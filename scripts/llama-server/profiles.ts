// The model registry of the local llama.cpp server.
//
// One entry per model. It holds runtime facts only: a Hugging Face repository, a quantization, a
// port, an alias, and a context size. It reads no scene, no asset, and no blueprint.

export type Profile = {
	repo: string; // the Hugging Face repository
	quant: string; // the quantization suffix of -hf
	port: number; // the port of the local server
	alias: string; // the model id sent in every request body
	ctx: number; // the context window in tokens
};

export const PROFILES: Record<string, Profile> = {
	"3d-coder": {
		repo: "ccore/Qwen3.5-4B-3D-Coder",
		quant: "Q4_K_M",
		port: 9931,
		alias: "local/3d-coder",
		ctx: 65536,
	},
};

/** The known profile names, in alphabetical order. */
export function profileNames(): string[] {
	return Object.keys(PROFILES).sort();
}

/** A profile name that the registry does not hold. It is invalid input, exit code 1. */
export class UnknownProfileError extends Error {
	readonly exitCode = 1;

	constructor(readonly requested: string) {
		super(`Unknown profile "${requested}". Known profiles: ${profileNames().join(", ")}.`);
		this.name = "UnknownProfileError";
	}
}

/** Read one profile. An unknown name throws `UnknownProfileError`. */
export function selectProfile(name: string): Profile {
	const profile = name ? PROFILES[name] : undefined;
	if (!profile) throw new UnknownProfileError(name || "(missing)");
	return profile;
}

function formatProfile(name: string, profile: Profile): string {
	return [
		`profile:    ${name}`,
		`repo:       ${profile.repo}`,
		`quant:      ${profile.quant}`,
		`port:       ${profile.port}`,
		`alias:      ${profile.alias}`,
		`ctx:        ${profile.ctx}`,
		`hf:         ${profile.repo}:${profile.quant}`,
	].join("\n");
}

/**
 * The command-line reader: `bun run scripts/llama-server/profiles.ts <name>`.
 *
 * It prints one profile, or it prints the known names and returns exit code 1.
 */
export function profilesMain(
	argv: string[],
	out: (line: string) => void = console.log,
	err: (line: string) => void = console.error,
): number {
	const name = argv[0];
	if (!name) {
		err(`Usage: bun run scripts/llama-server/profiles.ts <name>`);
		err(`Known profiles: ${profileNames().join(", ")}.`);
		return 1;
	}
	try {
		const profile = selectProfile(name);
		out(formatProfile(name, profile));
		return 0;
	} catch (error) {
		if (error instanceof UnknownProfileError) {
			err(error.message);
			return error.exitCode;
		}
		throw error;
	}
}

if (import.meta.main) {
	process.exit(profilesMain(process.argv.slice(2)));
}
