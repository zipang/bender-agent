# Ford Capri Mk III 2.8 Injection

Subject folder for the Ford Capri Mk III 2.8 Injection.

## Subject

A Ford Capri Mk III 2.8 Injection coupé, light metallic green, shown in a three-quarter front view.
The car is a stylized low-poly interpretation, not a photograph.

`reference.webp` is the chosen identity image. It is the low-poly render, flipped horizontally so
that the front of the car points to the right of the image, the same direction as the subject photo.

## Identification

The subject is a Ford Capri Mk III, not a Mk II, for four reasons:

- The Mk II has two large rectangular Hella H4 headlamps. The subject has four round headlamps,
  which the Mk III introduced as its trademark.
- The Mk III has a black "Aeroflow" slatted grille with the Ford oval in the centre.
- The subject carries an "injection" script on the front wing and a red pinstripe along the body.
  These belong to the 2.8 Injection model of 1981 to 1986.
- A Norev 1:18 die-cast of the "Ford Capri Mk.III 2.8 Injection (1981)" matches the model.

## Specific subject details

- Three doors: one door per side, one rear hatch. No rear side door.
- Body colour: light metallic green over the whole shell.
- Red pinstripe along the belt line, on both sides.
- "injection" script on the front wing, above the pinstripe.
- Four round headlamps in two pairs, a black slatted grille, and a small blue Ford oval in the centre.
- Black front bumper with two amber turn indicators.
- Side mirror on the driver door.
- **Black plastic lip on the rear hatch**: a thin, flat, matte black blade on the trailing edge of the
  hatch, at the base of the rear window, just above the tail lights. It spans the hatch width and
  protrudes a little rearward. It is not a wing, and it has no struts.
- The plate recess is an empty black surface. There is no plate and no character.
- Steel-look wheels with a light hub.

## Style

`style/purple-challenger-clean.jpg` is the style reference: a low-poly stylized video-game car with
flat facets, crisp edges, matte colours, and a pure white background with no cast shadow.

That image shows a different vehicle. Its purple and blue colours, its raised rear spoiler, its
wheel design and its plate must not appear on the Capri. Only the rendering treatment is borrowed.

## Dimensions

The real dimensions are an input, taken from published manufacturer specifications. They are not
read from any view.

| Dimension   | Value             | Source                                                                                                   |
| :---------- | :---------------- | :------------------------------------------------------------------------------------------------------- |
| Length      | 4.376 m (4376 mm) | Manufacturer specs, 1981 Capri 2.8i Mk III (encyCARpedia); cross-check capricarclub.org.au Mk 3: 4376 mm |
| Width       | 1.698 m (1698 mm) | Manufacturer specs (encyCARpedia); ultimatespecs and Wikipedia Mk III: 1702 mm                           |
| Height      | 1.298 m (1298 mm) | Manufacturer specs (encyCARpedia); ultimatespecs and Wikipedia Mk III: 1295 mm                           |
| Wheelbase   | 2.563 m (2563 mm) | Manufacturer specs (encyCARpedia); Wikipedia Mk III: 2565 mm                                             |
| Front track | 1.363 m           | Manufacturer specs (encyCARpedia)                                                                        |
| Rear track  | 1.394 m           | Manufacturer specs (encyCARpedia)                                                                        |
| Tyres       | 195/60 R14        | Manufacturer specs (encyCARpedia)                                                                        |

The published length ranges from 4262 mm (Wikipedia, base Mk III) to 4376 mm (encyCARpedia and
capricarclub, 2.8 Injection). The spread is about 2.7 percent. The value above uses the 2.8 Injection
figure, because the spoilers and bumpers of that model add length. The art director may revise it.

## Camera in the reference

`reference.webp` shows a three-quarter front-right view. The camera sits slightly above mid-body
height. The front of the vehicle points to the right of the image.

The orthographic views come from that image, so every view carries its own scale and its own
proportions. No view is at scale. Stage 1 measures a scale per axis for each view.

## Views

| View     | Reference file                     | State            | Front of the car points to |
| :------- | :--------------------------------- | :--------------- | :------------------------- |
| `front`  | `front/reference.webp` (1264x848)  | locked           | viewer                     |
| `back`   | `back/reference.webp` (1264x848)   | locked           | away from the viewer       |
| `right`  | `right/reference.webp` (1376x768)  | locked           | right                      |
| `left`   | `left/reference.webp` (1376x768)   | locked           | left                       |
| `top`    | `top/reference.webp` (896x1200)    | locked           | top                        |
| `bottom` | `bottom/reference.webp` (896x1200) | locked, optional | top                        |

`left/reference.webp` is a horizontal flip of `right/reference.webp`. It is not a generated image, so
the two side views are exactly symmetric.

`rear-3q/reference.webp` is an auxiliary three-quarter view, not one of the six. It records the shape
of the black rear lip, and it is the reference for that part in stage 3.

Every reference is WebP at quality 92. The JPEG originals were converted, checked at an RMSE of
1.1/255, and removed. The seven images weigh 328 KB instead of 2.1 MB.

## Scales, stage 1

`cropped/<view>.webp` holds the view without its white margin. Each view has two scales, one per
axis, written in `dimensions.json`.

| View     | kx mm/px | ky mm/px | Anisotropy |  Drift | Gate               |
| :------- | -------: | -------: | ---------: | -----: | :----------------- |
| `left`   |    3.283 |    2.853 |     0.8690 | 13.10% | `corrected`        |
| `right`  |    3.283 |    2.853 |     0.8690 | 13.10% | `corrected`        |
| `front`  |    2.048 |    1.964 |     0.9587 |  4.13% | `pass`             |
| `back`   |    1.932 |    1.881 |     0.9738 |  2.62% | `pass`             |
| `top`    |    3.329 |    3.964 |     1.1905 | 19.05% | `corrected`        |
| `bottom` |    2.868 |    3.779 |     1.3175 | 31.75% | `reject`, optional |

Two rules follow, and they apply to every later stage:

- **Convert per axis.** A horizontal distance uses `kx`, a vertical distance uses `ky`. One global
  scale would be wrong by the drift, everywhere, and no gate can see it.
- **Normalize first.** `mm = (px / span_px_on_that_axis) * real_mm`.

`top` is read with `--span robust`, because the mirrors protrude 36 px beyond the body and the
view is anchored on the width. On the other views `--span box` is correct: on a profile, the
smoothing eats the roof crown, and it turns a real 13% anisotropy into a false `pass`.

`bottom` is `reject` and stays out of every gate. It is an invented underside.

### The crop is a committed input

`cropped/<view>.webp` and `cropped/manifest.json` are **committed**. The crop is not a scratch file:
the viewer's calque and `tools/trace_hull.py` both read it, and both convert its pixels to
millimetres. Rebuilding it means re-arbitrating every scale, so it ships with the subject.

The crop is lossless (1.0 MB for six views against 1.6 MB in PNG, pixels identical), and
`crop_reference.py` decodes each file back and compares it before the run ends. A regeneration that
moves one pixel would reopen every scale built on it.

`measured/` stays derived and local: it is a picture of a check, not an input. Rebuild it with
`python3 tools/measure/report.py blueprints/vehicules/ford-capri-mk-iii --annotate`.

If a reference must change, the order is fixed: convert the new reference, run `crop_reference.py`,
rerun `view_scale.py` on all six views, rebuild `measurements.json` (it embeds a copy of every scale),
then run `report.py --write`. On this subject a one-pixel move at the roof crown of `front` changed
its drift from 4.27% to 4.13%.

## Gate G1

G1 passes. The wheelbase reads 2563.9 mm on `right` and 2521.0 mm on `top`: a spread of 1.69%,
inside the 10% budget. The two views therefore describe the same object.

## Hidden parts

No photograph shows a pure side profile, a top, or an underside. Those regions exist only in the
generated views, so treat them as hypotheses: useful for shape, not measured truth.

- The underside is the weakest region. The art director locked `bottom`, but it is optional and it
  does not enter a gate. Model it only if the deliverable exposes it.
- The roof crown and the hatch surface come from the `top` and `rear-3q` views only.
- No view shows the engine bay.

## Sources

- encyCARpedia, 1981 Ford Capri 2.8i Mk III: https://encycarpedia.com/ford/81-capri-2-8i-coupe
- Capri Car Club of Australia, Capri Mk 3 general information: https://www.capricarclub.org.au/caprimk3-i.php
- Ultimate Specs, Ford Capri Mk III 2.8 Injection: https://server.ultimatespecs.com/car-specs/Ford/7077/Ford-Capri-Mk-III-28-Injection.html
- Wikipedia, Ford Capri (Mk III dimensions): https://en.wikipedia.org/wiki/Ford_Capri
