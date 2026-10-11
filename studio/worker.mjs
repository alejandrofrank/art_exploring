import { render, extractPalette } from './core.mjs';
self.onmessage = ({ data: { image, settings, extract } }) => {
  try {
    const started = performance.now();
    const result = extract ? { palette: extractPalette(image, extract) } : render(image, settings);
    self.postMessage({ result, elapsed: performance.now() - started }, result.data ? [result.data.buffer] : []);
  } catch (error) { self.postMessage({ error: error.message }); }
};
