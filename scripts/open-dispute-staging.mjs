import { spawn } from "node:child_process";
import { ssh, sshOptions, cloudTarget } from "./lib/cloud-ssh.mjs";
const map = [
	["api", 18865, 8765],
	["student", 5174, 8080],
	["tutor", 5173, 8080],
	["dashboard", 5175, 8080],
];
const args = [...sshOptions, "-o", "ExitOnForwardFailure=yes", "-N"];
for (const [name, local, remote] of map) {
	const ip = ssh(
		`docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' fxv-dispute-stage-${name}-1`,
	).trim();
	if (!/^172\.\d+\.\d+\.\d+$/.test(ip))
		throw Error("Unexpected isolated staging address");
	args.push("-L", `127.0.0.1:${local}:${ip}:${remote}`);
}
args.push(cloudTarget);
console.log(
	"Private staging: student http://127.0.0.1:5174, tutor http://127.0.0.1:5173, dashboard http://127.0.0.1:5175. Synthetic staging accounts only; production accounts are not copied.",
);
const child = spawn("ssh", args, { stdio: "inherit" });
child.on("exit", (code) => {
	process.exitCode = code || 0;
});
process.on("SIGINT", () => child.kill("SIGINT"));
