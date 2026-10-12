import { DEFAULTS, PALETTES, validateSettings, render, makeRecipe, parseRecipe } from './core.mjs';
import { rasterize, exportSize } from './bitmap.mjs';
import { EXAMPLES, createSample } from './samples.mjs';
const $ = id => document.getElementById(id);
let settings = validateSettings(), source, identity, result, bitmap, snapshot, worker, timer, loadId = 0, pendingIdentity;
let rendering = false;
const methods = {
  pixels: 'Average each region, then map it to the nearest palette color. Grid size controls the detail.',
  bayer: 'A repeating 4 × 4 threshold pattern gives smooth areas a structured texture.',
  floyd: 'Carry quantization error into neighboring pixels. Often retains smoother gradients.',
  atkinson: 'Spread 75% of the error across six neighbors. Creates a sharper, more graphic result.',
  ascii: 'Map brightness to a character; map its color to the palette. The grid compensates for glyph proportions.',
};
function notify(message = '', error = false) {
  $('notice').hidden = !message; $('notice').textContent = message; $('notice').dataset.error = String(error);
}
function paint(canvas, raster) {
  canvas.width = raster.width; canvas.height = raster.height;
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height), 0, 0);
}
function updateControls() {
  for (const key of ['columns', 'algorithm', 'strength', 'ramp', 'brightness', 'contrast', 'saturation', 'noise', 'seed', 'background', 'scale']) {
    $(key).value = settings[key]; if ($(`${key}-value`)) $(`${key}-value`).textContent = settings[key];
  }
  for (const key of ['colored', 'transparent']) $(key).checked = settings[key];
  for (const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === settings.mode));
  $('dither-controls').hidden = settings.mode !== 'dither'; $('ascii-controls').hidden = settings.mode !== 'ascii';
  $('method-note').textContent = methods[settings.mode === 'dither' ? settings.algorithm : settings.mode];
  $('palette-preset').value = Object.keys(PALETTES).find(k => JSON.stringify(PALETTES[k]) === JSON.stringify(settings.palette)) ?? 'custom';
  $('export-text').hidden = settings.mode !== 'ascii';
  drawPalette();
}
function drawPalette() {
  $('palette-editor').replaceChildren();
  settings.palette.forEach((color, i) => {
    const slot = document.createElement('div'); slot.className = 'color-slot';
    const input = document.createElement('input'); input.type = 'color'; input.value = color; input.setAttribute('aria-label', `Palette color ${i + 1}`);
    const code = document.createElement('code'); code.textContent = color;
    input.addEventListener('input', () => { settings.palette[i] = input.value; code.textContent = input.value; $('palette-preset').value = 'custom'; schedule(); });
    const remove = document.createElement('button'); remove.textContent = '×'; remove.setAttribute('aria-label', `Remove palette color ${i + 1}`); remove.disabled = settings.palette.length <= 2;
    remove.addEventListener('click', () => { settings.palette.splice(i, 1); updateControls(); schedule(); });
    slot.append(input, code, remove); $('palette-editor').append(slot);
  });
  $('palette-count').textContent = `${settings.palette.length} colors`; $('add-color').disabled = settings.palette.length >= 16;
}
function setBusy(value) {
  rendering = value;
  for (const id of ['snapshot', 'export-png', 'save-recipe', 'export-text']) $(id).disabled = value || !result;
  $('render-state').textContent = value ? 'Rendering…' : 'Ready';
  $('output-viewport').setAttribute('aria-busy', String(value));
}
function schedule() {
  clearTimeout(timer); worker?.terminate(); worker = null;
  if (!source) return;
  setBusy(true); timer = setTimeout(run, 90);
}
function run() {
  try {
    settings = validateSettings(settings);
    const current = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' }); worker = current;
    current.onmessage = ({ data }) => {
      if (worker !== current) return;
      current.terminate(); worker = null;
      if (data.error) return fail(data.error);
      result = data.result; bitmap = rasterize(result); paint($('output-canvas'), bitmap);
      $('output-label').textContent = `B / ${settings.mode.toUpperCase()}`;
      $('output-canvas').setAttribute('aria-label', `${settings.mode} treatment, ${result.width} by ${result.height} cells`);
      $('grid-info').textContent = `${result.width} × ${result.height} ${settings.mode === 'ascii' ? 'characters' : 'cells'} · ${settings.mode === 'ascii' && !settings.colored ? 'monochrome glyphs' : `${result.counts.filter(n => n > 0).length}/${settings.palette.length} palette colors assigned`}`;
      $('timing').textContent = `${data.elapsed.toFixed(1)} ms processing · on this device`;
      $('usage').replaceChildren();
      const total = result.counts.reduce((a, b) => a + b, 0);
      result.counts.forEach((n, i) => {
        if (!n) return; const span = document.createElement('span'); span.style.background = settings.palette[i]; span.style.flexGrow = n;
        span.title = `${settings.palette[i]} · ${(n / total * 100).toFixed(1)}% of visible cells`; $('usage').append(span);
      });
      $('usage').hidden = settings.mode === 'ascii' && !settings.colored;
      $('usage').setAttribute('aria-label', total ? `Palette assignments across ${total} visible cells` : 'No visible cells');
      setBusy(false); updateView(); updateExport();
    };
    current.onerror = () => { if (worker === current) { current.terminate(); worker = null; fail('The image worker stopped. Try a smaller image or reload the page.'); } };
    current.postMessage({ image: source, settings });
  } catch (e) { fail(e.message); }
}
function fail(message) {
  setBusy(false); result = null;
  for (const id of ['snapshot', 'export-png', 'save-recipe', 'export-text']) $(id).disabled = true;
  $('render-state').textContent = 'Error'; notify(message, true);
}
function updateReference() {
  const frozen = $('reference').value === 'snapshot' && snapshot;
  if (!source) return;
  paint($('reference-canvas'), frozen ? snapshot.bitmap : source);
  $('reference-label').textContent = frozen ? `A / ${snapshot.settings.mode.toUpperCase()}` : 'SOURCE';
  $('reference-meta').textContent = frozen ? `${snapshot.grid} · frozen` : `${source.width} × ${source.height}`;
  $('reference-canvas').setAttribute('aria-label', frozen ? 'Frozen treatment A' : 'Original image'); updateView();
}
function updateView() {
  const zoom = $('zoom').value;
  for (const prefix of ['reference', 'output']) {
    const viewport = $(`${prefix}-viewport`), canvas = $(`${prefix}-canvas`);
    if (zoom === 'fit') { delete viewport.dataset.zoom; canvas.style.width = ''; canvas.style.height = ''; }
    else { viewport.dataset.zoom = zoom; canvas.style.width = `${canvas.width * Number(zoom)}px`; canvas.style.height = `${canvas.height * Number(zoom)}px`; }
  }
}
function updateExport() {
  if (!bitmap) return;
  const size = exportSize(bitmap.width, bitmap.height, settings.scale);
  $('export-size').textContent = `${size.width} × ${size.height} px${size.scale < settings.scale ? ` · capped at ${size.scale}×` : ''}`;
}
function setSource(image, info) {
  source = image; identity = info; snapshot = null;
  $('reference').value = 'original'; $('reference').querySelector('[value=snapshot]').disabled = true;
  $('source-info').textContent = `${info.kind === 'sample' ? EXAMPLES.find(e => e.id === info.id).title : info.name} · ${image.width} × ${image.height}`;
  for (const button of document.querySelectorAll('[data-example]')) button.setAttribute('aria-pressed', String(info.kind === 'sample' && button.dataset.example === info.id));
  updateReference(); schedule();
}
function openExample(example) {
  loadId++; pendingIdentity = null; notify(); settings = validateSettings({ ...DEFAULTS, ...example.settings });
  updateControls(); setSource(createSample(example.id), { kind: 'sample', id: example.id });
}
async function openImage(file) {
  if (!file) return;
  const token = ++loadId;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return notify('Choose a PNG, JPEG or WebP image.', true);
  if (file.size > 20 * 1024 * 1024) return notify('Choose an image smaller than 20 MB.', true);
  notify('Opening image locally…');
  try {
    const decoded = await createImageBitmap(file);
    if (token !== loadId) { decoded.close(); return; }
    const ratio = Math.min(1, 1600 / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(decoded.width * ratio)); canvas.height = Math.max(1, Math.round(decoded.height * ratio));
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(decoded, 0, 0, canvas.width, canvas.height); decoded.close();
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hash = await crypto.subtle.digest('SHA-256', data.data);
    if (token !== loadId) return;
    const sha256 = [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
    const info = { kind: 'file', name: file.name.slice(0, 255), width: canvas.width, height: canvas.height, sha256 };
    setSource(data, info);
    if (pendingIdentity && (pendingIdentity.sha256 !== sha256 || pendingIdentity.width !== canvas.width || pendingIdentity.height !== canvas.height)) notify(`Recipe settings applied, but this is a different image. Reopen “${pendingIdentity.name}” to reproduce the saved result.`);
    else { pendingIdentity = null; notify(ratio < 1 ? 'Image normalized to 1600 px on its longest edge. Processing and exports use this resolution.' : 'Image opened locally. Nothing was uploaded.'); }
  } catch { if (token === loadId) notify('This image could not be decoded. Try another PNG, JPEG or WebP.', true); }
}
function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
const stem = () => `${identity.kind === 'sample' ? identity.id : identity.name.replace(/\.[^.]+$/, '')}-${settings.mode}`.replace(/[^\w.-]+/g, '-').slice(0, 100);
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => { settings.mode = button.dataset.mode; updateControls(); schedule(); });
for (const key of ['columns', 'strength', 'brightness', 'contrast', 'saturation', 'noise']) $(key).addEventListener('input', () => { settings[key] = Number($(key).value); $(`${key}-value`).textContent = settings[key]; schedule(); });
for (const key of ['algorithm', 'ramp', 'background']) $(key).addEventListener('change', () => { settings[key] = $(key).value; updateControls(); schedule(); });
for (const key of ['colored', 'transparent']) $(key).addEventListener('change', () => { settings[key] = $(key).checked; schedule(); });
$('seed').addEventListener('change', () => {
  const value = Number($('seed').value);
  if (!Number.isInteger(value) || value < 0 || value > 4294967295) { $('seed').value = settings.seed; return notify('Seed must be a whole number from 0 to 4294967295.', true); }
  settings.seed = value; notify(); schedule();
});
$('palette-preset').addEventListener('change', () => { if (PALETTES[$('palette-preset').value]) { settings.palette = [...PALETTES[$('palette-preset').value]]; updateControls(); schedule(); } });
$('add-color').addEventListener('click', () => { if (settings.palette.length < 16) { settings.palette.push('#ffffff'); updateControls(); schedule(); } });
$('extract').addEventListener('click', () => {
  if (!source) return;
  clearTimeout(timer); worker?.terminate(); setBusy(true);
  const current = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' }); worker = current;
  current.onmessage = ({ data }) => {
    if (worker !== current) return; current.terminate(); worker = null;
    if (data.error) return fail(data.error);
    settings.palette = data.result.palette; updateControls(); schedule();
  };
  current.onerror = () => { if (worker === current) { current.terminate(); worker = null; fail('Palette extraction failed. Reload and try again.'); } };
  current.postMessage({ image: source, extract: Number($('extract-count').value) });
});
$('reset').addEventListener('click', () => { settings = validateSettings(); pendingIdentity = null; notify(); updateControls(); schedule(); });
$('reference').addEventListener('change', updateReference); $('zoom').addEventListener('change', updateView);
$('snapshot').addEventListener('click', () => {
  if (!result || rendering) return;
  snapshot = { bitmap: { ...bitmap, data: new Uint8ClampedArray(bitmap.data) }, settings: structuredClone(settings), grid: `${result.width} × ${result.height}` };
  $('reference').querySelector('[value=snapshot]').disabled = false; $('reference').value = 'snapshot'; updateReference();
});
let syncing = false;
for (const [from, to] of [['reference', 'output'], ['output', 'reference']]) $(`${from}-viewport`).addEventListener('scroll', () => {
  if (syncing || $('zoom').value === 'fit') return;
  syncing = true;
  const a = $(`${from}-viewport`), b = $(`${to}-viewport`);
  b.scrollLeft = a.scrollLeft / Math.max(1, a.scrollWidth - a.clientWidth) * Math.max(0, b.scrollWidth - b.clientWidth);
  b.scrollTop = a.scrollTop / Math.max(1, a.scrollHeight - a.clientHeight) * Math.max(0, b.scrollHeight - b.clientHeight);
  requestAnimationFrame(() => { syncing = false; });
});
$('scale').addEventListener('change', () => { settings.scale = Number($('scale').value); updateExport(); });
$('export-png').addEventListener('click', () => {
  if (!bitmap || rendering) return;
  const size = exportSize(bitmap.width, bitmap.height, settings.scale), canvas = document.createElement('canvas');
  canvas.width = size.width; canvas.height = size.height; const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.drawImage($('output-canvas'), 0, 0, canvas.width, canvas.height);
  const name = `${stem()}.png`;
  canvas.toBlob(blob => { if (blob) { download(blob, name); notify(`PNG ready: ${canvas.width} × ${canvas.height} px. Check your downloads.`); } else notify('PNG export failed. Try a smaller scale.', true); }, 'image/png');
});
$('export-text').addEventListener('click', () => { if (result && !rendering) download(new Blob([result.chars.join('\n') + '\n'], { type: 'text/plain' }), `${stem()}.txt`); });
$('save-recipe').addEventListener('click', () => {
  if (!result || rendering) return;
  download(new Blob([JSON.stringify(makeRecipe(settings, identity), null, 2) + '\n'], { type: 'application/json' }), `${stem()}.raster.json`);
  notify('Recipe saved. It contains settings and image identity; your image is not included.');
});
$('open-image').addEventListener('click', () => $('image-file').click());
$('image-file').addEventListener('change', () => { openImage($('image-file').files[0]); $('image-file').value = ''; });
$('load-recipe').addEventListener('click', () => $('recipe-file').click());
$('recipe-file').addEventListener('change', async () => {
  const file = $('recipe-file').files[0]; $('recipe-file').value = ''; if (!file) return;
  const token = ++loadId;
  try {
    if (file.size > 32768) throw new Error('Recipe files must be smaller than 32 KB.');
    const recipe = parseRecipe(await file.text()); if (token !== loadId) return;
    settings = recipe.settings; updateControls();
    if (recipe.source.kind === 'sample') { pendingIdentity = null; setSource(createSample(recipe.source.id), recipe.source); notify('Sample and recipe restored.'); }
    else {
      pendingIdentity = recipe.source; schedule();
      const match = identity?.sha256 === recipe.source.sha256 && identity?.width === recipe.source.width && identity?.height === recipe.source.height;
      notify(match ? 'Recipe restored. Source image fingerprint matches.' : `Recipe settings loaded. Open “${recipe.source.name}” to reproduce it. The current image is a different source.`);
      if (match) pendingIdentity = null;
    }
  } catch (e) { if (token === loadId) notify(`Could not load recipe: ${e.message}`, true); }
});
let dragDepth = 0;
document.addEventListener('dragenter', event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepth++; document.body.classList.add('dragging'); } });
document.addEventListener('dragover', event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
document.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging'); if (event.dataTransfer.files.length) openImage(event.dataTransfer.files[0]); });
for (const example of EXAMPLES) {
  const button = document.createElement('button'); button.className = 'example'; button.dataset.example = example.id; button.setAttribute('aria-pressed', 'false');
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
  paint(canvas, rasterize(render(createSample(example.id), { ...DEFAULTS, ...example.settings, columns: 64 })));
  const title = document.createElement('strong'); title.textContent = example.title;
  const note = document.createElement('span'); note.textContent = example.note; button.append(canvas, title, note);
  button.addEventListener('click', () => openExample(example)); $('example-list').append(button);
}
openExample(EXAMPLES[0]);
