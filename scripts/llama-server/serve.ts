// Start one local llama.cpp server, or reuse the one that already listens.
//
// The starter never starts a second server. A port that answers on `/v1/health` with the same alias
// is reused. A port that answers with a different alias is a conflict, exit code 2. It stops only
// the child that it started.

import { selectProfile, UnknownProfileError, type Profile } from "./profiles";

/** What a port answers about itself. */
export type ServerProbe = {
	up: boolean;
	status: number;
	aliases: string[];
};

/** The injected health check. */
export type Probe = (port: number) => Promise<ServerProbe>;

/** A child process, reduced to what the starter needs. */
export type Spawned = {
	pid: number;
	exited: Promise<number>;
	stop: () => void;
};

/** The injected spawn. */
export type Spawn = (command: string[]) => Spawned;

export type ServerHandle = {
	/** True when a running server was adopted instead of started. */
	reused: boolean;
	port: number;
	/** Stop the child that this call started. A reused server is never stopped. */
	stop: () => Promise<void>;
	/** The exit code of the started child, or null when no child was started. */
	exited: Promise<number> | null;
};

export type EnsureServerOptions = {
	profile: Profile;
	probe?: Probe;
	spawn?: Spawn;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
	/** The deadline of the readiness poll. Documented value: 120 s. */
	timeoutMs?: number;
	/** The interval of the readiness poll. Documented value: 500 ms. */
	pollMs?: number;
	out?: (line: string) => void;
};

export const DEFAULT_TIMEOUT_MS = 120_000;
export const DEFAULT_POLL_MS = 500;

/** The port answers with another model. The caller must not start a second server. */
export class AliasConflictError extends Error {
	readonly exitCode = 2;

	constructor(
		readonly expected: string,
		readonly actual: string[],
		readonly port: number,
	) {
		super(
			`Port ${port} answers with a different alias: expected "${expected}", found "${actual.join(", ") || "unknown"}". Stop that server or change the profile port.`,
		);
		this.name = "AliasConflictError";
	}
}

/** The server did not answer `/v1/health` before the deadline. */
export class ServerTimeoutError extends Error {
	readonly exitCode = 2;

	constructor(
		readonly timeoutMs: number,
		readonly lastStatus: number,
		readonly port: number,
	) {
		super(
			`The server did not become ready on port ${port} after ${timeoutMs / 1000} s (${timeoutMs} ms). Last status: ${lastStatus}.`,
		);
		this.name = "ServerTimeoutError";
	}
}

/**
 * The started child exited before the server answered `/v1/health`.
 *
 * A crashed child never becomes ready, so the poll stops at once instead of waiting the deadline.
 */
export class ServerCrashedError extends Error {
	readonly exitCode = 2;

	constructor(
		readonly code: number,
		readonly port: number,
		readonly pid: number,
	) {
		super(
			`The server exited with code ${code} before it became ready on port ${port} (pid ${pid}).`,
		);
		this.name = "ServerCrashedError";
	}
}

/**
 * Add `~/.local/bin` to a `PATH` value when it is absent.
 *
 * The documented installer writes `llama` there, and the OpenCode service does not always inherit
 * the shell `PATH`. The child process needs the same directory.
 */
export function withLocalBinPath(pathValue: string, home: string): string {
	const local = home ? `${home}/.local/bin` : "";
	if (!local) return pathValue;
	const parts = pathValue.split(":").filter(Boolean);
	if (parts.includes(local)) return pathValue;
	return [local, ...parts].join(":");
}

/** The documented invocation of the unified llama.cpp launcher. */
export function serveCommand(profile: Profile): string[] {
	return [
		"llama",
		"serve",
		"-hf",
		`${profile.repo}:${profile.quant}`,
		"-c",
		String(profile.ctx),
		"-np",
		"1",
		"-fa",
		"on",
		"-ngl",
		"all",
		"--host",
		"127.0.0.1",
		"--port",
		String(profile.port),
		"-a",
		profile.alias,
	];
}

/** The health check of the running machine. It reaches the loopback interface only. */
export const loopbackProbe: Probe = async (port) => {
	const base = `http://127.0.0.1:${port}`;
	let health: Response;
	try {
		health = await fetch(`${base}/v1/health`, { signal: AbortSignal.timeout(2000) });
	} catch {
		return { up: false, status: 0, aliases: [] };
	}
	if (health.status !== 200) return { up: false, status: health.status, aliases: [] };

	// `/v1/models` names the alias of the server. The documented `-a` flag sets it.
	try {
		const models = await fetch(`${base}/v1/models`, { signal: AbortSignal.timeout(2000) });
		if (models.status !== 200) return { up: true, status: 200, aliases: [] };
		const body = (await models.json()) as { data?: Array<{ id?: string }> };
		const aliases = (body.data ?? [])
			.map((model) => model.id)
			.filter((id): id is string => Boolean(id));
		return { up: true, status: 200, aliases };
	} catch {
		return { up: true, status: 200, aliases: [] };
	}
};

/** The spawn of the running machine. */
export const systemSpawn: Spawn = (command) => {
	const child = Bun.spawn(command, {
		stdin: "ignore",
		stdout: "inherit",
		stderr: "inherit",
		env: {
			...process.env,
			PATH: withLocalBinPath(process.env.PATH ?? "", process.env.HOME ?? ""),
		},
	});
	return {
		pid: child.pid,
		exited: child.exited,
		stop: () => {
			child.kill();
		},
	};
};

/**
 * Make sure that one server answers on the profile port.
 *
 * A healthy port with the same alias is reused. A healthy port with another alias throws
 * `AliasConflictError`. An unhealthy port is spawned once, then polled until the deadline.
 */
export async function ensureServer(options: EnsureServerOptions): Promise<ServerHandle> {
	const { profile } = options;
	const probe = options.probe ?? loopbackProbe;
	const spawn = options.spawn ?? systemSpawn;
	const sleep =
		options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
	const now = options.now ?? (() => performance.now());
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
	const out = options.out ?? (() => {});

	const first = await probe(profile.port);
	if (first.up) {
		if (first.aliases.length === 0 || first.aliases.includes(profile.alias)) {
			out(`server:     reused ${profile.alias} on http://127.0.0.1:${profile.port}`);
			return { reused: true, port: profile.port, stop: async () => {}, exited: null };
		}
		throw new AliasConflictError(profile.alias, first.aliases, profile.port);
	}

	const command = serveCommand(profile);
	out(`server:     starting ${command.join(" ")}`);
	const child = spawn(command);
	let stopped = false;
	const stop = async () => {
		if (stopped) return;
		stopped = true;
		child.stop();
	};

	// A child that dies cannot become ready. Record its exit so the poll stops at once.
	const exit = { code: null as number | null };
	void child.exited.then((code) => {
		exit.code = code;
	});

	const startedAt = now();
	let lastStatus = first.status;
	for (;;) {
		if (exit.code !== null) {
			await stop();
			throw new ServerCrashedError(exit.code, profile.port, child.pid);
		}
		const result = await probe(profile.port);
		if (result.up) {
			out(`server:     ready ${profile.alias} on http://127.0.0.1:${profile.port}`);
			return { reused: false, port: profile.port, stop, exited: child.exited };
		}
		if (exit.code !== null) {
			await stop();
			throw new ServerCrashedError(exit.code, profile.port, child.pid);
		}
		lastStatus = result.status;
		if (now() - startedAt >= timeoutMs) {
			await stop();
			throw new ServerTimeoutError(timeoutMs, lastStatus, profile.port);
		}
		await sleep(pollMs);
	}
}

export type ServeMainDeps = {
	probe?: Probe;
	spawn?: Spawn;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
	timeoutMs?: number;
	pollMs?: number;
	out?: (line: string) => void;
	err?: (line: string) => void;
	/** Resolve when the process should stop the child it started. */
	waitForSignal?: () => Promise<void>;
};

function waitForTermination(): Promise<void> {
	return new Promise<void>((resolve) => {
		process.once("SIGINT", () => resolve());
		process.once("SIGTERM", () => resolve());
	});
}

/** The command-line entry point: `bun run scripts/llama-server/serve.ts --profile 3d-coder`. */
export async function serveMain(argv: string[], deps: ServeMainDeps = {}): Promise<number> {
	const out = deps.out ?? console.log;
	const err = deps.err ?? console.error;

	let name = "3d-coder";
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index]!;
		if (arg === "--profile") {
			name = argv[index + 1] ?? "";
			index += 1;
			continue;
		}
		err(`Unknown argument "${arg}". Use --profile <name>.`);
		return 1;
	}

	let profile: Profile;
	try {
		profile = selectProfile(name);
	} catch (error) {
		if (error instanceof UnknownProfileError) {
			err(error.message);
			return error.exitCode;
		}
		throw error;
	}

	let handle: ServerHandle;
	try {
		handle = await ensureServer({
			profile,
			probe: deps.probe,
			spawn: deps.spawn,
			sleep: deps.sleep,
			now: deps.now,
			timeoutMs: deps.timeoutMs,
			pollMs: deps.pollMs,
			out,
		});
	} catch (error) {
		if (
			error instanceof AliasConflictError ||
			error instanceof ServerTimeoutError ||
			error instanceof ServerCrashedError
		) {
			err(error.message);
			return error.exitCode;
		}
		throw error;
	}

	if (handle.reused) return 0;

	const signal = (deps.waitForSignal ?? waitForTermination)();
	const exited = handle.exited;
	if (!exited) {
		await signal;
		await handle.stop();
		return 0;
	}

	// A server that dies on its own must not hang the starter until the next signal.
	const outcome = await Promise.race([
		signal.then(() => "signal" as const),
		exited.then((code) => ({ code })),
	]);
	if (outcome === "signal") {
		await handle.stop();
		return 0;
	}
	err(
		`The server exited with code ${outcome.code} on port ${profile.port} before a stop signal arrived.`,
	);
	return 2;
}

if (import.meta.main) {
	process.exit(await serveMain(process.argv.slice(2)));
}
