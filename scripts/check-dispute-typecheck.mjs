import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const root = new URL("../", import.meta.url).pathname;
const result = spawnSync("bun", ["run", "typecheck"], {
	cwd: root + "fluentxverse-server",
	encoding: "utf8",
	maxBuffer: 4 * 1024 * 1024,
});
const diagnostics = (result.stdout + result.stderr)
	.split("\n")
	.filter((line) => /^.*\(\d+,\d+\): error TS\d+:/.test(line));
// All initial diagnostics are fixed. Every compiler error now fails the release gate.
const unexpected = diagnostics;
const directory = root + "output/verification/dispute-staging";
mkdirSync(directory, { recursive: true });
writeFileSync(directory + "/typecheck.txt", result.stdout + result.stderr);
writeFileSync(
	directory + "/typecheck.json",
	JSON.stringify(
		{
			checkedAt: new Date().toISOString(),
			exitCode: result.status,
			diagnostics,
			unexpected,
		},
		null,
		2,
	) + "\n",
);
if (result.status !== 0 || diagnostics.length)
	throw Error("Unexpected typecheck failures: " + unexpected.join("\n"));
console.log(
	JSON.stringify({
		fullTypecheckPassed: result.status === 0,
		diagnostics: diagnostics.length,
		unexpectedDiagnostics: unexpected.length,
	}),
);
