// Hand-authored 5 × 7 glyphs, with one-column/one-row spacing. No system font dependency.
import { RAMPS } from './core.mjs';
const patterns = {
  ' ': '00000/00000/00000/00000/00000/00000/00000',
  '.': '00000/00000/00000/00000/00000/00100/00100',
  ':': '00000/00100/00100/00000/00100/00100/00000',
  '-': '00000/00000/00000/11111/00000/00000/00000',
  '=': '00000/00000/11111/00000/11111/00000/00000',
  '+': '00000/00100/00100/11111/00100/00100/00000',
  '*': '00000/10101/01110/11111/01110/10101/00000',
  '#': '01010/01010/11111/01010/11111/01010/01010',
  '%': '11001/11010/00010/00100/01000/01011/10011',
  '@': '01110/10001/10111/10101/10111/10000/01111',
  '0': '01110/10001/10011/10101/11001/10001/01110',
  '1': '00100/01100/00100/00100/00100/00100/01110',
  '2': '01110/10001/00001/00010/00100/01000/11111',
  '3': '11110/00001/00001/01110/00001/00001/11110',
  '4': '00010/00110/01010/10010/11111/00010/00010',
  '5': '11111/10000/10000/11110/00001/00001/11110',
  '6': '01110/10000/10000/11110/10001/10001/01110',
  '7': '11111/00001/00010/00100/01000/01000/01000',
  '8': '01110/10001/10001/01110/10001/10001/01110',
  '9': '01110/10001/10001/01111/00001/00001/01110',
  'i': '00100/00000/01100/00100/00100/00100/01110',
  'l': '01100/00100/00100/00100/00100/00100/01110',
  'o': '00000/00000/01110/10001/10001/10001/01110',
  'x': '00000/00000/10001/01010/00100/01010/10001',
  'O': '01110/10001/10001/10001/10001/10001/01110',
  'X': '10001/10001/01010/00100/01010/10001/10001',
  'M': '10001/11011/10101/10101/10001/10001/10001',
  'W': '10001/10001/10001/10101/10101/11011/10001',
};
export const GLYPHS = Object.fromEntries(Object.entries(patterns).map(([k, v]) => [k, v.split('/').join('')]));
for (const char of Object.values(RAMPS).join('')) if (!GLYPHS[char]) throw new Error(`Missing glyph: ${char}`);
export function rasterize(result) {
  if (result.settings.mode !== 'ascii') return { width: result.width, height: result.height, data: result.data };
  const width = result.width * 6, height = result.height * 8, data = new Uint8ClampedArray(width * height * 4);
  const bg = [1, 3, 5].map(k => parseInt(result.settings.background.slice(k, k + 2), 16));
  if (!result.settings.transparent) for (let i = 0; i < data.length; i += 4) data.set([...bg, 255], i);
  for (let y = 0; y < result.height; y++) for (let x = 0; x < result.width; x++) {
    const p = (y * result.width + x) * 4, glyph = GLYPHS[result.chars[y][x]];
    const color = result.settings.colored ? result.data.slice(p, p + 3) : [241, 237, 223];
    for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) if (glyph[gy * 5 + gx] === '1') {
      const q = ((y * 8 + gy) * width + x * 6 + gx) * 4;
      data.set(color, q); data[q + 3] = result.data[p + 3];
    }
  }
  return { width, height, data };
}
export function exportSize(width, height, requestedScale) {
  const scale = Math.max(1, Math.min(requestedScale, Math.floor(4096 / Math.max(width, height))));
  return { width: width * scale, height: height * scale, scale };
}
