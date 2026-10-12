import { PALETTES } from './core.mjs';
export const EXAMPLES = [
  { id: 'terrain', title: '01 / Contours', note: 'Bayer · 4 colors', settings: { mode: 'dither', algorithm: 'bayer', columns: 128, palette: PALETTES.moss, strength: .65 } },
  { id: 'still-life', title: '02 / Still life', note: 'Pixels · 5 colors', settings: { mode: 'pixels', columns: 80, palette: PALETTES.ember, background: '#201e32' } },
  { id: 'signal', title: '03 / Signal', note: 'ASCII · monochrome', settings: { mode: 'ascii', columns: 96, palette: PALETTES.ink, colored: false, background: '#17202b' } },
];
// Original procedural fixtures. Fixed math, no downloads, photos or external licenses.
export function createSample(id) {
  if (!EXAMPLES.some(e => e.id === id)) throw new Error('Unknown example.');
  const width = 640, height = 480, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height; let c;
    if (id === 'terrain') {
      c = [230 - v * 85, 205 - v * 36, 165 + v * 15];
      if ((u - .74) ** 2 + ((v - .25) * .75) ** 2 < .006) c = [249, 234, 183];
      const ridges = [
        [.40 + .09 * Math.sin(u * 11) + .05 * Math.cos(u * 23), [143, 160, 151]],
        [.57 + .09 * Math.sin(u * 8 + 2) + .04 * Math.cos(u * 17), [84, 128, 119]],
        [.73 + .07 * Math.sin(u * 10) + .04 * Math.cos(u * 21 + 2), [39, 81, 76]],
        [.89 + .07 * Math.sin(u * 7 + 2), [20, 47, 45]],
      ];
      for (const [edge, color] of ridges) if (v > edge) c = color.map(a => a + (v - edge) * 25 + Math.sin(u * 85 + v * 40) * 3);
    } else if (id === 'still-life') {
      c = v > .73 ? [105 + u * 30, 76 + u * 15, 78] : [40 + u * 50, 36 + v * 38, 57 + u * 10];
      if (((u - .5) / .34) ** 2 + ((v - .79) / .06) ** 2 < 1) c = [47, 32, 44];
      if (u > .24 && u < .43 && v > .34 && v < .78) c = [130 + Math.sin((u - .24) / .19 * Math.PI) * 90, 83 + (1 - v) * 80, 76 + (1 - v) * 60];
      if (u > .285 && u < .385 && v > .19 && v <= .34) c = [170, 119, 103];
      const dx = (u - .62) / .145, dy = (v - .635) / .193, r = dx * dx + dy * dy;
      if (r < 1) { const shade = Math.max(0, .6 + (-dx - dy) * .24) * Math.sqrt(1 - r); c = [138 + 108 * shade, 57 + 120 * shade, 61 + 61 * shade]; }
      if (u > .61 && u < .625 && v > .42 && v < .47) c = [79, 103, 76];
    } else {
      const r = Math.hypot((u - .5) * 1.33, v - .46);
      const wave = Math.cos(r * 57) * .5 + .5;
      c = [45 + wave * 180, 78 + wave * 150, 92 + wave * 122];
      if (u > .12 && u < .27 && v > .18 && v < .76) c = [234, 161 + v * 65, 125];
      if (v > .86) c = [u * 255, u * 255, u * 255];
    }
    const p = (y * width + x) * 4; data.set(c, p); data[p + 3] = 255;
  }
  return { width, height, data };
}
