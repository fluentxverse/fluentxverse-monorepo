import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const sharedRoles = process.argv.includes('--shared-roles');
const id = sharedRoles ? 'lesson-disputes-shared-roles-20261102' : 'lesson-disputes-engine-20261102';
const release = join(root, 'output/release', id);
const engine = resolve(root, '../budol/gmr-engine');
const dashboard = resolve(root, '../budol/gmr-dashboard');
const baselineImage = 'fluentxverse-cloud/gmr-engine:' + (sharedRoles ? 'lesson-disputes-engine-20261102' : 'rust-payout-worker-20261029');
const baselineEngine = join(root, 'output/release', sharedRoles ? 'lesson-disputes-engine-20261102' : 'rust-payout-worker-20261029', 'engine-source');
const baselineFrontend = join(root, 'output/release', sharedRoles ? 'lesson-disputes-engine-20261102' : 'project-destinations-20261029', 'frontend');
const engineFiles = [
  'contracts/lesson_disputes.go', 'contracts/lesson_disputes_test.go',
  'contracts/lesson_disputes/LessonDisputes.sol', 'contracts/lesson_disputes/artifact.json',
  'deployer/deployer.go', 'deployer/lesson_disputes.go', 'deployer/lesson_disputes_test.go', 'deployer/lesson-disputes.e2e.ts',
  'httpapi/api.go', 'httpapi/dashboard.go', 'httpapi/lesson_disputes.go', 'httpapi/lesson_disputes_test.go',
  'store/memgraph.go', 'store/models.go', 'store/lesson_disputes.go', 'store/lesson_disputes_test.go', 'store/lesson_disputes_integration_test.go',
];
const frontendFiles = ['App.tsx', 'api.ts', 'types.ts', 'styles.css', 'lessonDisputes.ts', 'lessonDisputes.test.ts'];
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const copy = (from, to) => { mkdirSync(join(to, '..'), { recursive: true }); cpSync(from, to, { recursive: true, filter: p => !['node_modules', '.git', '.wrangler'].includes(p.split('/').at(-1)) }); };
const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, CGO_ENABLED: '0', GOCACHE: '/tmp/fxv-engine-go-cache' } });
if (existsSync(join(release, 'prepared.json'))) throw Error('Release already prepared; do not overwrite it.');
mkdirSync(release, { recursive: true });
const source = join(release, 'engine-source');
copy(baselineEngine, source);
for (const file of engineFiles) copy(join(engine, 'internal', file), join(source, 'internal', file));
if (!existsSync(join(source, 'node_modules'))) symlinkSync(join(engine, 'node_modules'), join(source, 'node_modules'));
for (const f of ['deploy-contract.ts', 'vault-account.ts']) copy(join(engine, 'scripts', f), join(source, 'scripts', f));
run('go', ['test', './internal/...', './cmd/...'], source);
run('bun', ['internal/deployer/lesson-disputes.e2e.ts'], source);
const image = join(release, 'engine');
mkdirSync(image, { recursive: true });
run('go', ['build', '-buildvcs=false', '-trimpath', '-ldflags=-s -w', '-o', join(image, 'gmr-engine'), './cmd/api'], source);
writeFileSync(join(image, 'Dockerfile'), 'FROM ' + baselineImage + '\nCOPY gmr-engine /usr/local/bin/gmr-engine\n');
run('tar', ['-czf', join(release, 'engine.tar.gz'), '-C', image, '.'], root);

const frontend = join(release, 'frontend');
mkdirSync(frontend, { recursive: true });
for (const dir of ['gmr-dashboard', 'public', 'src']) copy(join(baselineFrontend, dir), join(frontend, dir));
if (!existsSync(join(frontend, 'node_modules'))) symlinkSync(resolve(root, '../budol/node_modules'), join(frontend, 'node_modules'));
for (const f of ['package.json', 'tsconfig.json', 'tsconfig.gmr-dashboard.json']) copy(resolve(root, '../budol', f), join(frontend, f));
run('bun', ['build', './gmr-dashboard/index.html', '--outdir=baseline-dist', '--public-path=/', '--production', '--minify'], frontend);
for (const f of frontendFiles) copy(join(dashboard, 'src', f), join(frontend, 'gmr-dashboard/src', f));
copy(join(dashboard, 'tests/lesson-disputes.e2e.cjs'), join(frontend, 'gmr-dashboard/tests/lesson-disputes.e2e.cjs'));
run('bunx', ['tsc', '--noEmit', '-p', 'tsconfig.gmr-dashboard.json'], frontend);
run('bun', ['test', 'gmr-dashboard/src'], frontend);
run('bun', ['build', './gmr-dashboard/index.html', '--outdir=dist', '--public-path=/', '--production', '--minify'], frontend);
for (const f of ['_headers', 'public/client-env.js', 'engine-favicon-v1.svg']) copy(join(baselineFrontend, 'dist', f), join(frontend, 'dist', f));
const htmlPath = join(frontend, 'dist/index.html');
let html = readFileSync(htmlPath, 'utf8').replaceAll('href="./', 'href="/').replaceAll('src="./', 'src="/');
html = html.replace('</head>', '<script src="/public/client-env.js"></script><link rel="icon" type="image/svg+xml" href="/engine-favicon-v1.svg">\n</head>');
writeFileSync(htmlPath, html);
for (const f of ['worker.ts', 'wrangler.json']) copy(join(baselineFrontend, f), join(frontend, f));
const assets = Object.fromEntries(readdirSync(join(frontend, 'dist')).filter(f => /\.(js|css)$/.test(f)).map(f => [f, sha(join(frontend, 'dist', f))]));
writeFileSync(join(release, 'prepared.json'), JSON.stringify({ id, preparedAt: new Date().toISOString(), baselineEngine: baselineImage, image: 'fluentxverse-cloud/gmr-engine:' + id, binarySHA256: sha(join(image, 'gmr-engine')), assets, publicNetworkDeployment: false }, null, 2));
console.log('Prepared scoped Engine API and dashboard release. Not published.');
