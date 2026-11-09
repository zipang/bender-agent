#!/usr/bin/env python3
"""Measure a side-view reference and a render of it, then print the differences in millimetres.

Why this exists. Eyeballing a stylized blueprint gives a model that is roughly right and
specifically wrong: the roof sits 60 mm too low, the bonnet 90 mm too long. Those errors are
invisible one at a time and obvious when measured. This script reduces both images to a
silhouette, scales them to the same real length, and reports the same landmarks in millimetres.

Method, and why each choice matters:

  - Background is removed by a flood fill from the corners, never by a brightness threshold.
    The car carries light grey trim and dark tyres on a white field; a threshold eats one and
    keeps the other. The fill is run propagation, not a dilation that grows one pixel a pass, so
    it reaches the same component in a few passes.
  - The two images are scaled by LENGTH, and anchored on the ground line. Fitting each subject
    to its own bounding box would stretch a too-tall model back into shape and hide the error.
  - The ground line is found from the lowest point of the tyres, not from the image border, so
    padding never shifts the result.

Usage:
    python3 scripts/blueprint/measure_view.py <reference> <render> [--length 3520]
"""

import argparse
import json
import sys

import numpy as np
from PIL import Image

# The reference is a stylized figurine, not a real car. The blueprints and the model both target
# the figurine, so the scale anchor is the figurine's own length, not the R5's 3.52 m.
DEFAULT_LENGTH_MM = 3520

# The tolerance the standalone table applies to every row, in millimetres. `check.ts` uses the same
# default, so the two tables agree on the verdict of every station.
TOLERANCE_MM = 40

# The bar: one mark per 5 mm of `|delta|`, over a field of 30 marks (150 mm). The tolerance mark is
# drawn at a fixed column, over the bar, so a bar that reaches it visibly crosses it.
BAR_FIELD = 30
BAR_MM_PER_MARK = 5


def bar_field(delta: float, tolerance: int = TOLERANCE_MM) -> tuple[str, bool]:
    """The bar field, and whether `|delta|` was clamped to it."""
    marks = round(abs(delta) / BAR_MM_PER_MARK)
    clamped = marks > BAR_FIELD
    width = min(marks, BAR_FIELD)
    cells = ["-" if index < width else " " for index in range(BAR_FIELD)]
    marker = round(tolerance / BAR_MM_PER_MARK)
    if 1 <= marker <= BAR_FIELD:
        cells[marker - 1] = "|"
    return "".join(cells), clamped


def reach(candidate: np.ndarray, seed: tuple[int, int]) -> np.ndarray:
    """The 4-connected component of `seed` in `candidate`, by run propagation.

    One pass marks every pixel in the same contiguous candidate run as a seeded pixel, along each
    axis, forward and backward. A running maximum on its own would carry a seed across a hole, so
    the reach compares the last seed at or before a pixel with the last non-candidate at or before
    it: a pixel is reachable when the seed is the more recent of the two, which is true exactly when
    a seed sits in the pixel's own run. Alternating the two axes converges to the same component the
    old one-pixel-per-iteration dilation reached, in a few passes instead of one per pixel of
    distance. The loop stops on the fixed point, and raises rather than spin if it has not.
    """
    height, width = candidate.shape
    columns = np.arange(width)
    rows = np.arange(height).reshape(height, 1)
    region = np.zeros((height, width), dtype=bool)
    region[seed] = True
    for _ in range(height + width):
        previous = region
        # Horizontal runs, forward and backward.
        blocker = np.maximum.accumulate(np.where(candidate, -1, columns), axis=1)
        seed_at = np.maximum.accumulate(np.where(region, columns, -1), axis=1)
        forward = seed_at > blocker
        blocker = np.maximum.accumulate(np.where(candidate[:, ::-1], -1, columns), axis=1)[:, ::-1]
        seed_at = np.maximum.accumulate(np.where(region[:, ::-1], columns, -1), axis=1)[:, ::-1]
        region = (forward | (seed_at > blocker)) & candidate
        # Vertical runs, forward and backward.
        blocker = np.maximum.accumulate(np.where(candidate, -1, rows), axis=0)
        seed_at = np.maximum.accumulate(np.where(region, rows, -1), axis=0)
        forward = seed_at > blocker
        blocker = np.maximum.accumulate(np.where(candidate[::-1, :], -1, rows), axis=0)[::-1, :]
        seed_at = np.maximum.accumulate(np.where(region[::-1, :], rows, -1), axis=0)[::-1, :]
        region = (forward | (seed_at > blocker)) & candidate
        if np.array_equal(region, previous):
            return region
    raise RuntimeError("run propagation did not converge within w + h passes")


def load_mask(path: str, tolerance: int = 26) -> np.ndarray:
    """True where the picture holds the subject, False on the flat background."""
    pixels = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    height, width, _ = pixels.shape
    background = np.zeros((height, width), dtype=bool)

    for seed in [(0, 0), (0, width - 1), (height - 1, 0), (height - 1, width - 1)]:
        if background[seed]:
            continue
        candidate = np.abs(pixels - pixels[seed]).max(axis=2) < tolerance
        background |= reach(candidate, seed)

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
    print("Roof height above the ground, from the nose to the tail.  All values in millimetres.")
    print("delta = model - reference.  A negative delta is a model that sits lower than the reference.")
    print(f"The bar is one mark per 5 mm.  | is the tolerance limit, {TOLERANCE_MM} mm.  "
          "A bar that reaches it fails.")
    print("")
    print("   station    reference       model       delta")
    for point in result["profile_mm"]:
        field, clamped = bar_field(point["delta"])
        verdict = "OVER" if clamped else ("ok" if abs(point["delta"]) <= TOLERANCE_MM else "OUT")
        station = f"{point['at_mm']:.0f} mm"
        reference = f"{point['reference']:.0f} mm"
        render = f"{point['render']:.0f} mm"
        delta = f"{point['delta']:+.0f} mm"
        print(f"{station:>10}{reference:>12}{render:>13}{delta:>12}   {field}   {verdict}")
    within = sum(1 for p in result["profile_mm"] if abs(p["delta"]) <= TOLERANCE_MM)
    outside = len(result["profile_mm"]) - within
    worst = max(result["profile_mm"], key=lambda p: abs(p["delta"]))
    print("")
    print(f"{len(result['profile_mm'])} stations   {within} within tolerance   {outside} outside   "
          f"worst {worst['delta']:+.0f} mm at {worst['at_mm']:.0f} mm")


if __name__ == "__main__":
    main()
