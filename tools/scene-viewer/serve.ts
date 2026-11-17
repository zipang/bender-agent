// The CLI: one command opens one page.
//
// `bun run tools/scene-viewer/serve.ts` serves the viewer and prints where it listens. The asset is
// optional: without `--asset` the page asks the catalogue and opens the first valid candidate, so a
// reviewer never types a path. With `--asset` the flag names one repository module, and a violation
// exits 1 with the rule it broke -- the server is never started on a path it cannot serve.

import { resolve } from "node:path";
import { createServer, readOptions } from "./server.ts";

// The root is computed once, here, and passed down. No module below guesses it again.
const ROOT = resolve(import.meta.dir, "../..");

let options;
try {
	options = readOptions(process.argv.slice(2), ROOT);
} catch (error) {
	console.error(`scene-viewer: ${error?.message ?? error}`);
	process.exit(1);
}

const server = createServer({ ...options, root: ROOT });

console.log(`scene viewer: http://127.0.0.1:${server.port}/`);
console.log(
	`asset: ${options.asset ?? "the first valid asset of the catalogue"}`
);
