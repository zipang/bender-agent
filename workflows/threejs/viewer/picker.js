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
      // The zoom the orthographic camera is at: the panel and the 10 px grab threshold follow it, so
      // a handle stays as easy to grab at 400 % as at 100 %.
      zoom: rig.state.zoom,
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

  // One press, one possible point.
  //
  // T0003 gives the left button to the camera: a left drag pans, on the flat views and the free
  // views alike. A record on the press would therefore drop a point on every pan, and a plain left
  // click is the pan's resting gesture, not a measurement. A point is invoked by `Ctrl` + left
  // click, and it lands on the RELEASE, under 3 px of movement.
  //
  // The claim is a capture-phase listener on `window`, not on the canvas. On a free view
  // `Ctrl` + left is `OrbitControls`' own rotate -- the modifier swap T0003 pins to r187 -- so the
  // measurement chord must be taken before the canvas sees it. When the chord matches and the tool
  // is on, the event is stopped here and never reaches `OrbitControls`. When it does not match, the
  // handler returns without touching the event, so the camera keeps the plain left press.
  const DRAG_PX = 3;   // the same threshold T0004 uses for a degenerate marquee rectangle
  let pending = null;  // { pointerId, clientX, clientY, source } | null

  window.addEventListener("pointerdown", (event) => {
    // A press that is not the chord abandons any point the previous press was carrying.
    if (!measurement.active || event.button !== 0 || !event.ctrlKey) {
      pending = null;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    // `ctrlKey` only: on macOS a `Meta` click is the secondary-click gesture, and the art director
    // asked for `Ctrl`. The source is decided at the PRESS, so releasing `Shift` a moment early
    // cannot change which surface the point lands on.
    pending = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      source: event.shiftKey ? "model" : "calque",
    };
  }, { capture: true });

  // The release stays on the canvas, where the press handler used to be. `OrbitControls` captures
  // the pointer on the same element, so a `pointerup` reaches the canvas even when the press was
  // the camera's.
  element.addEventListener("pointerup", (event) => {
    if (!pending || event.pointerId !== pending.pointerId) return;
    const moved = Math.hypot(event.clientX - pending.clientX, event.clientY - pending.clientY);
    const source = pending.source;
    pending = null;
    if (moved >= DRAG_PX) return;
    const rect = element.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    point(nx, ny, source);
  });

  // A cancel and a lost focus abandon the point, and a fresh press of another button is handled
  // above. A `pointerup` with no pending press records nothing: that is what makes T0004's press
  // claim safe, because a press the knot editor consumes never reaches this picker.
  element.addEventListener("pointercancel", () => { pending = null; });
  window.addEventListener("blur", () => { pending = null; });

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
    pickAt,
    between,
    lastBetween,
    render,
    on,
    off,
    clear,
    state,
  };
}
