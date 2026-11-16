// T1.2 — the install check.
//
// `--check` is the default and mutates nothing. `--yes` runs the documented install command once,
// through the injected runner. The default path is safe to run in a test.

import { describe, expect, test } from "bun:test";
import {
	ARTIFACTS,
	detectRuntime,
	INSTALL_COMMAND,
	installMain,
	type InstallDeps,
} from "./install";

type ProbeCall = { command: string[] };

function deps(options: {
	which: Record<string, string | null>;
	version?: string;
	exists?: Record<string, boolean>;
}): InstallDeps & {
	spawned: ProbeCall[];
	probed: ProbeCall[];
	lines: string[];
	errors: string[];
} {
	// `spawned` records install commands only. `probed` records the version queries of the probe.
	const spawned: ProbeCall[] = [];
	const probed: ProbeCall[] = [];
	const lines: string[] = [];
	const errors: string[] = [];
	return {
		spawned,
		probed,
		lines,
		errors,
		probe: {
			which: (name) => options.which[name] ?? null,
			exists: (path) => options.exists?.[path] ?? false,
			run: (command) => {
				probed.push({ command });
				return { status: 0, stdout: options.version ?? "version: 1.0.0-dev (build 12375)" };
			},
		},
		spawn: async (command) => {
			spawned.push({ command });
			return 0;
		},
		out: (line) => lines.push(line),
		err: (line) => errors.push(line),
	};
}

describe("install --check", () => {
	test("a present llama reports its version and spawns nothing", async () => {
		const d = deps({
			which: { llama: "/home/u/.local/bin/llama" },
			version: "version: 1.0.0-dev (build 12375)",
		});
		const code = await installMain(["--check"], d);
		expect(code).toBe(0);
		expect(d.spawned).toEqual([]);
		const output = d.lines.join("\n");
		expect(output).toContain("/home/u/.local/bin/llama");
		expect(output).toContain("build 12375");
		expect(output).not.toContain(INSTALL_COMMAND);
	});

	test("a legacy llama-server is accepted as a fallback", async () => {
		const d = deps({
			which: { "llama-server": "/usr/bin/llama-server" },
			version: "version: 4321",
		});
		const code = await installMain([], d);
		expect(code).toBe(0);
		expect(d.spawned).toEqual([]);
		const output = d.lines.join("\n");
		expect(output).toContain("/usr/bin/llama-server");
		expect(output).toContain("4321");
	});

	test("a missing runtime reports the documented install command and spawns nothing", async () => {
		const d = deps({ which: {} });
		const code = await installMain(["--check"], d);
		expect(code).toBe(0);
		expect(d.spawned).toEqual([]);
		const output = d.lines.join("\n");
		expect(output).toContain(INSTALL_COMMAND);
		expect(output).toContain("2.71 GB");
		expect(output).toContain("0.68 GB");
	});

	test("the artifact list quotes the two card sizes", () => {
		expect(ARTIFACTS).toEqual([
			{ name: "Qwen3.5-4B-3D-Coder-Q4_K_M.gguf", size: "2.71 GB" },
			{ name: "mmproj-Qwen3.5-4B-BF16.gguf", size: "0.68 GB" },
		]);
	});
});

describe("install --yes", () => {
	test("a missing runtime runs the documented command once", async () => {
		const d = deps({ which: {} });
		const code = await installMain(["--yes"], d);
		expect(code).toBe(0);
		expect(d.spawned).toHaveLength(1);
		expect(d.spawned[0]!.command.join(" ")).toContain(INSTALL_COMMAND);
	});

	test("a present runtime is never installed twice", async () => {
		const d = deps({ which: { llama: "/home/u/.local/bin/llama" } });
		const code = await installMain(["--yes"], d);
		expect(code).toBe(0);
		expect(d.spawned).toEqual([]);
	});

	test("a failing install returns 1", async () => {
		const d = deps({ which: {} });
		d.spawn = async (command) => {
			d.spawned.push({ command });
			return 1;
		};
		const code = await installMain(["--yes"], d);
		expect(code).toBe(1);
		expect(d.errors.join("\n")).toContain(INSTALL_COMMAND);
	});
});

describe("detectRuntime", () => {
	test("probes llama before llama-server", () => {
		const d = deps({
			which: { llama: "/a/llama", "llama-server": "/b/llama-server" },
			version: "version: 1.0.0",
		});
		const runtime = detectRuntime(d.probe);
		expect(runtime).not.toBeNull();
		expect(runtime!.bin).toBe("llama");
		expect(d.probed[0]!.command).toEqual(["/a/llama", "version"]);
	});

	test("a runtime outside PATH is found in ~/.local/bin", () => {
		const home = "/home/u";
		const d = deps({
			which: {},
			exists: { [`${home}/.local/bin/llama`]: true },
			version: "version: 1.0.0-dev (build 12375)",
		});
		const runtime = detectRuntime(d.probe, home);
		expect(runtime).not.toBeNull();
		expect(runtime!.bin).toBe("llama");
		expect(runtime!.path).toBe(`${home}/.local/bin/llama`);
	});
});
