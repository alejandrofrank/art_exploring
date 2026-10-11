import os
import random
import json
from datetime import datetime
from ascii_conversion import AsciiMagic
import argparse

INPUT_DIR = os.path.join('images', 'input')
OUTPUT_DIR = os.path.join('images', 'output')
JSON_DIR = os.path.join('images', 'json')

# Image processing variations
variations = {
    'standard': {
        'brightness': 1.0,
        'contrast': 1.2,
        'saturation': 1.3
    },
    'dramatic': {
        'brightness': 0.8,
        'contrast': 1.5,
        'saturation': 1.5
    },
    'bright': {
        'brightness': 1.3,
        'contrast': 1.1,
        'saturation': 1.2
    }
}

def random_adjust(value: float, variance: float = 0.2, rng=None) -> float:
    """Add random variance to a value within a percentage range"""
    adjustment = 1.0 + (rng or random.Random(42)).uniform(-variance, variance)
    return value * adjustment

def create_style_variations(file_path: str, image_name: str, 
                          columns: int, width_ratio: float,
                          scale_factor: float,
                          randomize: bool = False,
                          random_variance: float = 0.2,
                          char_set: str = 'standard', seed: int = 42) -> list:
    # Create output directory
    base_name = os.path.splitext(image_name)[0]
    image_folder = os.path.join(OUTPUT_DIR, base_name)
    os.makedirs(image_folder, exist_ok=True)

    # Store metadata for each variation
    variations_metadata = []

    # Process each variation
    for style_index, (style_name, params) in enumerate(variations.items()):
        try:
            print(f"\nCreating {style_name} variation:")
            # Create a fresh instance for each variation
            variation_seed = seed + style_index
            rng = random.Random(variation_seed)
            current_art = AsciiMagic.from_image(file_path, char_set=char_set, seed=variation_seed)
            
            # Apply size scaling
            current_art.set_size(scale_factor)
            
            # Store the selected character set
            char_set_type = current_art.selected_char_set
            
            if randomize:
                # Randomize parameters within variance
                randomized_params = {
                    'brightness': random_adjust(params['brightness'], random_variance, rng),
                    'contrast': random_adjust(params['contrast'], random_variance, rng),
                    'saturation': random_adjust(params['saturation'], random_variance, rng)
                }
                params = randomized_params
                print(f"Randomized parameters: {params}")
            
            # Apply enhancements
            current_art.enhance_image(**params)
            
            # Save variation
            output_path = os.path.join(image_folder, f"{base_name}_{style_name}.html")
            current_art.save_as_html(
                path=output_path, 
                columns=columns, 
                width_ratio=width_ratio
            )
            
            # Store metadata for this variation
            variation_data = {
                'style': style_name,
                'character_set': char_set_type,
                'seed': variation_seed,
                'parameters': {
                    'brightness': params['brightness'],
                    'contrast': params['contrast'],
                    'saturation': params['saturation'],
                    'scale_factor': scale_factor
                },
                'output_path': os.path.relpath(output_path, OUTPUT_DIR),
                'columns': columns,
                'width_ratio': width_ratio
            }
            variations_metadata.append(variation_data)
            
            print(f"Saved to: {image_folder}")
            
        except Exception as e:
            print(f"Error creating {style_name} variation: {str(e)}")
            raise
    
    return variations_metadata

def save_metadata(image_name: str, variations_data: list):
    """Save metadata for an image and its variations to JSON"""
    os.makedirs(JSON_DIR, exist_ok=True)
    
    metadata = {
        'image_name': image_name,
        'original_path': os.path.join(INPUT_DIR, image_name),
        'processing_date': datetime.now().isoformat(),
        'variations': variations_data
    }
    
    json_path = os.path.join(JSON_DIR, f"{os.path.splitext(image_name)[0]}_metadata.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=4)
    
    print(f"Metadata saved to: {json_path}")

def process_images(args):
    """Process all images with given arguments"""
    for image_name in sorted(os.listdir(INPUT_DIR)):
        if image_name.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif')):
            print(f"Processing: {image_name}")
            try:
                image_path = os.path.join(INPUT_DIR, image_name)
                variations_data = create_style_variations(
                    file_path=image_path,
                    image_name=image_name,
                    columns=args.columns,
                    width_ratio=args.width_ratio,
                    scale_factor=args.scale_factor,
                    randomize=args.randomize,
                    char_set=args.char_set, seed=args.seed
                )
                save_metadata(image_name, variations_data)
            except Exception as e:
                print(f"Error processing {image_name}: {str(e)}")
                raise
            print()

def main():
    # Ensure output directories exist
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(JSON_DIR, exist_ok=True)
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Convert images to ASCII art')
    parser.add_argument('--columns', type=int, default=150, help='Number of columns in output')
    parser.add_argument('--width-ratio', type=float, default=2.2, help='Width ratio adjustment')
    parser.add_argument('--scale-factor', type=float, default=1.0, help='Scale factor for output size')
    parser.add_argument('--randomize', action='store_true', help='Add random variance to parameters')
    parser.add_argument('--char-set', choices=[*AsciiMagic.CHAR_SETS, 'random'], default='standard', help='Explicit character set, or seeded random selection')
    parser.add_argument('--seed', type=int, default=42, help='Reproducible seed for optional randomization (default: 42)')
    args = parser.parse_args()
    
    print(f"Processing images from: {os.path.abspath(INPUT_DIR)}")
    print(f"Saving results to: {os.path.abspath(OUTPUT_DIR)}")
    print(f"Saving metadata to: {os.path.abspath(JSON_DIR)}")
    print(f"Scale factor: {args.scale_factor}")
    print(f"Randomization: {'Enabled' if args.randomize else 'Disabled'}")
    print()
    
    # Process images
    process_images(args)
    print("Processing complete!")

if __name__ == "__main__":
    main()
