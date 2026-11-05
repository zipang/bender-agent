# Draft prompt: one modeling reference image built from the material of a draft folder.
#
# The generator attaches the images in order: subject first, then style.
# Placeholders come from lib/prompts.ts (buildDraftPrompt).
#
# This template serves one panel and several panels. The panel intro, the layout, the panel list
# and the panel rules are generated from the pose count, so the wording never contradicts the
# requested layout.
#
# NOTHING here assumes a subject category. The subject can be an object, a machine, a vehicle, a
# character, a creature, a plant, or a product. NOTHING here assumes that the reference images are
# complete, consistent, sharp, or even of the same instance. The template states how to resolve
# that, and the art director can pin a reading with "specific subject details".

[shared]
You prepare one modeling reference image for a 3D asset pipeline. The result becomes the single
identity image of a {subject}. Orthographic views are generated from it later, so it must show the true shape of the {subject} and nothing else.

{panelIntro}

The attached images have two separate roles. Do not mix them.

{subjectRange}: the SUBJECT REFERENCE.
These images were collected by hand. They are raw evidence about one subject, not a set of equal
claims, and they are not guaranteed to be complete:

- They can come from different angles, distances, cameras, lenses, and light conditions.
- Their quality, sharpness, and resolution can differ a lot.
- They can be partial: a detail shot, a crop, a drawing, a screenshot, a photo of a screen.
- They can disagree about a detail, a colour, a marking, or the position of a part.
- One of them can show a variant, a sibling model, a different paint scheme, or a different pose.
- One or more of them can show the subject in a context that is not the subject at all.

First decide what the subject IS. Read every subject image together and build one single mental
model of it: the part count, the silhouette from each side, the proportions, the colours, the
materials, the markings, the wear, and the asymmetries. Do not assume a category, and do not add
what the category usually has. A chair needs no wheels. A robot needs no grille. A character needs
no bumper. Use only what the images show or what their parts logically imply.

The reference images do not have to agree perfectly. When they differ, treat the difference as
noise from the capture, not as a redesign. Resolve it in this order, and stop at the first rule
that gives an answer:

1. The "specific subject details" the art director states below. This rule wins over every image.
2. The sharpest, most complete, and least cropped image.
3. The most orthographic image, the one taken square to a side, a front, or a back.
4. The simplest reading that stays compatible with every image at once.

Never merge two different subjects into one. Never average two incompatible shapes into a shape
that neither shows. Never invent a part that no image supports. When a detail cannot be settled,
choose the simplest plausible reading and keep it strictly identical in every panel.

You cannot ask a question in return, so settle the reading yourself. But when the difficulty goes
past a detail and reaches the subject itself, keep the reading minimal and literal. A doubtful
reading costs less than an invented part: draw only what the images support, complete only what
the geometry requires, and add no decoration to fill the doubt. The art director settles the
remaining ambiguity in the "specific subject details" below, so respect that text over your own
reading whenever the two differ.

Some parts of the {subject} are not visible in any image: a back, an underside, an interior, a
side that no picture covers, a face in shadow. Complete them so the result reads as one single
coherent {subject}. Extrapolate from the visible parts only: same construction logic, same
material, same level of detail, same proportions, same wear. Complete what the geometry requires,
and stop there. Do not add decoration, text, badges, seams, or equipment that no image supports.

A subject image can contain a background: a sky, a lawn, a table, a studio sweep, a diorama, a
shadow on the ground, another product. All of it is noise. Reproduce none of it. The subject keeps
its own colours and its own markings: never recolour it, and never apply the livery, the logo, or
the graphic design of another image to it.

{styleBlock}
The rendering treatment never changes the geometry. The {subject} keeps the body shape, the
proportions, the part count, the colours, and the markings that the subject images show. The style
changes only how the surface is drawn.

{panelLayout}

{panelList}

{panelRules}

Render the complete {subject} in each panel, centered, with a small white margin on every side. No
part of the {subject} may touch or cross the image edge, and no silhouette may touch another one.

Frame: one single image, {aspect} {orientation}.

Background: one perfectly uniform pure white field, #FFFFFF, edge to edge. No gradient, no
vignette, no texture, no room, no horizon line, no ground plane.

Lighting: flat and even. No cast shadow on the background, no contact shadow, no floor
reflection, no dramatic rim light.

Output: a clean product sheet of the {subject}, rendered {style}. No text, no caption, no logo
overlay, no watermark, no border, no frame, no dimension arrow, no colour swatch strip, no collage
of extra thumbnails.

This is a controlled modeling reference, not a cinematic image. Do not beautify, do not redesign,
do not change the proportions to make the {subject} look better.

Reference images in words, from the art director: {subjectNote}
Specific subject details to keep, from the art director: {specificSubjectDetails}
Style notes from the art director: {styleNote}

[style]
{styleRange}: the STYLE REFERENCE.
The style reference defines how the picture must look, not what it shows. It shows a different
subject, which is irrelevant. Copy only the rendering treatment: the shading model, the edge
treatment, the polygon density, the material response, the palette saturation, and the flatness of
the light.

Never copy from a style image: its subject, its body shape, its parts, its accessories, its
markings, its colours, its camera angle, or its composition. The subject keeps its own colours, so
a blue and white style image must not produce a blue and white {subject}. If a style image
conflicts with a subject image, the subject wins on shape, part count, colour, and markings, and
the style wins on rendering treatment only. Apply the same treatment to every panel.

[no-style]
No style image is attached. Apply this rendering style exactly: {style}.
Keep the shading simple and flat, keep the silhouette readable, and keep the material response
consistent across the whole {subject}, in every panel.
