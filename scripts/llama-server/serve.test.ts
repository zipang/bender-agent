// T1.3 — the server lifecycle.
//
// The starter reuses a healthy server with the same alias, refuses a port that answers with a
// different alias, spawns at most once, gives up at the deadline, and stops only the child it
// started. No test starts a real `llama serve`.

import { describe, expect, test } from "bun:test";
import { PROFILES } from "./profiles";
import {
	AliasConflictError,
	ensureServer,
	serveMain,
	ServerCrashedError,
	ServerTimeoutError,
	withLocalBinPath,
	type Probe,
	type ServerProbe,
	type Spawned,
} from "./serve";

const PROFILE = PROFILES["3d-coder"]!;

function probeFrom(...results: ServerProbe[]): Probe & { calls: number } {
	let calls = 0;
	const probe = (async () => {
		const result = results[Math.min(calls, results.length - 1)]!;
		calls += 1;
		return result;
	}) as Probe & { calls: number };
	Object.defineProperty(probe, "calls", { get: () => calls });
	return probe;
}

// The fake child never exits by default, so the readiness poll runs to its own outcome.
function spawnRecorder(exit: Promise<number> = new Promise<number>(() => {})) {
	const commands: string[][] = [];
	const stops = { count: 0 };
	const spawn = (command: string[]): Spawned => {
		commands.push(command);
		return {
			pid: 4242,
			exited: exit,
			stop: () => {
				stops.count += 1;
			},
		};
	};
	return { spawn, commands, stops };
}

const DOWN: ServerProbe = { up: false, status: 0, aliases: [] };
const SAME: ServerProbe = { up: true, status: 200, aliases: ["local/3d-coder"] };
const OTHER: ServerProbe = { up: true, status: 200, aliases: ["local/other"] };

describe("ensureServer", () => {
	test("a healthy port with the same alias is reused and nothing is spawned", async () => {
		const probe = probeFrom(SAME);
		const rec = spawnRecorder();
		const handle = await ensureServer({ profile: PROFILE, probe, spawn: rec.spawn });
		expect(handle.reused).toBe(true);
		expect(handle.port).toBe(9931);
		expect(rec.commands).toEqual([]);
		await handle.stop();
		expect(rec.stops.count).toBe(0);
	});

	test("a healthy port with a different alias is a conflict, exit code 2", async () => {
		const probe = probeFrom(OTHER);
		const rec = spawnRecorder();
		let error: unknown;
		try {
			await ensureServer({ profile: PROFILE, probe, spawn: rec.spawn });
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(AliasConflictError);
		const conflict = error as AliasConflictError;
		expect(conflict.exitCode).toBe(2);
		expect(conflict.message).toContain("local/3d-coder");
		expect(conflict.message).toContain("local/other");
		expect(rec.commands).toEqual([]);
	});

	test("an unhealthy port is spawned once with the documented flags", async () => {
		const probe = probeFrom(DOWN, DOWN, SAME);
		const rec = spawnRecorder();
		const handle = await ensureServer({
			profile: PROFILE,
			probe,
			spawn: rec.spawn,
			sleep: async () => {},
		});
		expect(handle.reused).toBe(false);
		expect(rec.commands).toHaveLength(1);
		expect(rec.commands[0]).toEqual([
			"llama",
			"serve",
			"-hf",
			"ccore/Qwen3.5-4B-3D-Coder:Q4_K_M",
			"-c",
			"65536",
			"-np",
			"1",
			"-fa",
			"on",
			"-ngl",
			"all",
			"--host",
			"127.0.0.1",
			"--port",
			"9931",
			"-a",
			"local/3d-coder",
		]);
		expect(rec.commands[0]).not.toContain("--jinja");
		await handle.stop();
		expect(rec.stops.count).toBe(1);
	});

	test("the poll gives up after the deadline with exit code 2 and the last status", async () => {
		const probe = probeFrom({ up: false, status: 502, aliases: [] });
		const rec = spawnRecorder();
		let clock = 0;
		let error: unknown;
		try {
			await ensureServer({
				profile: PROFILE,
				probe,
				spawn: rec.spawn,
				sleep: async () => {},
				now: () => (clock += 600),
				timeoutMs: 1200,
				pollMs: 500,
			});
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(ServerTimeoutError);
		const timeout = error as ServerTimeoutError;
		expect(timeout.exitCode).toBe(2);
		expect(timeout.lastStatus).toBe(502);
		expect(timeout.message).toContain("502");
		expect(timeout.message).toContain("1200");
		expect(rec.stops.count).toBe(1);
	});

	test("the default deadline is 120 s and the poll interval is 500 ms", async () => {
		const probe = probeFrom(DOWN);
		const rec = spawnRecorder();
		const sleeps: number[] = [];
		let clock = 0;
		let error: unknown;
		try {
			await ensureServer({
				profile: PROFILE,
				probe,
				spawn: rec.spawn,
				sleep: async (ms) => {
					sleeps.push(ms);
					clock += ms;
				},
				now: () => clock,
			});
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(ServerTimeoutError);
		expect(sleeps.every((ms) => ms === 500)).toBe(true);
		expect((error as ServerTimeoutError).message).toContain("120 s");
	});
});

describe("serveMain", () => {
	test("reuses a healthy server and returns 0", async () => {
		const lines: string[] = [];
		const code = await serveMain(["--profile", "3d-coder"], {
			probe: probeFrom(SAME),
			spawn: spawnRecorder().spawn,
			out: (line) => lines.push(line),
			waitForSignal: async () => {
				throw new Error("must not wait when the server is reused");
			},
		});
		expect(code).toBe(0);
		expect(lines.join("\n")).toContain("reused");
	});

	test("stops the child it started when the signal arrives", async () => {
		const rec = spawnRecorder();
		const code = await serveMain(["--profile", "3d-coder"], {
			probe: probeFrom(DOWN, SAME),
			spawn: rec.spawn,
			sleep: async () => {},
			out: () => {},
			waitForSignal: async () => {},
		});
		expect(code).toBe(0);
		expect(rec.stops.count).toBe(1);
	});

	test("a conflict returns 2 and names both aliases", async () => {
		const errors: string[] = [];
		const code = await serveMain(["--profile", "3d-coder"], {
			probe: probeFrom(OTHER),
			spawn: spawnRecorder().spawn,
			err: (line) => errors.push(line),
			out: () => {},
		});
		expect(code).toBe(2);
		expect(errors.join("\n")).toContain("local/3d-coder");
		expect(errors.join("\n")).toContain("local/other");
	});

	test("a timeout returns 2", async () => {
		const errors: string[] = [];
		const code = await serveMain(["--profile", "3d-coder"], {
			probe: probeFrom(DOWN),
			spawn: spawnRecorder().spawn,
			sleep: async () => {},
			now: (() => {
				let clock = 0;
				return () => (clock += 600);
			})(),
			timeoutMs: 1200,
			out: () => {},
			err: (line) => errors.push(line),
		});
		expect(code).toBe(2);
		expect(errors.join("\n")).toContain("did not become ready");
	});

	test("an unknown profile returns 1 and lists the known names", async () => {
		const errors: string[] = [];
		const code = await serveMain(["--profile", "nope"], {
			probe: probeFrom(DOWN),
			spawn: spawnRecorder().spawn,
			out: () => {},
			err: (line) => errors.push(line),
		});
		expect(code).toBe(1);
		expect(errors.join("\n")).toContain("3d-coder");
	});
});

describe("withLocalBinPath", () => {
	test("puts ~/.local/bin first when it is absent", () => {
		expect(withLocalBinPath("/usr/bin:/bin", "/home/u")).toBe(
			"/home/u/.local/bin:/usr/bin:/bin",
		);
	});

	test("keeps a PATH that already holds the directory", () => {
		const value = "/home/u/.local/bin:/usr/bin";
		expect(withLocalBinPath(value, "/home/u")).toBe(value);
	});

	test("leaves an unknown home alone", () => {
		expect(withLocalBinPath("/usr/bin", "")).toBe("/usr/bin");
	});
});

describe("a crashing child", () => {
	test("ensureServer stops the readiness poll with a clear error", async () => {
		const probe = probeFrom(DOWN);
		const rec = spawnRecorder(Promise.resolve(7));
		let error: unknown;
		const started = performance.now();
		try {
			await ensureServer({
				profile: PROFILE,
				probe,
				spawn: rec.spawn,
				sleep: async () => {},
			});
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(ServerCrashedError);
		const crashed = error as ServerCrashedError;
		expect(crashed.exitCode).toBe(2);
		expect(crashed.code).toBe(7);
		expect(crashed.message).toContain("7");
		expect(crashed.message).toContain("9931");
		// It fails at once, not after the 120 s deadline.
		expect(performance.now() - started).toBeLessThan(1000);
	});

	test("serveMain returns 2 and names the exit code when the child dies before a signal", async () => {
		const rec = spawnRecorder(Promise.resolve(9));
		const errors: string[] = [];
		const code = await serveMain(["--profile", "3d-coder"], {
			probe: probeFrom(DOWN, SAME),
			spawn: rec.spawn,
			sleep: async () => {},
			out: () => {},
			err: (line) => errors.push(line),
			waitForSignal: () => new Promise<void>(() => {}),
		});
		expect(code).toBe(2);
		expect(errors.join("\n")).toContain("9");
	});

	test("serveMain still returns 0 when the signal comes before the exit", async () => {
		const rec = spawnRecorder(Promise.resolve(0));
		const code = await serveMain(["--profile", "3d-coder"], {
			probe: probeFrom(DOWN, SAME),
			spawn: rec.spawn,
			sleep: async () => {},
			out: () => {},
			waitForSignal: async () => {},
		});
		expect(code).toBe(0);
		expect(rec.stops.count).toBe(1);
	});
});
