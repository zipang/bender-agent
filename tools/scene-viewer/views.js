// The fixed view table: six orthographic presets and one free view.
//
// A named view is a frame the art director can reproduce, so it is a constant and not something a
// page derives from the asset. The order of the keys is the order of the view bar. The table is
// destined for both workflows, one table: the Three.js viewer still reads its own copy today, and
// a later ticket merges it onto this one. The viewer reads no `scene.json`, so nothing here can
// drift with a subject.
//
// `up` is written only on the two pole views. At ±89.99° a camera that keeps the world `+Y` as its
// up vector is looking almost straight down or up, and the horizon becomes an unstable line; `-Z`
// puts the asset's width on the screen's horizontal instead.

export const VIEWS = Object.freeze({
	left: { azimuth: 0, elevation: 0, perspective: false },
	right: { azimuth: 180, elevation: 0, perspective: false },
	front: { azimuth: 90, elevation: 0, perspective: false },
	back: { azimuth: 270, elevation: 0, perspective: false },
	top: { azimuth: 90, elevation: 89.99, perspective: false, up: [0, 0, -1] },
	bottom: {
		azimuth: 90,
		elevation: -89.99,
		perspective: false,
		up: [0, 0, -1]
	},
	free: { azimuth: 60, elevation: 30, perspective: true }
});

// The view a page opens on: the eye that shows a mass. An elevation is a projection, and it hides
// everything the other axis carries, so it is a poor first look at an asset nobody has seen.
export const DEFAULT_VIEW = "free";
