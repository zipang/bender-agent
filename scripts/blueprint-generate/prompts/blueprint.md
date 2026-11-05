# Blueprint Prompt Template
#
# Edit this file to tune every generation. No code change is required.
# Sections start with a name in square brackets. Do not remove [shared] or a view section.
#
# Placeholders:
#   {subjectType}  vehicule | character | object
#   {style}        rendering style, from --style
#   {view}         front | left | back | right | top | bottom
#   {subjectName}  subject folder name, for reference only
#
# [shared] is used for every view. Each view section is appended after it.

[shared]
We want to create a 3D statue (figurine) of this {subjectType} of a video game.
{referenceViewsBlock}
Using the same {style} style, we want to view the subject from different angles to propose it for sale.
Use the attached reference image of the subject to generate the {view} orthographic view of the exact same subject.
Extrapolate the hidden details of the reference subject.
Use a true orthographic camera with no perspective convergence, no three-quarter angle, no lens distortion, and no dramatic lighting.
Center the complete subject on a pure white background.
Show all surfaces visible from this direction.

DO NOT use shadows. DO NOT add any support, base, pedestal, or separate accessory to the scene.
DO remove any artifact that is not the main subject (halos, shadows, speckles, stray marks) to keep the background clear.
DO keep the same proportions, materials, colors, and wear.

{notesBlock}

[front]
The camera is in front of the subject and looks at its front face. The subject faces the camera.

[left]
The camera is on the left side of the subject itself. The front of the subject points to the right side of the image.

[back]
The camera is behind the subject and looks at its rear face. This is a 180 degree turn from the front view.

[right]
The camera is on the right side of the subject itself. The front of the subject points to the left side of the image.

[top]
The camera is directly above the subject. The camera axis is vertical and points down. The front of the subject points to the bottom of the image.

[bottom]
The camera is directly below the subject. The camera axis is vertical and points up. The front of the subject points to the bottom of the image.
