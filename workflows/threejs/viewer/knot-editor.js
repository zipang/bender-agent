// The knot editor: the one place where input becomes an edit.
//
// A contour that carries 194 knots, or a reduce that keeps 34, cannot be reshaped one knot per
// gesture: the art director needs to act on a region of the outline as one object. This module owns
// that region -- the selection -- and every listener the gestures need:
//
//   Shift + left drag   draw a selection rectangle; every knot inside it joins the selection
//   drag a selected knot  move the whole selection by one vector
//   Delete / Backspace  remove the selected knots, unless fewer than three would remain
//   Escape              clear the selection, or cancel an open marquee
//
// It is one module because "every input binding in one place" must be literal: the editor installs
// its listeners once, at construction, and never removes them. A listener that returns early while
// the tool is off costs nothing; adding and removing on every mode toggle is a second source of
// state that can drift.
//
// The editor does not own the left button. The camera does: a left drag pans, on a flat view as on a
// free one. The editor borrows the button in one place only -- a press that lands inside a knot's
// grab threshold -- so the same button pans everywhere else and never needs a mode. The claim is a
// capture-phase listener on `window`: `OrbitControls` registers its own `pointerdown` on the canvas
// when it is constructed, and at the target a listener runs in registration order, so a canvas-level
// `stopImmediatePropagation()` would arrive AFTER `OrbitControls` had already claimed the press. A
// capture-phase listener on an ancestor stops the event before it reaches the canvas.
//
// The selection is transient. It is never written to `contours.js` and never enters the saved
// payload; only the knots it moves or removes are.

import * as THREE from "three";
import { addIndices, indicesInRect, moveKnotsBy, nearestKnot, removeKnots } from "./knots.js";

const DRAG_PX = 3; // a rectangle whose diagonal is under this many pixels is a Shift click

/**
 * @param {object} options
 * @param {ReturnType<import("./camera.js").createCameraRig>} options.rig
 * @param {ReturnType<import("./calque.js").createCalque>} options.calque
 * @param {ReturnType<import("./picker.js").createPicker>} options.picker
 * @param {ReturnType<import("./stage.js").createStage>} options.stage
 * @param {HTMLCanvasElement} options.canvas
 * @param {{ marquee: HTMLElement|null, info: HTMLElement|null }} options.dom
 * @param {object} options.host  the knot model the editor must not own
 */
export function createKnotEditor({ rig, calque, picker, stage, canvas, dom, host }) {
  // The one selection: `view` is the plate being edited, `indices` ascending, unique, into
  // `knotsOf(view)`. `view: null` means "no selection", and the shown view answers for display.
  const selection = { view: null, indices: [] };
  let active = false;
  let shiftDown = false;

  // The rectangle: `base` is the selection it had at press, `candidates` the live union.
  const marquee = { open: false, view: null, origin: null, startClient: null, base: [], candidates: [] };
  // The group drag: `last` is the pointer's uv at the previous move, so the delta is incremental.
  const drag = { active: false, view: null, last: null };

  const info = dom?.info ?? null;
  const marqueeEl = dom?.marquee ?? null;

  function knotList(view) {
    return view ? host.knotsOf(view) ?? [] : [];
  }

  function isActive() {
    return active;
  }

  function selectionState() {
    const view = selection.view ?? calque.shownView();
    const list = knotList(view);
    const indices = selection.view ? selection.indices.slice() : [];
    return {
      view: view ?? null,
      indices,
      count: indices.length,
      positions: indices.map((i) => (list[i] ? [list[i][0], list[i][1]] : null)),
    };
  }

  function selectionSet(view, indices) {
    const list = knotList(view);
    const next = addIndices([], indices, list.length);
    selection.view = view ?? null;
    selection.indices = next;
    calque.setSelection?.(view ?? null, next);
    host.updateInfo?.();
    return selectionState();
  }

  function selectionClear() {
    selection.view = null;
    selection.indices = [];
    calque.setSelection?.(null, []);
    host.updateInfo?.();
    return { view: calque.shownView() ?? null, count: 0 };
  }

  /** The additive selection path of `__ctl.knotSelectRect`, in plate-local metres. */
  function selectRect(view, u0, v0, u1, v1) {
    const list = knotList(view);
    const inside = indicesInRect(list, [u0, v0, u1, v1]);
    const before = selection.view === view ? selection.indices : [];
    const after = addIndices(before, inside, list.length);
    const added = after.filter((i) => !before.includes(i));
    selectionSet(view, after);
    return { view, added, selection: after, count: after.length };
  }

  /** Move the whole selection by one vector. The `__ctl.knotDragSelection` path. */
  async function dragSelection(du, dv) {
    const view = selection.view;
    if (!view || selection.indices.length === 0) {
      return { view: view ?? null, moved: 0, count: 0 };
    }
    const entry = host.ensureKnots(view);
    entry.knots = moveKnotsBy(entry.knots, selection.indices, [du, dv]);
    await host.applyEdit(view, { volume: true });
    return { view, moved: selection.indices.length, count: selection.indices.length };
  }

  /** Delete the selection, or refuse below the minimum. The `__ctl.knotDeleteSelection` path. */
  async function deleteSelection() {
    const view = selection.view;
    if (!view) return { view: null, removed: [], refused: false, reason: null, count: 0 };
    const entry = host.ensureKnots(view);
    const result = removeKnots(entry.knots, selection.indices, 3);
    if (result.refused) {
      if (info) info.textContent = "cannot delete: at least 3 knots";
      return { view, removed: [], refused: true, reason: result.reason, count: selection.indices.length };
    }
    entry.knots = result.knots;
    selectionClear();
    await host.applyEdit(view, { volume: true });
    return { view, removed: result.removed, refused: false, reason: null, count: 0 };
  }

  /** Project a knot of the shown view to CSS pixels inside the canvas. */
  function screenOf(index) {
    const view = selection.view ?? calque.shownView();
    const plate = calque.current();
    if (!view || !plate) return null;
    const knot = knotList(view)[index];
    if (!knot) return null;
    // The z is the same hair in front of the line that `buildHandles` uses in `calque.js`: a handle
    // and the outline it belongs to sit at the same place, so a projected handle lands on its knot.
    const world = new THREE.Vector3(knot[0], knot[1], 0.001);
    plate.localToWorld(world);
    const ndc = world.project(rig.activeCamera);
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + ((ndc.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - ndc.y) / 2) * rect.height,
    };
  }

  /** Recompute the marquee-armed class after a view or an edit-mode change. */
  function armCursor() {
    const armed = active && !rig.state.perspective && (shiftDown || marquee.open);
    document.body.classList.toggle("marquee-armed", armed);
    return armed;
  }

  function setActive(on) {
    active = Boolean(on);
    if (!active) {
      cancelMarquee();
      endDrag();
      selectionClear();
    }
    armCursor();
    return active;
  }

  // ------------------------------------------------------------------ the marquee overlay

  function showMarquee(client) {
    if (!marqueeEl) return;
    marqueeEl.hidden = false;
    marqueeEl.style.left = `${client.x}px`;
    marqueeEl.style.top = `${client.y}px`;
    marqueeEl.style.width = "0px";
    marqueeEl.style.height = "0px";
  }

  function updateMarquee(a, b) {
    if (!marqueeEl) return;
    marqueeEl.style.left = `${Math.min(a.x, b.x)}px`;
    marqueeEl.style.top = `${Math.min(a.y, b.y)}px`;
    marqueeEl.style.width = `${Math.abs(b.x - a.x)}px`;
    marqueeEl.style.height = `${Math.abs(b.y - a.y)}px`;
  }

  function hideMarquee() {
    if (marqueeEl) marqueeEl.hidden = true;
    marquee.open = false;
    marquee.view = null;
    marquee.origin = null;
    marquee.startClient = null;
    marquee.base = [];
    marquee.candidates = [];
  }

  function startMarquee(event, pick) {
    marquee.open = true;
    marquee.view = pick.view;
    marquee.origin = pick.uv;
    marquee.startClient = { x: event.clientX, y: event.clientY };
    marquee.base = selection.view === pick.view ? selection.indices.slice() : [];
    marquee.candidates = marquee.base.slice();
    showMarquee(marquee.startClient);
    event.preventDefault();
    event.stopPropagation();
    capturePointer(event.pointerId);
    armCursor();
  }

  function moveMarquee(event) {
    const current = picker.pickPlaneAt(...pointerNdc(event));
    if (marquee.startClient) {
      updateMarquee(marquee.startClient, { x: event.clientX, y: event.clientY });
    }
    if (!current || current.view !== marquee.view) return;
    const list = knotList(marquee.view);
    const rect = [marquee.origin[0], marquee.origin[1], current.uv[0], current.uv[1]];
    marquee.candidates = addIndices(marquee.base, indicesInRect(list, rect), list.length);
    // The candidates are shown, not committed: the selection follows the rectangle live, and the
    // panel quotes the count, but a Shift click with no movement will restore `base`.
    selection.view = marquee.view;
    selection.indices = marquee.candidates.slice();
    calque.setSelection?.(marquee.view, marquee.candidates);
    host.updateInfo?.();
  }

  function releaseMarquee(event) {
    const start = marquee.startClient;
    const diagonal = start ? Math.hypot(event.clientX - start.x, event.clientY - start.y) : 0;
    const view = marquee.view;
    const base = marquee.base;
    const candidates = marquee.candidates;
    releasePointer(event.pointerId);
    hideMarquee();
    // Under three screen pixels it is a Shift click: the selection does not change.
    selectionSet(view, diagonal < DRAG_PX ? base : candidates);
    armCursor();
  }

  function cancelMarquee() {
    if (!marquee.open) return;
    const view = marquee.view;
    const base = marquee.base;
    hideMarquee();
    selectionSet(view, base);
    armCursor();
  }

  // ------------------------------------------------------------------ the group drag

  function moveDrag(event) {
    const current = picker.pickPlaneAt(...pointerNdc(event));
    if (!current || current.view !== drag.view) return;
    const entry = host.ensureKnots(drag.view);
    const delta = [current.uv[0] - drag.last[0], current.uv[1] - drag.last[1]];
    entry.knots = moveKnotsBy(entry.knots, selection.indices, delta);
    drag.last = current.uv;
    host.applyEdit(drag.view, { volume: false });
  }

  function endDrag() {
    if (!drag.active) return;
    const view = drag.view;
    drag.active = false;
    drag.view = null;
    drag.last = null;
    // The volume costs about two seconds, so it is rebuilt once, on release, and only when shown.
    if (view && host.volumeVisible?.()) host.rebuildVolume?.();
  }

  // ------------------------------------------------------------------ pointer helpers

  function pointerNdc(event) {
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    ];
  }

  function capturePointer(pointerId) {
    try {
      canvas.setPointerCapture(pointerId);
    } catch {
      // A synthetic event in a check has no active pointer and the browser throws `NotFoundError`.
    }
  }

  function releasePointer(pointerId) {
    try {
      if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
    } catch {
      // The pointer may already be gone; nothing to release.
    }
  }

  function isTypingTarget(target) {
    return Boolean(target && typeof target.matches === "function" &&
      target.matches('input, textarea, select, [contenteditable="true"]'));
  }

  // ------------------------------------------------------------------ the listeners
  //
  // Installed once, at construction, and never removed.

  // The press claim: a capture-phase listener on `window`, so it runs before `OrbitControls` at the
  // canvas. Only the presses the editor owns call `stopPropagation`; a press away from every knot
  // is left alone and reaches the camera, so a pan never costs the selection.
  window.addEventListener("pointerdown", (event) => {
    if (!active || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey) return; // the measurement tool's chord
    if (rig.state.perspective) return; // the editor acts on a flat view only
    const pick = picker.pickPlaneAt(...pointerNdc(event));
    if (!pick) return;

    if (event.shiftKey) {
      startMarquee(event, pick);
      return;
    }

    // A plain press is claimed only when it lands on a knot, inside the grab threshold. The
    // threshold is 10 screen pixels in the plate's metres, so a handle is as easy to grab at 400 %
    // as at 100 %.
    const list = knotList(pick.view);
    const threshold = (10 * (picker.state().mmPerScreenPx || 1)) / 1000;
    const near = nearestKnot(list, pick.uv);
    if (!near || near.distance > threshold) return; // not claimed: the camera pans

    event.preventDefault();
    event.stopPropagation();
    const selected = selection.view === pick.view && selection.indices.includes(near.index);
    if (selected) {
      capturePointer(event.pointerId);
      drag.active = true;
      drag.view = pick.view;
      drag.last = pick.uv;
    } else {
      // A click on an unselected knot is a selection reset: it never inserts, removes or moves.
      selectionSet(pick.view, []);
    }
  }, { capture: true });

  canvas.addEventListener("pointermove", (event) => {
    if (!active) return;
    if (marquee.open) moveMarquee(event);
    else if (drag.active) moveDrag(event);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!active) return;
    if (marquee.open) releaseMarquee(event);
    else if (drag.active) endDrag();
  });

  canvas.addEventListener("pointercancel", () => {
    cancelMarquee();
    endDrag();
  });

  // The keys. `Shift` is tracked always, so arming the crosshair needs no mode; the edit keys act
  // only while the tool is on.
  window.addEventListener("keydown", (event) => {
    if (event.key === "Shift") {
      shiftDown = true;
      armCursor();
      return;
    }
    if (!active) return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    if (isTypingTarget(event.target)) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      // While a rectangle is open the selection is a live preview, not a commitment: `releaseMarquee`
      // would re-apply the candidates it captured. Deleting the preview and then re-applying the
      // stale candidates would resurrect a state the art director never confirmed, so the key does
      // nothing until the rectangle closes.
      if (marquee.open) return;
      event.preventDefault();
      deleteSelection();
    } else if (event.key === "Escape") {
      // Escape cancels whatever gesture is open, so the two cancel paths agree: a rectangle restores
      // the selection it had at press, a group drag ends, and with neither open the selection clears.
      if (marquee.open) cancelMarquee();
      else {
        endDrag();
        selectionClear();
      }
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key !== "Shift") return;
    shiftDown = false;
    armCursor();
  });

  // A key released outside the page must not leave the sight on.
  window.addEventListener("blur", () => {
    shiftDown = false;
    armCursor();
  });

  return {
    setActive,
    isActive,
    selection: selectionState,
    selectionSet,
    selectionClear,
    selectRect,
    dragSelection,
    deleteSelection,
    screenOf,
    armCursor,
  };
}
