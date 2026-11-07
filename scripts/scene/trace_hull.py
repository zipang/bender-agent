#!/usr/bin/env python3
"""Trace the three silhouettes and intersect them into one solid: the visual hull.

Why this shape of method. A cross-section table asks the modeller to guess a section at every
station, and every guess is unmeasured. Three orthographic silhouettes are measurements: the left
view fixes the outline in Z and Y, the front view fixes it in X and Y, the top view fixes it in X
and Z. A point belongs to the subject only if all three views contain it, so the intersection of the
three extruded profiles is the largest volume consistent with the drawings.

What this method does NOT do: it does not validate the views. The hull matches the three views it
was built from by construction, so a good IoU on those three is a check of the tracing code, not of
the subject. The views it does not use -- `right`, `back`, `bottom` -- are the ones that can catch a
contradiction. Compare against those before believing the result.

Per station along Z, a section is a set of vertical columns:

    x in [xlo(z), xhi(z)]                 from the top view
    y in [max(ylo_front(x), ylo_side(z)), min(yhi_front(x), yhi_side(z))]

which is exactly the three-way intersection when each view gives one interval per column. A column
whose interval is empty is absent, which is how the nose and the tail taper.

Usage, from the repository root:

    python3 scripts/scene/trace_hull.py --subject blueprints/vehicules/r5-tl-1972 \
        --out scenes/r5-tl-1972/body-sections.js --step 20

It writes a JavaScript module holding the columns, in metres, Y up, +Z forward, centred on X = 0
and Z = 0, seated on Y = 0.
"""

import argparse
import json
import os

import numpy as np
from PIL import Image

# ---------------------------------------------------------------- view mapping

# How an image's two screen axes map onto the model's axes, and in which direction.
#
# Derived once, from the camera basis in `viewer/camera.js`, and written down here because a mirrored
# mapping produces a plausible car and passes nothing:
#
#   left   azimuth 0, up +Y   frame right = up x dir = (0,1,0) x (1,0,0) = -Z
#                             so image +x runs toward -Z: the nose, at the image left, is +Z
#   front  azimuth 90, up +Y  frame right = (0,1,0) x (0,0,1) = +X
#   top    azimuth 90, el ~90, up -Z   frame right = (0,0,-1) x (0,1,0) = +X
#                                      frame up = dir x right = (0,1,0) x (1,0,0) = -Z
#                                      so image +y (down) runs toward +Z
VIEWS = {
    # view: (horizontal model axis, horizontal sign, vertical model axis, vertical sign)
    # `sign` is what the IMAGE's increasing coordinate maps to. Vertical is always inverted here
    # because image y grows downward and model y grows upward.
    "left": ("z", -1, "y", -1),
    "right": ("z", +1, "y", -1),
    "front": ("x", +1, "y", -1),
    "back": ("x", -1, "y", -1),
    "top": ("x", +1, "z", +1),
}

# The three silhouettes the hull needs, and what each one constrains.
PROFILES = {
    "side": "left",
    "front": "front",
    "plan": "top",
}

WHITE_CUTOFF = 246  # a pixel darker than this on any channel is subject


# ---------------------------------------------------------------- masks

def load_mask(path):
    """A boolean mask of the subject, and nothing else.

    The background is a plain white field, so the test is per channel. A shadow or a halo would
    survive this test, which is why the cleaning pass runs before the views are generated and why
    `crop_reference.py` keeps a margin: the corners must stay background.
    """
    image = Image.open(path).convert("RGB")
    pixels = np.asarray(image).astype(np.int16)
    return (pixels.min(axis=2) < WHITE_CUTOFF)


def spans(mask):
    """The first and last true index of each row and column.

    A column of a silhouette is one interval from bottom to top, and a row is one interval from left
    to right. That holds for a vehicle face and for its plan; a subject with a hole through it -- a
    bicycle frame, a ladder -- needs the general outline, not this.
    """
    height, width = mask.shape
    rows = np.full((height, 2), -1, dtype=np.int32)
    for y in range(height):
        index = np.flatnonzero(mask[y])
        if index.size:
            rows[y] = (index[0], index[-1])
    cols = np.full((width, 2), -1, dtype=np.int32)
    for x in range(width):
        index = np.flatnonzero(mask[:, x])
        if index.size:
            cols[x] = (index[0], index[-1])
    return rows, cols


def column_interval(mask, x):
    """The vertical interval of column x, or None. Index-safe."""
    if x < 0 or x >= mask.shape[1]:
        return None
    index = np.flatnonzero(mask[:, x])
    if index.size == 0:
        return None
    return int(index[0]), int(index[-1])


# ---------------------------------------------------------------- geometry

class View:
    """One reference view, mapped into model metres.

    The anchor is the SUBJECT BOX CENTRE, not the image centre: the crop keeps a margin, and the
    calque is placed on the box. The box centre maps to the model centre in the two axes the view
    spans, and to half the real height on the vertical one.
    """

    def __init__(self, name, crop, crop_manifest, dimensions, real):
        self.name = name
        self.mask = load_mask(crop)
        entry = crop_manifest["views"][name]
        # `subject_box` is in SOURCE image coordinates, and `offset` is where that box sits inside
        # the CROPPED file. The cropped file is what every mask below is read from, so the box must
        # be re-expressed in its coordinates -- the same rule the calque applies, and the reason a
        # crop is calibrated on the subject box rather than on the file.
        sx0, sy0, sx1, sy1 = entry["subject_box"]
        offset_x, offset_y = entry["offset"]
        span_h = sx1 - sx0 + 1
        span_v = sy1 - sy0 + 1
        self.cx = offset_x + (span_h - 1) / 2.0
        self.cy = offset_y + (span_v - 1) / 2.0
        scale = dimensions["views"][name]["scale_mm_per_px"]
        self.kx = scale["horizontal"] / 1000.0   # metres per pixel, horizontal
        self.ky = scale["vertical"] / 1000.0

        # The subject box must describe the same rectangle the calibration used, or the two
        # disagree and every number below carries the difference.
        expect_h = dimensions["views"][name].get("span_px", {}).get("horizontal")
        if expect_h and abs(expect_h - span_h) > 1:
            raise SystemExit(
                f"{name}: crop span {span_h} px but the calibration used {expect_h} px"
            )

        self.axis_h, self.sign_h, self.axis_v, self.sign_v = VIEWS[name]
        self.height = real["height"] / 1000.0

    def to_model(self, px, py):
        """A pixel coordinate to the two model coordinates this view spans, in metres."""
        du = (px - self.cx) * self.kx * self.sign_h
        dv = (py - self.cy) * self.ky * self.sign_v
        if self.axis_v == "y":
            dv = dv + self.height / 2.0
        return du, dv

    def to_pixel(self, u, v):
        """The inverse, rounded to the nearest pixel."""
        dv = v - (self.height / 2.0 if self.axis_v == "y" else 0.0)
        px = self.cx + u / (self.kx * self.sign_h)
        py = self.cy + dv / (self.ky * self.sign_v)
        return int(round(px)), int(round(py))

    def vertical_interval(self, u):
        """The interval on the vertical axis, for one value `u` of the horizontal one.

        This is the column of the picture at `u`: a side view and a face view both answer "between
        which two heights is the subject present here". Returns (lo, hi) in metres, or None.
        """
        if self.axis_v != "y":
            raise ValueError(f"{self.name}: vertical_interval needs a view whose vertical axis is Y")
        px, _ = self.to_pixel(u, self.height / 2.0)
        span = column_interval(self.mask, px)
        if span is None:
            return None
        _, y0 = self.to_model(px, span[0])
        _, y1 = self.to_model(px, span[1])
        return (min(y0, y1), max(y0, y1))

    def horizontal_interval(self, v):
        """The interval on the horizontal axis, for one value `v` of the vertical one.

        This is the row of a plan view at one station: "between which two widths is the subject
        present here". Returns (lo, hi) in metres, or None.
        """
        if self.axis_h not in ("x", "z"):
            raise ValueError(f"{self.name}: horizontal_interval needs a plan view")
        u_zero = 0.0
        _, py = self.to_pixel(u_zero, v)
        if py < 0 or py >= self.mask.shape[0]:
            return None
        index = np.flatnonzero(self.mask[py])
        if index.size == 0:
            return None
        u0 = self.to_model(index[0], py)[0]
        u1 = self.to_model(index[-1], py)[0]
        return (min(u0, u1), max(u0, u1))


# ---------------------------------------------------------------- hull

def build_hull(subject, real, step_mm):
    with open(os.path.join(subject, "cropped", "manifest.json"), encoding="utf-8") as handle:
        manifest = json.load(handle)
    with open(os.path.join(subject, "dimensions.json"), encoding="utf-8") as handle:
        dimensions = json.load(handle)

    views = {}
    for role, name in PROFILES.items():
        path = os.path.join(subject, "cropped", f"{name}.png")
        views[role] = View(name, path, manifest, dimensions, real)

    side, front, plan = views["side"], views["front"], views["plan"]

    length = real["length"] / 1000.0
    width = real["width"] / 1000.0
    height = real["height"] / 1000.0
    step = step_mm / 1000.0

    # Columns across X, at a fixed pitch, centred on 0.
    count_x = int(round(width / step)) + 1
    xs = np.linspace(-width / 2, width / 2, count_x)

    # Front view: the vertical interval of every column, computed once.
    front_span = np.empty((count_x, 2))
    front_span[:] = np.nan
    for i, x in enumerate(xs):
        interval = front.vertical_interval(float(x))
        if interval:
            front_span[i] = interval

    stations = int(round(length / step)) + 1
    zs = np.linspace(-length / 2, length / 2, stations)

    sections = []
    for k, z in enumerate(zs):
        # The side view answers at this station; the plan view too. Both are indexed by Z here,
        # which is the one axis the two share -- and the earlier version of this loop indexed the
        # side view by zero, so every section carried the middle of the car.
        side_span = side.vertical_interval(float(z))
        plan_span = plan.horizontal_interval(float(z))
        if side_span is None or plan_span is None:
            sections.append({"z": round(float(z), 4), "columns": []})
            continue
        y_lo_side, y_hi_side = side_span
        x_lo, x_hi = plan_span

        columns = []
        for i, x in enumerate(xs):
            if not (x_lo - 1e-9 <= x <= x_hi + 1e-9):
                continue
            if not np.isfinite(front_span[i, 0]):
                continue
            y_lo = max(front_span[i, 0], y_lo_side)
            y_hi = min(front_span[i, 1], y_hi_side)
            if y_hi - y_lo < 1e-4:
                continue
            # The grid index travels with the column. Two consecutive stations rarely share the same
            # set of columns -- the nose tapers faster than a 20 mm pitch -- so the mesh must match
            # columns by index in X, never by position in the list.
            columns.append([i, round(float(x), 4), round(float(y_lo), 4), round(float(y_hi), 4)])

        sections.append({"z": round(float(z), 4), "columns": columns})

    return {
        "unit": "m",
        "up": "y",
        "forward": "z",
        "step_mm": step_mm,
        "pitch": round(step, 6),
        "columns": count_x,
        "real": {"length": length, "width": width, "height": height},
        "views_used": list(PROFILES.values()),
        "sections": sections,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Intersect three silhouettes into one solid.")
    parser.add_argument("--subject", required=True)
    parser.add_argument("--out", required=True, help="the JavaScript module to write")
    parser.add_argument("--step", type=float, default=20.0, help="column and station pitch, mm")
    parser.add_argument("--json", help="also write the raw data here")
    args = parser.parse_args()

    with open(os.path.join(args.subject, "dimensions.json"), encoding="utf-8") as handle:
        dimensions = json.load(handle)
    real = {name: entry["value"] * (1000 if dimensions.get("unit", "m") == "m" else 1)
            for name, entry in dimensions["real"].items()}

    hull = build_hull(args.subject, real, args.step)

    columns = sum(len(s["columns"]) for s in hull["sections"])
    filled = sum(1 for s in hull["sections"] if s["columns"])
    print(f"sections  {len(hull['sections'])}, {filled} with columns")
    print(f"columns   {columns} across {len(hull['sections'])} stations")
    print(f"step      {args.step} mm")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(hull, handle, indent=1)
            handle.write("\n")
        print(f"json      {args.json}")

    header = (
        "// The body, as an intersection of three silhouettes. Generated by\n"
        "// `scripts/scene/trace_hull.py`; edit the tracer, not this file.\n"
        "//\n"
        "// A point belongs to the subject if the left view, the front view and the top view all\n"
        "// contain it. Each section is the set of vertical columns that survive all three, at one\n"
        "// station along Z. Units are metres, Y is up, +Z is forward (the nose), and the body is\n"
        "// centred on X = 0 and Z = 0.\n"
        "//\n"
        "// What it reproduces: the three views it was built from, by construction. What it cannot\n"
        "// check: the views it did not use. That is what `right`, `back` and `bottom` are for.\n"
    )
    with open(args.out, "w", encoding="utf-8") as handle:
        handle.write(header)
        handle.write(f"export const TRACE = {json.dumps({k: v for k, v in hull.items() if k != 'sections'}, separators=(',', ':'))};\n\n")
        handle.write("export const SECTIONS = [\n")
        for section in hull["sections"]:
            cols = ",".join(f"[{c[0]},{c[1]},{c[2]},{c[3]}]" for c in section["columns"])
            handle.write(f'  {{ z: {section["z"]}, columns: [{cols}] }},\n')
        handle.write("];\n")
    print(f"module    {args.out}  {os.path.getsize(args.out) // 1024} KiB")


if __name__ == "__main__":
    main()
