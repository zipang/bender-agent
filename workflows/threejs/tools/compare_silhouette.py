#!/usr/bin/env python3
"""Compare the model's silhouette to a reference view, as two binary masks.

This is the instrument stage 2 is judged with, and it exists because a shaded render hides errors
that a silhouette cannot. Both images are reduced to subject / not subject, laid in the same metric
frame, and differenced. What is left is the shape error, in millimetres, with nowhere to hide.

How the two masks are placed. Not by a global scale factor and not by eye:

  - the reference gets its two scales, `kx` and `ky`, from `dimensions.json`. They differ, because
    a generated view is stretched;
  - the model gets its two scales from its own bounding box in the render, and its world bounding
    box from the sidecar that `ctl.ts shot` writes next to the image. A model render is an
    orthographic projection, so its scale is uniform and exact;
  - the two are then anchored on the landmarks that define the subject: the nose and the ground for
    an elevation, the centre and the roof for a head-on view.

Anchoring on the nose and the ground is deliberate. It keeps a length error visible at the tail and
a height error visible at the roof, instead of cancelling them into a tidy ratio.

Usage:

    bun run scripts/scene/ctl.ts open --shot --url http://127.0.0.1:5180
    bun run scripts/scene/ctl.ts view left
    bun run scripts/scene/ctl.ts shot /tmp/opencode/left.webp

    python3 scripts/scene/compare_silhouette.py --subject blueprints/vehicules/r5-tl-1972 \\
        --view left --render /tmp/opencode/left.webp --out /tmp/opencode/cmp-left.png

It prints the spans on both axes, the overlap, and a station table of the top edge and the bottom
edge, in millimetres.
"""

import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw


# ---------------------------------------------------------------- masks

def subject_mask(image: Image.Image, tolerance: int = 26) -> np.ndarray:
    """True on the subject. A flood fill from the corners, never a brightness threshold.

    A white field and a studio grey both work; a threshold does not, because a pale bumper and a
    dark tyre are both subject and one of them is always on the wrong side of the cut.
    """
    pixels = np.asarray(image.convert("RGB")).astype(np.int16)
    h, w, _ = pixels.shape
    background = np.zeros((h, w), bool)
    for seed in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]:
        if background[seed]:
            continue
        candidate = np.abs(pixels - pixels[seed]).max(axis=2) < tolerance
        region = np.zeros((h, w), bool)
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


def bbox(mask: np.ndarray):
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if rows.size == 0:
        raise SystemExit("empty mask: the subject was not found")
    return int(cols[0]), int(rows[0]), int(cols[-1]), int(rows[-1])


# ---------------------------------------------------------------- placement

# The view table is shared with the page and with the other tools: `viewer/views.json` holds the
# axes and the anchor rule, so a view cannot exist in the browser and be missing here.
#
#   anchor "edge-ground": the leading edge, and the ground. Side elevations.
#   anchor "center-top":  the horizontal centre, and the top edge. Head-on views.
#   anchor "center":      the centre on both axes. Plan views.
VIEWS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "viewer", "views.json")

with open(VIEWS_FILE, encoding="utf-8") as handle:
    VIEWS = json.load(handle)["views"]

# Only a view that owns a calque has a reference image to compare against.
LAYOUT = {
    name: (view["axes"], view.get("anchor", "center"))
    for name, view in VIEWS.items()
    if view.get("plate")
}


def load_dimensions(subject: str, view: str) -> dict:
    path = os.path.join(subject, "dimensions.json")
    with open(path, encoding="utf-8") as handle:
        document = json.load(handle)
    entry = document["views"].get(view)
    if entry is None:
        raise SystemExit(f"no dimensions entry for view '{view}' in {path}")
    return entry


def reference_metrics(path: str, kx: float, ky: float):
    """The reference mask, and the pixel box of the subject."""
    image = Image.open(path)
    mask = subject_mask(image)
    box = bbox(mask)
    return image, mask, box


def resample(mask: np.ndarray, scale_x: float, scale_y: float, anchor_px, anchor_new, size):
    """Nearest-neighbour remap of a mask about an anchor, into a new pixel grid.

    Out-of-range samples are EMPTY, not clamped. Clamping to the border replicates the edge column
    and row across everything outside the source, which smears the mask to the canvas edge and
    produces a comparison that looks aligned and is meaningless.
    """
    # scale_x is (reference mm per px) / (model mm per px), so it already converts a reference
    # distance INTO model pixels: multiply. Dividing walks the sample off the image entirely.
    width, height = size
    x = (np.arange(width) - anchor_new[0]) * scale_x + anchor_px[0]
    y = (np.arange(height) - anchor_new[1]) * scale_y + anchor_px[1]
    xi = np.round(x).astype(int)
    yi = np.round(y).astype(int)
    inside_x = (xi >= 0) & (xi < mask.shape[1])
    inside_y = (yi >= 0) & (yi < mask.shape[0])
    out = np.zeros((height, width), bool)
    out[np.ix_(inside_y, inside_x)] = mask[np.ix_(yi[inside_y], xi[inside_x])]
    return out


def edges(mask: np.ndarray):
    """Top and bottom row of the subject, per column. -1 where the column is empty."""
    h, w = mask.shape
    top = np.full(w, -1, int)
    bottom = np.full(w, -1, int)
    for x in range(w):
        column = np.where(mask[:, x])[0]
        if column.size:
            top[x] = column[0]
            bottom[x] = column[-1]
    return top, bottom


def widths(mask: np.ndarray):
    """Left and right column of the subject, per row. -1 where the row is empty."""
    h, w = mask.shape
    left = np.full(h, -1, int)
    right = np.full(h, -1, int)
    for y in range(h):
        row = np.where(mask[y])[0]
        if row.size:
            left[y] = row[0]
            right[y] = row[-1]
    return left, right


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare a model silhouette to a reference view.")
    parser.add_argument("--subject", required=True)
    parser.add_argument("--view", required=True, choices=sorted(LAYOUT))
    parser.add_argument("--render", required=True, help="the model capture")
    parser.add_argument("--out", help="write an overlay PNG here")
    parser.add_argument("--steps", type=int, default=16, help="stations in the edge tables")
    args = parser.parse_args()

    entry = load_dimensions(args.subject.rstrip("/"), args.view)
    kx = float(entry["scale_mm_per_px"]["horizontal"])
    ky = float(entry["scale_mm_per_px"]["vertical"])

    ref_image, ref_mask, ref_box = reference_metrics(entry["file"], kx, ky)
    model_image = Image.open(args.render)
    model_mask = subject_mask(model_image)
    model_box = bbox(model_mask)

    # The model's own scale comes from its bounding box and its world size. Both are exact for an
    # orthographic render, so no camera parameter has to be trusted.
    sidecar_path = f"{args.render}.json"
    if os.path.exists(sidecar_path):
        with open(sidecar_path, encoding="utf-8") as handle:
            stats = json.load(handle)
        world = stats["size"]
        # `axes: "zy"` means the image's width runs along Z and its height along Y. A plan view is
        # "xz", so the vertical axis is not always Y and the index cannot be assumed.
        axes = LAYOUT[args.view][0]
        horizontal_axis, vertical_axis = axes[0], axes[1]
        index = {"x": 0, "y": 1, "z": 2}
        span_h = world[index[horizontal_axis]] * 1000.0
        span_v = world[index[vertical_axis]] * 1000.0
    else:
        print(f"warning: no sidecar at {sidecar_path}; the model scale falls back to the reference",
              file=sys.stderr)
        span_h = (ref_box[2] - ref_box[0] + 1) * kx
        span_v = (ref_box[3] - ref_box[1] + 1) * ky

    ref_span_h = (ref_box[2] - ref_box[0] + 1) * kx
    ref_span_v = (ref_box[3] - ref_box[1] + 1) * ky
    model_span_h_px = model_box[2] - model_box[0] + 1
    model_span_v_px = model_box[3] - model_box[1] + 1
    model_kx = span_h / model_span_h_px
    model_ky = span_v / model_span_v_px

    # Anchor both masks on the same landmark of the reference frame.
    # A body without wheels has no ground contact, so its lowest point is the sill. Anchoring its
    # bottom on the reference's tyre contact would build a 265 mm error into the comparison before
    # any geometry is measured, and it would land entirely on the roof. The sill is a declared
    # number, so the model is lifted by exactly that much and the two bottoms then mean the same
    # thing: the underside of the body.
    sill_mm = float(stats.get("min", [0, 0, 0])[1]) * 1000.0 if os.path.exists(sidecar_path) else 0.0

    anchor_name = LAYOUT[args.view][1]
    if anchor_name == "edge-ground":
        ref_anchor = (ref_box[0], ref_box[3] - sill_mm / ky)
        model_anchor = (model_box[0], model_box[3])
    elif anchor_name == "center-top":
        ref_anchor = ((ref_box[0] + ref_box[2]) / 2, ref_box[1])
        model_anchor = ((model_box[0] + model_box[2]) / 2, model_box[1])
    else:
        ref_anchor = ((ref_box[0] + ref_box[2]) / 2, (ref_box[1] + ref_box[3]) / 2)
        model_anchor = ((model_box[0] + model_box[2]) / 2, (model_box[1] + model_box[3]) / 2)

    # Model pixels -> reference pixels, about the shared anchor.
    scale_x = kx / model_kx
    scale_y = ky / model_ky
    size = (ref_image.width, ref_image.height)
    model_aligned = resample(model_mask, scale_x, scale_y, model_anchor, ref_anchor, size)

    both = ref_mask & model_aligned
    ref_only = ref_mask & ~model_aligned
    model_only = model_aligned & ~ref_mask
    union = ref_mask | model_aligned
    iou = both.sum() / union.sum() if union.sum() else 0.0

    print(f"view          {args.view}   anchor {anchor_name}")
    if sill_mm:
        print(f"note          the model carries no wheels: its underside is lifted {sill_mm:.0f} mm "
              f"to sit at the reference's sill, not on its tyres")
        print(f"              the band below the sill is the wheel zone, and it is NOT comparable "
              f"at stage 2")
    print(f"reference     {ref_image.width} x {ref_image.height} px   "
          f"kx {kx:.3f}  ky {ky:.3f} mm/px")
    print(f"model         {model_image.width} x {model_image.height} px   "
          f"scaled x{scale_x:.3f} y{scale_y:.3f} to fit")
    print()
    print(f"span horizontal   reference {ref_span_h:7.0f} mm   model {span_h:7.0f} mm   "
          f"delta {span_h - ref_span_h:+7.0f} mm")
    print(f"span vertical     reference {ref_span_v:7.0f} mm   model {span_v:7.0f} mm   "
          f"delta {span_v - ref_span_v:+7.0f} mm")
    print()
    print(f"overlap           {100.0 * both.sum() / union.sum():.1f} % of the union   "
          f"(IoU {iou:.3f})")
    print(f"                  reference only {100.0 * ref_only.sum() / union.sum():.1f} %   "
          f"model only {100.0 * model_only.sum() / union.sum():.1f} %")

    # Station tables, in millimetres. This is the part a gate reads.
    if LAYOUT[args.view][0] == "z":
        ref_top, ref_bottom = edges(ref_mask)
        mod_top, mod_bottom = edges(model_aligned)
        columns = np.where((ref_top >= 0) & (mod_top >= 0))[0]
        if columns.size:
            picks = np.linspace(columns[0], columns[-1], args.steps).round().astype(int)
            print()
            print("  from the nose        top edge                 bottom edge")
            print("  station   ref   model   delta      ref   model   delta")
            worst_top = (0, 0)
            for column in picks:
                z = (column - ref_box[0]) * kx
                rt = (ref_box[3] - ref_top[column]) * ky
                mt = (ref_box[3] - mod_top[column]) * ky
                rb = (ref_box[3] - ref_bottom[column]) * ky
                mb = (ref_box[3] - mod_bottom[column]) * ky
                dt, db = mt - rt, mb - rb
                if abs(dt) > abs(worst_top[1]):
                    worst_top = (z, dt)
                print(f"  {z:7.0f}   {rt:6.0f} {mt:6.0f} {dt:+6.0f}    "
                      f"{rb:6.0f} {mb:6.0f} {db:+6.0f}")
            print()
            print(f"  worst top-edge delta {worst_top[1]:+.0f} mm at {worst_top[0]:.0f} mm from the nose")
    else:
        ref_left, ref_right = widths(ref_mask)
        mod_left, mod_right = widths(model_aligned)
        rows = np.where((ref_left >= 0) & (mod_left >= 0))[0]
        if rows.size:
            picks = np.linspace(rows[0], rows[-1], args.steps).round().astype(int)
            print()
            print("  from the ground      left edge                right edge")
            print("  station   ref   model   delta      ref   model   delta")
            for row in picks:
                y = (ref_box[3] - row) * ky
                rl = (ref_left[row] - ref_anchor[0]) * kx
                ml = (mod_left[row] - ref_anchor[0]) * kx
                rr = (ref_right[row] - ref_anchor[0]) * kx
                mr = (mod_right[row] - ref_anchor[0]) * kx
                print(f"  {y:7.0f}   {rl:+6.0f} {ml:+6.0f} {ml - rl:+6.0f}    "
                      f"{rr:+6.0f} {mr:+6.0f} {mr - rr:+6.0f}")
            print()
            print(f"  widest   reference {ref_right.max() - ref_left.min():.0f} mm   "
                  f"model {(mod_right.max() - mod_left.min()) * model_kx / kx:+.0f} mm remapped")

    if args.out:
        overlay = Image.new("RGB", size, (255, 255, 255))
        pixels = np.array(overlay)
        pixels[both] = (120, 120, 120)
        pixels[ref_only] = (220, 60, 50)
        pixels[model_only] = (50, 110, 220)
        overlay = Image.fromarray(pixels)
        draw = ImageDraw.Draw(overlay)
        draw.text((8, 8), f"{args.view}  IoU {iou:.3f}  "
                          f"h {span_h - ref_span_h:+.0f} mm  v {span_v - ref_span_v:+.0f} mm",
                  fill=(0, 0, 0))
        overlay.save(args.out)
        print()
        print(f"overlay  {args.out}   grey both, red reference only, blue model only")


if __name__ == "__main__":
    main()
