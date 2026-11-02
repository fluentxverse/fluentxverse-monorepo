import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { ssh, quote } from "./lib/cloud-ssh.mjs";
const code = readFileSync(
	new URL(
		"../fluentxverse-server/tests/stagingDispute.smoke.ts",
		import.meta.url,
	),
	"utf8",
);
const smoke = ssh(
	"docker exec -w /app/tests fxv-dispute-stage-api-1 bun -e " + quote(code),
);
console.log(smoke);
const probe = `for(const url of ['http://127.0.0.1:8765/health','http://student:8080/','http://tutor:8080/','http://dashboard:8080/']){const r=await fetch(url,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error(url+' '+r.status);console.log(JSON.stringify({url,status:r.status}));}`;
const health = ssh(
	"docker exec fxv-dispute-stage-api-1 bun -e " + quote(probe),
);
console.log(health);
const out = new URL("../output/verification/dispute-staging/", import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(
	new URL("cloud-smoke.json", out),
	JSON.stringify(
		{
			checkedAt: new Date().toISOString(),
			smoke,
			health,
			productionPromoted: false,
		},
		null,
		2,
	) + "\n",
);
