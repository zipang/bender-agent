#!/usr/bin/env python3
"""Turn picked points into millimetres, and check that two views agree.

`scripts/measure/index.html` places the points. This script does the arithmetic and the check.

Two rules make the numbers trustworthy:

  - a distance is read on the axes, never on the diagonal: dx is multiplied by kx and dy by ky.
    On a stretched view those two scales differ, and one global scale is wrong on both;
  - a measurement that carries a `key` is the same physical dimension as every other measurement
    with that key, in every view. The script groups them and prints the disagreement. That is the
    only test that proves the views describe the same object.

Usage:

    python3 scripts/measure/report.py blueprints/vehicules/r5-tl-1972
    python3 scripts/measure/report.py blueprints/vehicules/r5-tl-1972 --annotate
    python3 scripts/measure/report.py blueprints/vehicules/r5-tl-1972 --write
    python3 scripts/measure/report.py blueprints/vehicules/r5-tl-1972 --json

`--write` records the landmark verdict in `dimensions.json`, which is what closes gate G1.
`--annotate` draws the points and their values on a copy of each view, so the placement can be
checked without a browser.
"""

import argparse
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

LANDMARK_TOLERANCE_PCT = 10.0
COLOURS = [
    (255, 139, 61), (78, 163, 255), (87, 201, 139), (240, 196, 25),
    (226, 86, 74), (181, 123, 255), (46, 199, 199), (217, 140, 255),
]


def load_json(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def measure_view(view, entry):
    """One row per measurement, in millimetres, read on the axes."""
    scale = entry["scale_mm_per_px"]
    kx, ky = float(scale["horizontal"]), float(scale["vertical"])
    points = entry.get("points", {})
    rows = []
    for measurement in entry.get("measurements", []):
        a = points.get(measurement["from"])
        b = points.get(measurement["to"])
        if a is None or b is None:
            print(
                f"warning: {view}/{measurement['name']} refers to a missing point "
                f"({measurement['from']} -> {measurement['to']}), skipped",
                file=sys.stderr,
            )
            continue
        dx = abs(b[0] - a[0])
        dy = abs(b[1] - a[1])
        mx, my = dx * kx, dy * ky
        rows.append(
            {
                "view": view,
                "name": measurement["name"],
                "key": (measurement.get("key") or "").strip(),
                "from": measurement["from"],
                "to": measurement["to"],
                "dx_px": dx,
                "dy_px": dy,
                "dx_mm": mx,
                "dy_mm": my,
                "length_mm": math.hypot(mx, my),
            }
        )
    return rows


def annotate(subject, view, entry, rows, out_path):
    image = Image.open(entry["file"]).convert("RGB").copy()
    draw = ImageDraw.Draw(image)
    try:
        font = ImageFont.truetype("DejaVuSans-Bold.ttf", 22)
        small = ImageFont.truetype("DejaVuSans.ttf", 18)
    except OSError:
        font = small = ImageFont.load_default()

    points = entry.get("points", {})
    names = list(points)
    # Every measurement is drawn on its own, with its two axis readings, because that is the
    # number the model consumes.
    for index, row in enumerate(rows):
        colour = COLOURS[index % len(COLOURS)]
        a = points[row["from"]]
        b = points[row["to"]]
        draw.line([tuple(a), tuple(b)], fill=colour, width=3)
        draw.line([tuple(a), (b[0], a[1])], fill=colour, width=1)
        draw.line([(b[0], a[1]), tuple(b)], fill=colour, width=1)
        text = f"{row['name']}  {row['dx_mm']:.0f} x {row['dy_mm']:.0f} mm"
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        box = draw.textbbox((0, 0), text, font=font)
        draw.rectangle(
            [mid[0] - 6, mid[1] - 34, mid[0] + box[2] + 6, mid[1] - 34 + box[3] + 8],
            fill=(0, 0, 0),
        )
        draw.text((mid[0], mid[1] - 32), text, fill=colour, font=font)

    for index, name in enumerate(names):
        colour = COLOURS[index % len(COLOURS)]
        x, y = points[name]
        draw.ellipse([x - 9, y - 9, x + 9, y + 9], outline=(0, 0, 0), width=5)
        draw.ellipse([x - 9, y - 9, x + 9, y + 9], outline=colour, width=3)
        draw.line([x - 16, y, x + 16, y], fill=colour, width=1)
        draw.line([x, y - 16, x, y + 16], fill=colour, width=1)
        draw.text((x + 14, y - 28), name, fill=colour, font=small)

    image.save(out_path)
    return out_path


def main():
    parser = argparse.ArgumentParser(description="Report picked measurements in millimetres.")
    parser.add_argument("subject", help="subject folder, for example blueprints/vehicules/r5-tl-1972")
    parser.add_argument("--annotate", action="store_true", help="write one annotated PNG per view")
    parser.add_argument("--write", action="store_true", help="record the landmark verdict in dimensions.json")
    parser.add_argument("--json", action="store_true", help="print JSON only")
    args = parser.parse_args()

    subject = args.subject.rstrip("/")
    measurements_path = os.path.join(subject, "measurements.json")
    dimensions_path = os.path.join(subject, "dimensions.json")
    if not os.path.exists(measurements_path):
        raise SystemExit(f"no {measurements_path}: place the points with /measure/ first")
    if not os.path.exists(dimensions_path):
        raise SystemExit(f"no {dimensions_path}: run scripts/scene/view_scale.py first")

    document = load_json(measurements_path)
    dimensions = load_json(dimensions_path)

    rows = []
    for view, entry in document.get("views", {}).items():
        rows.extend(measure_view(view, entry))

    # Landmarks: one key, several views, one number expected.
    landmarks = {}
    for row in rows:
        if row["key"]:
            landmarks.setdefault(row["key"], []).append(row)

    verdicts = {}
    for key, group in landmarks.items():
        values = [row["length_mm"] for row in group]
        low, high = min(values), max(values)
        mean = sum(values) / len(values)
        delta = (high - low) / mean * 100.0 if mean else 100.0
        verdicts[key] = {
            "values_mm": {row["view"]: round(row["length_mm"], 1) for row in group},
            "spread_pct": round(delta, 2),
            "gate": "pass" if delta <= LANDMARK_TOLERANCE_PCT else "fail",
        }

    g1 = (
        "pass"
        if verdicts
        and all(v["gate"] == "pass" for v in verdicts.values())
        and dimensions.get("scales") == "pass"
        else "open"
    )

    if args.write:
        dimensions["landmarks"] = verdicts
        dimensions["g1"] = g1
        with open(dimensions_path, "w", encoding="utf-8") as handle:
            json.dump(dimensions, handle, indent=2)
            handle.write("\n")

    if args.annotate:
        out_dir = os.path.join(subject, "measured")
        os.makedirs(out_dir, exist_ok=True)
        for view, entry in document.get("views", {}).items():
            view_rows = [row for row in rows if row["view"] == view]
            if not view_rows:
                continue
            path = annotate(subject, view, entry, view_rows, os.path.join(out_dir, f"{view}.png"))
            print(f"annotated  {path}")

    if args.json:
        print(json.dumps({"measurements": rows, "landmarks": verdicts, "g1": g1}, indent=2))
        return

    by_view = {}
    for row in rows:
        by_view.setdefault(row["view"], []).append(row)

    for view, view_rows in by_view.items():
        entry = document["views"][view]
        scale = entry["scale_mm_per_px"]
        print(f"\n{view}   kx {scale['horizontal']:.3f}  ky {scale['vertical']:.3f} mm/px")
        print(f"  {'name':<18} {'from -> to':<18} {'dx px':>7} {'dy px':>7} {'dx mm':>9} {'dy mm':>9} {'length':>9}")
        for row in view_rows:
            pair = f"{row['from']} -> {row['to']}"
            print(
                f"  {row['name']:<18} {pair:<18} {row['dx_px']:>7.0f} {row['dy_px']:>7.0f} "
                f"{row['dx_mm']:>9.1f} {row['dy_mm']:>9.1f} {row['length_mm']:>9.1f}"
            )

    if verdicts:
        print("\nlandmarks, one key across several views")
        print(f"  {'key':<20} {'views':<28} {'mean':>9} {'spread':>8}  verdict")
        for key, verdict in verdicts.items():
            values = verdict["values_mm"]
            mean = sum(values.values()) / len(values)
            joined = ", ".join(f"{v} {x:.1f}" for v, x in values.items())
            print(
                f"  {key:<20} {joined:<28} {mean:>9.1f} {verdict['spread_pct']:>7.2f}%  "
                f"{verdict['gate'].upper()}"
            )
    else:
        print("\nlandmarks   none. Give two measurements in different views the same key.")

    print(f"\ngate G1     {g1.upper()}")
    if g1 != "pass":
        print("            A landmark needs two views and the same key on both measurements.")


if __name__ == "__main__":
    main()
