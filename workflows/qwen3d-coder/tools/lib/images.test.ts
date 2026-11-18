// T17.1 — the image set: `--image` and `--views`, normalised to PNG at a preset.
//
// The real blueprint subjects are the fixtures that matter, and they are read-only: the test never
// writes under `blueprints/`. The synthetic cases (a small PNG, a broken file, a missing view) live
// in a scratch tree under `.tmp/`, so the repository stays clean.

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	DEFAULT_IMAGE_PRESET,
	IMAGE_PRESETS,
	type ImagePreset,
	resolveImages,
	VIEW_NAMES
} from "./images";

const ROOT = resolve(import.meta.dir, "..", "..", "..", "..");
const R5 = join(ROOT, "blueprints", "vehicules", "r5-tl-1972");
const MINIVAN = join(
	ROOT,
	"blueprints",
	"vehicules",
	"blue-and-white-minivan-01"
);

const SCRATCH = join(ROOT, ".tmp", `qwen3d-images-${process.pid}`);

afterAll(() => {
	rmSync(SCRATCH, { recursive: true, force: true });
});

function scratchSubject(name: string): string {
	const dir = join(SCRATCH, name);
	mkdirSync(dir, { recursive: true });
	return dir;
}

/** A real small PNG, produced from a blueprint file, for the synthetic cases. */
async function smallPng(path: string): Promise<Buffer> {
	await Bun.write(
		path,
		await new Bun.Image(Bun.file(join(R5, "reference.png")))
			.resize(64, 64, { fit: "inside" })
			.png()
			.buffer()
	);
	return readFileSync(path);
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function magic(data: string): Buffer {
	return Buffer.from(data, "base64").subarray(0, 4);
}

function resolveOne(
	subjectDir: string,
	flags: { image?: boolean; views?: string | null },
	preset: ImagePreset = "full"
) {
	return resolveImages({
		subjectDir,
		image: flags.image ?? false,
		views: flags.views ?? null,
		preset
	});
}

describe("VIEW_NAMES", () => {
	test("holds the six names of the blueprint, in order", () => {
		expect([...VIEW_NAMES]).toEqual([
			"front",
			"left",
			"right",
			"back",
			"top",
			"bottom"
		]);
	});
});

describe("IMAGE_PRESETS", () => {
	test("is the three-rung ladder of D10", () => {
		expect(IMAGE_PRESETS).toEqual({
			tiny: { maxSide: 384, colours: 64 },
			small: { maxSide: 512, colours: null },
			full: { maxSide: 800, colours: null }
		});
	});

	test("each rung is frozen, so a run cannot change it", () => {
		expect(Object.isFrozen(IMAGE_PRESETS)).toBe(true);
		expect(Object.isFrozen(IMAGE_PRESETS.tiny)).toBe(true);
		expect(Object.isFrozen(IMAGE_PRESETS.small)).toBe(true);
		expect(Object.isFrozen(IMAGE_PRESETS.full)).toBe(true);
	});

	test("the resolved default is tiny, the cheapest rung", () => {
		expect(DEFAULT_IMAGE_PRESET).toBe("tiny");
	});
});

describe("the real blueprints", () => {
	test("--image labels the reference sheet and reads the minivan WebP", async () => {
		const [image, ...rest] = await resolveOne(MINIVAN, { image: true });
		expect(rest).toHaveLength(0);
		expect(image!.label).toBe("reference");
		expect(image!.path).toBe(join(MINIVAN, "reference.webp"));
		expect(image!.mime).toBe("image/png");
		expect(image!.preset).toBe("full");
		expect(magic(image!.data)).toEqual(PNG_MAGIC);
	});

	test("--views top,right,back keeps the order the art director typed", async () => {
		const images = await resolveOne(MINIVAN, { views: "top,right,back" });
		expect(images).toHaveLength(3);
		expect(images.map((image) => image.label)).toEqual([
			"top",
			"right",
			"back"
		]);
		expect(images.map((image) => image.path)).toEqual([
			join(MINIVAN, "top", "reference.webp"),
			join(MINIVAN, "right", "reference.webp"),
			join(MINIVAN, "back", "reference.webp")
		]);
		for (const image of images) {
			expect(image.mime).toBe("image/png");
			expect(magic(image.data)).toEqual(PNG_MAGIC);
		}
	});

	test("r5-tl-1972 resolves the same two flag sets", async () => {
		const image = await resolveOne(R5, { image: true });
		expect(image.map((entry) => entry.label)).toEqual(["reference"]);
		expect(image[0]!.path).toBe(join(R5, "reference.png"));

		const views = await resolveOne(R5, { views: "top,right,back" });
		expect(views.map((entry) => entry.label)).toEqual([
			"top",
			"right",
			"back"
		]);
		expect(views.map((entry) => entry.path)).toEqual([
			join(R5, "top", "reference.png"),
			join(R5, "right", "reference.png"),
			join(R5, "back", "reference.png")
		]);
	});
});

describe("the normalisation", () => {
	const cases = [
		{
			name: "the minivan reference",
			subject: MINIVAN,
			flags: { image: true },
			sizes: ["384×384", "512×512", "800×800"]
		},
		{
			name: "the r5 top view",
			subject: R5,
			flags: { views: "top" },
			sizes: ["384×214", "512×286", "800×447"]
		}
	] as const;

	for (const entry of cases) {
		test(`${entry.name} is ${entry.sizes.join(" | ")}`, async () => {
			const presets: ImagePreset[] = ["tiny", "small", "full"];
			for (const [index, preset] of presets.entries()) {
				const [image] = await resolveOne(
					entry.subject,
					entry.flags,
					preset
				);
				expect(image!.preset).toBe(preset);
				expect(`${image!.width}×${image!.height}`).toBe(
					entry.sizes[index]
				);
				expect(image!.bytes).toBeGreaterThan(0);
				expect(Buffer.from(image!.data, "base64").length).toBe(
					image!.bytes
				);
			}
		});
	}

	test("a WebP source comes back as PNG bytes", async () => {
		const [image] = await resolveOne(R5, { views: "front" }, "full");
		expect(image!.path.endsWith(".webp")).toBe(true);
		expect(magic(image!.data)).toEqual(PNG_MAGIC);
	});

	test("tiny writes an indexed PNG that is smaller than small", async () => {
		const [small] = await resolveOne(R5, { views: "top" }, "small");
		const [tiny] = await resolveOne(R5, { views: "top" }, "tiny");
		expect(tiny!.bytes).toBeLessThan(small!.bytes);
	});

	test("a source at most the preset is byte-identical under full", async () => {
		const dir = scratchSubject("small");
		const path = join(dir, "reference.png");
		const source = await smallPng(path);
		const [image] = await resolveOne(dir, { image: true }, "full");
		expect(image!.width).toBe(64);
		expect(image!.height).toBe(36);
		expect(Buffer.from(image!.data, "base64").equals(source)).toBe(true);
	});

	test("a PNG larger than the preset is re-encoded under full", async () => {
		const dir = scratchSubject("large");
		const path = join(dir, "reference.png");
		await Bun.write(
			path,
			await new Bun.Image(Bun.file(join(R5, "reference.png")))
				.resize(900, 900)
				.png()
				.buffer()
		);
		const source = readFileSync(path);
		const [image] = await resolveOne(dir, { image: true }, "full");
		expect(image!.width).toBe(800);
		expect(image!.height).toBe(800);
		expect(Buffer.from(image!.data, "base64").equals(source)).toBe(false);
	});
});

describe("the refused inputs, one message each", () => {
	test("--image and --views together", async () => {
		await expect(
			resolveImages({
				subjectDir: R5,
				image: true,
				views: "top",
				preset: "full"
			})
		).rejects.toThrow(/--image and --views are exclusive/);
	});

	test("an image flag without a subject", async () => {
		await expect(
			resolveImages({
				subjectDir: null,
				image: true,
				views: null,
				preset: "full"
			})
		).rejects.toThrow(/--subject/);
		await expect(
			resolveImages({
				subjectDir: null,
				image: false,
				views: "top",
				preset: "full"
			})
		).rejects.toThrow(/--subject/);
	});

	test("a name outside the six", async () => {
		await expect(resolveOne(R5, { views: "top,sides" })).rejects.toThrow(
			/front, left, right, back, top, bottom/
		);
	});

	test("an empty name and an empty list", async () => {
		await expect(resolveOne(R5, { views: "top,,back" })).rejects.toThrow(
			/empty/
		);
		await expect(resolveOne(R5, { views: "   " })).rejects.toThrow(/empty/);
	});

	test("a repeated name", async () => {
		await expect(resolveOne(R5, { views: "top,top" })).rejects.toThrow(
			/repeated/
		);
	});

	test("a view file that is missing quotes the path", async () => {
		const dir = scratchSubject("missing-view");
		writeFileSync(join(dir, "reference.png"), "x");
		await expect(resolveOne(dir, { views: "top" })).rejects.toThrow(
			join(dir, "top", "reference.png")
		);
	});

	test("a missing reference quotes the subject folder", async () => {
		const dir = scratchSubject("missing-reference");
		await expect(resolveOne(dir, { image: true })).rejects.toThrow(
			/reference\.<ext> is missing/
		);
	});

	test("a file that does not decode quotes the path and the code", async () => {
		const dir = scratchSubject("broken");
		writeFileSync(join(dir, "reference.png"), "not an image");
		await expect(resolveOne(dir, { image: true })).rejects.toThrow(
			/reference\.png: the image could not be decoded \(ERR_/
		);
	});

	test("an unknown preset lists the three", async () => {
		await expect(
			resolveImages({
				subjectDir: R5,
				image: true,
				views: null,
				preset: "huge" as ImagePreset
			})
		).rejects.toThrow(/tiny, small, full/);
	});
});
