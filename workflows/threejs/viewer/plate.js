import * as THREE from "three";
import { realMetres, referenceScale } from "./api.js";
import { viewBasis } from "./camera.js";

/**
 * Where a view's picture sits in the model, in metres.
 *
 * A plate is a plane of `imgW * kx` by `imgH * ky`, centred on its subject box and oriented by the
 * view's basis. Two consumers need that placement: the plate that draws the picture, and the volume
 * that extrudes the traced path. Building it twice is how the two drift apart by the crop margin,
 * which is exactly the 0.3 percent error this project already paid for once.
 *
 * The returned `matrix` maps a plate-local `(u, v, 0)` to model coordinates, with `u` along
 * `basis.right` and `v` along `basis.up`. `dir` is the view's normal, so it is the extrusion axis.
 */
export function plateFrame({ document: sceneDocument, views, view }) {
  const reference = sceneDocument.views?.[view]?.reference;
  if (!reference) {
    throw new Error(`plate: no cropped reference for "${view}" -- run crop_reference.py`);
  }

  const { kx, ky } = referenceScale(reference);
  const [imgW, imgH] = reference.size_px;
  const [sx0, sy0, sx1, sy1] = reference.subject_box;
  const spanH = sx1 - sx0 + 1;
  const spanV = sy1 - sy0 + 1;
  const [offsetX, offsetY] = reference.offset;

  const basis = viewBasis(views, view);
  const realHeight = realMetres(sceneDocument, sceneDocument.roles.y);
  const centre = new THREE.Vector3(0, realHeight / 2, 0);
  // A plan view is a plane at the ground, not a wall through the middle of the subject.
  if (view === "top" || view === "bottom") centre.set(0, 0, 0);

  // Subject box centre inside the cropped image, as an offset in screen coordinates.
  const dx = (offsetX + spanH / 2 - imgW / 2) * kx;
  const dy = -(offsetY + spanV / 2 - imgH / 2) * ky;

  const position = centre
    .clone()
    .addScaledVector(basis.right, dx)
    .addScaledVector(basis.up, dy);

  const matrix = new THREE.Matrix4()
    .makeBasis(basis.right, basis.up, basis.dir)
    .setPosition(position);

  return {
    kx, ky,
    width: imgW * kx,
    height: imgH * ky,
    subjectW: spanH,
    subjectH: spanV,
    basis,
    origin: position,
    matrix,
  };
}
