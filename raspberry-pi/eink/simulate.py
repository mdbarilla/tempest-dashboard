#!/usr/bin/env python3
"""Simulate how a screenshot will look on an Inky Impression 7.3 panel.

Quantizes with the same blended palette and Floyd-Steinberg dithering as the
Pimoroni inky library (set_image, saturation=0.5), then paints each pixel with
the panel's measured ink colour so the preview matches the physical display.

Usage: simulate.py input.png output.png [--panel spectra6|7color] [--saturation 0.5]
"""
import argparse

from PIL import Image

# Palettes copied from pimoroni/inky: inky_e673.py (Spectra 6) and inky_ac073tc1a.py (7 colour).
PANELS = {
    "spectra6": {
        "desaturated": [(0, 0, 0), (255, 255, 255), (255, 255, 0), (255, 0, 0), (0, 0, 255), (0, 255, 0)],
        "saturated": [(0, 0, 0), (161, 164, 165), (208, 190, 71), (156, 72, 75), (61, 59, 94), (58, 91, 70)],
    },
    "7color": {
        "desaturated": [(0, 0, 0), (255, 255, 255), (0, 255, 0), (0, 0, 255), (255, 0, 0), (255, 255, 0), (255, 140, 0)],
        "saturated": [(0, 0, 0), (217, 242, 255), (3, 124, 76), (27, 46, 198), (245, 80, 34), (255, 255, 68), (239, 121, 44)],
    },
}


def blend(panel, saturation):
    return [
        tuple(int(s * saturation + d * (1.0 - saturation)) for s, d in zip(sat, desat))
        for sat, desat in zip(panel["saturated"], panel["desaturated"])
    ]


def simulate(image, panel_name="spectra6", saturation=0.5):
    panel = PANELS[panel_name]
    palette = blend(panel, saturation)
    palette_image = Image.new("P", (1, 1))
    palette_image.putpalette([c for rgb in palette for c in rgb] + [0, 0, 0] * (256 - len(palette)))
    indexed = image.convert("RGB").quantize(len(palette), palette=palette_image, dither=Image.Dither.FLOYDSTEINBERG)
    indexed.putpalette([c for rgb in panel["saturated"] for c in rgb] + [0, 0, 0] * (256 - len(palette)))
    return indexed.convert("RGB")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--panel", choices=sorted(PANELS), default="spectra6")
    parser.add_argument("--saturation", type=float, default=0.5)
    args = parser.parse_args()
    simulate(Image.open(args.input), args.panel, args.saturation).save(args.output)


if __name__ == "__main__":
    main()
