import os
from PIL import Image, ImageEnhance, ImageOps
from enum import Enum
from typing import List, Tuple, Optional
import colorsys
import random

class Modes(Enum):
    ASCII = 'ascii'
    HTML = 'html'
    HTML_MONOCHROME = 'html_monochrome'

class AsciiMagic:
    # Extended color palette for better gradients
    COLOR_DATA = [
        [(0, 0, 0), '#000000'], [(30, 30, 30), '#1C1C1C'],
        [(60, 60, 60), '#383838'], [(90, 90, 90), '#545454'],
        [(120, 120, 120), '#707070'], [(150, 150, 150), '#8C8C8C'],
        [(180, 180, 180), '#A8A8A8'], [(210, 210, 210), '#C4C4C4'],
        [(255, 255, 255), '#FFFFFF'],
        # Primary colors
        [(255, 0, 0), '#FF0000'], [(0, 255, 0), '#00FF00'], [(0, 0, 255), '#0000FF'],
        # Secondary colors
        [(255, 255, 0), '#FFFF00'], [(0, 255, 255), '#00FFFF'], [(255, 0, 255), '#FF00FF'],
        # Additional shades
        [(128, 0, 0), '#800000'], [(0, 128, 0), '#008000'], [(0, 0, 128), '#000080'],
        [(128, 128, 0), '#808000'], [(0, 128, 128), '#008080'], [(128, 0, 128), '#800080'],
        [(255, 51, 51), '#FF3333'], [(255, 102, 102), '#FF6666'],
        [(255, 153, 153), '#FF9999'], [(204, 0, 0), '#CC0000'],
        [(153, 0, 0), '#990000'], [(255, 26, 26), '#FF1A1A'],
        
        # Additional Greens
        [(51, 255, 51), '#33FF33'], [(102, 255, 102), '#66FF66'],
        [(153, 255, 153), '#99FF99'], [(0, 204, 0), '#00CC00'],
        [(0, 153, 0), '#009900'], [(26, 255, 26), '#1AFF1A'],
        
        # Additional Blues
        [(51, 51, 255), '#3333FF'], [(102, 102, 255), '#6666FF'],
        [(153, 153, 255), '#9999FF'], [(0, 0, 204), '#0000CC'],
        [(0, 0, 153), '#009999'], [(26, 26, 255), '#1A1AFF'],
        
        # Mixed Colors for Better Transitions
        [(255, 128, 0), '#FF8000'],  # Orange
        [(255, 0, 128), '#FF0080'],  # Pink
        [(128, 255, 0), '#80FF00'],  # Lime
        [(0, 128, 255), '#0080FF'],  # Sky Blue
        [(128, 0, 255), '#8000FF'],  # Purple
        [(0, 255, 128), '#00FF80']   # Spring Green
    ]
    
    # Different character sets for various styles
    ASCII_CHARS_BY_DENSITY = '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. '[::-1]
    BINARY_CHARS = '10 '[::-1]
    NUMBER_CHARS = '9876543210 '[::-1]
    LETTER_CHARS = 'ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqponmlkjihgfedcba '[::-1]
    MINIMAL_CHARS = 'Xx '[::-1]

    # Character set types
    CHAR_SETS = {
        'standard': ASCII_CHARS_BY_DENSITY,
        'binary': BINARY_CHARS,
        'numbers': NUMBER_CHARS,
        'letters': LETTER_CHARS,
        'minimal': MINIMAL_CHARS
    }

    # Probability weights for character sets
    CHAR_SET_WEIGHTS = {
        'standard': 0.4,   # 40% chance
        'binary': 0.2,     # 20% chance
        'numbers': 0.2,    # 20% chance
        'letters': 0.15,   # 15% chance
        'minimal': 0.05    # 5% chance
    }

    def __init__(self, image: Image.Image):
        self._image = image
        self._setup_color_palette()
        self._chars_by_density = self._select_char_set()

    def _select_char_set(self) -> str:
        """Randomly select a character set based on weights"""
        items = list(self.CHAR_SET_WEIGHTS.items())
        choices, weights = zip(*items)
        selected = random.choices(choices, weights=weights, k=1)[0]
        print(f"Selected character set: {selected}")
        self.selected_char_set = selected  # Store the selection
        return self.CHAR_SETS[selected]

    def apply_effects(self, effects: List[str] = None) -> None:
            """Apply various effects to the image before conversion
            
            Args:
                effects: List of effects to apply ('dramatic', 'bright', 'high_contrast')
            """
            if not effects:
                return

            for effect in effects:
                if effect == 'dramatic':
                    self.enhance_image(contrast=1.5, saturation=1.5)
                elif effect == 'bright':
                    self.enhance_image(brightness=1.3, contrast=1.2)
                elif effect == 'high_contrast':
                    self.enhance_image(contrast=1.8, saturation=1.2)
    @classmethod
    def from_image(cls, path: str) -> 'AsciiMagic':
        """Create AsciiMagic instance from image file"""
        try:
            with Image.open(path) as img:
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                image_copy = img.copy()
            return cls(image_copy)
        except Exception as e:
            print(f"Error opening image {path}: {str(e)}")
            raise

    def _setup_color_palette(self):
        """Create color palette with RGB and HSV values"""
        self.PALETTE = []
        for rgb, hex_color in self.COLOR_DATA:
            r, g, b = [x/255.0 for x in rgb]
            hsv = colorsys.rgb_to_hsv(r, g, b)
            self.PALETTE.append({
                'rgb': (r, g, b),
                'hsv': hsv,
                'hex': hex_color
            })

    def set_size(self, scale_factor: float = 1.0) -> None:
        """Adjust the overall size of the ASCII art
        
        Args:
            scale_factor: Factor to scale the art (1.0 is default, 2.0 is twice as big)
        """
        self.DEFAULT_STYLES = f'''
            display: inline-block;
            border-width: {4 * scale_factor}px {6 * scale_factor}px;
            border-color: black;
            border-style: solid;
            background-color: black;
            font-family: monospace;
            font-size: {2 * scale_factor}px;
            line-height: 1;
            letter-spacing: 0;
            white-space: pre;
        '''

    def enhance_image(self, brightness: float = 1.0, contrast: float = 1.2, saturation: float = 1.3) -> None:
        """Apply image enhancements"""
        try:
            if saturation != 1.0:
                enhancer = ImageEnhance.Color(self._image)
                self._image = enhancer.enhance(saturation)
            if brightness != 1.0:
                enhancer = ImageEnhance.Brightness(self._image)
                self._image = enhancer.enhance(brightness)
            if contrast != 1.0:
                enhancer = ImageEnhance.Contrast(self._image)
                self._image = enhancer.enhance(contrast)
        except Exception as e:
            print(f"Error enhancing image: {str(e)}")
            raise

    def _calculate_color_distance(self, color1: Tuple[float, float, float], 
                                color2: Tuple[float, float, float]) -> float:
        """Calculate color distance using a weighted algorithm"""
        # Convert RGB to HSV for better color comparison
        hsv1 = colorsys.rgb_to_hsv(*color1)
        hsv2 = colorsys.rgb_to_hsv(*color2)
        
        # Weights for HSV components
        h_weight = 2.0  # Higher weight for hue
        s_weight = 1.0
        v_weight = 1.0
        
        # Calculate weighted distance
        h_dist = min(abs(hsv1[0] - hsv2[0]), 1 - abs(hsv1[0] - hsv2[0])) * h_weight
        s_dist = abs(hsv1[1] - hsv2[1]) * s_weight
        v_dist = abs(hsv1[2] - hsv2[2]) * v_weight
        
        return h_dist + s_dist + v_dist

    def _find_closest_color(self, pixel: Tuple[int, int, int]) -> str:
        """Find closest color in palette using improved color matching"""
        r, g, b = [x/255.0 for x in pixel]
        min_distance = float('inf')
        closest_color = self.PALETTE[0]['hex']
        
        pixel_hsv = colorsys.rgb_to_hsv(r, g, b)
        
        for color in self.PALETTE:
            distance = self._calculate_color_distance((r, g, b), color['rgb'])
            if distance < min_distance:
                min_distance = distance
                closest_color = color['hex']
        
        return closest_color
    
    def optimize_for_display(self, target_width: Optional[int] = None) -> None:
        """Optimize image for display while maintaining aspect ratio"""
        if not target_width:
            return

        aspect_ratio = self._image.height / self._image.width
        target_height = int(target_width * aspect_ratio)
        
        self._image = self._image.resize(
            (target_width, target_height),
            Image.Resampling.LANCZOS
        )

    def _build_char(self, char: str, pixel: Tuple[int, int, int], brightness: float, mode: Modes) -> str:
        """Build character with color handling"""
        if mode == Modes.ASCII:
            return char
        
        hex_color = self._find_closest_color(pixel) if mode == Modes.HTML else '#FFFFFF'
        return f'<span style="color: {hex_color}">{char}</span>'

    def to_ascii_art(self, columns: int = 500, width_ratio: float = 4.4, mode: Modes = Modes.HTML) -> str:
        """Convert image to ASCII art with improved quality
        
        Args:
            columns: Number of characters per line (increased from 150 to 200 for more detail)
            width_ratio: Adjusts for character width vs height (reduced from 2.2 to 1.8 for better proportions)
            mode: Output mode (ASCII, HTML, etc.)
        """
        img_w, img_h = self._image.size
        scalar = img_w * width_ratio / columns
        new_w = int(img_w * width_ratio / scalar)
        new_h = int(img_h / scalar)
        
        rgb_img = self._image.resize((new_w, new_h), Image.Resampling.LANCZOS)
        grayscale_img = rgb_img.convert("L")
        
        lines = []
        for h in range(new_h):
            line = ''
            for w in range(new_w):
                brightness = grayscale_img.getpixel((w, h)) / 255
                pixel = rgb_img.getpixel((w, h))
                
                if isinstance(pixel, int):
                    pixel = (pixel, pixel, pixel)
                
                char_idx = int(brightness * (len(self._chars_by_density) - 1))
                char = self._chars_by_density[char_idx]
                line += self._build_char(char, pixel, brightness, mode)
            
            lines.append(line)
        
        return '\n'.join(lines) if mode == Modes.ASCII else '<br>'.join(lines)

    def save_as_html(self, path: str, columns: int = 150, width_ratio: float = 2.2, monochrome: bool = False) -> None:
        """Save ASCII art as HTML with improved styling"""
        mode = Modes.HTML_MONOCHROME if monochrome else Modes.HTML
        art = self.to_ascii_art(columns=columns, width_ratio=width_ratio, mode=mode)
        
        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>ASCII Art - {os.path.basename(path)}</title>
    <meta charset="utf-8">
    <style>
        body {{ background: black; margin: 20px; }}
        .ascii-art {{ {self.DEFAULT_STYLES} }}
    </style>
</head>
<body>
    <pre class="ascii-art">{art}</pre>
</body>
</html>"""
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)