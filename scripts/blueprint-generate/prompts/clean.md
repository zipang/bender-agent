# Reference Repair Template
#
# Used by: blueprint-generate.ts --clean
# Validated on blueprints/vehicules/blue-and-white-minivan-01 (single panel) and
# blueprints/vehicules/r5-tl-1972 (two panels, with content edits).
#
# Placeholders:
#   {subject}      vehicle | character | object | subject, from the subject type
#   {subjectName}  subject folder name
#   {defects}      artifacts to remove, from --defects
#   {editsBlock}   content changes the art director authorized, from --edits, or the no-edit text
#   {panelNote}    how many panels the image holds, and how to keep them
#
# Two kinds of change, and they must not be confused:
#   defects  an artifact that is not the subject: outline, shadow, halo, speckles. Never content.
#   edits    a deliberate change to the subject itself: a logo to erase, the characters of a plate
#            to remove, a window to close. Only the art director authorizes it.
#
# An edit names what to remove, and it never authorizes removing more than it names. Most edits
# target the CONTENT of a carrier, not the carrier itself: the characters of a plate, and not the
# plate; the interior seen through the glass, and not the glass. The template states that rule,
# because a model that is told "erase the plate" erases the plate and leaves a hole.

[shared]
The attached image is a reference image for a 3D asset pipeline. It contains one main subject: a
{subject}. Repair that image in place.

{panelNote}

This is a repair pass, not a redesign. The geometry, the camera, and the framing stay exactly as
they are. Two things may change, and only these two:

1. Artifacts to remove: {defects}.
2. Authorized content edits, if any:
{editsBlock}

Do not move, rescale, recrop, rotate, or re-pose the subject. Do not change the camera angle, the
perspective, or the framing. Do not change a shape, a proportion, a colour, a material, or a wear
mark that is not named above. Do not add a part, a detail, or an accessory.

An edit applies to exactly what it names, and nothing around it. Read each edit literally, and
delete the smallest thing that satisfies it. When an edit targets the CONTENT of a carrier, keep
the carrier itself perfectly intact:

- A plate, a decal, or a sign is a carrier. Its characters, its numbers, its text, and its graphics
  are the content. Remove the content, and keep the plate: same rectangle, same edges, same
  mounting, same colour, same surface, same thickness, same position. A blank plate stays a plate.
- Glass is a carrier. The interior behind it is the content. Remove the interior, and keep the
  glass: the same tint, the same reflections, the same highlights, the same frame, exactly as they
  already are in this image. Do not repaint the glass, do not darken it, and do not invent a
  reflection that the image does not show. Only the shapes behind the glass disappear.
  To remove what is behind glass, keep the glass surface and its existing colour field, and reply
  it as an opaque surface of exactly that colour: no seat, no dashboard, no wheel, no headrest, no
  silhouette, and no new reflection. The glass must look like the darkest window already in the
  image, and it must not become lighter, greyer, or more transparent than it was.

When an edit targets a whole part, remove that part cleanly, as if it had never been there: its
screws, its outline, its shadow, and its recess. The surface must then read as one continuous
painted panel. Leave no hole, no ghost rectangle, no smudge, no blurred patch, and no invented
replacement graphic.

There is no ground and no environment. Keep the subject on a plain pure white background, with a
small even margin around it. Use no shadow, no reflection under the subject, no gradient, and no
vignette.

Return the same subject, from the same angle, on pure white.
