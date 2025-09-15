# ASCII Art Generator

A sophisticated image-to-ASCII art converter that transforms images into artistic text-based representations with multiple visual styles and character sets.

## Features

- **Multiple Character Sets**: Standard ASCII, Binary (0,1), Numbers (0-9), Letters (A-Z), Minimal (Xx)
- **Artistic Style Variations**: Standard, Dramatic, and Bright presets
- **Advanced Image Processing**: Brightness, contrast, and saturation adjustments
- **Randomization**: Optional parameter variance for unique artistic results
- **Batch Processing**: Convert multiple images automatically
- **HTML Output**: Colored ASCII art viewable in web browsers
- **Metadata Tracking**: Complete processing parameters saved as JSON

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd crypto
```

2. **Install dependencies**
```bash
pip install -r requirements.txt
```

## Usage

### Basic Usage
```bash
cd visual/simpler
python main.py
```

### Advanced Options
```bash
# High resolution output
python main.py --columns 300 --scale-factor 2.0

# Artistic experimentation with randomization
python main.py --columns 150 --randomize --scale-factor 1.5

# Compact output for quick previews
python main.py --columns 50 --scale-factor 0.3

# Custom width ratio
python main.py --columns 200 --width-ratio 1.8
```

### Command Line Options
- `--columns`: Number of characters per line (default: 150)
- `--width-ratio`: Width ratio adjustment (default: 2.2)
- `--scale-factor`: Scale factor for output size (default: 1.0)
- `--randomize`: Add random variance to parameters

## Input and Output

- **Input Directory**: `visual/simpler/images/input/`
  - Supports: PNG, JPG, JPEG, BMP, GIF formats
  
- **Output Directory**: `visual/simpler/images/output/`
  - Creates HTML files with colored ASCII art
  - Organized by image name with style variations
  
- **Metadata Directory**: `visual/simpler/images/json/`
  - JSON files containing processing parameters and settings

## Style Variations

Each image is processed into three artistic styles:

1. **Standard**: Balanced brightness (1.0), enhanced contrast (1.2), vivid saturation (1.3)
2. **Dramatic**: Darker brightness (0.8), high contrast (1.5), intense saturation (1.5)
3. **Bright**: Enhanced brightness (1.3), moderate contrast (1.1), warm saturation (1.2)

## Character Sets

The generator randomly selects from five character sets:
- **Standard** (40%): Full ASCII character range for maximum detail
- **Binary** (20%): 0s and 1s for digital/cyberpunk aesthetic
- **Numbers** (20%): 0-9 for numeric art style
- **Letters** (15%): A-Z alphabet characters
- **Minimal** (5%): Just X and x for high contrast

## Examples

Add your images to `visual/simpler/images/input/` and run the converter. Results will be saved as HTML files that you can open in any web browser to view your ASCII art masterpieces!

## Technical Details

- **Color Matching**: Advanced HSV color space analysis for accurate color representation
- **Image Enhancement**: PIL-based brightness, contrast, and saturation adjustments
- **Quality Resampling**: LANCZOS algorithm for high-quality image resizing
- **Aspect Ratio Preservation**: Maintains original image proportions