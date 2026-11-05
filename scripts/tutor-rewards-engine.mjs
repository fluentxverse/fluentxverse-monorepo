import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { root } from './identity-mainnet-operations.mjs';
import { quote } from './lib/cloud-ssh.mjs';

const release = 'output/release/tutor-rewards-20261104';
const remote = '/opt/fluentxverse/releases/tutor-rewards-20261104';
const baseline = 'fluentxverse-cloud/gmr-engine:lesson-registry-batching-20261104';
const image = 'fluentxverse-cloud/gmr-engine:tutor-rewards-bootstrap-20261104';
const mode = process.argv[2];
if (mode === '--prepare') {
  const source = join(release, 'engine-source');
  mkdirSync(release, { recursive: true });
  if (!existsSync(source)) cpSync('output/release/lesson-registry-batching-20261104/engine-source', source, { recursive: true,
    verbatimSymlinks: true, filter: p => !['node_modules', '.git'].includes(p.split('/').at(-1)) });
  if (!existsSync(join(source, 'node_modules'))) symlinkSync('/home/paulanthonyarriola/Desktop/budol/gmr-engine/node_modules', join(source, 'node_modules'), 'dir');
  mkdirSync(join(source, 'cmd/tutor-rewards-bootstrap'), { recursive: true });
  cpSync('integrations/tutor-rewards/engine/main.go', join(source, 'cmd/tutor-rewards-bootstrap/main.go'));
  cpSync('integrations/tutor-rewards/engine/deploy.ts', join(source, 'scripts/tutor-rewards-deploy.ts'));
  for (const file of ['tutorRewardsArtifact', 'tutorRewardsDeployment']) {
    const name = file === 'tutorRewardsArtifact' ? 'tutor-rewards-artifact.json' : 'tutor-rewards-deployment.json';
    cpSync('shared/' + file + '.json', join(source, 'scripts', name));
    if (file === 'tutorRewardsArtifact') cpSync('shared/' + file + '.json', join(source, 'cmd/tutor-rewards-bootstrap', name));
  }
  const run = (cmd, args) => execFileSync(cmd, args, { cwd: source, stdio: 'inherit', env: { ...process.env, CGO_ENABLED: '0', GOCACHE: '/tmp/fxv-engine-go-cache' } });
  run('gofmt', ['-w', 'cmd/tutor-rewards-bootstrap']);
  run('go', ['test', './cmd/tutor-rewards-bootstrap']);
  run('bunx', ['tsc', '--noEmit', '--target', 'esnext', '--module', 'esnext', '--moduleResolution', 'bundler', '--resolveJsonModule', '--esModuleInterop', '--skipLibCheck', '--strict', '--types', 'bun', 'scripts/tutor-rewards-deploy.ts']);
  mkdirSync(join(release, 'engine/scripts'), { recursive: true });
  run('go', ['build', '-buildvcs=false', '-trimpath', '-ldflags=-s -w', '-o', resolve(release, 'engine/tutor-rewards-bootstrap'), './cmd/tutor-rewards-bootstrap']);
  for (const file of ['tutor-rewards-deploy.ts', 'tutor-rewards-artifact.json', 'tutor-rewards-deployment.json']) cpSync(join(source, 'scripts', file), join(release, 'engine/scripts', file));
  writeFileSync(join(release, 'engine/Dockerfile'), `FROM ${baseline}\nCOPY tutor-rewards-bootstrap /usr/local/bin/\nCOPY scripts/ /app/scripts/\n`);
  execFileSync('tar', ['-czf', join(release, 'engine.tar.gz'), '-C', join(release, 'engine'), '.']);
  writeFileSync(join(release, 'engine-prepared.json'), JSON.stringify({ baseline, image, artifactSHA256: createHash('sha256').update(readFileSync('shared/tutorRewardsArtifact.json')).digest('hex') }, null, 2));
} else if (mode === '--upload') {
  root(`install -d -m 700 ${remote}/engine ${remote}/private && tar -xzf - -C ${remote}/engine`, { input: readFileSync(release + '/engine.tar.gz') });
  console.log(root(`docker build --network none -t ${image} ${remote}/engine`));
} else if (mode === '--deploy' || mode === '--verify') {
  const py = `import json,subprocess
c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
if c['Config']['Image']!='${baseline}' or c['State']['Health']['Status']!='healthy':raise RuntimeError('Engine baseline changed')
args=['docker','run','--rm','--network','container:budol-gmr-engine-1','--env-file','/dev/stdin','-v','${remote}/private:/rewards-private','--entrypoint','/usr/local/bin/tutor-rewards-bootstrap','${image}','-journal','/rewards-private/deployment.json']
${mode === '--deploy' ? "args.append('-broadcast')" : ''}
print(subprocess.check_output(args,input='\\n'.join(c['Config']['Env'])+'\\n',text=True))`;
  const result = JSON.parse(root('python3 -c ' + quote(py), { timeout: 130000 }));
  mkdirSync(release, { recursive: true });
  writeFileSync(join(release, 'deployment.json'), JSON.stringify({ at: new Date().toISOString(), ...result }, null, 2));
  console.log(JSON.stringify(result));
} else throw Error('Use --prepare, --upload, --deploy or --verify');
