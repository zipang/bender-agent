// The pure spin math: one turn in twelve seconds, counter-clockwise.
//
// The page can spin the camera in a loop, but the angle a tick produces is a rule with no state and
// no clock, so it is tested without a browser. Twenty seconds would be too slow to judge a
// silhouette and four seconds too fast to follow a named part; twelve is the chosen period. The step
// is subtracted, so the camera turns counter-clockwise, which is the direction the art director
// asked for.
//
// A tick that carries no positive interval returns the angle unchanged. That case is real: the first
// animation-loop callback carries no previous timestamp, and a background tab can report a frame
// interval of zero.

export const SPIN_PERIOD_MS = 12_000;

/**
 * The azimuth after one tick.
 *
 * @param {number} azimuth The current azimuth, in degrees
 * @param {number} dtMs The interval since the previous tick, in milliseconds
 * @param {number} [periodMs] The period of one turn, in milliseconds
 * @returns {number} The next azimuth, normalized into `[0, 360)`
 */
export function nextAzimuth(azimuth, dtMs, periodMs = SPIN_PERIOD_MS) {
	// `Number.isFinite` rejects NaN and both infinities; the `<= 0` guard rejects a stopped or
	// backwards clock. The angle is returned as it arrived, not normalized: a caller that sends a
	// NaN must not receive a plausible 0 back.
	if (!Number.isFinite(dtMs) || dtMs <= 0) return azimuth;
	const next = azimuth - dtMs * (360 / periodMs);
	if (!Number.isFinite(next)) return azimuth;
	return ((next % 360) + 360) % 360;
}
