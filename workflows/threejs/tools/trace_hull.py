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

    python3 workflows/threejs/tools/trace_hull.py --subject blueprints/vehicules/r5-tl-1972 \
        --out workflows/threejs/scenes/r5-tl-1972/body-hull.js --step 20

    # keep every accessory: the outer envelope instead of the main volume
    python3 workflows/threejs/tools/trace_hull.py ... --mask silhouette

    # a body that is not one hue, or a hue the auto detector gets wrong
    python3 workflows/threejs/tools/trace_hull.py ... --hue 205 --hue-width 25 --sat-min 0.3
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
    # bottom: same pose as `top`, camera below and looking up. up = (0,0,-1), dir = (0,-1,0), so
    # right = up x dir = (-1,0,0): the image's +x runs toward -X, and its +y toward +Z.
    "bottom": ("x", -1, "z", +1),
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
    """Erode, then dilate: the morphological OPENING of a profile.

    Erosion alone removes a protrusion and every taper with it, because a taper is a long run of
    small moves inward and each sample sees its neighbours. The dilation that follows restores the
    width wherever the eroded outline is flat, so the taper comes back and the protrusion does not:
    a bump narrower than the window has been flattened past the point of no return.

    This is the difference between "remove what sticks out" and "remove what is narrow", and only
    the second one is true of an accessory.

    It is ONE-DIMENSIONAL on purpose. A wheel is a local protrusion in the vertical run of a column,
    which is exactly what this removes, and a two-dimensional disc of the same size also erodes the
    nose and the tail of the body. The drawing does not use this: see `View.body_mask`.
    """
    if radius <= 0:
        return np.array(lo, copy=True), np.array(hi, copy=True)
    eroded_lo, eroded_hi = erode(lo, hi, radius)
    # A sample whose erosion inverted it is absent: the window found nothing it could belong to.
    inverted = eroded_hi < eroded_lo
    eroded_lo[inverted] = np.nan
    eroded_hi[inverted] = np.nan
    return dilate(eroded_lo, eroded_hi, radius)


def sliding_extreme(values, window, is_min):
    """A sliding min or max along axis 1, at a fixed window. O(1) per sample. Gil-Werman.

    The window is centred, so `window` is odd. Outside the array the fill is the neutral element of
    the operation: `True` for a min over a boolean mask (a window must not invent a background
    pixel), `False` for a max.
    """
    pad = window // 2
    fill = True if is_min else False
    block = np.pad(values, ((0, 0), (pad, pad)), constant_values=fill)
    length = block.shape[1]
    blocks = -(-length // window)
    if blocks * window > length:
        block = np.pad(block, ((0, 0), (0, blocks * window - length)), constant_values=fill)
    shaped = block.reshape(block.shape[0], blocks, window)
    if is_min:
        prefix = np.minimum.accumulate(shaped, axis=2).reshape(block.shape[0], -1)
        suffix = np.minimum.accumulate(shaped[:, :, ::-1], axis=2)[:, :, ::-1]
    else:
        prefix = np.maximum.accumulate(shaped, axis=2).reshape(block.shape[0], -1)
        suffix = np.maximum.accumulate(shaped[:, :, ::-1], axis=2)[:, :, ::-1]
    suffix = suffix.reshape(block.shape[0], -1)
    first = np.arange(values.shape[1])
    if is_min:
        return np.minimum(suffix[:, first], prefix[:, first + window - 1])
    return np.maximum(suffix[:, first], prefix[:, first + window - 1])


def _disc_pass(mask, radius_x, radius_y, is_min):
    """One dilation or erosion by an ellipse, as a stack of horizontal runs.

    A disc is the union of its horizontal chords, so the two-dimensional operation is a vertical
    sweep of one-dimensional ones. The chord half-width at row offset `dy` is the ellipse equation
    in pixels, which makes the structuring element a disc of radius `smooth_mm` in MODEL metres even
    when the view is anisotropic.
    """
    height, width = mask.shape
    if radius_x < 1 or radius_y < 1:
        return mask.copy()
    result = None
    neutral = True if is_min else False
    for dy in range(-radius_y, radius_y + 1):
        fraction = 1.0 - (dy / float(radius_y)) ** 2
        half = int(np.floor(radius_x * np.sqrt(fraction))) if fraction > 0 else 0
        run = sliding_extreme(mask, 2 * half + 1, is_min)
        piece = np.full((height, width), neutral, dtype=bool)
        top = max(0, dy)
        bottom = min(height, height + dy)
        if bottom > top:
            piece[top:bottom, :] = run[max(0, -dy):max(0, -dy) + (bottom - top), :]
        result = piece if result is None else ((result & piece) if is_min else (result | piece))
    return result


def open_disc(mask, radius_x, radius_y):
    """Erode, then dilate by a disc: the morphological OPENING of a region.

    This is the difference between "remove what sticks out" and "remove what is narrow", and only
    the second one is true of an accessory. A disc is the right element because it preserves every
    edge whose curvature radius is larger than its own: an erosion moves such an edge inward by the
    radius along the normal, and the dilation moves it back. A square does not, and it was measured
    2 to 3 pixels inside the body.

    The previous code opened the `lo` and `hi` profiles of a view, one sample at a time, which is a
    one-dimensional operation. It removed the accessory and left the region COLUMN-CONVEX: every
    column filled from its first subject pixel to its last. A near-vertical flank then lost its
    slope, and any drawing of that region sat outside the body.
    """
    if radius_x < 1 or radius_y < 1:
        return mask.copy()
    return _disc_pass(_disc_pass(mask, radius_x, radius_y, True), radius_x, radius_y, False)


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
        # `body_mask` is the region the CONTOUR draws, and it is the picture. `cols` and `rows` are
        # the region the HULL builds from, and they are opened first.
        #
        # The two must not be the same object. The opening removes an accessory from a PROFILE: a
        # wheel is a local protrusion in the vertical run of a column, and a 150 mm window drops it.
        # That is a statement about the body, and the hull needs it. Applied to the picture, the same
        # window also erodes every convex edge the body really has, and the nose loses tens of
        # millimetres. A contour is a diagnostic of the drawing over the photograph, so it reads the
        # photograph.
        #
        # Keeping them apart also keeps the hull honest. `body_mask` is never opened, so no choice
        # made for the drawing can move the volume.
        self.body_mask = self.mask
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


def boundary_loops(mask):
    """Every closed boundary of a boolean mask, as corner polygons in pixel units.

    The old outline walked the mask one IMAGE COLUMN at a time: `lo[px]`, then `hi[px]` on the way
    back. That cannot express an edge that runs along the rows, and the plan view is mostly such an
    edge -- its flanks are near vertical. The ring then degrades into a run of column end caps, and
    the polygon drawn from it bulges 1 to 6 pixels outside the body along both flanks. The mirror,
    small and nearly horizontal, was reproduced correctly, which is why the fault looked arbitrary.

    This walks the CELL EDGES instead. A subject pixel contributes one unit edge wherever its
    neighbour is background, and the edges are chained head to tail. A vertical flank becomes a run
    of vertical edges, which is exactly what it is. Rasterising the polygon back on the same grid
    then returns the mask pixel for pixel: the outline is no longer an approximation of its own
    source.

    No threshold, no colour, no per-axis pass: only the shape of the mask. A dark subject on a pale
    field and the reverse give the same walk.

    Corners are in pixel units, with a pixel of index `x` spanning corners `x` to `x + 1`. The
    loops run clockwise on screen. Collinear runs are collapsed, so a straight flank costs one
    segment and not one per pixel.
    """
    height, width = mask.shape
    padded = np.zeros((height + 2, width + 2), dtype=bool)
    padded[1:-1, 1:-1] = mask
    body = padded[1:-1, 1:-1]
    up = padded[:-2, 1:-1]
    down = padded[2:, 1:-1]
    left = padded[1:-1, :-2]
    right = padded[1:-1, 2:]

    starts = []
    outs = []
    # One directed edge per exposed side, subject kept on the same hand everywhere, so the edge set
    # already chains: every corner has as many incoming as outgoing edges.
    ys, xs = np.nonzero(body & ~up)
    starts.append(np.stack([xs, ys], axis=1))
    outs.append(np.stack([xs + 1, ys], axis=1))
    ys, xs = np.nonzero(body & ~right)
    starts.append(np.stack([xs + 1, ys], axis=1))
    outs.append(np.stack([xs + 1, ys + 1], axis=1))
    ys, xs = np.nonzero(body & ~down)
    starts.append(np.stack([xs + 1, ys + 1], axis=1))
    outs.append(np.stack([xs, ys + 1], axis=1))
    ys, xs = np.nonzero(body & ~left)
    starts.append(np.stack([xs, ys + 1], axis=1))
    outs.append(np.stack([xs, ys], axis=1))

    start = np.concatenate(starts)
    end = np.concatenate(outs)
    if start.size == 0:
        return []

    # Corner -> the ends of every edge that leaves it. A diagonal pinch gives two, and the walk then
    # turns clockwise: that keeps two lobes that touch at one corner as two loops, which is what the
    # mask shows.
    leaving = {}
    for (ax, ay), (bx, by) in zip(start.tolist(), end.tolist()):
        leaving.setdefault((ax, ay), []).append((bx, by))

    def rank(candidate, direction):
        dx, dy = candidate[0] - direction[0], candidate[1] - direction[1]
        # Clockwise on screen is (-dy, dx); then straight, then counter-clockwise, then back.
        order = {(-direction[1], direction[0]): 0, (direction[0], direction[1]): 1,
                 (direction[1], -direction[0]): 2, (-direction[0], -direction[1]): 3}
        return order.get((dx, dy), 4)

    loops = []
    remaining = sum(len(v) for v in leaving.values())
    while remaining:
        first = next(key for key, value in leaving.items() if value)
        chain = [first]
        current = first
        previous_direction = None
        while True:
            choices = leaving.get(current)
            if not choices:
                break
            if len(choices) == 1:
                nxt = choices.pop()
            else:
                nxt = min(choices, key=lambda c: rank(c, previous_direction or (1, 0)))
                choices.remove(nxt)
            remaining -= 1
            previous_direction = (nxt[0] - current[0], nxt[1] - current[1])
            current = nxt
            if current == first:
                break
            chain.append(current)
        if len(chain) >= 4:
            loops.append(chain)

    return [simplify_collinear(loop) for loop in loops]


def simplify_collinear(loop):
    """Drop a corner whose two segments have the same direction: it carries no shape."""
    kept = []
    count = len(loop)
    for index in range(count):
        before = loop[index - 1]
        here = loop[index]
        after = loop[(index + 1) % count]
        d1 = (here[0] - before[0], here[1] - before[1])
        d2 = (after[0] - here[0], after[1] - here[1])
        if d1 != d2:
            kept.append(here)
    return kept


# ---------------------------------------------------------------- paths

def _segment_distance(point, a, b):
    """Distance from a point to the segment `a`-`b`, in the units of the points."""
    px, py = point
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    if length2 <= 0.0:
        return float(np.hypot(px - ax, py - ay))
    t = ((px - ax) * dx + (py - ay) * dy) / length2
    t = max(0.0, min(1.0, t))
    return float(np.hypot(px - (ax + t * dx), py - (ay + t * dy)))


def _polyline_deviation(points, path):
    """Worst distance from any traced point to the drawn polyline, in the points' units.

    Per point it is the NEAREST segment that counts: a point is off the line when it is far from all
    of it, not from one of it. Taking the farthest segment reports the diameter of the shape.
    """
    if len(path) < 2:
        return float("inf")
    arrays = np.asarray(path, dtype=float)
    a = arrays[:-1]
    b = arrays[1:]
    ab = b - a
    length2 = np.einsum("ij,ij->i", ab, ab)
    worst = 0.0
    for point in np.asarray(points, dtype=float):
        ap = point - a
        dot = np.einsum("ij,ij->i", ap, ab)
        with np.errstate(divide="ignore", invalid="ignore"):
            t = np.where(length2 > 0.0, dot / length2, 0.0)
        t = np.clip(t, 0.0, 1.0)
        closest = a + t[:, None] * ab
        distance = np.hypot(*(point - closest).T)
        nearest = float(distance.min())
        if nearest > worst:
            worst = nearest
    return worst


def simplify_ring(points, tolerance):
    """Douglas-Peucker on a closed ring, at a chord tolerance. Returns new corner points.

    This is the only place the shape is decided, and it is decided by one number: the largest
    distance the drawn path may sit from the traced points. A tolerance under the pixel size keeps
    the pixel staircase, and a tolerance above it removes the staircase and nothing else. There is
    no per-subject constant anywhere in it.

    A ring has no ends, so it is split at its two farthest-apart points. Each half is an open
    polyline and the standard recursion applies to it.
    """
    ring = np.asarray(points, dtype=float)
    count = ring.shape[0]
    if count < 4:
        return ring.tolist()
    # A ring has no ends, so it is opened at its farthest-from-centre point and walked once around,
    # ending on the same corner. The two ends coincide, which is what lets one recursion serve both
    # the opening and the closing edge.
    centre = ring.mean(axis=0)
    first = int(np.argmax(np.hypot(*(ring - centre).T)))
    order = [(first + step) % count for step in range(count + 1)]

    stack = [(0, len(order) - 1)]
    keep = {0, len(order) - 1}
    while stack:
        head, tail = stack.pop()
        if tail - head < 2:
            continue
        a, b = ring[order[head]], ring[order[tail]]
        worst, at = -1.0, -1
        for offset in range(head + 1, tail):
            d = _segment_distance(ring[order[offset]], a, b)
            if d > worst:
                worst, at = d, offset
        if worst <= tolerance or at < 0:
            continue
        keep.add(at)
        stack.append((head, at))
        stack.append((at, tail))

    # The last kept index repeats the first point, so it is dropped from the closed ring.
    return [ring[order[i]].tolist() for i in sorted(keep)[:-1]]


def subdivide_ring(points, max_length):
    """Insert points so that no segment is longer than `max_length`. Corners are kept as they are."""
    if max_length <= 0 or len(points) < 2:
        return list(points)
    out = []
    count = len(points)
    for index in range(count):
        a = points[index]
        b = points[(index + 1) % count]
        out.append(list(a))
        length = float(np.hypot(b[0] - a[0], b[1] - a[1]))
        steps = int(np.ceil(length / max_length)) if length > max_length else 1
        for step in range(1, steps):
            t = step / float(steps)
            out.append([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
    return out


def _fit_cubic(points, tangent_start, tangent_end):
    """Least-squares cubic through a span, with fixed end tangents. Returns (c1, c2)."""
    first = np.array(points[0], dtype=float)
    last = np.array(points[-1], dtype=float)
    span = float(np.hypot(*(last - first)))
    if span <= 0.0:
        return first.tolist(), last.tolist()
    # Chord-length parametrisation: a first guess that is already close for a short span.
    u = [0.0]
    for index in range(1, len(points)):
        u.append(u[-1] + float(np.hypot(*(np.array(points[index]) - np.array(points[index - 1])))))
    total = u[-1] or 1.0
    u = [value / total for value in u]

    t1 = np.array(tangent_start, dtype=float)
    t2 = np.array(tangent_end, dtype=float)
    n1 = np.linalg.norm(t1)
    n2 = np.linalg.norm(t2)
    if n1 == 0.0 or n2 == 0.0:
        return (first + (last - first) / 3.0).tolist(), (first + 2.0 * (last - first) / 3.0).tolist()
    t1 = t1 / n1 * span / 3.0
    t2 = t2 / n2 * span / 3.0

    # Solve for the two scalar lengths along the tangents, by least squares on the residual.
    a11 = a12 = a22 = x1 = x2 = 0.0
    for index, point in enumerate(points):
        t = u[index]
        s = 1.0 - t
        b0, b1, b2, b3 = s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t
        a1 = t1 * b1
        a2 = t2 * b2
        target = np.array(point, dtype=float) - (b0 * first + b3 * last)
        a11 += float(a1 @ a1)
        a12 += float(a1 @ a2)
        a22 += float(a2 @ a2)
        x1 += float(a1 @ target)
        x2 += float(a2 @ target)
    det = a11 * a22 - a12 * a12
    if abs(det) < 1e-12:
        alpha, beta = span / 3.0, span / 3.0
    else:
        alpha = (x1 * a22 - x2 * a12) / det
        beta = (a11 * x2 - a12 * x1) / det
    # A negative length folds the curve back; a very long one overshoots. Both are clamped to the
    # chord, which is the only scale the span itself provides.
    alpha = max(0.0, min(alpha, span))
    beta = max(0.0, min(beta, span))
    return (first + t1 / (span / 3.0) * alpha).tolist(), (last - t2 / (span / 3.0) * beta).tolist()


def _cubic_points(control, samples=48):
    """Sample a cubic segment into points, for measuring only."""
    p0 = np.array(control[0], dtype=float)
    c1 = np.array(control[1], dtype=float)
    c2 = np.array(control[2], dtype=float)
    p3 = np.array(control[3], dtype=float)
    out = []
    for index in range(samples + 1):
        t = index / float(samples)
        s = 1.0 - t
        out.append(s * s * s * p0 + 3 * s * s * t * c1 + 3 * s * t * t * c2 + t * t * t * p3)
    return out


def fit_ring(points, tolerance, max_length=0.0):
    """Greedy cubic fit of a closed ring, guarded by a maximum deviation.

    Each span grows one point at a time until the cubic through it strays further than `tolerance`
    from the traced points, and the span before the failure is emitted. The tangents at both ends
    come from the neighbouring points, which is what keeps two spans meeting along one line instead
    of at an angle.

    A span that cannot meet the tolerance even at its shortest becomes a straight segment. That is
    not a failure: a tolerance under the pixel size cannot smooth a pixel staircase, and the honest
    answer there is the trace itself. Raising the tolerance is what removes the staircase, and the
    measured deviation says when it has.

    The measured deviation of the result is returned with it. A fit that meets the tolerance is a
    fact about the output, not a claim about the algorithm.
    """
    ring = np.asarray(points, dtype=float)
    count = ring.shape[0]
    if count < 4:
        return {"start": ring[0].tolist(), "segments": [["L", *ring[i].tolist()] for i in range(1, count)]}, 0.0

    def tangent(index, forward=True):
        step = 1 if forward else -1
        return ring[(index + step) % count] - ring[index % count]

    def chord(a, b):
        return float(np.hypot(*(ring[b] - ring[a])))

    segments = []
    worst = 0.0
    index = 0
    while index < count:
        best = None
        end = index + 2
        while end <= count - 1:
            # `pitch` is a cap on the span, and it applies to the curve as much as to a polyline:
            # a cubic that spans the whole flank is one segment the caller cannot subdivide.
            if max_length > 0.0 and chord(index, end) > max_length:
                break
            span = ring[index:end + 1]
            control = [span[0].tolist(),
                       *_fit_cubic(span, tangent(index), -tangent(end % count, forward=False)),
                       span[-1].tolist()]
            deviation = _polyline_deviation(span, _cubic_points(control))
            if deviation > tolerance:
                break
            best = (end, control, deviation)
            end += 1
        if best is None:
            # No cubic meets the tolerance here: keep the trace, one segment.
            nxt = (index + 1) % count
            segments.append(["L", round(float(ring[nxt][0]), 4), round(float(ring[nxt][1]), 4)])
            index += 1
            continue
        end, control, deviation = best
        worst = max(worst, deviation)
        segments.append(["C",
                         round(control[1][0], 4), round(control[1][1], 4),
                         round(control[2][0], 4), round(control[2][1], 4),
                         round(control[3][0], 4), round(control[3][1], 4)])
        index = end
    return {"start": [round(float(v), 4) for v in ring[0]], "segments": segments}, worst


def build_path(points, mode, pitch_mm, tolerance_mm):
    """Turn a traced ring into a path, at the resolution the caller asks for.

    Two parameters, and each one answers a different question:

    - `tolerance_mm` decides how far the drawn line may sit from the traced points. It is the only
      knob that changes the SHAPE, and it is the same number for `poly` and `bezier`.
    - `pitch_mm` decides the longest segment. It changes how finely the shape is written down, not
      what it is.

    `poly` is the simplified ring with straight segments: the trace, read literally. `bezier` fits
    cubics to the same points, so the two modes describe the same curve at the same tolerance, and a
    viewer can switch between them without the outline moving.

    Returns the path, the number of points it consumed, and the measured deviation in metres.
    """
    scale = 1.0
    simplified = simplify_ring(points, tolerance_mm)
    if mode == "bezier":
        path, deviation = fit_ring(simplified, tolerance_mm, pitch_mm)
        consumed = len(simplified)
    else:
        dense = subdivide_ring(simplified, pitch_mm) if pitch_mm > 0 else simplified
        start = dense[0]
        path = {"start": [round(v, 4) for v in start],
                "segments": [["L", round(p[0], 4), round(p[1], 4)] for p in dense[1:]]}
        consumed = len(dense)
        deviation = _polyline_deviation(points, dense)
    return path, consumed, float(deviation)


def plate_contour(view, mode="poly", pitch_mm=2.0, tolerance_mm=0.25):
    """The outline of one view, in the plate's own metres, as a path at a chosen resolution.

    The plate is a plane of `imgW * kx` by `imgH * ky` centred on the image, so a pixel maps to
    local coordinates without touching the subject box or the crop offset: the plate mesh already
    carries those. The contour is emitted in that frame on purpose -- a second mapping from model
    axes would be a second chance to place it a few millimetres off the picture it came from.

    The ring is the boundary of the traced region, walked along the pixel corners, so the polygon
    and the picture agree on every side of the body, including an edge that runs along the rows.

    It is drawn over the reference picture so the trace can be judged where it came from -- and this
    path is NOT what the hull reads. The hull re-samples the photograph on its own lattice. A pixel
    staircase here and a 20 mm staircase on the surface are two separate facts, and a plan that
    conflates them fixes neither.

    Returns `None` when the view has no boundary.
    """
    height, width = view.mask.shape
    loops = boundary_loops(view.body_mask)
    if not loops:
        return None
    # The outer boundary is the one that encloses the most area. A separate island -- a mirror
    # detached from the shell, a part cut away -- is not part of one ring, and the viewer draws one
    # line per view, so the outer loop is the one it can carry.
    outer = max(loops, key=lambda loop: abs(_area(loop)))

    # Plate-local metres. `tolerance_mm` and `pitch_mm` are millimetres, so the shape is decided in
    # the units the art director can reason about, not in pixels that change with the crop.
    ring = [((cx - width / 2.0) * view.kx, -((cy - height / 2.0) * view.ky)) for cx, cy in outer]
    path, consumed, deviation = build_path(ring, mode, pitch_mm / 1000.0, tolerance_mm / 1000.0)
    return {
        "path": path,
        "points": consumed,
        "deviation_mm": round(deviation * 1000.0, 4),
    }


def _area(loop):
    """Signed area of a corner loop, in square pixels. The shoelace sum, halved."""
    total = 0.0
    for index in range(len(loop)):
        x1, y1 = loop[index]
        x2, y2 = loop[(index + 1) % len(loop)]
        total += x1 * y2 - x2 * y1
    return total / 2.0


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
        help="the widest protrusion to erase from the HULL, in millimetres of outline. "
             "0 disables the opening. The drawn contour reads the picture and is never opened",
    )
    parser.add_argument(
        "--pitch", type=float, default=2.0,
        help="millimetres. The longest segment of the drawn contour. It sets the resolution, "
             "not the shape",
    )
    parser.add_argument(
        "--mode", choices=("poly", "bezier"), default="poly",
        help="poly draws straight segments, bezier fits cubics to the same points",
    )
    parser.add_argument(
        "--tolerance", type=float, default=0.25,
        help="millimetres. The largest distance the drawn contour may sit from the traced points. "
             "This is the one number that changes the SHAPE",
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
        "// `workflows/threejs/tools/trace_hull.py`; edit the tracer, not this file.\n"
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
        "//\n"
        "// CONTOURS holds the outline of every orthogonal view, in the frame of that view's plate,\n"
        "// with `used` marking the three the hull was built from. The others are witnesses: the\n"
        "// intersection never saw them, so their outline is a check, not an input.\n"
    )
    summary = {key: value for key, value in hull.items() if key != "sections"}
    # Every orthogonal view gets an outline, not only the three the hull reads.
    #
    # The point of drawing a contour is to compare three things on one plane: the picture, the
    # outline taken from it, and the volume that came out. A view the hull did not read is exactly
    # where that comparison is most informative -- `right`, `front` and `bottom` are the witnesses
    # the intersection never saw, so their outline is a check rather than an input.
    #
    # `used` says which is which, so the viewer can draw a witness outline differently and nobody
    # has to remember the list.
    with open(os.path.join(args.subject, "cropped", "manifest.json"), encoding="utf-8") as handle:
        manifest = json.load(handle)
    used = {view.name for view in views.values()}
    contours = {}
    for name in sorted(manifest["views"]):
        if name not in dimensions.get("views", {}):
            continue
        if name in used:
            view = next(candidate for candidate in views.values() if candidate.name == name)
        else:
            try:
                # Same mask and same opening as the views the hull reads. A witness drawn from the
                # raw silhouette would differ from the solid everywhere an accessory sits, and the
                # eye would read that difference as a modelling error instead of the cut.
                view = View(name, args.subject, manifest, dimensions, real, smooth, args.mask)
            except (KeyError, FileNotFoundError, ValueError):
                continue
        traced = plate_contour(view, args.mode, args.pitch, args.tolerance)
        if not traced:
            continue
        contours[name] = {
            "kx": round(view.kx, 7),
            "ky": round(view.ky, 7),
            "size_px": [view.mask.shape[1], view.mask.shape[0]],
            "used": name in used,
            # The resolution is written down with the geometry, so a reader can tell a shape from a
            # sampling choice. `deviation_mm` is measured on the output, never requested.
            "mode": args.mode,
            "pitch_mm": args.pitch,
            "tolerance_mm": args.tolerance,
            "points": traced["points"],
            "deviation_mm": traced["deviation_mm"],
            "path": traced["path"],
        }
    with open(args.out, "w", encoding="utf-8") as handle:
        handle.write(header)
        handle.write(f"export const TRACE = {json.dumps(summary, separators=(',', ':'))};\n\n")
        handle.write("// The outline each view contributed, in plate-local metres (u right, v up,\n")
        handle.write("// origin at the image centre), as a PATH: a start point and segments of\n")
        handle.write("// type L or C, which THREE.Path accepts as they are. Drawn over the\n")
        handle.write("// reference picture, so the trace can be judged where it came from.\n")
        handle.write("//\n")
        handle.write("// `mode`, `pitch_mm` and `tolerance_mm` say how it was sampled, and\n")
        handle.write("// `deviation_mm` is the measured distance from the traced points to the\n")
        handle.write("// drawn line. The hull does NOT read this path: it re-samples the\n")
        handle.write("// photograph at its own lattice, and that is where the surface\n")
        handle.write("// staircase comes from.\n")
        handle.write(f"export const CONTOURS = {json.dumps(contours, separators=(',', ':'))};\n\n")
        handle.write("export const SECTIONS = [\n")
        for section in hull["sections"]:
            cols = ",".join(f"[{c[0]},{c[1]},{c[2]},{c[3]}]" for c in section["columns"])
            handle.write(f'  {{ z: {section["z"]}, columns: [{cols}] }},\n')
        handle.write("];\n")
    print(f"module    {args.out}  {os.path.getsize(args.out) // 1024} KiB")


if __name__ == "__main__":
    main()
