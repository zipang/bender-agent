#!/usr/bin/env python3
"""Crop a reference view down to the subject, so its spans are the image's own size.

A generated view is a picture on a white field, and the subject floats somewhere inside it. Every
tool in the chain then has to find it again: a flood fill from the corners, a bounding box, a
robust span, a protrusion count. That is work done once per view, forever, and every one of those
steps is a place to be wrong.

After the crop, the subject touches the frame: its spans are the image dimensions, and any point
picked on it is already an offset inside the subject.

What the crop does NOT do: it does not change the scale, and it does not fix the anisotropy. Both
are ratios of two spans, and cropping preserves both. An image that was 9% short stays 9% short.
The gain is in reading distances, not in the calibration.

A margin of a few pixels is kept, and it is not cosmetic: every silhouette tool flood-fills from
the four corners, so the corners must stay background. Cropping the box exactly makes that fill
start on the subject and return nonsense.

Usage:

    python3 scripts/scene/crop_reference.py --subject blueprints/vehicules/r5-tl-1972
    python3 scripts/scene/crop_reference.py --subject blueprints/vehicules/r5-tl-1972 --margin 8
    python3 scripts/scene/crop_reference.py --subject blueprints/vehicules/r5-tl-1972 --views left,front --json

It writes `cropped/<view>.png` and `cropped/manifest.json` under the subject. The locked
`reference.<ext>` of each view is read only, and is never modified: the crop is a derived file, and
it can be rebuilt at any time.
"""

import argparse
import json
import os

import numpy as np

from view_scale import subject_mask


def repo_rel(path: str) -> str:
    """A path relative to the repository root, whatever the working directory was.

    This matters more than it looks. The manifest is read by the browser, which resolves every
    reference through `/repo/<path>`. A path recorded relative to whatever directory the tool was
    run from carries `../../` in it, and the browser then asks for a file outside the repository and
    gets a 404. Measure once, record absolutely: derive the root from the `blueprints` component.
    """
    absolute = os.path.abspath(path)
    parts = absolute.split(os.sep)
    if "blueprints" not in parts:
        return path
    root = os.sep.join(parts[: parts.index("blueprints")])
    return os.path.relpath(absolute, root)


def find(path: str) -> str:
    """The view's reference, whatever extension the generator gave it."""
    if os.path.exists(path):
        return path
    for ext in (".png", ".webp", ".jpg", ".jpeg"):
        candidate = os.path.splitext(path)[0] + ext
        if os.path.exists(candidate):
            return candidate
    raise SystemExit(f"no reference image at {path}")


def crop_one(path: str, out_path: str, margin: int) -> dict:
    from PIL import Image

    image = Image.open(path).convert("RGB")
    mask = subject_mask(path)
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if len(rows) == 0 or len(cols) == 0:
        raise SystemExit(f"no subject found in {path}: the mask is empty")

    width, height = image.size
    x0 = max(0, int(cols[0]) - margin)
    y0 = max(0, int(rows[0]) - margin)
    x1 = min(width - 1, int(cols[-1]) + margin)
    y1 = min(height - 1, int(rows[-1]) + margin)

    # Pillow's crop box is half-open: right and bottom are exclusive.
    cropped = image.crop((x0, y0, x1 + 1, y1 + 1))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    cropped.save(out_path)

    # Two different rectangles, and confusing them costs a real, silent error.
    #
    # `crop_box` is the whole cropped file, margin included. `subject_box` is the subject alone.
    # A scale must be built on the SUBJECT: mapping the full crop to the real length makes the
    # subject 4 px short of it, which on the left view is 11 mm, and every trace then carries that.
    return {
        "file": repo_rel(out_path),
        "source": repo_rel(path),
        "crop_box": [x0, y0, x1, y1],
        "subject_box": [int(cols[0]), int(rows[0]), int(cols[-1]), int(rows[-1])],
        "offset": [int(cols[0]) - x0, int(rows[0]) - y0],
        "margin": margin,
        "source_px": [width, height],
        "size_px": [cropped.width, cropped.height],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Crop a reference view to its subject.")
    parser.add_argument("--subject", required=True, help="subject folder, for example blueprints/vehicules/r5-tl-1972")
    parser.add_argument("--margin", type=int, default=2,
                        help="pixels of background kept around the subject (default 2, so the corners stay background)")
    parser.add_argument("--views", default="all", help="comma-separated views, or all")
    parser.add_argument("--out", default=None, help="output directory (default <subject>/cropped)")
    parser.add_argument("--json", action="store_true", help="print JSON only")
    args = parser.parse_args()

    subject = args.subject.rstrip("/")
    out_dir = args.out or os.path.join(subject, "cropped")

    available = [v for v in ("left", "right", "front", "back", "top", "bottom")
                 if os.path.exists(os.path.join(subject, v, "reference.png"))
                 or os.path.exists(os.path.join(subject, v, "reference.webp"))]
    wanted = available if args.views == "all" else [v.strip() for v in args.views.split(",") if v.strip()]
    missing = [v for v in wanted if v not in available]
    if missing:
        raise SystemExit(f"no reference for: {', '.join(missing)} (have: {', '.join(available)})")

    manifest = {"subject": repo_rel(subject), "margin": args.margin, "views": {}}
    for view in wanted:
        source = find(os.path.join(subject, view, "reference.png"))
        out_path = os.path.join(out_dir, f"{view}.png")
        entry = crop_one(source, out_path, args.margin)
        manifest["views"][view] = entry
        if not args.json:
            subject_box = entry["subject_box"]
            print(
                f"{view:<7} {entry['source_px'][0]}x{entry['source_px'][1]}"
                f" -> {entry['size_px'][0]}x{entry['size_px'][1]} px"
                f"   subject {subject_box[2] - subject_box[0] + 1}"
                f" x {subject_box[3] - subject_box[1] + 1} px"
                f"   margin {entry['offset'][0]},{entry['offset'][1]}"
            )

    os.makedirs(out_dir, exist_ok=True)
    manifest_path = os.path.join(out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")

    if args.json:
        print(json.dumps(manifest, indent=2))
    else:
        print()
        print(f"manifest  {manifest_path}")
        print("The locked reference.<ext> files are untouched: the crop is derived and can be rebuilt.")


if __name__ == "__main__":
    main()
