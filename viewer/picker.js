// Picking in model units, and the panel that reports it.
//
// The calque is in the scene at the model's own scale, so a point on it IS a model coordinate:
// there is no pixels-to-millimetres conversion left to get wrong. A raycast against the plate
// returns world metres directly, and the two in-plane axes of the view are the two numbers the
// model file wants.
//
// The honest limit is not the unit, it is the SCREEN. A click resolves to one screen pixel, and the
// subject covers as many screen pixels as the current zoom gives it. So the panel always prints the
// current millimetres per screen pixel, next to the reference image's own scale, which it reads
// from the API document. Trace at a zoom where the two agree, or the tool is coarser than the
// picture it shows.

import * as THREE from "three";
import {
  axesOf, betweenPoints, imageScaleMm, mmPerScreenPx as screenMmPerPx, panelLines, readPoint,
} from "./measure.js";

/**
 * @param {object} options
 * @param {ReturnType<import("./camera.js").createCameraRig>} options.rig
 * @param {ReturnType<import("./calque.js").createCalque>} options.calque
 * @param {Record<string, any>} options.views
 * @param {object} options.document                   the `/api/scene` document
 * @param {THREE.WebGLRenderer} options.renderer
 * @param {HTMLElement} options.element               the canvas, for pointer events
 * @param {THREE.Object3D} options.root               the model root, for shift-click picks
 */
export function createPicker({
  rig, calque, views, document: sceneDocument, renderer, element, root,
}) {
  const measurement = {
    active: false,
    points: [], // { source, view, world: [x,y,z], u, v, mmPerPx, axes, read }
  };

  let panel = null;

  function mmPerScreenPx() {
    return screenMmPerPx({
      perspective: rig.state.perspective,
      orthoHeight: rig.state.orthoHeight,
      distance: rig.state.distance,
      fov: rig.state.fov,
      height: renderer.domElement.height,
    });
  }

  // Pick at a normalised device coordinate -- (-1,-1) is the bottom left, (1,1) the top right -- so a
  // caller can test the chain without synthesising a mouse event.
  function pickAt(nx, ny, source) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(nx, ny), rig.activeCamera);

    if (source === "model") {
      if (!root) return null;
      const hit = raycaster.intersectObject(root, true)[0];
      if (!hit) return null;
      return { source: "model", view: null, world: hit.point.toArray() };
    }

    // The plate, even when the model is in front of it: measurement is about the reference, and the
    // model must not be able to block the point you are trying to read.
    const plate = calque.current();
    if (!plate) return null;
    const hit = raycaster.intersectObject(plate, false)[0];
    if (!hit) return null;

    const local = plate.worldToLocal(hit.point.clone());
    return {
      source: "calque",
      view: plate.userData.view,
      world: hit.point.toArray().map((v) => Number(v.toFixed(4))),
      u: local.x,
      v: local.y,
    };
  }

  function record(point) {
    const axes = axesOf(point.view ? views[point.view] : null);
    return {
      ...point,
      mmPerPx: Number(mmPerScreenPx().toFixed(3)),
      axes,
      read: readPoint(point.world, axes),
    };
  }

  function point(nx, ny, source = "calque") {
    const hit = pickAt(nx, ny, source);
    if (!hit) return null;
    const entry = record(hit);
    measurement.points.push(entry);
    render();
    return entry;
  }

  // The distance between two picks, in model units and broken down per axis.
  function between(i, j) {
    const a = measurement.points[i];
    const b = measurement.points[j];
    if (!a || !b) return null;
    return { from: i, to: j, ...betweenPoints(a.world, b.world, a.axes ?? ["x", "y"]) };
  }

  function lastBetween() {
    const n = measurement.points.length;
    return n >= 2 ? between(n - 2, n - 1) : null;
  }

  function render() {
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "measure-panel";
      panel.style.cssText = [
        "position:fixed", "left:16px", "bottom:16px", "z-index:20",
        "background:#1118", "color:#e7e9ee", "border:1px solid #2e333c", "border-radius:6px",
        "padding:8px 10px", "font:12px/1.5 ui-monospace,monospace", "max-width:520px",
        "white-space:pre", "pointer-events:none", "display:none",
      ].join(";");
      document.body.appendChild(panel);
    }
    if (!measurement.active && measurement.points.length === 0) {
      panel.style.display = "none";
      return;
    }
    panel.style.display = "block";
    const plateView = calque.shownView();
    panel.textContent = panelLines({
      active: measurement.active,
      mmPerPx: mmPerScreenPx(),
      imageKx: plateView ? imageScaleMm(sceneDocument, plateView) : null,
      imageView: plateView,
      points: measurement.points,
      between: lastBetween(),
    }).join("\n");
  }

  function on() {
    measurement.active = true;
    render();
  }

  function off() {
    measurement.active = false;
    render();
  }

  function clear() {
    measurement.points.length = 0;
    render();
  }

  element.addEventListener("pointerdown", (event) => {
    if (!measurement.active) return;
    if (event.button !== 0) return;
    const rect = element.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    point(nx, ny, event.shiftKey ? "model" : "calque");
  });

  function state() {
    return {
      active: measurement.active,
      mmPerScreenPx: Number(mmPerScreenPx().toFixed(3)),
      points: measurement.points,
      between: measurement.points.length >= 2 ? between(0, measurement.points.length - 1) : null,
    };
  }

  return {
    measurement,
    pick: point,
    between,
    lastBetween,
    render,
    on,
    off,
    clear,
    state,
  };
}
