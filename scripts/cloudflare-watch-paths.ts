#!/usr/bin/env bun
/**
 * Cloudflare build watch path detector.
 *
 * Given a list of changed files (from git diff), determines which Cloudflare
 * Workers deployments should be triggered. Fails safe: if it cannot reliably
 * determine affected deployments, it exits with a non-zero code to prevent
 * skipping a potentially necessary deployment.
 *
 * Usage:
 *   git diff --name-only HEAD~1 HEAD | bun run scripts/cloudflare-watch-paths.ts
 *   bun run scripts/cloudflare-watch-paths.ts path1 path2 ...
 *
 * Exit codes:
 *   0 - Success, affected Workers printed to stdout
 *   1 - Error or ambiguous input, deploy all Workers
 */

const FETCH_EXAMPLE_PATH = "packages/examples/cloudflare/fetch/";
const NODE_EXAMPLE_PATH = "packages/examples/cloudflare/node/";
const CORE_SRC_PATH = "packages/core/src/";
const CORE_PACKAGE_JSON = "packages/core/package.json";
const CORE_TSCONFIG = "packages/core/tsconfig.json";

// Paths under packages/core/ that are NOT relevant to the runtime artifact.
const CORE_IRRELEVANT_PREFIXES = [
	"packages/core/test/",
	"packages/core/docs/",
	"packages/core/benchmarks/",
];

function isRelevantCoreChange(filePath: string): boolean {
	// Core source code is always relevant
	if (filePath.startsWith(CORE_SRC_PATH)) {
		return true;
	}

	// Core package.json and tsconfig.json affect the build
	if (filePath === CORE_PACKAGE_JSON || filePath === CORE_TSCONFIG) {
		return true;
	}

	// Other core paths (tests, docs, benchmarks) are irrelevant
	return false;
}

function getAffectedWorkers(changedFiles: string[]): string[] {
	const affected = new Set<string>();

	for (const file of changedFiles) {
		const normalized = file.trim();

		// Example-specific changes
		if (normalized.startsWith(FETCH_EXAMPLE_PATH)) {
			affected.add("fetch");
		}
		if (normalized.startsWith(NODE_EXAMPLE_PATH)) {
			affected.add("node");
		}

		// Shared core changes
		if (normalized.startsWith("packages/core/")) {
			if (isRelevantCoreChange(normalized)) {
				affected.add("fetch");
				affected.add("node");
			}
		}

		// Root-level files that affect both
		if (
			normalized === "package.json" ||
			normalized === "bun.lock" ||
			normalized === "tsconfig.json"
		) {
			affected.add("fetch");
			affected.add("node");
		}
	}

	return Array.from(affected).sort();
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);

	let changedFiles: string[];

	if (args.length > 0) {
		// Files passed as arguments
		changedFiles = args;
	} else {
		// Read from stdin (piped from git diff)
		const stdin = Bun.stdin.stream();
		const text = await new Response(stdin).text();
		changedFiles = text
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
	}

	if (changedFiles.length === 0) {
		console.error("Error: No changed files provided");
		process.exit(1);
	}

	// Fail safe: if any file path is ambiguous, deploy all
	for (const file of changedFiles) {
		if (!file.startsWith("packages/") && !file.startsWith("bun.lock") && !file.startsWith("tsconfig.json") && file !== "package.json") {
			console.error(`Warning: Ambiguous path "${file}", deploying all Workers`);
			console.log("fetch node");
			process.exit(0);
		}
	}

	const affected = getAffectedWorkers(changedFiles);

	if (affected.length === 0) {
		// No relevant changes, no deployments needed
		console.log("");
		process.exit(0);
	}

	console.log(affected.join(" "));
	process.exit(0);
}

main();
