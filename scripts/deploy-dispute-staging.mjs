import { execFileSync } from "node:child_process";
import { ssh, quote } from "./lib/cloud-ssh.mjs";
const root = new URL("../", import.meta.url).pathname;
const destination = "/opt/fluentxverse/staging/disputes-20261031";
if (!process.argv.includes("--deploy"))
	throw Error("Explicit --deploy required; isolated staging only");
const paths = [
	"fluentxverse-server/src",
	"shared",
	"fluentxverse-server/tests/studentDispute.persistence.ts",
	"fluentxverse-server/tests/stagingDispute.smoke.ts",
	"fluentxverse-server/init.sql",
	"scripts/staging/dispute-host.ts",
	"package.json",
	"bun.lock",
	"fluentxverse-server/package.json",
	"fluentxverse-dashboard/package.json",
	"fluentxverse-student-solid-prototype/package.json",
	"fluentxverse-tutor-solid-prototype/package.json",
	"fluentxverse-site/package.json",
	"fluentxverse-dashboard/dist",
	"fluentxverse-tutor-solid-prototype/dist",
	"fluentxverse-student-solid-prototype/dist",
];
const bundle = execFileSync("tar", ["-czf", "-", ...paths], {
	cwd: root,
	maxBuffer: 64 * 1024 * 1024,
});
ssh(
	`install -d -m 700 ${quote(destination)} && tar -xzf - -C ${quote(destination)}`,
	{ input: bundle },
);
// Staging has no production volumes, credentials, network memberships or public ports.
const bootstrap = String.raw`
import json,secrets,os,subprocess
from pathlib import Path
p=Path('/opt/fluentxverse/staging/disputes-20261031')
envpath=p/'stage-env.json'
if envpath.exists(): env=json.loads(envpath.read_text())
else:
 env={'NODE_ENV':'development','MEMGRAPH_URI':'bolt://graph:7687','MEMGRAPH_USER':'','MEMGRAPH_PASSWORD':'',
 'DATABASE_URL':'postgresql://stage:stage@logs:5432/stage','JWT_SECRET':secrets.token_hex(32),
 'ALLOW_MOCK_TICKET_PURCHASES':'true','LESSON_BOOKING_MODE':'paid','REFUND_TRANSFERS_DISABLED':'true',
 'QA_RECORDING_ENCRYPTION_KEY':secrets.token_hex(32),'SEAWEED_FILER_URL':'http://filer:8888',
 'FRONTEND_URLS':'http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175'}
 envpath.write_text(json.dumps(env));envpath.chmod(0o600)
image='fluentxverse-cloud/api:dispute-staging-20261031'
(p/'Dockerfile').write_text('''FROM fluentxverse-cloud/api:project-destinations-20261029-enrollment AS dependencies
USER root
WORKDIR /deps
COPY package.json bun.lock ./
COPY fluentxverse-server/package.json fluentxverse-server/package.json
COPY fluentxverse-dashboard/package.json fluentxverse-dashboard/package.json
COPY fluentxverse-student-solid-prototype/package.json fluentxverse-student-solid-prototype/package.json
COPY fluentxverse-tutor-solid-prototype/package.json fluentxverse-tutor-solid-prototype/package.json
COPY fluentxverse-site/package.json fluentxverse-site/package.json
RUN bun install --production --frozen-lockfile --filter fluentxverse-server && mkdir -p /deps/fluentxverse-server/node_modules
FROM fluentxverse-cloud/api:project-destinations-20261029-enrollment
COPY --from=dependencies /deps/node_modules /app/node_modules
COPY --from=dependencies /deps/fluentxverse-server/node_modules /app/node_modules
COPY fluentxverse-server/src /app/src
COPY shared /shared
COPY fluentxverse-server/tests /app/tests
''')
subprocess.run(['docker','build','-t',image,str(p)],check=True,stdout=subprocess.DEVNULL)
common={'networks':['stage'],'restart':'unless-stopped','logging':{'driver':'json-file','options':{'max-size':'5m','max-file':'2'}}}
services={
 'graph':dict(common,image='fluentxverse-cloud/memgraph:20261023',mem_limit='512m',cpus=0.25,volumes=['graph:/var/lib/memgraph'],entrypoint=['/usr/lib/memgraph/memgraph'],command=['--log-level=WARNING']),
 'logs':dict(common,image='fluentxverse-cloud/postgres:20261023',mem_limit='192m',cpus=0.15,environment={'POSTGRES_USER':'stage','POSTGRES_PASSWORD':'stage','POSTGRES_DB':'stage'},volumes=['logs:/var/lib/postgresql/data',f'{p}/fluentxverse-server/init.sql:/docker-entrypoint-initdb.d/001-schema.sql:ro']),
 'api':dict(common,image=image,mem_limit='512m',cpus=0.35,environment=env,ports=['127.0.0.1:18865:8765'],depends_on=['graph','logs'],healthcheck={'test':['CMD','bun','-e',"fetch('http://127.0.0.1:8765/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],'interval':'10s','timeout':'5s','retries':5,'start_period':'15s'}),
}
for kind,directory,port in [('student','fluentxverse-student-solid-prototype',18774),('tutor','fluentxverse-tutor-solid-prototype',18773),('dashboard','fluentxverse-dashboard',18775)]:
 services[kind]=dict(common,image=image,mem_limit='64m',cpus=0.05,entrypoint=['bun'],command=['/stage/dispute-host.ts'],environment={'STAGE_COMPONENT':kind,'STAGE_ROOT':'/assets'},ports=[f'127.0.0.1:{port}:8080'],volumes=[f'{p}/scripts/staging:/stage:ro',f'{p}/{directory}/dist:/assets:ro'],healthcheck={'disable':True})
services['filer']=dict(common,image=image,mem_limit='64m',cpus=0.05,user='0:0',entrypoint=['bun'],command=['/stage/dispute-host.ts'],environment={'STAGE_COMPONENT':'filer','STAGE_ROOT':'/data'},volumes=[f'{p}/scripts/staging:/stage:ro','images:/data'],healthcheck={'disable':True})
config={'name':'fxv-dispute-stage','services':services,'networks':{'stage':{'internal':True}},'volumes':{'graph':{},'logs':{},'images':{}}}
(p/'compose.json').write_text(json.dumps(config));(p/'compose.json').chmod(0o600)
subprocess.run(['docker','compose','-f',str(p/'compose.json'),'up','-d'],check=True)
print(json.dumps({'stagingPath':str(p),'api':'127.0.0.1:18865','liveTransfersDisabled':True,'productionUntouched':True}))
`;
console.log(ssh("python3 -c " + quote(bootstrap)));
