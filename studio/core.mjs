// Pure RGBA processing. Shared by the browser worker and Node tests.
export const ENGINE = 'raster-lab/1';
export const PALETTES = {
  moss: ['#142822', '#365847', '#7d9970', '#dce5bb'],
  ink: ['#17202b', '#f1eddf'],
  ember: ['#201e32', '#69415a', '#c36a62', '#eca778', '#f5dfbb'],
  electric: ['#171b35', '#3b4279', '#447d98', '#81c8be', '#f3e8cf', '#ed8d77'],
};
export const RAMPS = { standard: ' .:-=+*#%@', binary: ' 01', numbers: ' 123456789', letters: ' .iloxOXMW', minimal: ' .X' };
export const DEFAULTS = Object.freeze({ mode: 'dither', columns: 128, algorithm: 'bayer', strength: 0.65,
  brightness: 1, contrast: 1, saturation: 1, noise: 0, seed: 42,
  palette: PALETTES.moss, ramp: 'standard', colored: true, transparent: false, background: '#142822', scale: 4 });
const clamp = (v, a = 0, b = 255) => Math.max(a, Math.min(b, v));
const hex = v => Math.round(v).toString(16).padStart(2, '0');
const rgb = color => [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
const luminance = p => p[0] * .2126 + p[1] * .7152 + p[2] * .0722;
const plain = v => v && typeof v === 'object' && !Array.isArray(v);

export function validateSettings(input = {}) {
  if (!plain(input)) throw new Error('Settings must be an object.');
  for (const key of Object.keys(input)) if (!(key in DEFAULTS) || !Object.hasOwn(DEFAULTS, key)) throw new Error(`Unknown setting: ${key}`);
  const s = { ...DEFAULTS, ...input, palette: [...(input.palette ?? DEFAULTS.palette)] };
  for (const [key, values] of Object.entries({ mode: ['pixels', 'dither', 'ascii'], algorithm: ['bayer', 'floyd', 'atkinson'], ramp: Object.keys(RAMPS) })) {
    if (!values.includes(s[key])) throw new Error(`Invalid ${key}.`);
  }
  for (const [key, min, max, integer] of [['columns', 16, 320, true], ['strength', 0, 1], ['brightness', 0, 2], ['contrast', 0, 2], ['saturation', 0, 2], ['noise', 0, 30], ['seed', 0, 4294967295, true], ['scale', 1, 8, true]]) {
    if (typeof s[key] !== 'number' || !Number.isFinite(s[key]) || s[key] < min || s[key] > max || (integer && !Number.isInteger(s[key]))) throw new Error(`${key} must be ${integer ? 'an integer' : 'a number'} from ${min} to ${max}.`);
  }
  for (const key of ['colored', 'transparent']) if (typeof s[key] !== 'boolean') throw new Error(`Invalid ${key}.`);
  if (!Array.isArray(s.palette) || s.palette.length < 2 || s.palette.length > 16 || ![...s.palette, s.background].every(c => typeof c === 'string' && /^#[\da-f]{6}$/i.test(c))) throw new Error('Use 2–16 six-digit hex palette colors and a valid background.');
  return s;
}

export function makeRecipe(settings, source) {
  return parseRecipe({ format: 'raster-lab', version: 1, engine: ENGINE, settings: validateSettings(settings), source });
}
export function parseRecipe(value) {
  const r = typeof value === 'string' ? JSON.parse(value) : value;
  if (!plain(r) || r.format !== 'raster-lab' || r.version !== 1 || r.engine !== ENGINE) throw new Error('This is not a supported Image to Pixels v1 recipe.');
  const s = r.source;
  if (!plain(s) || !['sample', 'file'].includes(s.kind)) throw new Error('Recipe source is missing.');
  let source;
  if (s.kind === 'sample') {
    if (!['terrain', 'still-life', 'signal'].includes(s.id)) throw new Error('Unknown sample in recipe.');
    source = { kind: 'sample', id: s.id };
  } else {
    if (typeof s.name !== 'string' || s.name.length > 255 || !/^[a-f0-9]{64}$/.test(s.sha256) || ![s.width, s.height].every(n => Number.isInteger(n) && n > 0 && n <= 1600)) throw new Error('Invalid image identity in recipe.');
    source = { kind: 'file', name: s.name, width: s.width, height: s.height, sha256: s.sha256 };
  }
  return { format: 'raster-lab', version: 1, engine: ENGINE, source, settings: validateSettings(r.settings) };
}

export function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function validateImage(image) {
  if (!image || ![image.width, image.height].every(v => Number.isInteger(v) && v > 0 && v <= 1600) || image.data?.length !== image.width * image.height * 4) throw new Error('Expected an RGBA image up to 1600 × 1600.');
}
export function gridSize(image, settings) {
  let width = settings.columns;
  let height = Math.max(1, Math.round(width * image.height / image.width * (settings.mode === 'ascii' ? 6 / 8 : 1)));
  if (height > 384) { width = Math.max(1, Math.round(width * 384 / height)); height = 384; }
  return { width, height };
}
function sample(image, width, height, settings) {
  const out = new Float32Array(width * height * 4), random = seededRandom(settings.seed), bg = rgb(settings.background);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const x0 = Math.floor(x * image.width / width), x1 = Math.min(image.width, Math.max(x0 + 1, Math.floor((x + 1) * image.width / width)));
    const y0 = Math.floor(y * image.height / height), y1 = Math.min(image.height, Math.max(y0 + 1, Math.floor((y + 1) * image.height / height)));
    const sum = [0, 0, 0]; let alpha = 0;
    for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
      const p = (sy * image.width + sx) * 4, a = image.data[p + 3] / 255;
      alpha += a;
      for (let k = 0; k < 3; k++) sum[k] += image.data[p + k] * a;
    }
    const a = alpha / ((x1 - x0) * (y1 - y0));
    const color = sum.map((v, k) => settings.transparent ? (alpha ? v / alpha : 0) : v / ((x1 - x0) * (y1 - y0)) + bg[k] * (1 - a));
    const lum = luminance(color), noise = (random() - .5) * 2 * settings.noise, pos = (y * width + x) * 4;
    for (let k = 0; k < 3; k++) out[pos + k] = clamp(((lum + (color[k] - lum) * settings.saturation) * settings.brightness - 127.5) * settings.contrast + 127.5 + noise);
    out[pos + 3] = settings.transparent ? a * 255 : 255;
  }
  return out;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function nearest(pixel, palette) {
  let best = 0, distance = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = (pixel[0] - palette[i][0]) ** 2 * .2126 + (pixel[1] - palette[i][1]) ** 2 * .7152 + (pixel[2] - palette[i][2]) ** 2 * .0722;
    if (d < distance) { best = i; distance = d; }
  }
  return best;
}
export function render(image, options = {}) {
  validateImage(image);
  const settings = validateSettings(options), { width, height } = gridSize(image, settings);
  const work = sample(image, width, height, settings), data = new Uint8ClampedArray(work.length);
  const palette = settings.palette.map(rgb), chars = [], counts = new Array(palette.length).fill(0);
  const spread = settings.algorithm === 'floyd' ? [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]] : [[1, 0, 1 / 8], [2, 0, 1 / 8], [-1, 1, 1 / 8], [0, 1, 1 / 8], [1, 1, 1 / 8], [0, 2, 1 / 8]];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4, pixel = [work[p], work[p + 1], work[p + 2]];
      const offset = settings.mode === 'dither' && settings.algorithm === 'bayer' ? ((BAYER[(y % 4) * 4 + x % 4] + .5) / 16 - .5) * 255 * settings.strength : 0;
      const index = nearest(pixel.map(v => clamp(v + offset)), palette), chosen = palette[index];
      data.set(chosen, p); data[p + 3] = work[p + 3];
      if (data[p + 3]) counts[index]++;
      if (settings.mode === 'ascii') {
        const ramp = RAMPS[settings.ramp];
        row += data[p + 3] ? ramp[Math.round(clamp(luminance(pixel)) / 255 * (ramp.length - 1))] : ' ';
      }
      if (settings.mode === 'dither' && settings.algorithm !== 'bayer' && data[p + 3]) {
        for (const [dx, dy, weight] of spread) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny >= height) continue;
          const q = (ny * width + nx) * 4;
          if (!work[q + 3]) continue;
          for (let k = 0; k < 3; k++) work[q + k] += (pixel[k] - chosen[k]) * weight * settings.strength;
        }
      }
    }
    if (settings.mode === 'ascii') chars.push(row);
  }
  return { data, width, height, chars, counts, settings };
}

// Deterministic weighted median cut on a bounded, quantized sample of the source.
export function extractPalette(image, count = 8) {
  validateImage(image);
  if (!Number.isInteger(count) || count < 2 || count > 16) throw new Error('Palette size must be 2–16.');
  const bins = new Map(), stride = Math.max(1, Math.floor(image.width * image.height / 16384));
  for (let p = 0; p < image.data.length; p += stride * 4) {
    if (image.data[p + 3] < 16) continue;
    const color = [...image.data.slice(p, p + 3)], key = color.map(c => c >> 3).join(',');
    const bin = bins.get(key) ?? { sums: [0, 0, 0], weight: 0 };
    const a = image.data[p + 3] / 255;
    for (let k = 0; k < 3; k++) bin.sums[k] += color[k] * a;
    bin.weight += a; bins.set(key, bin);
  }
  if (!bins.size) return ['#000000', '#ffffff'];
  let boxes = [[...bins.values()].map(b => ({ color: b.sums.map(v => v / b.weight), weight: b.weight }))];
  const range = box => [0, 1, 2].map(k => { let lo = 255, hi = 0; for (const b of box) { lo = Math.min(lo, b.color[k]); hi = Math.max(hi, b.color[k]); } return hi - lo; });
  while (boxes.length < count) {
    const splittable = boxes.map((b, i) => ({ i, score: b.length > 1 ? Math.max(...range(b)) * b.reduce((n, v) => n + v.weight, 0) : -1 })).sort((a, b) => b.score - a.score)[0];
    if (splittable.score < 0) break;
    const box = boxes[splittable.i], ranges = range(box), channel = ranges.indexOf(Math.max(...ranges));
    box.sort((a, b) => a.color[channel] - b.color[channel]);
    const total = box.reduce((n, v) => n + v.weight, 0); let acc = 0, cut = 1;
    for (let i = 0; i < box.length - 1; i++) { acc += box[i].weight; cut = i + 1; if (acc >= total / 2) break; }
    boxes.splice(splittable.i, 1, box.slice(0, cut), box.slice(cut));
  }
  const colors = boxes.map(box => {
    const weight = box.reduce((n, b) => n + b.weight, 0);
    return [0, 1, 2].map(k => box.reduce((n, b) => n + b.color[k] * b.weight, 0) / weight);
  }).sort((a, b) => luminance(a) - luminance(b)).map(c => '#' + c.map(hex).join(''));
  if (colors.length === 1) colors.push(colors[0]);
  return colors;
}
