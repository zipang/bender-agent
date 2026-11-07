#!/usr/bin/env python3
"""Trace three silhouettes and intersect them into one solid: the main volume.

Why this shape of method. A cross-section table asks the modeller to guess a section at every
station, and every guess is unmeasured. Three orthographic silhouettes are measurements: the left
view fixes the outline in Z and Y, the front view fixes it in X and Y, the top view fixes it in X
and Z. A point belongs to the subject only if all three views contain it, so the intersection of the
three extruded profiles is the largest volume consistent with the drawings.

What this method does NOT do: it does not validate the views. The hull matches the three views it
was built from by construction, so a good IoU on those three is a check of the tracing code, not of
the subject. The views it does not use -- `right`, `back`, `bottom` -- are the ones that can catch a
contradiction. Compare against those before believing the result.

THE MAIN VOLUME, NOT EVERYTHING THAT TOUCHES IT

A silhouette contains the accessories glued to the subject: mirrors, bumpers, tyres, badges.
Extruding the whole silhouette makes the hull the outer envelope of the ACCESSORIES, so a mirror
becomes part of the body, the body's flanks swell to include it, and stage 3 has nowhere to put it.

An accessory is geometrically a BUMP: it leaves the smooth outline for a short distance and comes
back. A bumper, a mirror and a tyre are all of that shape; the body's own shoulder, sill and roofline
are not. So the cut is geometric, not chromatic: every interval the tracer reads is first ERODED by a
rolling window along its own axis --

    yhi(x) <- min over [x - w, x + w] of yhi        the outline can only move inward
    ylo(x) <- max over [x - w, x + w] of ylo

-- which removes anything narrower than the window and leaves everything wider exactly where it was.
A colour cut was tried first and removed the rocker panel with the bumpers: the lower body is a
different hue in the reference, and the shell is not one colour. A window is a length, and a length
is the thing the drawings actually measure.

The cut is not free, and it is reported, not hidden:
  - the nose and the tail shorten by the depth of a bumper that was the only thing present there;
  - the bottom rises to the sill, because the tyres reach lower than the shell;
  - a mirror, whose stalk is narrower than the window, disappears from the flank.
All three are correct for a body-only volume.

WHICH VIEW WIDTHS THE BODY

The hull takes the narrowest of every constraint it is given, so a view that under-reports a
dimension silently shrinks the solid -- and the numbers still look plausible.

The plan view is the worst offender on a subject with mirrors. Its calibration box is sized on the
whole silhouette, and the widest run of a generated plan is often a mirror: on this subject the plan
reaches the real width on 13 rows out of 706, while its body sits at 1400 mm. Mapping that box to the
real width makes every body column short, and the hull inherits the error on all of them.

The face views do not have that problem. `front` and `back` both reach 1527 mm over hundreds of rows,
so their body width is the width they were calibrated on.

`--face` therefore chooses which face view constrains Y per X, and `--width-from` chooses which view
fixes the absolute width. The default takes the width from the face and lets the plan give only the
SHAPE of the taper: each station's plan interval is scaled so the widest body run matches the face
view's. The nose and the tail keep the profile the plan drew, at the width the face view proves.

`--width-from plan` restores the pure intersection. `--mask raw` restores the outer envelope.
`--smooth-mm 0` disables the opening.

PER STATION, A SECTION IS A SET OF VERTICAL COLUMNS

    x in [xlo(z), xhi(z)]                      from the plan view
    y in [max(ylo_front(x), ylo_side(z)),      from the front view and the side view
          min(yhi_front(x), yhi_side(z))]

which is the three-way intersection when each view gives one interval per column. A column whose
interval is empty is absent, which is how the nose and the tail taper.

Usage, from the repository root:

    python3 scripts/scene/trace_hull.py --subject blueprints/vehicules/r5-tl-1972 \
        --out scenes/r5-tl-1972/body-hull.js --step 20

    # keep every accessory: the outer envelope instead of the main volume
    python3 scripts/scene/trace_hull.py ... --mask silhouette

    # a body that is not one hue, or a hue the auto detector gets wrong
    python3 scripts/scene/trace_hull.py ... --hue 205 --hue-width 25 --sat-min 0.3
"""

import argparse
import json
import os

import numpy as np
from PIL import Image

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
    # `sign` is what the IMAGE's increasing coordinate maps to. Vertical is inverted because image
    # y grows downward and model y grows upward.
    "left": ("z", -1, "y", -1),
    "right": ("z", +1, "y", -1),
    "front": ("x", +1, "y", -1),
    "back": ("x", -1, "y", -1),
    "top": ("x", +1, "z", +1),
}

# The silhouettes the hull needs, and what each one constrains. The side view is fixed: it is the
# only one that gives the height profile over the length. The face view is a choice (see the
# docstring), and the plan view supplies the shape of the width.
def profiles(face):
    return {"side": "left", "face": face, "plan": "top"}

WHITE_CUTOFF = 246  # a pixel darker than this on any channel is not background


# ---------------------------------------------------------------- colour

def erode(lo, hi, radius):
    """Shrink every interval by the narrowest neighbour within `radius` samples.

    `lo` and `hi` are float arrays over a sampling axis, NaN where the silhouette is absent. Each
    sample takes the largest low and the smallest high of its window, so the outline can only move
    inward. NaN is skipped, never propagated: a gap must not erase the samples beside it.
    """
    n = lo.size
    out_lo = np.array(lo, copy=True)
    out_hi = np.array(hi, copy=True)
    for i in range(n):
        if np.isnan(out_lo[i]) or np.isnan(out_hi[i]):
            continue
        a = max(0, i - radius)
        b = min(n, i + radius + 1)
        low = lo[a:b][~np.isnan(lo[a:b])]
        high = hi[a:b][~np.isnan(hi[a:b])]
        if low.size:
            out_lo[i] = max(out_lo[i], float(low.max()))
        if high.size:
            out_hi[i] = min(out_hi[i], float(high.min()))
    return out_lo, out_hi


def dilate(lo, hi, radius):
    """Grow every interval by the widest neighbour within `radius` samples.

    The inverse of `erode`, applied to its result. A sample that erosion left NaN stays absent: the
    window found nothing there that belonged to the subject.
    """
    n = lo.size
    out_lo = np.array(lo, copy=True)
    out_hi = np.array(hi, copy=True)
    for i in range(n):
        if np.isnan(lo[i]) or np.isnan(hi[i]):
            continue
        a = max(0, i - radius)
        b = min(n, i + radius + 1)
        low = lo[a:b][~np.isnan(lo[a:b])]
        high = hi[a:b][~np.isnan(hi[a:b])]
        if low.size:
            out_lo[i] = min(out_lo[i], float(low.min()))
        if high.size:
            out_hi[i] = max(out_hi[i], float(high.max()))
    return out_lo, out_hi


def open_intervals(lo, hi, radius):
    """Erode, then dilate: the morphological OPENING of an outline.

    Erosion alone removes a protrusion and every taper with it, because a taper is a long run of
    small moves inward and each sample sees its neighbours. The dilation that follows restores the
    width wherever the eroded outline is flat, so the taper comes back and the protrusion does not:
    a bump narrower than the window has been flattened past the point of no return.

    This is the difference between "remove what sticks out" and "remove what is narrow", and only
    the second one is true of an accessory.
    """
    if radius <= 0:
        return np.array(lo, copy=True), np.array(hi, copy=True)
    eroded_lo, eroded_hi = erode(lo, hi, radius)
    # A sample whose erosion inverted it is absent: the window found nothing it could belong to.
    inverted = eroded_hi < eroded_lo
    eroded_lo[inverted] = np.nan
    eroded_hi[inverted] = np.nan
    return dilate(eroded_lo, eroded_hi, radius)


# ---------------------------------------------------------------- masks

def load_rgb(path):
    """The cropped view as an 8-bit RGB array."""
    return np.asarray(Image.open(path).convert("RGB"))


def silhouette_mask(rgb):
    """Every non-background pixel: the subject and each accessory on it.

    The background is a plain white field, so the test is per channel. A shadow or a halo would
    survive this test, which is why the cleaning pass runs before the views are generated and why
    `crop_reference.py` keeps a margin: the corners must stay background.
    """
    return rgb.min(axis=2) < WHITE_CUTOFF


# ---------------------------------------------------------------- geometry

class View:
    """One reference view, mapped into model metres, with its mask already cut to the body.

    The anchor is the SUBJECT BOX CENTRE, not the image centre: the crop keeps a margin, and the
    calque is placed on the box. The box centre maps to the model centre on the two axes the view
    spans, and to half the real height on the vertical one.
    """

    def __init__(self, name, subject, manifest, dimensions, real, smooth_mm, mask_mode):
        self.name = name
        path = os.path.join(subject, "cropped", f"{name}.png")
        rgb = load_rgb(path)
        self.silhouette = silhouette_mask(rgb)
        # `raw` keeps every accessory: the outer envelope, useful to see how much is being cut.
        self.mask = self.silhouette if mask_mode == "raw" else self.silhouette

        entry = manifest["views"][name]
        # `subject_box` is in SOURCE image coordinates and `offset` is where that box sits inside
        # the CROPPED file. The masks are read from the cropped file, so the box is re-expressed in
        # its coordinates -- the same rule the calque applies.
        sx0, sy0, sx1, sy1 = entry["subject_box"]
        offset_x, offset_y = entry["offset"]
        span_h = sx1 - sx0 + 1
        span_v = sy1 - sy0 + 1
        self.cx = offset_x + (span_h - 1) / 2.0
        self.cy = offset_y + (span_v - 1) / 2.0

        scale = dimensions["views"][name]["scale_mm_per_px"]
        self.kx = scale["horizontal"] / 1000.0   # metres per pixel, horizontal
        self.ky = scale["vertical"] / 1000.0

        self.axis_h, self.sign_h, self.axis_v, self.sign_v = VIEWS[name]
        self.height = real["height"] / 1000.0

        # The intervals are read once per axis into arrays, eroded, then served from memory. A
        # per-call scan of the mask would re-erode a moving window, and the erosion is not local to
        # the call: it depends on neighbours the caller never asks for.
        self.rows = self._read_rows()          # indexed by y: (lo, hi) on the horizontal axis
        self.cols = self._read_cols()          # indexed by x: (lo, hi) on the vertical axis
        if mask_mode != "raw" and smooth_mm > 0:
            # The radius of an array follows the PIXEL AXIS it is indexed by, not the model axis the
            # view constrains: `cols` walks image x, whose scale is kx; `rows` walks image y, whose
            # scale is ky. Swapping them makes the window several times too long on a stretched
            # view, and the opening then eats a shoulder instead of a mirror.
            radius_cols = max(1, int(round(smooth_mm / 1000.0 / self.kx)))
            radius_rows = max(1, int(round(smooth_mm / 1000.0 / self.ky)))
            self.cols = open_intervals(*self.cols, radius_cols)
            self.rows = open_intervals(*self.rows, radius_rows)

    def _read_cols(self):
        """Per column: the first and last row of the mask, as float arrays with NaN for absent."""
        width = self.mask.shape[1]
        lo = np.full(width, np.nan)
        hi = np.full(width, np.nan)
        for x in range(width):
            index = np.flatnonzero(self.mask[:, x])
            if index.size:
                lo[x] = index[0]
                hi[x] = index[-1]
        return lo, hi

    def _read_rows(self):
        """Per row: the first and last column of the mask, as float arrays with NaN for absent."""
        height = self.mask.shape[0]
        lo = np.full(height, np.nan)
        hi = np.full(height, np.nan)
        for y in range(height):
            index = np.flatnonzero(self.mask[y])
            if index.size:
                lo[y] = index[0]
                hi[y] = index[-1]
        return lo, hi

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
        """The interval on Y, for one value `u` of this view's horizontal axis.

        A side view and a face view both answer "between which two heights is the subject present
        here". Returns (lo, hi) in metres, or None.
        """
        if self.axis_v != "y":
            raise ValueError(f"{self.name}: vertical_interval needs a view whose vertical axis is Y")
        px, _ = self.to_pixel(u, self.height / 2.0)
        if px < 0 or px >= self.cols[0].size:
            return None
        y0, y1 = self.cols[0][px], self.cols[1][px]
        if np.isnan(y0) or np.isnan(y1):
            return None
        _, lo = self.to_model(px, y0)
        _, hi = self.to_model(px, y1)
        return (min(lo, hi), max(lo, hi))

    def horizontal_interval(self, v):
        """The interval on X, for one value `v` of this view's vertical axis.

        A plan view answers "between which two widths is the subject present at this station".
        Returns (lo, hi) in metres, or None.
        """
        if self.axis_h != "x" or self.axis_v != "z":
            raise ValueError(f"{self.name}: horizontal_interval needs a plan view")
        _, py = self.to_pixel(0.0, v)
        if py < 0 or py >= self.rows[0].size:
            return None
        x0, x1 = self.rows[0][py], self.rows[1][py]
        if np.isnan(x0) or np.isnan(x1):
            return None
        u0 = self.to_model(x0, py)[0]
        u1 = self.to_model(x1, py)[0]
        return (min(u0, u1), max(u0, u1))

    def extents(self, mask):
        """The pixel box of a mask, or None."""
        ys, xs = np.nonzero(mask)
        if xs.size == 0:
            return None
        return int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())


# ---------------------------------------------------------------- hull

def build_hull(subject, real, step_mm, mask_mode, smooth_mm, face_view, width_from):
    with open(os.path.join(subject, "cropped", "manifest.json"), encoding="utf-8") as handle:
        manifest = json.load(handle)
    with open(os.path.join(subject, "dimensions.json"), encoding="utf-8") as handle:
        dimensions = json.load(handle)

    table = profiles(face_view)
    views = {}
    for role, name in table.items():
        views[role] = View(name, subject, manifest, dimensions, real, smooth_mm, mask_mode)
    side, face, plan = views["side"], views["face"], views["plan"]

    length = real["length"] / 1000.0
    width = real["width"] / 1000.0
    height = real["height"] / 1000.0
    step = step_mm / 1000.0

    # Which view fixes the absolute width. The plan's box is often sized on a mirror, so its body
    # columns are all short by the same ratio; the face view reaches the real width over hundreds of
    # rows. `plan` restores the pure intersection, `face` keeps the plan's SHAPE and the face's size.
    if width_from == "face":
        plan_width = widest_run(*plan.rows) * plan.kx
        face_width = widest_run(*face.rows) * face.kx
        plan_x_scale = face_width / plan_width if plan_width > 0 and face_width > 0 else 1.0
    elif width_from == "real":
        # The real width is an INPUT. Every view's calibration box is sized on the whole silhouette,
        # and the widest pixel run of that silhouette is usually an accessory -- a mirror on the plan,
        # a bumper on the face. Mapping that box to the real width therefore makes the BODY short by
        # the accessory's depth, in every view at once, and no view can outvote the others when all
        # of them carry the same error.
        #
        # So the plan keeps the SHAPE of the taper and the real dimension fixes the scale: the widest
        # body run of the plan becomes the real width. This is the same rule the length already
        # follows, where the plan's box is mapped to the real length.
        plan_width = widest_run(*plan.rows) * plan.kx
        plan_x_scale = (width / plan_width) if plan_width > 0 else 1.0
    else:
        plan_x_scale = 1.0

    # Columns across X, at a fixed pitch, centred on 0.
    count_x = int(round(width / step)) + 1
    xs = np.linspace(-width / 2, width / 2, count_x)

    # The face view: the vertical interval of every column, computed once.
    face_span = np.full((count_x, 2), np.nan)
    for i, x in enumerate(xs):
        interval = face.vertical_interval(float(x))
        if interval:
            face_span[i] = interval

    stations = int(round(length / step)) + 1
    zs = np.linspace(-length / 2, length / 2, stations)

    sections = []
    for z in zs:
        # Both views are indexed by Z, the one axis they share.
        side_span = side.vertical_interval(float(z))
        plan_span = plan.horizontal_interval(float(z))
        if side_span is None or plan_span is None:
            sections.append({"z": round(float(z), 4), "columns": []})
            continue
        y_lo_side, y_hi_side = side_span
        # The plan gives the width at this station. Scaled about the centre, it keeps the taper of
        # the nose and the tail and adopts the width the face view proves.
        x_lo, x_hi = plan_span[0] * plan_x_scale, plan_span[1] * plan_x_scale

        columns = []
        for i, x in enumerate(xs):
            if not (x_lo - 1e-9 <= x <= x_hi + 1e-9):
                continue
            if not np.isfinite(face_span[i, 0]):
                continue
            y_lo = max(face_span[i, 0], y_lo_side)
            y_hi = min(face_span[i, 1], y_hi_side)
            if y_hi - y_lo < 1e-4:
                continue
            # The grid index travels with the column: two consecutive stations rarely share the same
            # set of columns, so the mesh must match them by index, never by list position.
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
        "views_used": [name for name in table.values()],
        "mask": mask_mode,
        "smooth_mm": smooth_mm,
        "face_view": face_view,
        "width_from": width_from,
        "plan_x_scale": round(plan_x_scale, 6),
        "sections": sections,
    }, views


def widest_run(lo, hi):
    """The widest single interval of an array pair, in samples. 0 when nothing is left."""
    live = ~np.isnan(lo) & ~np.isnan(hi)
    if not live.any():
        return 0.0
    return float(np.max(hi[live] - lo[live]))


def report_cuts(views, hull, smooth_mm):
    """Print what the opening removed, per view, and the size of the solid it produced.

    The global extent is the wrong number to report: an accessory usually sits at one station, so
    the widest row overall does not move even when the accessory is gone. The number that does move
    is the widest run of the outline -- the body's own section -- so that is the one printed.
    """
    # A run is measured ALONG the array's own index, and the scale follows that direction, not the
    # array's name: the run of a column is read down image y, so it is a ky length, and the run of a
    # row is read across image x, so it is a kx length. Reporting the other scale produces a number
    # that looks like millimetres and is not one -- the plan view's ky is its LENGTH, not its width.
    tuned = []
    for view in views.values():
        for label, scale in (("cols", view.ky), ("rows", view.kx)):
            before_raw, after_raw = raw_intervals(view, label), getattr(view, label)
            before = widest_run(*before_raw) * scale * 1000
            after = widest_run(*after_raw) * scale * 1000
            if before - after >= 1.0 or label == ("rows" if view.axis_v == "z" else "cols"):
                tuned.append((view.name, label, before, after))

    print(f"  {'view':<6} {'axis':<5} {'before':>8} {'after':>8} {'cut':>6}   mm")
    for name, label, before, after in tuned:
        print(f"  {name:<6} {label:<5} {before:8.0f} {after:8.0f} {before - after:6.0f}")

    # The views must agree about a dimension two of them measure. X is measured twice: the plan
    # view gives the width at every station, and the front view gives the width of the face. When
    # they disagree, the hull silently takes the narrower one, and the model is short by the
    # difference with nothing on screen to say so.
    by_name = {view.name: view for view in views.values()}
    plan_width = widest_run(*by_name["top"].rows) * by_name["top"].kx * 1000
    face = by_name[hull["face_view"]]
    front_width = widest_run(*face.rows) * face.kx * 1000
    if plan_width > 0 and front_width > 0:
        drift = 100.0 * abs(plan_width - front_width) / max(plan_width, front_width)
        verdict = "agree" if drift <= 5.0 else "DISAGREE"
        print(
            f"  width  plan {plan_width:6.0f}   {hull['face_view']:<5} {front_width:6.0f}   "
            f"{drift:5.2f} %   {verdict}"
        )
        if drift > 5.0:
            print(
                "         The hull takes the narrower of the two, so the body is short by their\n"
                "         difference. One of the two views was calibrated on a box that includes\n"
                "         an accessory: re-run view_scale.py on the body span, not on the box."
            )

    filled = [s for s in hull["sections"] if s["columns"]]
    if not filled:
        print("  solid  empty: every section lost its columns")
        return
    zs = [s["z"] for s in filled]
    ys = [c[2] for s in filled for c in s["columns"]]
    yh = [c[3] for s in filled for c in s["columns"]]
    xs = [c[1] for s in filled for c in s["columns"]]
    print(
        f"  solid  length {1000 * (max(zs) - min(zs)):6.0f}   "
        f"width {1000 * (max(xs) - min(xs)):6.0f}   "
        f"height {1000 * (max(yh) - min(ys)):6.0f}   "
        f"bottom {1000 * min(ys):5.0f} mm above the ground"
    )


def raw_intervals(view, label):
    """The view's intervals before the opening, on one pixel axis, from the full silhouette."""
    if label == "cols":
        size = view.mask.shape[1]
        lo = np.full(size, np.nan)
        hi = np.full(size, np.nan)
        for x in range(size):
            index = np.flatnonzero(view.silhouette[:, x])
            if index.size:
                lo[x], hi[x] = index[0], index[-1]
        return lo, hi
    size = view.mask.shape[0]
    lo = np.full(size, np.nan)
    hi = np.full(size, np.nan)
    for y in range(size):
        index = np.flatnonzero(view.silhouette[y])
        if index.size:
            lo[y], hi[y] = index[0], index[-1]
    return lo, hi


def main() -> None:
    parser = argparse.ArgumentParser(description="Intersect three silhouettes into one solid.")
    parser.add_argument("--subject", required=True)
    parser.add_argument("--out", required=True, help="the JavaScript module to write")
    parser.add_argument("--step", type=float, default=20.0, help="column and station pitch, mm")
    parser.add_argument(
        "--mask", choices=("body", "raw"), default="body",
        help="body erodes the accessories away; raw keeps the outer envelope",
    )
    parser.add_argument(
        "--smooth-mm", type=float, default=150.0,
        help="the widest protrusion to erase, in millimetres of outline. 0 disables the opening",
    )
    parser.add_argument(
        "--face", choices=("front", "back"), default="back",
        help="which view constrains the vertical profile over the width",
    )
    parser.add_argument(
        "--width-from", choices=("real", "face", "plan"), default="real",
        help="which source fixes the absolute width; `plan` is the pure intersection",
    )
    parser.add_argument("--json", help="also write the raw data here")
    args = parser.parse_args()

    with open(os.path.join(args.subject, "dimensions.json"), encoding="utf-8") as handle:
        dimensions = json.load(handle)
    unit = dimensions.get("unit", "m")
    real = {
        name: entry["value"] * (1000.0 if unit == "m" else 1.0)
        for name, entry in dimensions["real"].items()
    }

    smooth = 0.0 if args.mask == "raw" else args.smooth_mm
    hull, views = build_hull(
        args.subject, real, args.step, args.mask, smooth, args.face, args.width_from
    )

    print(
        f"mask      {args.mask}" + ("" if smooth == 0 else f"   opening {smooth:.0f} mm")
        + f"   face {args.face}   width from {args.width_from}"
    )
    report_cuts(views, hull, smooth)
    columns = sum(len(s["columns"]) for s in hull["sections"])
    filled = sum(1 for s in hull["sections"] if s["columns"])
    print(f"sections  {len(hull['sections'])}, {filled} with columns, {columns} columns")
    print(f"step      {args.step} mm")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(hull, handle, indent=1)
            handle.write("\n")
        print(f"json      {args.json}")

    header = (
        "// The main volume, as an intersection of three silhouettes. Generated by\n"
        "// `scripts/scene/trace_hull.py`; edit the tracer, not this file.\n"
        "//\n"
        "// A point belongs to the subject if the left view, the front view and the top view all\n"
        "// contain it. Each section is the set of vertical columns that survive all three, at one\n"
        "// station along Z. Units are metres, Y is up, +Z is forward (the nose), and the body is\n"
        "// centred on X = 0 and Z = 0.\n"
        "//\n"
        "// Views: the side view for the height over the length, the face view for the profile\n"
        "// over the width, and the plan view for the shape of the width. The plan's absolute\n"
        "// width is often a mirror's, so the width itself comes from the face view.\n"
        "//\n"
        "// protrusion narrower than the window -- a mirror, a bumper, a tyre -- is not part of it.\n"
        "// Stage 3 places those as their own nodes. The nose, the tail and the underside are\n"
        "// therefore shorter than the silhouette.\n"
        "//\n"
        "// What it reproduces: the three views it was built from, by construction. What it cannot\n"
        "// check: the views it did not use. That is what `right`, `back` and `bottom` are for.\n"
    )
    summary = {key: value for key, value in hull.items() if key != "sections"}
    with open(args.out, "w", encoding="utf-8") as handle:
        handle.write(header)
        handle.write(f"export const TRACE = {json.dumps(summary, separators=(',', ':'))};\n\n")
        handle.write("export const SECTIONS = [\n")
        for section in hull["sections"]:
            cols = ",".join(f"[{c[0]},{c[1]},{c[2]},{c[3]}]" for c in section["columns"])
            handle.write(f'  {{ z: {section["z"]}, columns: [{cols}] }},\n')
        handle.write("];\n")
    print(f"module    {args.out}  {os.path.getsize(args.out) // 1024} KiB")


if __name__ == "__main__":
    main()
