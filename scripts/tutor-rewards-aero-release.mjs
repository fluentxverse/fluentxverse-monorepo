import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getContractAddress } from 'viem';
import { root } from './identity-mainnet-operations.mjs';
import { quote } from './lib/cloud-ssh.mjs';
const dir = resolve('output/release/tutor-rewards-aero-20261104'), remote = '/opt/fluentxverse/releases/tutor-rewards-aero-20261104';
const baseline = 'fluentxverse-cloud/gmr-engine:lesson-registry-batching-20261104';
const image = 'fluentxverse-cloud/gmr-engine:tutor-rewards-aero-bootstrap-20261104';
const mode = process.argv[2];
const hash = b => createHash('sha256').update(b).digest('hex');
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe', maxBuffer: 8e6, timeout: 240000,
  env: { ...process.env, CGO_ENABLED: '0', GOCACHE: '/tmp/fxv-engine-go-cache' } });
if (mode === '--prepare') {
  mkdirSync(dir, { recursive: true });
  const pin = JSON.parse(readFileSync('shared/tutorRewardsDeployment.json'));
  const aero = JSON.parse(readFileSync('shared/tutorRewardsAero.json'));
  const a = JSON.parse(readFileSync('shared/tutorRewardsAeroArtifact.json'));
  const address = nonce => getContractAddress({ from: pin.operator, nonce: BigInt(nonce) }).toLowerCase();
  const token = '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec';
  const release = { projectId: pin.projectId, operator: pin.operator, rpcUrl: pin.rpcUrl, chainId: 4663, deployments: [
    { name: 'FluentXVerse Aero Reward Adapter', nonce: 1, contract: address(1), args: [pin.operator, pin.contract, pin.settlementToken, aero.router, aero.factory],
      bindings: { owner: pin.operator, rewards: pin.contract, settlementToken: pin.settlementToken, router: aero.router, factory: aero.factory }, artifact: a.adapter, feeCapWei: '160000000000000' },
    { name: 'FluentXVerse Alchemy NVDA Feed', nonce: 2, contract: address(2), args: [pin.operator, pin.operator, token, 300],
      bindings: { owner: pin.operator, publisher: pin.operator, token, maxObservationAge: 300, decimals: 18 }, artifact: a.feed, feeCapWei: '80000000000000' },
  ] };
  const file = join(dir, 'release.json'), encoded = JSON.stringify(release);
  if (existsSync(file) && readFileSync(file, 'utf8') !== encoded) throw Error('Prepared Aero binding changed');
  if (!existsSync(file)) writeFileSync(file, encoded, { flag: 'wx' });
  const src = join(dir, 'engine-source');
  if (!existsSync(src)) cpSync('output/release/tutor-rewards-20261104/engine-source', src, { recursive: true, verbatimSymlinks: true,
    filter: p => !['node_modules', '.git'].includes(p.split('/').at(-1)) });
  if (!existsSync(join(src, 'node_modules'))) symlinkSync('/home/paulanthonyarriola/Desktop/budol/gmr-engine/node_modules', join(src, 'node_modules'), 'dir');
  mkdirSync(join(src, 'cmd/tutor-rewards-aero-bootstrap'), { recursive: true });
  cpSync('integrations/tutor-rewards/engine/aero-bootstrap.go', join(src, 'cmd/tutor-rewards-aero-bootstrap/main.go'));
  cpSync('integrations/tutor-rewards/engine/aero-deploy.ts', join(src, 'scripts/tutor-rewards-aero-deploy.ts'));
  for (const path of ['scripts', 'cmd/tutor-rewards-aero-bootstrap']) writeFileSync(join(src, path, 'tutor-rewards-aero-release.json'), encoded);
  run('gofmt', ['-w', 'cmd/tutor-rewards-aero-bootstrap'], src);
  console.log(run('go', ['test', './cmd/tutor-rewards-aero-bootstrap'], src));
  console.log(run('bunx', ['tsc', '--noEmit', '--target', 'esnext', '--module', 'esnext', '--moduleResolution', 'bundler', '--resolveJsonModule', '--esModuleInterop', '--skipLibCheck', '--strict', '--types', 'bun', 'scripts/tutor-rewards-aero-deploy.ts'], src));
  mkdirSync(join(dir, 'engine/scripts'), { recursive: true });
  run('go', ['build', '-buildvcs=false', '-trimpath', '-ldflags=-s -w', '-o', join(dir, 'engine/tutor-rewards-aero-bootstrap'), './cmd/tutor-rewards-aero-bootstrap'], src);
  for (const f of ['tutor-rewards-aero-deploy.ts', 'tutor-rewards-aero-release.json']) cpSync(join(src, 'scripts', f), join(dir, 'engine/scripts', f));
  writeFileSync(join(dir, 'engine/Dockerfile'), `FROM ${baseline}\nCOPY tutor-rewards-aero-bootstrap /usr/local/bin/\nCOPY scripts/ /app/scripts/\n`);
  writeFileSync(join(dir, 'prepared.json'), JSON.stringify({ baseline, image, bindingSHA256: hash(encoded) }));
  console.log(JSON.stringify({ prepared: true, deployments: release.deployments.map(d => ({ name: d.name, contract: d.contract, nonce: d.nonce })) }));
} else if (mode === '--upload') {
  root(`install -d -m 700 ${remote}/engine ${remote}/private && tar -xzf - -C ${remote}/engine`, { input: execFileSync('tar', ['-czf', '-', '-C', join(dir, 'engine'), '.'], { maxBuffer: 32e6 }) });
  console.log(root(`docker build --network none -t ${image} ${remote}/engine`));
} else if (mode === '--deploy' || mode === '--verify') {
  const index = Number(process.argv[3]); if (![0, 1].includes(index)) throw Error('Aero deployment index must be 0 or 1');
  const py = `import json,subprocess
c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
if c['Config']['Image']!='${baseline}' or c['State']['Health']['Status']!='healthy':raise RuntimeError('Engine baseline changed')
args=['docker','run','--rm','--network','container:budol-gmr-engine-1','--env-file','/dev/stdin','-v','${remote}/private:/aero-private','--entrypoint','/usr/local/bin/tutor-rewards-aero-bootstrap','${image}','-directory','/aero-private','-index','${index}']
${mode === '--deploy' ? "args.append('-broadcast')" : ''}
print(subprocess.check_output(args,input='\\n'.join(c['Config']['Env'])+'\\n',text=True))`;
  const result = JSON.parse(root('python3 -c ' + quote(py), { timeout: 130000 }));
  writeFileSync(join(dir, `deployment-${index}.json`), JSON.stringify({ at: new Date().toISOString(), ...result }, null, 2)); console.log(JSON.stringify(result));
} else throw Error('Use --prepare, --upload, --deploy INDEX or --verify INDEX');
