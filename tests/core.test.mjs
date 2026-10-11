import test from 'node:test';
import assert from 'node:assert/strict';
import { render, extractPalette, validateSettings, makeRecipe, parseRecipe, seededRandom } from '../studio/core.mjs';
const image = (width, height, pixel) => ({ width, height, data: new Uint8ClampedArray(Array.from({ length: width * height }, (_, i) => pixel(i % width, Math.floor(i / width))).flat()) });
const gray = image(16, 16, (x) => [x * 17, x * 17, x * 17, 255]);
const bw = { columns: 16, palette: ['#000000', '#ffffff'] };
test('quantization maps endpoints and produces only the chosen palette', () => {
  for (const mode of ['pixels', 'dither', 'ascii']) for (const algorithm of ['bayer', 'floyd', 'atkinson']) {
    const r = render(gray, { ...bw, mode, algorithm });
    for (let i = 0; i < r.data.length; i += 4) { assert.ok([0, 255].includes(r.data[i])); assert.equal(r.data[i], r.data[i + 1]); }
    assert.equal(r.counts.reduce((a, b) => a + b), r.width * r.height);
  }
});
test('Bayer distributes middle gray evenly and repeats its 4 × 4 pattern', () => {
  const r = render(image(16, 16, () => [128, 128, 128, 255]), { ...bw, mode: 'dither', algorithm: 'bayer', strength: 1 });
  assert.deepEqual(r.counts, [128, 128]);
  assert.deepEqual([...r.data.slice(0, 16)], [...r.data.slice(16, 32)]);
});
test('diffusion conserves approximate gray coverage, and zero strength is quantization', () => {
  const flat = image(64, 32, () => [128, 128, 128, 255]);
  const r = render(flat, { ...bw, columns: 64, algorithm: 'floyd', strength: 1 });
  assert.ok(Math.abs(r.counts[1] / (64 * 32) - .5) < .02);
  for (const algorithm of ['bayer', 'floyd', 'atkinson']) assert.deepEqual(render(gray, { ...bw, algorithm, strength: 0 }).data, render(gray, { ...bw, mode: 'pixels' }).data);
});
test('alpha-aware downsampling avoids invisible red bleeding into blue', () => {
  const r = render(image(32, 16, x => x % 2 ? [0, 0, 255, 255] : [255, 0, 0, 0]), { ...bw, transparent: true, mode: 'pixels', palette: ['#ff0000', '#0000ff'] });
  assert.deepEqual([...r.data.slice(0, 4)], [0, 0, 255, 128]);
});
test('background compositing and fully transparent inputs are handled explicitly', () => {
  const transparent = image(16, 16, () => [255, 0, 0, 0]);
  assert.deepEqual([...render(transparent, { ...bw, background: '#ffffff' }).data.slice(0, 4)], [255, 255, 255, 255]);
  assert.equal(render(transparent, { ...bw, transparent: true }).counts.reduce((a, b) => a + b), 0);
  assert.deepEqual(extractPalette(transparent), ['#000000', '#ffffff']);
});
test('sample grid is bounded even for extreme portraits or landscapes', () => {
  for (const mode of ['pixels', 'ascii']) for (const im of [image(1, 1600, () => [0, 0, 0, 255]), image(1600, 1, () => [0, 0, 0, 255])]) {
    const r = render(im, { mode }); assert.ok(r.width > 0 && r.width <= 320 && r.height > 0 && r.height <= 384);
  }
});
test('same seed and recipe reproduce exactly, while noise can vary with seed', () => {
  const settings = { ...bw, noise: 30, seed: 11 };
  const recipe = parseRecipe(JSON.stringify(makeRecipe(settings, { kind: 'sample', id: 'terrain' })));
  assert.deepEqual(render(gray, settings).data, render(gray, recipe.settings).data);
  const flat = image(32, 32, () => [127, 127, 127, 255]);
  assert.notDeepEqual(render(flat, settings).data, render(flat, { ...settings, seed: 12 }).data);
  const a = seededRandom(0), b = seededRandom(0); assert.equal(a(), b());
});
test('palette extraction is deterministic, bounded and ignores hidden colors', () => {
  const im = image(16, 16, x => x < 8 ? [255, 0, 0, 255] : [0, 0, 255, 0]);
  assert.deepEqual(extractPalette(im, 2), ['#ff0000', '#ff0000']);
  assert.deepEqual(extractPalette(gray, 8), extractPalette(gray, 8));
  assert.equal(extractPalette(gray, 8).length, 8);
});
test('ASCII rows preserve grid shape; no randomized character selection', () => {
  const r = render(gray, { ...bw, mode: 'ascii', ramp: 'binary' });
  assert.equal(r.chars.length, 12); assert.ok(r.chars.every(s => s.length === 16 && /^[ 01]+$/.test(s)));
  assert.deepEqual(r.chars, render(gray, { ...bw, mode: 'ascii', ramp: 'binary' }).chars);
});
test('reject malformed recipes, invalid dimensions, and unbounded settings', () => {
  for (const v of [{ columns: 0 }, { scale: 100 }, { seed: -1 }, { contrast: NaN }, { noise: '3' }, { mode: 'video' }, { palette: ['red'] }, { unknown: true }, JSON.parse('{"__proto__":{}}')]) assert.throws(() => validateSettings(v));
  assert.throws(() => render({ width: 1601, height: 1, data: [] }));
  assert.throws(() => parseRecipe({ format: 'raster-lab', version: 2 }));
  assert.throws(() => makeRecipe({}, { kind: 'sample', id: '../secret' }));
  const file = { kind: 'file', name: 'example.png', width: 16, height: 16, sha256: 'a'.repeat(64) };
  assert.deepEqual(parseRecipe(JSON.stringify(makeRecipe({}, file))).source, file);
});
