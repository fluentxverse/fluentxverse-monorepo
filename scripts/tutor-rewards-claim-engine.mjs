import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { root } from './identity-mainnet-operations.mjs';
import { quote } from './lib/cloud-ssh.mjs';
const dir = resolve('output/release/tutor-rewards-aero-20261104'), src = join(dir, 'engine-source');
const remote = '/opt/fluentxverse/releases/tutor-rewards-aero-20261104';
const baseline = 'fluentxverse-cloud/gmr-engine:lesson-registry-batching-20261104', image = 'fluentxverse-cloud/gmr-engine:tutor-rewards-claims-20261104';
const run = (cmd, args) => execFileSync(cmd, args, { cwd: src, encoding: 'utf8', maxBuffer: 8e6, timeout: 240000, env: { ...process.env, CGO_ENABLED: '0', GOCACHE: '/tmp/fxv-engine-go-cache' } });
if (process.argv[2] === '--prepare') {
  cpSync('integrations/tutor-rewards/engine/claim.go', join(src, 'internal/httpapi/tutor_rewards.go'));
  cpSync('integrations/tutor-rewards/engine/claim_test.go', join(src, 'internal/httpapi/tutor_rewards_test.go'));
  cpSync('integrations/tutor-rewards/engine/authorize.ts', join(src, 'scripts/tutor-rewards-authorize.ts'));
  cpSync('integrations/tutor-rewards/engine/authorize.test.ts', join(src, 'scripts/tutor-rewards-authorize.test.ts'));
  cpSync('shared/tutorRewardClaim.ts', join(src, 'scripts/tutor-rewards-claim.ts'));
  for (const [local, name] of [['tutorRewardsDeployment.json', 'tutor-rewards-deployment.json'], ['tutorRewardsArtifact.json', 'tutor-rewards-artifact.json']]) cpSync('shared/' + local, join(src, 'scripts', name));
  const file = join(src, 'internal/httpapi/api.go'); let api = readFileSync(file, 'utf8');
  const anchor = 'v1.Post("/erc20/managed-transfer-with-permit", server.requireScope("transactions:write"), server.erc20ManagedTransferWithPermit)';
  if (!api.includes('v1.Post("/tutor-rewards/authorize"')) {
    if (api.split(anchor).length !== 2) throw Error('Engine route anchor changed');
    api = api.replace(anchor, anchor + '\n\tv1.Post("/tutor-rewards/authorize", server.requireScope("transactions:write"), server.tutorRewardAuthorize)'); writeFileSync(file, api);
  }
  run('gofmt', ['-w', 'internal/httpapi/tutor_rewards.go', 'internal/httpapi/tutor_rewards_test.go', 'internal/httpapi/api.go']);
  console.log(run('go', ['test', './internal/httpapi', './internal/disputes', './internal/store']));
  console.log(run('bunx', ['tsc', '--noEmit', '--target', 'esnext', '--module', 'esnext', '--moduleResolution', 'bundler', '--resolveJsonModule', '--esModuleInterop', '--skipLibCheck', '--strict', '--types', 'bun', 'scripts/tutor-rewards-authorize.ts']));
  console.log(run('bun', ['--no-env-file', 'test', 'scripts/tutor-rewards-authorize.test.ts']));
  mkdirSync(join(dir, 'claim-engine/scripts'), { recursive: true });
  run('go', ['build', '-buildvcs=false', '-trimpath', '-ldflags=-s -w', '-o', join(dir, 'claim-engine/gmr-engine'), './cmd/api']);
  for (const f of ['tutor-rewards-authorize.ts', 'tutor-rewards-claim.ts', 'tutor-rewards-deployment.json', 'tutor-rewards-artifact.json']) cpSync(join(src, 'scripts', f), join(dir, 'claim-engine/scripts', f));
  writeFileSync(join(dir, 'claim-engine/Dockerfile'), `FROM ${baseline}\nCOPY gmr-engine /usr/local/bin/gmr-engine\nCOPY scripts/ /app/scripts/\n`);
} else if (process.argv[2] === '--upload') {
  root(`install -d ${remote}/claim-engine && tar -xzf - -C ${remote}/claim-engine`, { input: execFileSync('tar', ['-czf', '-', '-C', join(dir, 'claim-engine'), '.'], { maxBuffer: 64e6 }) });
  console.log(root(`docker build --network none -t ${image} ${remote}/claim-engine`));
} else if (process.argv[2] === '--deploy') {
  const py = `import json,subprocess,os
from pathlib import Path
r=Path('${remote}/private');c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
if c['Config']['Image']!='${baseline}' or c['State']['Health']['Status']!='healthy':raise RuntimeError('Engine baseline changed')
def private(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump(value,f);f.flush();os.fsync(f.fileno())
private(r/'claim-engine-rollback.private.json',c);override=r/'claim-engine.override.json';private(override,{'services':{'gmr-engine':{'image':'${image}'}}})
labels=c['Config']['Labels'];files=labels['com.docker.compose.project.config_files'].split(',')
if not all(Path(f).is_file() for f in files):raise RuntimeError('Missing compose baseline')
args=['docker','compose','-p',labels['com.docker.compose.project']]+[v for f in files for v in ['-f',f]]
subprocess.run(args+['-f',str(override),'up','-d','--no-deps','--wait','--wait-timeout','120','gmr-engine'],check=True)
print(json.dumps({'image':'${image}','health':'healthy'}))`;
  console.log(root('python3 -c ' + quote(py), { timeout: 300000 }));
} else throw Error('Use --prepare, --upload or --deploy');
