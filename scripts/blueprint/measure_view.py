#!/usr/bin/env python3
"""Measure a side-view reference and a render of it, then print the differences in millimetres.

Why this exists. Eyeballing a stylized blueprint gives a model that is roughly right and
specifically wrong: the roof sits 60 mm too low, the bonnet 90 mm too long. Those errors are
invisible one at a time and obvious when measured. This script reduces both images to a
silhouette, scales them to the same real length, and reports the same landmarks in millimetres.

Method, and why each choice matters:

  - Background is removed by a flood fill from the corners, never by a brightness threshold.
    The car carries light grey trim and dark tyres on a white field; a threshold eats one and
    keeps the other.
  - The two images are scaled by LENGTH, and anchored on the ground line. Fitting each subject
    to its own bounding box would stretch a too-tall model back into shape and hide the error.
  - The ground line is found from the lowest point of the tyres, not from the image border, so
    padding never shifts the result.

Usage:
    python3 scripts/scene/measure_view.py <reference> <render> [--length 3520]
"""

import argparse
import json
import sys

import numpy as np
from PIL import Image

# The reference is a stylized figurine, not a real car. The blueprints and the model both target
# the figurine, so the scale anchor is the figurine's own length, not the R5's 3.52 m.
DEFAULT_LENGTH_MM = 3520


def load_mask(path: str, tolerance: int = 26) -> np.ndarray:
    """True where the picture holds the subject, False on the flat background."""
    pixels = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    height, width, _ = pixels.shape
    background = np.zeros((height, width), dtype=bool)

    for seed in [(0, 0), (0, width - 1), (height - 1, 0), (height - 1, width - 1)]:
        if background[seed]:
            continue
        candidate = np.abs(pixels - pixels[seed]).max(axis=2) < tolerance
        region = np.zeros((height, width), dtype=bool)
        region[seed] = True
        while True:
            grown = region.copy()
            grown[1:, :] |= region[:-1, :]
            grown[:-1, :] |= region[1:, :]
            grown[:, 1:] |= region[:, :-1]
            grown[:, :-1] |= region[:, 1:]
            grown &= candidate
            if grown.sum() == region.sum():
                break
            region = grown
        background |= region

    return ~background


def segment(mask: np.ndarray) -> dict:
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    top, bottom = int(rows[0]), int(rows[-1])
    left, right = int(cols[0]), int(cols[-1])
    length_px = right - left + 1
    height_px = bottom - top + 1

    top_edge = np.full(length_px, np.nan)
    bottom_edge = np.full(length_px, np.nan)
    for i, x in enumerate(range(left, right + 1)):
        column = np.where(mask[:, x])[0]
        if column.size:
            top_edge[i] = column[0]
            bottom_edge[i] = column[-1]

    # The roof line is measured over the middle half of the car: a mirror or an aerial at the
    # ends would otherwise be read as the roof.
    mid = top_edge[int(length_px * 0.3):int(length_px * 0.7)]
    roof = float(np.nanmedian(mid))

    # The wheels hang below the underside of the body. The underside is the bottom edge where the
    # silhouette is NOT a wheel, so it is the modal value of the bottom edge over the middle of
    # the car. A wheel is then a run of columns whose bottom edge lies clearly below that line.
    ground = float(np.nanmax(bottom_edge))
    middle = bottom_edge[int(length_px * 0.35):int(length_px * 0.65)]
    underside = float(np.nanmedian(middle))
    hanging = bottom_edge > underside + height_px * 0.02

    runs, start = [], None
    for i, value in enumerate(hanging):
        if value and start is None:
            start = i
        elif not value and start is not None:
            if i - start > length_px * 0.05:
                runs.append((start, i - 1))
            start = None
    if start is not None and length_px - start > length_px * 0.05:
        runs.append((start, length_px - 1))

    # The tyre diameter is the vertical drop below the underside at the axle column: the wheel
    # is a circle, so its lowest point to its widest point is one radius.
    wheels = []
    for a, b in runs:
        centre = (a + b) // 2
        drop = ground - underside
        diameter = 2 * drop
        wheels.append((centre, diameter, a, b))

    return {
        "length_px": length_px,
        "height_px": height_px,
        "ratio": height_px / length_px,
        "top_edge": top_edge,
        "bottom_edge": bottom_edge,
        "roof": roof,
        "ground": ground,
        "underside": underside,
        "top": top,
        "left": left,
        "wheels": wheels,
    }


def report(reference: dict, render: dict, length_mm: float) -> dict:
    # One scale, from the reference length, applied to both: the render is not allowed to
    # renormalise itself into agreement.
    mm_per_px = length_mm / reference["length_px"]
    scale = reference["length_px"] / render["length_px"]

    out = {
        "scale_mm_per_ref_px": round(mm_per_px, 3),
        "reference": {
            "height_mm": round(reference["height_px"] * mm_per_px, 1),
            "ratio": round(reference["ratio"], 4),
            "wheels": [{"centre_mm": round(c * mm_per_px, 1), "diameter_mm": round(d * mm_per_px, 1)}
                       for c, d, _a, _b in reference["wheels"]],
        },
        "render": {
            "height_mm": round(render["height_px"] * scale * mm_per_px, 1),
            "ratio": round(render["ratio"], 4),
            "wheels": [{"centre_mm": round(c * scale * mm_per_px, 1),
                        "diameter_mm": round(d * scale * mm_per_px, 1)}
                       for c, d, _a, _b in render["wheels"]],
        },
        "delta": {
            "height_mm": round((render["height_px"] * scale - reference["height_px"]) * mm_per_px, 1),
        },
        "profile_mm": [],
    }

    steps = 21
    for i in range(steps):
        a = int(i * (reference["length_px"] - 1) / (steps - 1))
        b = int(i * (render["length_px"] - 1) / (steps - 1))
        ref_top = reference["top_edge"][a]
        rnd_top = render["top_edge"][b]
        if not (np.isfinite(ref_top) and np.isfinite(rnd_top)):
            continue
        # Distance from the ground, in millimetres, along the length.
        ref_h = (reference["ground"] - ref_top) * mm_per_px
        rnd_h = (render["ground"] - rnd_top) * scale * mm_per_px
        out["profile_mm"].append({
            "at_mm": round(i * length_mm / (steps - 1), 0),
            "reference": round(ref_h, 0),
            "render": round(rnd_h, 0),
            "delta": round(rnd_h - ref_h, 0),
        })
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("reference")
    parser.add_argument("render")
    parser.add_argument("--length", type=float, default=DEFAULT_LENGTH_MM)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    reference = segment(load_mask(args.reference))
    render = segment(load_mask(args.render))
    result = report(reference, render, args.length)

    if args.json:
        print(json.dumps(result, indent=2))
        return

    r, d = result["reference"], result["render"]
    print(f"scale            {result['scale_mm_per_ref_px']} mm per reference pixel")
    print(f"reference        height {r['height_mm']} mm   h/l {r['ratio']}")
    print(f"render           height {d['height_mm']} mm   h/l {d['ratio']}")
    print(f"height delta     {result['delta']['height_mm']:+} mm")
    print("")
    print("wheels, front to rear (centre from the nose, tyre diameter)")
    for label, wheels in (("reference", r["wheels"]), ("render", d["wheels"])):
        print(f"  {label:<12} " + "   ".join(
            f"@{w['centre_mm']:.0f} mm ⌀{w['diameter_mm']:.0f}" for w in wheels))
    print("")
    print("roof height above the ground, sampled nose to tail")
    print(f"  {'at':>7}  {'reference':>10}  {'render':>8}  {'delta':>7}")
    for point in result["profile_mm"]:
        bar = ("+" if point["delta"] > 0 else "-") * min(int(abs(point["delta"]) / 20), 30)
        print(f"  {point['at_mm']:>7.0f}  {point['reference']:>10.0f}  "
              f"{point['render']:>8.0f}  {point['delta']:>+7.0f}  {bar}")


if __name__ == "__main__":
    main()
