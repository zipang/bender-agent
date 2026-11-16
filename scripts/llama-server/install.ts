// Verify the local llama.cpp runtime, and install it on request.
//
// `--check` is the default and mutates nothing. `--yes` runs the documented install command once.
// This script never downloads a model: llama.cpp fetches the weights itself, through `-hf`.

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** The install command that the model card documents. */
export const INSTALL_COMMAND = "curl -LsSf https://llama.app/install.sh | sh";

/** The two model artifacts, with the sizes that the model card quotes. */
export const ARTIFACTS = [
	{ name: "Qwen3.5-4B-3D-Coder-Q4_K_M.gguf", size: "2.71 GB" },
	{ name: "mmproj-Qwen3.5-4B-BF16.gguf", size: "0.68 GB" },
];

export type Runtime = {
	bin: "llama" | "llama-server";
	path: string;
	version: string;
};

/**
 * The injected machine probe. A test supplies its own probe, so the default path never runs a
 * command and never touches the machine.
 */
export type Probe = {
	/** The absolute path of an executable on `PATH`, or null. */
	which: (name: string) => string | null;
	/** Whether a path exists. */
	exists: (path: string) => boolean;
	/** Run a short command and return its status and its standard output. */
	run: (command: string[]) => { status: number; stdout: string };
};

export type InstallDeps = {
	probe: Probe;
	/** Run the install command. Returns its exit status. */
	spawn: (command: string[]) => Promise<number>;
	out: (line: string) => void;
	err: (line: string) => void;
};

/** The probe of the running machine. */
export const systemProbe: Probe = {
	which: (name) => Bun.which(name),
	exists: (path) => existsSync(path),
	run: (command) => {
		const result = Bun.spawnSync(command, { stdout: "pipe", stderr: "pipe" });
		return { status: result.exitCode ?? 1, stdout: result.stdout?.toString() ?? "" };
	},
};

function firstLine(text: string): string {
	return text.trim().split("\n")[0]?.trim() ?? "";
}

/**
 * Find the runtime. It probes `llama`, the unified launcher, first, and a legacy `llama-server`
 * second. A binary outside `PATH` is accepted from `~/.local/bin`, because the service does not
 * always inherit the shell `PATH`.
 */
export function detectRuntime(probe: Probe, home: string = homedir()): Runtime | null {
	const candidates: Array<{ bin: "llama" | "llama-server"; args: string[] }> = [
		{ bin: "llama", args: ["version"] },
		{ bin: "llama-server", args: ["--version"] },
	];
	for (const { bin, args } of candidates) {
		const found = probe.which(bin);
		const path =
			found ??
			(probe.exists(join(home, ".local", "bin", bin))
				? join(home, ".local", "bin", bin)
				: null);
		if (!path) continue;
		const version = firstLine(probe.run([path, ...args]).stdout);
		return { bin, path, version };
	}
	return null;
}

/**
 * The command-line entry point.
 *
 * `--check` is the default. `--yes` runs the documented install command once, through the injected
 * runner, and reports its result.
 */
export async function installMain(
	argv: string[],
	deps: InstallDeps,
	home: string = homedir(),
): Promise<number> {
	const known = new Set(["--check", "--yes"]);
	for (const arg of argv) {
		if (!known.has(arg)) {
			deps.err(`Unknown flag "${arg}". Use --check (default) or --yes.`);
			return 1;
		}
	}
	const install = argv.includes("--yes");
	const runtime = detectRuntime(deps.probe, home);

	if (runtime) {
		deps.out(`runtime:    ${runtime.bin}  (${runtime.path})`);
		deps.out(`version:    ${runtime.version || "unknown"}`);
	} else {
		deps.out("runtime:    missing");
		deps.out(`install:    ${INSTALL_COMMAND}`);
	}

	for (const artifact of ARTIFACTS) {
		deps.out(`artifact:   ${artifact.name}  ${artifact.size}`);
	}

	if (!install) {
		deps.out("check only: no command was run.");
		return 0;
	}
	if (runtime) {
		deps.out("install:    not needed, the runtime is present.");
		return 0;
	}

	deps.out(`install:    running ${INSTALL_COMMAND}`);
	const status = await deps.spawn(["sh", "-c", INSTALL_COMMAND]);
	if (status !== 0) {
		deps.err(
			`install:    failed with status ${status}. Run the command manually: ${INSTALL_COMMAND}`,
		);
		return 1;
	}
	deps.out("install:    done. Run --check again to read the version.");
	return 0;
}

if (import.meta.main) {
	const deps: InstallDeps = {
		probe: systemProbe,
		spawn: async (command) => {
			const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
			return (await child.exited) ?? 1;
		},
		out: console.log,
		err: console.error,
	};
	process.exit(await installMain(process.argv.slice(2), deps));
}
