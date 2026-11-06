#!/usr/bin/env python3
"""Stage 1 of volume modelling: give every view its own scale, on each axis, and declare the drift.

A view is a picture and a picture has no size. A generated view is worse than that: it was drawn
from a description, so it carries its own scale AND its own proportions. Two views of the same
subject are therefore rarely the same drawing at two sizes.

So one scale per view is not enough, and one global scale for the whole set is a lie. This script
measures the subject inside one view and returns two scales:

    kx  mm per pixel, horizontally, from the real dimension this view spans on that axis
    ky  mm per pixel, vertically,   from the real dimension it spans on the other axis

The ratio ky/kx is the view's **anisotropy**: 1.0 means the view is a uniformly scaled picture of
the subject; anything else means the drawing was stretched. That number is not a defect to hide. It
is a correction to apply, because a per-axis scale restores a stretched circle to a circle.

What it costs: a view is usable only if every measurement taken from it is converted to a FRACTION
of the spanning dimension before it is multiplied by the real one. A pixel distance multiplied by a
single global scale is wrong by the anisotropy, everywhere, and no later gate can see it.

Usage:

    python3 scripts/scene/view_scale.py blueprints/vehicules/r5-tl-1972/left/reference.png \
        --view left --length 3.521 --width 1.525 --height 1.400

    python3 scripts/scene/view_scale.py ... --write blueprints/vehicules/r5-tl-1972/dimensions.json

The second form merges the entry into `dimensions.json`, so the scale of each view accumulates in
one file that every later stage reads. Re-running a view replaces only that view's entry.

Real dimensions are an input. Never derive them from the views this script measures.

Known limit: the silhouette is the whole subject, so a protruding accessory (a mirror, an antenna,
a bumper corner) inflates the span. On a width-anchored view that makes the scale too small and the
cross-check look like a proportion error. Exclude the accessory, or declare it, before you conclude
that the view is wrong.
"""

import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

# Which overall dimension each view spans, per axis of the image.
#   horizontal, vertical -> the key in the real-dimension table
VIEW_TABLE = {
    "left": ("length", "height"),
    "right": ("length", "height"),
    "front": ("width", "height"),
    "back": ("width", "height"),
    "top": ("width", "length"),
    "bottom": ("width", "length"),
}

# Anisotropy budget. Below PASS the view is a uniform scale of the subject. Between PASS and
# CORRECTED the view is stretched, and per-axis scales are mandatory. Above CORRECTED the drawing
# has lost the subject's shape and must not be traced: a curve that should be circular is an
# ellipse, and the correction cannot recover the detail it destroyed.
PASS_PCT = 5.0
CORRECTED_PCT = 25.0


def subject_mask(path: str, tolerance: int = 26) -> np.ndarray:
    """True on the subject, False on the flat background.

    A flood fill from the four corners, never a brightness threshold: a light grey bumper and a
    dark tyre are both subject, and a threshold keeps one and loses the other.
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


def smoothed_max(profile: np.ndarray, window_pct: float) -> float:
    """The maximum of a profile, with narrow spikes averaged out.

    The window is a fraction of the profile's length, so it scales with the subject and not with
    the file. Edge values are replicated, so an extreme that sits at the tip of the subject -- a
    pointed nose, a flat tail -- survives the smoothing.
    """
    window = max(3, int(round(len(profile) * window_pct / 100.0)))
    if window >= len(profile):
        return float(profile.max())
    pad = window // 2
    padded = np.pad(profile, pad, mode="edge")
    return float(np.convolve(padded, np.ones(window) / window, mode="valid").max())


def measure(path: str, view: str, real: dict, span: str = "box") -> dict:
    if view not in VIEW_TABLE:
        raise SystemExit(f"unknown view '{view}', expected one of {', '.join(VIEW_TABLE)}")
    for key in ("length", "width", "height"):
        if key not in real:
            raise SystemExit(f"missing real dimension: --{key}")

    mask = subject_mask(path)
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if rows.size == 0:
        raise SystemExit(f"the background fill covered the whole image: {path}")
    box = [int(cols[0]), int(rows[0]), int(cols[-1]), int(rows[-1])]
    raw_x = box[2] - box[0] + 1
    raw_y = box[3] - box[1] + 1

    # Two ways to read a span, and the choice is not cosmetic.
    #
    # `box` takes the bounding box. On a cropped view -- the shape this pipeline now produces --
    # the subject touches the frame, so the span is simply the image size: no statistics, nothing
    # to be wrong about. This is the default, and it is the reading a human does by eye.
    #
    # `robust` smooths each profile over 5% of its length before taking the maximum, so a narrow
    # spur (a mirror, an antenna) averages away. It is available because a *width* anchored on a
    # mirror is genuinely too small. But it is not the default, and it must not be applied blindly:
    # the same smoothing eats a real extreme. A side view's roof crown is one point of the
    # silhouette, so a window wider than the crown shortens the car by 4%, turns a real 6%
    # anisotropy into a false pass, and sends the next stage to fix a body that was right.
    body = mask[box[1]:box[3] + 1, box[0]:box[2] + 1]
    if span == "robust":
        row_width = np.array([
            (np.where(row)[0][-1] - np.where(row)[0][0] + 1) if row.any() else 0
            for row in body
        ], dtype=float)
        col_height = np.array([
            (np.where(col)[0][-1] - np.where(col)[0][0] + 1) if col.any() else 0
            for col in body.T
        ], dtype=float)
        span_x = int(round(smoothed_max(row_width, 5)))
        span_y = int(round(smoothed_max(col_height, 5)))
    else:
        span_x, span_y = int(raw_x), int(raw_y)

    horizontal, vertical = VIEW_TABLE[view]

    # One real dimension per axis. Each axis gets its own scale, because the drawing may be
    # stretched and because a view is only anchored on the axes it actually spans.
    kx = real[horizontal] * 1000.0 / span_x
    ky = real[vertical] * 1000.0 / span_y

    anisotropy = ky / kx
    drift_pct = abs(anisotropy - 1.0) * 100.0
    if drift_pct <= PASS_PCT:
        verdict = "pass"
    elif drift_pct <= CORRECTED_PCT:
        verdict = "corrected"
    else:
        verdict = "reject"

    image_px = [int(Image.open(path).size[0]), int(Image.open(path).size[1])]
    return {
        "file": os.path.relpath(path),
        "view": view,
        "image_px": image_px,
        "body_px": [int(span_x), int(span_y)],
        "silhouette_box_px": box,
        "protrusion_px": [int(raw_x - span_x), int(raw_y - span_y)],
        "spans": f"{horizontal} horizontally, {vertical} vertically",
        "scale_mm_per_px": {"horizontal": round(kx, 4), "vertical": round(ky, 4)},
        "anisotropy": round(anisotropy, 4),
        "drift_pct": round(drift_pct, 2),
        # The scale a single-global-scale method would have used, and the error it would carry.
        "naive_scale_error_mm": round((ky - kx) * span_y, 1),
        "gate": verdict,
    }


def write_entry(path: str, entry: dict, real: dict, unit: str, source: str,
                required: bool) -> None:
    document = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as handle:
            document = json.load(handle)
    # The subject folder is the parent of the view folder, which holds the image.
    document.setdefault(
        "subject", os.path.basename(os.path.dirname(os.path.dirname(os.path.abspath(entry["file"]))))
    )
    document.setdefault("unit", unit)
    document["real"] = {key: {"value": value, "source": source} for key, value in real.items()}
    entry["required"] = required
    document.setdefault("views", {})[entry["view"]] = entry
    # An optional view informs and does not decide: it is recorded, and it never blocks the gate.
    required_views = [v for v in document["views"].values() if v.get("required", True)]
    document["scales"] = (
        "pass"
        if required_views and all(v["gate"] in ("pass", "corrected") for v in required_views)
        else "open"
    )
    # The scales are only two of the four conditions of G1. The third is the landmark cross-check,
    # which no script can run yet, so G1 stays open until a `landmarks` entry says it passed.
    landmarks = document.get("landmarks") or {}
    document["g1"] = (
        "pass"
        if document["scales"] == "pass"
        and landmarks
        and all(v.get("delta_pct", 100) <= 10 for v in landmarks.values())
        else "open"
    )
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(document, handle, indent=2)
        handle.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Measure a reference view and prove its scale.")
    parser.add_argument("image")
    parser.add_argument("--view", required=True, choices=sorted(VIEW_TABLE))
    parser.add_argument("--length", type=float, help="real length in metres")
    parser.add_argument("--width", type=float, help="real width in metres")
    parser.add_argument("--height", type=float, help="real height in metres")
    parser.add_argument("--write", metavar="dimensions.json",
                        help="merge the entry into this dimensions.json")
    parser.add_argument("--optional", action="store_true",
                        help="record the view but keep it out of the gate (the underside, usually)")
    parser.add_argument("--source", default="art director",
                        help="where the real dimensions come from, for the record")
    parser.add_argument("--span", choices=("box", "robust"), default="box",
                        help="how to read the span: box is the bounding box, and it is the right "
                             "answer on a cropped view; robust smooths narrow spurs away (default box)")
    parser.add_argument("--json", action="store_true", help="print the entry as JSON only")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        stem, _ = os.path.splitext(args.image)
        for extension in (".png", ".webp", ".jpg", ".jpeg"):
            if os.path.exists(stem + extension):
                args.image = stem + extension
                break
        else:
            raise SystemExit(f"no reference image found for {args.image}")

    real = {}
    for key in ("length", "width", "height"):
        value = getattr(args, key)
        if value is not None:
            real[key] = value
    if len(real) != 3:
        raise SystemExit("all three of --length, --width, --height are required")

    entry = measure(args.image, args.view, real, args.span)
    entry["span_mode"] = args.span

    if args.write:
        write_entry(args.write, entry, real, "m", args.source, not args.optional)

    if args.json:
        print(json.dumps(entry, indent=2))
        return

    horizontal, vertical = VIEW_TABLE[args.view]
    prints = [
        f"view        {entry['view']}   {entry['image_px'][0]}x{entry['image_px'][1]} px"
        f"{'   (optional)' if args.optional else ''}",
        f"span        {entry['body_px'][0]} x {entry['body_px'][1]} px   ({args.span})"
        f"   (bounding box {entry['silhouette_box_px'][2] - entry['silhouette_box_px'][0] + 1}"
        f" x {entry['silhouette_box_px'][3] - entry['silhouette_box_px'][1] + 1},"
        f" protrusion {entry['protrusion_px'][0]} x {entry['protrusion_px'][1]} px)",
        f"spans       {entry['spans']}",
        f"scale       horizontal {entry['scale_mm_per_px']['horizontal']:.3f} mm/px   "
        f"vertical {entry['scale_mm_per_px']['vertical']:.3f} mm/px",
        f"anisotropy  {entry['anisotropy']:.4f}   ({entry['drift_pct']:.2f} % of drift, "
        f"budget {PASS_PCT:.0f} % pass / {CORRECTED_PCT:.0f} % reject)",
        f"gate        {entry['gate'].upper()}",
    ]
    if entry["gate"] == "corrected":
        prints.append(
            f"            This view is stretched by {entry['drift_pct']:.1f} %. Use the two scales"
        )
        prints.append(
            "            independently: convert every pixel distance to a fraction of the spanning"
        )
        prints.append(
            f"            dimension first. A single global scale would be off by "
            f"{abs(entry['naive_scale_error_mm']):.0f} mm over the span."
        )
    elif entry["gate"] == "reject":
        prints.append(
            f"            This view is stretched by {entry['drift_pct']:.1f} %, past the "
            f"{CORRECTED_PCT:.0f} % budget."
        )
        prints.append(
            "            It has lost the subject's shape: do not trace it. Regenerate it, or"
        )
        prints.append(
            "            check that it really is an elevation and not a three-quarter view."
        )
    print("\n".join(prints))
    if entry["gate"] == "reject":
        sys.exit(1)


if __name__ == "__main__":
    main()
