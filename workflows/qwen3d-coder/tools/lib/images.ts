// The image set of a run: `--image`, `--views`, and the preset that sizes every image.
//
// The endpoint's decoder reads what `stb_image` reads, one blueprint is written entirely in WebP,
// and the reference views are 1600 × 1600 — too many image tokens for a 4B model on a local
// endpoint. Every image is therefore decoded, resized, and re-encoded as PNG before it leaves this
// module. `blueprints/**` is read only: the source files keep their size and their format.
//
// The function is a pure function of the file system. It throws one `Error` per violated rule, and
// the caller maps the throw to exit `1`.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The three rungs of the D10 ladder, in the order a run tries them.
 *
 * `tiny` is the default and the first rung; `small` is the first climb; `full`
 * is the last. A rung that fails ends the climb: more detail cannot repair a
 * broken answer.
 */
export const IMAGE_PRESETS = Object.freeze({
	/**
	 * The default, and the first rung: a small indexed PNG, 3 to 10 times
	 * lighter than `small` on disk.
	 */
	tiny: Object.freeze({ maxSide: 384, colours: 64 }),
	/** The second rung: a third more pixels on each side, truecolor. */
	small: Object.freeze({ maxSide: 512, colours: null }),
	/** The third rung: the most detail the endpoint can use, and the heaviest. */
	full: Object.freeze({ maxSide: 800, colours: null })
});

export type ImagePreset = keyof typeof IMAGE_PRESETS;

/** The rung a run sends when `--image-preset` is not typed: the cheapest one. */
export const DEFAULT_IMAGE_PRESET: ImagePreset = "tiny";

export type ResolvedImage = {
	/** `reference` for `--image`, else the view name. */
	label: string;
	/** The absolute path that was read. */
	path: string;
	/** Always `image/png`: every image is normalised. */
	mime: string;
	/** The preset that produced the bytes. */
	preset: ImagePreset;
	/** The pixel width that is sent, after the preset. */
	width: number;
	/** The pixel height that is sent, after the preset. */
	height: number;
	/** The number of PNG bytes that are sent, before base64. */
	bytes: number;
	/** The file bytes, base64, without the data URL prefix. */
	data: string;
};

/** The six names a view may carry, in the order of the blueprint. */
export const VIEW_NAMES = [
	"front",
	"left",
	"right",
	"back",
	"top",
	"bottom"
] as const;

/** The accepted reference extensions, in the order the reference is looked up. */
export const REFERENCE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;

/**
 * The chosen identity image of a folder, or null.
 *
 * One lookup order for the reference sheet and for every view folder.
 */
export function findReference(dir: string): string | null {
	let names: string[];
	try {
		names = readdirSync(dir);
	} catch {
		return null;
	}
	for (const ext of REFERENCE_EXTENSIONS) {
		const name = `reference${ext}`;
		if (names.includes(name)) return join(dir, name);
	}
	return null;
}

/** The preset named by the flag, or a throw that lists the three. */
function readPreset(name: string): {
	maxSide: number;
	colours: number | null;
} {
	const preset = IMAGE_PRESETS[name as ImagePreset];
	if (!preset) {
		throw new Error(
			`Unknown image preset "${name}". The three presets are tiny, small, full.`
		);
	}
	return preset;
}

/** The decoder's error code, or a stable fallback when it publishes none. */
function decodeCode(error: unknown): string {
	const code = (error as { code?: unknown } | null)?.code;
	return typeof code === "string" && code ? code : "ERR_IMAGE_DECODE_FAILED";
}

type Encoded = { width: number; height: number; png: Buffer };

/**
 * Decode, resize, and encode one file under one preset.
 *
 * A source that is already a PNG, already at most `maxSide` on both sides, and
 * sent under `full` keeps its source bytes: the chain would re-encode it for
 * nothing. Every other source goes through the documented `Bun.Image` chain.
 * The format is sniffed from the bytes, never from the extension.
 */
async function encode(path: string, preset: ImagePreset): Promise<Encoded> {
	const settings = readPreset(preset);

	let raw: Buffer;
	try {
		raw = readFileSync(path);
	} catch (error) {
		throw new Error(
			`${path}: the image could not be decoded (${decodeCode(error)})`
		);
	}

	// The header pass exists only for the byte-identical branch, which exists only under `full`.
	if (preset === "full") {
		let metadata: { width: number; height: number; format: string };
		try {
			metadata = await new Bun.Image(raw).metadata();
		} catch (error) {
			throw new Error(
				`${path}: the image could not be decoded (${decodeCode(error)})`
			);
		}
		if (
			metadata.format === "png" &&
			metadata.width <= settings.maxSide &&
			metadata.height <= settings.maxSide
		) {
			return {
				width: metadata.width,
				height: metadata.height,
				png: raw
			};
		}
	}

	let image = new Bun.Image(raw).resize(settings.maxSide, settings.maxSide, {
		fit: "inside",
		withoutEnlargement: true
	});
	image = settings.colours
		? image.png({
				palette: true,
				colors: settings.colours,
				dither: true
			})
		: image.png();

	let png: Buffer;
	try {
		png = await image.buffer();
	} catch (error) {
		throw new Error(
			`${path}: the image could not be decoded (${decodeCode(error)})`
		);
	}
	return { width: image.width, height: image.height, png };
}

/** One absolute path, encoded under the preset in force. */
async function resolveOne(
	path: string,
	label: string,
	preset: ImagePreset
): Promise<ResolvedImage> {
	const encoded = await encode(path, preset);
	return {
		label,
		path,
		mime: "image/png",
		preset,
		width: encoded.width,
		height: encoded.height,
		bytes: encoded.png.length,
		data: encoded.png.toString("base64")
	};
}

/**
 * Split `--views`, and refuse an empty name, an unknown name, and a repeated
 * name.
 */
function viewNames(raw: string): string[] {
	if (!raw.trim())
		throw new Error(
			"--views is empty. Pass the six names, comma-separated, for example top,right,back."
		);
	const names = raw.split(",").map((name) => name.trim());
	const seen = new Set<string>();
	for (const name of names) {
		if (!name)
			throw new Error(
				"--views holds an empty name. Pass the six names, comma-separated, for example top,right,back."
			);
		if (!(VIEW_NAMES as readonly string[]).includes(name)) {
			throw new Error(
				`Unknown view "${name}". The six views are front, left, right, back, top, bottom.`
			);
		}
		if (seen.has(name))
			throw new Error(`The view "${name}" is repeated in --views.`);
		seen.add(name);
	}
	return names;
}

/**
 * Resolve the images of a run, in the order the art director typed them.
 *
 * `--image` sends the chosen reference; `--views` sends the named view folders.
 * The two are exclusive, both need a subject, and every image is normalised to
 * PNG at `preset`.
 */
export async function resolveImages(input: {
	/** The subject folder. Absent in text mode. */
	subjectDir: string | null;
	/** `--image`. */
	image: boolean;
	/** `--views`, raw. */
	views: string | null;
	/** The resolved `--image-preset`. */
	preset: ImagePreset;
}): Promise<ResolvedImage[]> {
	readPreset(input.preset);

	if (input.image && input.views !== null) {
		throw new Error(
			"--image and --views are exclusive: pass one of the two."
		);
	}
	const wantsImage = input.image;
	const wantsViews = input.views !== null;
	if (!wantsImage && !wantsViews) return [];

	if (!input.subjectDir) {
		const flag = wantsImage ? "--image" : "--views";
		throw new Error(
			`${flag} needs --subject: a prompt file has no blueprint beside it.`
		);
	}
	const subjectDir = input.subjectDir;

	if (wantsImage) {
		const path = findReference(subjectDir);
		if (!path) {
			throw new Error(
				`reference.<ext> is missing in ${subjectDir}. Generation reads no other image.`
			);
		}
		return [await resolveOne(path, "reference", input.preset)];
	}

	const names = viewNames(input.views as string);
	const images: ResolvedImage[] = [];
	for (const name of names) {
		const found = findReference(join(subjectDir, name));
		if (!found) {
			throw new Error(
				`The view file does not exist: ${join(subjectDir, name, "reference.png")}. A view reads <subject>/<view>/reference.<ext>.`
			);
		}
		images.push(await resolveOne(found, name, input.preset));
	}
	return images;
}
