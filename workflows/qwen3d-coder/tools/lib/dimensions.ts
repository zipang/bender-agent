// The real dimensions of a blueprint, as the `* dimensions:` line of the user turn.
//
// `dimensions.json` holds `real.length.value`, `real.height.value`, and `real.width.value`, each
// with its own source. The values are an input of the run; this module never reads them from the
// views that the asset is later checked against. A missing file, invalid JSON, a missing `real`
// block, or one bad value is a null line: a blueprint without dimensions is a normal blueprint.

/** A finite number above zero, or null. */
function positive(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: null;
}

/**
 * At most three decimals, with the trailing zeros of the art director's
 * notation trimmed.
 */
function number(value: number): string {
	return String(Number(value.toFixed(3)));
}

function readValue(value: unknown): number | null {
	if (value === null || typeof value !== "object") return null;
	return positive((value as { value?: unknown }).value);
}

/**
 * Build the `L=<length> <unit>, h=<height> <unit>, l=<width> <unit>` line, or
 * null.
 *
 * The unit is `json.unit` when it is a non-empty string, else `m`. Every one of
 * the three values must be a finite number above zero, or the whole line is
 * absent.
 */
export function dimensionsLine(json: unknown): string | null {
	if (json === null || typeof json !== "object" || Array.isArray(json))
		return null;

	const real = (json as { real?: unknown }).real;
	if (real === null || typeof real !== "object" || Array.isArray(real))
		return null;

	const block = real as {
		length?: unknown;
		height?: unknown;
		width?: unknown;
	};
	const units = (json as { unit?: unknown }).unit;
	const unit = typeof units === "string" && units.trim() ? units.trim() : "m";

	const lengthValue = readValue(block.length);
	const heightValue = readValue(block.height);
	const widthValue = readValue(block.width);
	if (lengthValue === null || heightValue === null || widthValue === null)
		return null;

	return `L=${number(lengthValue)} ${unit}, h=${number(heightValue)} ${unit}, l=${number(widthValue)} ${unit}`;
}
