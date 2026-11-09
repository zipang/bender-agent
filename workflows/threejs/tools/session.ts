// One browser session, owned by one tool.
//
// `agent-browser` starts a headless Chrome per session name, and nothing stops it for you: an
// interrupted tool leaves a browser and its process tree behind, and a wedged browser blocks every
// later call forever, because the CLI has no timeout of its own. This module is the one place that
// opens, guards and closes a session, and the one place that bounds a call.
//
// Rules it enforces:
//
//   - one owner. A tool opens its session through `Session`, and `Session.close()` runs in the
//     tool's `finally`, on `SIGINT` and on `SIGTERM`.
//   - the name carries the process id, so two runs of the same tool cannot collide, and a leftover
//     of an interrupted run is identifiable.
//   - every call is bounded. On expiry the child is killed and the error names the step and the
//     elapsed time.
//   - a stale session is swept. At open, a session whose name matches this tool's prefix and whose
//     process is gone is closed. A session the tool cannot prove is stale is left alone.
//
// `ctl.ts` is the exception: its session is meant to outlive one command, so it borrows a name and
// never installs the signal guards. Everything else owns the session it opens.

/** The bound of one `agent-browser` call, in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** How long a `close` or a `session list` may take before it is called wedged. */
const CONTROL_TIMEOUT_MS = 15_000;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Run one `agent-browser` command under a timeout.
 *
 * The child's pipes are read here. On a non-zero exit the error names the label and the code; on
 * expiry the child is killed and the error names the label and the elapsed time.
 *
 * The drain is raced against the abort, not awaited blindly: `agent-browser` can leave a helper
 * holding the write end of the pipe after the CLI itself is killed, and a plain read would then wait
 * on the helper rather than on the command. The abort wins the race, so the clock in the error is
 * the clock of the limit.
 */
export async function ab(
  args: string[],
  label: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let proc: Bun.Subprocess<"pipe", "pipe">;
  try {
    proc = Bun.spawn(["agent-browser", ...args], {
      stdout: "pipe",
      stderr: "pipe",
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
  // Read the pipes through explicit readers, so a timeout can cancel them. A plain
  // `new Response(stream).text()` locks the stream and cannot be stopped: a killed CLI can leave a
  // helper holding the write end, and the read would then keep the event loop alive after the throw.
  const readers = [proc.stdout.getReader(), proc.stderr.getReader()];
  const readAll = async (reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> => {
    const decoder = new TextDecoder();
    let text = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
    } catch {
      // A cancelled or broken pipe is not an error here; the caller reads the exit code.
    }
    return text;
  };
  const aborted = new Promise<"aborted">((resolve) => {
    if (controller.signal.aborted) resolve("aborted");
    else controller.signal.addEventListener("abort", () => resolve("aborted"), { once: true });
  });
  try {
    const result = await Promise.race([
      (async () => {
        const [stdout, stderr] = await Promise.all(readers.map(readAll));
        const code = await proc.exited;
        return { stdout, stderr, code } as const;
      })(),
      aborted,
    ]);
    if (result === "aborted") {
      // Release the pipes before the throw, so the process can exit while the browser is swept.
      for (const reader of readers) void reader.cancel().catch(() => {});
      throw new Error(
        `${label} timed out after ${((Date.now() - started) / 1000).toFixed(1)} s (limit ${(timeoutMs / 1000).toFixed(0)} s)`,
      );
    }
    if (result.code !== 0) {
      throw new Error(
        `agent-browser ${args[0]} failed (${result.code}) [${label}]: ${(result.stderr || result.stdout).trim().slice(0, 300)}`,
      );
    }
    return result.stdout;
  } finally {
    clearTimeout(timer);
  }
}

/** Evaluate a script in the session, and parse its JSON answer when it is one. */
export async function evaluate(
  script: string,
  session: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const text = (await ab(["eval", script, "--session", session], `eval ${script.slice(0, 48)}`, timeoutMs)).trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Close a named session. A close failure is a warning, never a throw: it must not hide a result. */
export async function closeSession(name: string, timeoutMs = CONTROL_TIMEOUT_MS): Promise<void> {
  try {
    await ab(["close", "--session", name], `close ${name}`, timeoutMs);
  } catch (error) {
    console.warn(`warning: could not close session ${name}: ${String(error).slice(0, 160)}`);
  }
}

/** The pid of an owned session name (`<tool>-<pid>`), or null when the name is not one. */
function ownedPid(name: string, tool: string): number | null {
  const match = name.match(new RegExp(`^${escapeRegex(tool)}-(\\d+)$`));
  return match ? Number(match[1]) : null;
}

/** True when the process still exists. `EPERM` means it exists and is not ours: still alive. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Close every session named `<tool>-<pid>` whose process is gone.
 *
 * The name is the proof: a session whose name does not carry a dead pid is never closed. A session
 * of a live run is left alone, so two concurrent runs do not fight.
 */
export async function sweepStale(tool: string): Promise<string[]> {
  let names: string[] = [];
  try {
    const raw = await ab(["session", "list", "--json"], "session list", CONTROL_TIMEOUT_MS);
    const data = JSON.parse(raw) as { data?: { sessions?: unknown } };
    if (Array.isArray(data?.data?.sessions)) names = data.data.sessions.map(String);
  } catch {
    return [];
  }
  const swept: string[] = [];
  for (const name of names) {
    const pid = ownedPid(name, tool);
    if (pid === null || alive(pid)) continue;
    await closeSession(name);
    swept.push(name);
  }
  return swept;
}

export type SessionOptions = {
  /** An explicit session name. Without it the name is `<tool>-<pid>`. */
  name?: string;
  /** True when this process owns the session and must close it. Defaults to `name === undefined`. */
  owned?: boolean;
};

/** A browser session, owned or borrowed, with the clock and the guards around every call. */
export class Session {
  readonly tool: string;
  readonly name: string;
  readonly owned: boolean;
  #open = false;

  constructor(tool: string, options: SessionOptions = {}) {
    this.tool = tool;
    this.name = options.name ?? `${tool}-${process.pid}`;
    this.owned = options.owned ?? options.name === undefined;
    if (this.owned) this.#installSignals();
  }

  /**
   * Open the page. A stale session of this tool is swept first, so an interrupted run does not
   * leave a browser for the next one.
   */
  async open(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
    if (this.owned) await sweepStale(this.tool);
    // Set before the call: if `open` fails halfway, the `finally` must still try to close it.
    this.#open = true;
    await ab(["open", url, "--session", this.name], "open", timeoutMs);
  }

  evaluate(script: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
    return evaluate(script, this.name, timeoutMs);
  }

  /** Run one `agent-browser` command against this session, under the timeout. */
  ab(args: string[], label: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
    return ab(args, label, timeoutMs);
  }

  /** Close the session. Idempotent, and safe to call from a `finally` or a signal handler. */
  async close(): Promise<void> {
    if (!this.#open) return;
    this.#open = false;
    await closeSession(this.name);
  }

  #installSignals(): void {
    const stop = (code: number) => {
      void this.close().finally(() => process.exit(code));
    };
    process.on("SIGINT", () => stop(130));
    process.on("SIGTERM", () => stop(143));
  }
}
