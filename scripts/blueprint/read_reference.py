#!/usr/bin/env python3
"""Read the geometry of a stylized side-view reference into millimetres, from the nose.

The blueprint is a figurine: its proportions are the target, not the real car's. Reading them off
the picture by eye gives a model that is roughly right and specifically wrong. This script turns
the picture into numbers:

  - the silhouette's upper and lower edges, as polylines in (from the nose, above the ground);
  - the belt line, which is where the glass meets the paint;
  - the glazed openings, as boxes.

Orientation. The reference draws the nose on the right. Every length here is measured from the
nose, so a value of 0 is the front and 3520 is the tail. That matches the model's +Z.

Usage:
    python3 scripts/blueprint/read_reference.py <side-view image> [--length 3520]
"""

import argparse
import json

import numpy as np
from PIL import Image


def subject_mask(path: str, tolerance: int = 26) -> np.ndarray:
    """True on the subject, False on the flat background.

    A flood fill from the four corners, never a brightness threshold: the car has light grey
    bumpers and dark tyres, and a threshold would keep one and lose the other.
    """
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


def simplify(points, tolerance):
    """Douglas-Peucker: keep the corners, drop the pixels between them."""
    if len(points) < 3:
        return list(points)
    start = np.array(points[0], dtype=float)
    end = np.array(points[-1], dtype=float)
    span = end - start
    norm = float(np.hypot(*span))
    if norm == 0:
        distances = [float(np.hypot(*(np.array(p, dtype=float) - start))) for p in points]
    else:
        distances = [
            abs(span[0] * (p[1] - start[1]) - span[1] * (p[0] - start[0])) / norm for p in points
        ]
    index = int(np.argmax(distances))
    if distances[index] <= tolerance:
        return [points[0], points[-1]]
    left = simplify(points[:index + 1], tolerance)
    right = simplify(points[index:], tolerance)
    return left[:-1] + right


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("reference")
    parser.add_argument("--length", type=float, default=3520.0)
    parser.add_argument("--simplify", type=float, default=14.0)
    args = parser.parse_args()

    rgb = np.asarray(Image.open(args.reference).convert("RGB")).astype(np.int16)
    mask = subject_mask(args.reference)
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    top, bottom, left, right = int(rows[0]), int(rows[-1]), int(cols[0]), int(cols[-1])
    length_px = right - left + 1
    mm = args.length / length_px
    ground = float(bottom)

    def to_mm(column: int, pixel_y: float) -> tuple[float, float]:
        # Length from the nose: the nose is the right edge, so the pixel column is mirrored.
        return (round((right - column) * mm, 0), round((ground - pixel_y) * mm, 0))

    # Glass: dark and desaturated. The paint is a saturated orange, so the blue channel is far
    # below the red one there, and close to it in the glass.
    brightness = rgb.max(axis=2)
    glass = mask & (brightness < 165) & ((rgb[:, :, 0] - rgb[:, :, 2]) < 70)

    upper, lower, belt = [], [], []
    for x in range(left, right + 1):
        column = np.where(mask[:, x])[0]
        if column.size == 0:
            continue
        upper.append(to_mm(x, column[0]))
        lower.append(to_mm(x, column[-1]))
        glass_rows = np.where(glass[:, x])[0]
        if glass_rows.size > 3:
            # The belt is the bottom of the glass, but only where paint lies just below it: that
            # rejects the shadowed trim and the interior seen through a window.
            below = glass_rows[glass_rows + 4 < bottom]
            below = [y for y in below if mask[y + 4, x] and not glass[y + 4, x]]
            if below:
                belt.append(to_mm(x, max(below)))

    # Glazed openings, as connected boxes.
    labels = np.zeros(glass.shape, dtype=np.int32)
    boxes, current = [], 0
    for seed_y in range(top, bottom + 1):
        for seed_x in range(left, right + 1):
            if not glass[seed_y, seed_x] or labels[seed_y, seed_x]:
                continue
            current += 1
            stack = [(seed_y, seed_x)]
            labels[seed_y, seed_x] = current
            min_y = max_y = seed_y
            min_x = max_x = seed_x
            count = 0
            while stack:
                y, x = stack.pop()
                count += 1
                min_y, max_y = min(min_y, y), max(max_y, y)
                min_x, max_x = min(min_x, x), max(max_x, x)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if top <= ny <= bottom and left <= nx <= right and glass[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = current
                        stack.append((ny, nx))
            if count > length_px * 3:
                boxes.append((count, min_x, max_x, min_y, max_y))

    openings = []
    for count, min_x, max_x, min_y, max_y in sorted(boxes, key=lambda b: -b[0])[:6]:
        x0, y0 = to_mm(min_x, max_y)
        x1, y1 = to_mm(max_x, min_y)
        openings.append({
            "area_px": count,
            "from_nose_mm": [round(min(x0, x1), 0), round(max(x0, x1), 0)],
            "above_ground_mm": [round(min(y0, y1), 0), round(max(y0, y1), 0)],
        })

    result = {
        "reference": args.reference,
        "length_mm": args.length,
        "mm_per_px": round(mm, 3),
        "height_mm": round((bottom - top + 1) * mm, 0),
        "upper_mm": simplify(upper, args.simplify),
        "lower_mm": simplify(lower, args.simplify),
        "belt_mm": simplify(belt, args.simplify * 2),
        "openings": openings,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
