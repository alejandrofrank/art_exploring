"""Regression checks use temporary output only; never rewrite checked-in experiments."""
import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'visual' / 'simpler'))
from ascii_conversion import AsciiMagic, Modes
import main

class LegacyTests(unittest.TestCase):
    def test_default_and_seeded_selection(self):
        image = Image.new('RGB', (8, 8), (100, 130, 220))
        self.assertEqual(AsciiMagic(image).selected_char_set, 'standard')
        self.assertEqual(AsciiMagic(image, 'random', 123).selected_char_set, AsciiMagic(image, 'random', 123).selected_char_set)

    def test_html_escaping_palette_and_small_image(self):
        art = AsciiMagic(Image.new('RGB', (20, 1)))
        self.assertIn('&lt;', art._build_char('<', (0, 0, 0), 0, Modes.HTML))
        self.assertIn('&amp;', art._build_char('&', (0, 0, 0), 0, Modes.HTML))
        self.assertTrue(art.to_ascii_art(columns=1))
        self.assertEqual(art._find_closest_color((0, 0, 153)), '#000099')
        for args in [{'columns': 0}, {'width_ratio': 0}]:
            with self.assertRaises(ValueError): art.to_ascii_art(**args)

    def test_variations_repeat_with_exact_metadata(self):
        with tempfile.TemporaryDirectory() as folder, contextlib.redirect_stdout(io.StringIO()):
            previous = main.OUTPUT_DIR
            try:
                main.OUTPUT_DIR = folder
                image = Path(folder) / 'fixture.png'
                Image.new('RGB', (12, 8), (123, 90, 211)).save(image)
                def run():
                    metadata = main.create_style_variations(str(image), image.name, 8, 2.2, 1, True, char_set='random', seed=10)
                    outputs = [(Path(folder) / v['output_path']).read_bytes() for v in metadata]
                    return metadata, outputs
                self.assertEqual(run(), run())
                metadata, _ = run()
                self.assertEqual([v['seed'] for v in metadata], [10, 11, 12])
            finally: main.OUTPUT_DIR = previous

if __name__ == '__main__': unittest.main()
