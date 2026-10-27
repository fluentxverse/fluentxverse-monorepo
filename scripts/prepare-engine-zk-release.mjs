import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engine = resolve(root, '../budol/gmr-engine');
const release = join(root, 'output/release/engine-zk-security-20261020');
const source = join(release, 'source'), baseline = join(release, 'baseline');
function run(command, args, options = {}) {
  const r = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...options });
  if (r.status !== 0) throw Error(`${command} failed: ${(r.stderr || '').slice(-1500)}`);
  return r.stdout;
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const old = JSON.parse(run('docker', ['inspect', 'budol-gmr-engine-1']))[0];
if (old.Image !== 'sha256:ab0849eb8023174a86738fa055d3fee1fd850e8cbc8f2d7e8560fc1ae583f5bc') throw Error('Engine runtime changed; review the release');
mkdirSync(release, { recursive: true });
const files = [];
function snapshot(relative) {
  const path = join(engine, relative);
  let entries;
  try { entries = readdirSync(path, { withFileTypes: true }); } catch (error) { if (error.code !== 'ENOTDIR') throw error; }
  if (entries) {
    for (const item of entries) {
      if (item.isSymbolicLink()) throw Error('Source symlinks require review');
      snapshot(`${relative}/${item.name}`);
    }
    return;
  }
  if (!/\.(go|sol)$/.test(relative) && !['go.mod', 'go.sum'].includes(relative)) return;
  for (const target of [source, baseline]) {
    const destination = join(target, relative); mkdirSync(dirname(destination), { recursive: true }); copyFileSync(path, destination);
  }
  files.push({ path: relative, sha256: sha(readFileSync(path)) });
}
for (const path of ['go.mod', 'go.sum', 'cmd/api', 'internal']) snapshot(path);

// Reconstruct only known prior changes in a disposable baseline, never in the shared checkout.
const policyPath = join(baseline, 'internal/httpapi/zkverify_policy.go');
let policy = readFileSync(policyPath, 'utf8');
policy = policy.replace(/\t\/\/ Screening requires[^\n]*\n\tStatementType[^\n]*\n\tBindings[^\n]*\n/, '');
policy = policy.replace(/\tif policy.PublicInputs == 15 \{\n\t\tvalidShape[^\n]*\n\t\}\n/, '');
policy = policy.replace(/\tif policy.PublicInputs == 15 &&[^\n]*\n\t\treturn errors.New\("invalid approved screening policy"\)\n\t\}\n/, '');
policy = policy.replace(/\tif policy.PublicInputs == 15 \{\n\t\tfor index, expected := range policy.Bindings \{[\s\S]*?\n\t\t\}\n\t\}\n/, '');
policy = policy.replace(/var screeningBindingIndexes[\s\S]*?(?=func \(s Server\) enforceZKProjectWritePolicy)/, '');
if (/screeningBindingIndexes|StatementType|Bindings|validScreeningBindings/.test(policy)) throw Error('Baseline policy reconstruction failed');
writeFileSync(policyPath, policy);
run('gofmt', ['-w', policyPath]);
const archived = join(engine, '_archive/fluentxverse-custom-contracts-20261019');
const archiveManifest = JSON.parse(readFileSync(join(archived, 'MANIFEST.json')));
const screening = archiveManifest.files.find(f => f.path === 'internal/httpapi/screening.go');
if (sha(readFileSync(join(archived, screening.path))) !== screening.sha256) throw Error('Archived baseline digest mismatch');
copyFileSync(join(archived, screening.path), join(baseline, screening.path));

// The script runtime must otherwise be byte-identical to the currently running worker.
const worker = readFileSync(join(engine, 'scripts/zkverify.ts'), 'utf8');
const previousWorker = worker.replace("import { assertContributedGroth16Key } from './groth16-key-safety.ts';\n", '')
  .replace("if (request.action === 'submitProof' && (request.proofSystem || 'groth16').toLowerCase() === 'groth16') {\n  assertContributedGroth16Key(request.vk);\n}\n", '');
const liveWorker = run('docker', ['exec', 'budol-gmr-engine-1', 'cat', '/app/scripts/zkverify.ts']);
if (sha(previousWorker) !== sha(liveWorker)) throw Error('The local proof worker contains unrelated runtime changes');
run('docker', ['cp', 'budol-gmr-engine-1:/usr/local/bin/gmr-engine', join(release, 'previous-engine')]);
const buildEnv = { ...process.env, GOTOOLCHAIN: 'go1.25.14', CGO_ENABLED: '0', GOOS: 'linux', GOARCH: 'amd64', GOAMD64: 'v1' };
console.log('Building the prior Engine baseline with its exact Go toolchain.');
run('go', ['build', '-buildvcs=false', '-trimpath', '-ldflags=-s -w', '-o', join(release, 'baseline-engine'), './cmd/api'], { cwd: baseline, env: buildEnv });
const baselineMatched = sha(readFileSync(join(release, 'previous-engine'))) === sha(readFileSync(join(release, 'baseline-engine')));
writeFileSync(join(release, 'preparation.json'), JSON.stringify({ baseImage: old.Image, baselineMatched,
  currentBinarySHA256: sha(readFileSync(join(release, 'previous-engine'))), baselineBinarySHA256: sha(readFileSync(join(release, 'baseline-engine'))), files }, null, 2) + '\n');
if (!baselineMatched) throw Error('Baseline differs from the running binary; do not deploy this source snapshot');
console.log('PASS prior binary reproduced exactly. Building only the scoped security changes.');
run('go', ['build', '-buildvcs=false', '-trimpath', '-ldflags=-s -w', '-o', join(release, 'gmr-engine'), './cmd/api'], { cwd: source, env: buildEnv });
console.log('PASS scoped Engine candidate prepared without changing the live runtime.');
