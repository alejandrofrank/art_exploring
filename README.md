# Raster Lab

A browser workbench for exploring how an image changes when represented with pixels, a limited palette, dithering or characters. Evolved from the Python ASCII experiments in this repository.

**[Open the live lab](https://raster-lab.alejandrofranks.workers.dev)** · [Processing core](studio/core.mjs) · [Tests](tests)

Open a built-in experiment or your own image, keep a treatment as **A**, then change **B**. Export the result as PNG and save its recipe to reproduce it later. Image processing runs on your device; the app has no upload endpoint, account, analytics or external image dependencies.

## What you can explore

| Mode | Controls | Useful for |
| --- | --- | --- |
| Pixels | Grid resolution, palette, image adjustments | Reducing an image to its shapes and color blocks |
| Dither | Bayer 4 × 4, Floyd–Steinberg, Atkinson; strength | Comparing ordered patterns with error diffusion |
| ASCII | Five explicit character sets, color or monochrome | Representing brightness with fixed bitmap glyphs |

Shared tools: brightness, contrast, saturation, optional seeded grain, editable 2–16-color palettes, four palette presets, median-cut palette extraction, alpha preservation or matte compositing, original/A/B comparison, synchronized scrolling at 1:1/2×/4×, PNG export at integer scale, ASCII text export, JSON recipe import/export. The three procedural gallery samples open both the source and its recipe.

## Run locally

Requires Node.js 22 or newer. The studio has **no npm dependencies and no build step**.

```sh
git clone https://github.com/alejandrofrank/art_exploring.git
cd art_exploring
npm run dev
```

Open the address printed by the server (default `http://127.0.0.1:4314`). Set `PORT` if that port is in use. Serve `studio/` over HTTP rather than opening `index.html` directly: module workers require a web origin.

```sh
npm test
```

## How the renderer works

1. **Sample.** Average source regions into a bounded grid, premultiplying by alpha so invisible colors do not bleed into visible pixels. ASCII compensates for its 6 × 8 cell proportions.
2. **Adjust.** Apply saturation, brightness and contrast, then optional seeded grain. The original image stays unchanged.
3. **Represent.** Choose nearest palette colors with weighted RGB distance. Ordered dithering offsets the threshold; diffusion carries error forward. ASCII chooses characters from brightness and paints hand-authored 5 × 7 glyphs.
4. **Export.** Preview and PNG share the same RGBA buffer. Export scaling uses integer nearest-neighbor enlargement, preserving the pixel grid.

`studio/core.mjs` is pure JavaScript shared by Node tests and a browser worker. New requests terminate superseded workers so stale renders cannot replace the current treatment. `bitmap.mjs` supplies fixed glyphs; PNG appearance does not depend on installed fonts. `samples.mjs` generates original fixtures without downloads. Render timing reports actual worker processing on the current device, excluding decode, startup and painting.

Palette usage describes grid-cell color assignments, not final PNG color frequencies (ASCII backgrounds and monochrome glyphs can add other colors). Nearest-color matching operates on encoded RGB, not a perceptually uniform color space. This is an inspectable creative tool, not a color-proofing application.

## Recipes and reproducibility

Recipes record the format version, renderer version, every setting, exact palette and grain seed. Bundled samples have stable IDs. User images are identified by dimensions and a SHA-256 fingerprint of the decoded, normalized RGBA data; **the image itself is not included**. Reopen the source file after importing its recipe. A mismatch is shown explicitly.

Given the same normalized pixels, engine version and settings, the core produces the same pixels. Browser image decoding/color management and resizing can differ; the fingerprint catches these differences. Recipes do not store the frozen comparison pane. ASCII `.txt` exports contain the character grid, while the bitmap PNG is the portable visual result.

Bounds: PNG/JPEG/WebP input up to 20 MB, normalized to 1600 px on the longest edge; 16–320 requested columns and at most 384 rows; 2–16 palette colors; output capped at 4096 px per edge with integer scale; recipes up to 32 KB. Tall images may use fewer columns to stay within the grid limit. No video, animation, layers or regional painting in v1.

## Original Python converter

The original batch workflow remains in `visual/simpler/`, with its checked-in examples preserved. It uses its own older HSV palette matching and system-font HTML output; it does not reproduce browser recipes.

[Original comparison image](docs/examples.png) · [Saved HTML gallery](docs/gallery.html). Historical sample artwork may belong to third parties; rights remain with its creators. Use images you own or have permission to transform. The browser studio uses newly authored procedural samples instead.

```sh
python -m pip install -r requirements.txt
cd visual/simpler
python main.py --columns 150 --char-set standard
python main.py --columns 150 --char-set random --randomize --seed 42
```

Input comes from `images/input/`; HTML goes to `images/output/` and metadata to `images/json/`. Running this batch command can overwrite outputs with matching names. Character choice is now explicit (`standard`, `binary`, `numbers`, `letters`, `minimal`, `random`); default runs use `standard`. Optional randomization uses recorded per-variation seeds and exact enhancement values. HTML escapes character text, validates dimensions, and derives palette hex values from their RGB values.

From the repository root:

```sh
python -m unittest discover -s tests -p test_legacy.py
```

Tests use temporary directories and do not modify existing experiments.

## Publish

Deploy only `studio/`. No server-side code or secrets are needed. `wrangler.jsonc` is configured for a Cloudflare static-assets Worker named `raster-lab`. With Wrangler 4 installed and authenticated:

```sh
wrangler deploy --dry-run
wrangler deploy
```

The existing deployment is manual; pushing to GitHub runs verification, not deployment. The GitHub workflow checks the browser core and Python regression suite. Browser smoke checks also cover sample switching, A/B comparison, palette extraction, recipe restoration, PNG/TXT downloads and mobile overflow.

Algorithm reference: [Tanner Helland's dithering guide](https://tannerhelland.com/2012/12/28/dithering-eleven-algorithms-source-code.html). Renderer implementation, procedural fixtures and bitmap glyphs are in this repository.
