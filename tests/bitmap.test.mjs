import test from 'node:test';
import assert from 'node:assert/strict';
import { render, makeRecipe, parseRecipe } from '../studio/core.mjs';
import { rasterize, exportSize, GLYPHS } from '../studio/bitmap.mjs';
import { EXAMPLES, createSample } from '../studio/samples.mjs';
test('gallery recipes reproduce the complete pixel output, including ASCII glyphs', () => {
  for (const example of EXAMPLES) {
    const source = createSample(example.id), a = rasterize(render(source, example.settings));
    const recipe = parseRecipe(JSON.stringify(makeRecipe(example.settings, { kind: 'sample', id: example.id })));
    const b = rasterize(render(createSample(recipe.source.id), recipe.settings));
    assert.deepEqual(a, b); assert.equal(a.data.length, a.width * a.height * 4);
  }
});
test('ASCII bitmap has known glyph geometry and preserves transparent background', () => {
  const result = { width: 1, height: 1, chars: ['1'], data: new Uint8ClampedArray([255, 0, 0, 128]), settings: { mode: 'ascii', colored: true, transparent: true, background: '#000000' } };
  const raster = rasterize(result);
  assert.deepEqual([raster.width, raster.height], [6, 8]);
  const visible = [...raster.data].filter((_, i) => i % 4 === 3 && raster.data[i] === 128).length;
  assert.equal(visible, GLYPHS['1'].split('').filter(v => v === '1').length);
  assert.equal(raster.data[3], 0); assert.equal(raster.data[2 * 4 + 3], 128);
});
test('PNG scaling is always integral and bounded, including wide ASCII output', () => {
  assert.deepEqual(exportSize(128, 96, 4), { width: 512, height: 384, scale: 4 });
  assert.deepEqual(exportSize(1920, 1440, 8), { width: 3840, height: 2880, scale: 2 });
  assert.deepEqual(exportSize(6, 3072, 8), { width: 6, height: 3072, scale: 1 });
});
