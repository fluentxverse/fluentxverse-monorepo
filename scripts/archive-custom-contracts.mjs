import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engine = resolve(root, '../budol/gmr-engine');
const apply = process.argv.includes('--apply');
const verify = process.argv.includes('--verify');
const plans = [
  {
    root, destination: 'archive/custom-contracts-20261019',
    move: ['contracts/anonymous-reviews', 'contracts/lesson-passes', 'contracts/screening',
      'fluentxverse-server/scripts/deploy-anonymous-reviews.mjs', 'fluentxverse-server/scripts/deploy-lesson-passes.mjs',
      'fluentxverse-server/scripts/smoke-anonymous-reviews.mjs', 'fluentxverse-server/scripts/smoke-lesson-passes.mjs',
      'fluentxverse-server/tests/anonymousReviews.persistence.ts', 'fluentxverse-server/tests/lessonPasses.persistence.ts'],
    copy: ['fluentxverse-server/src/services/anonymousReviews/chain.ts', 'fluentxverse-server/src/services/anonymousReviews/service.ts',
      'fluentxverse-server/src/services/anonymousReviews/tallySnapshot.ts', 'fluentxverse-server/src/services/anonymousReviews/policy.ts',
      'fluentxverse-server/src/services/screening', 'fluentxverse-server/src/services/lessonPasses',
      'fluentxverse-server/src/routes/screening.route.ts', 'fluentxverse-server/src/routes/lessonPasses.route.ts',
      'fluentxverse-server/src/services/web3.services/gmrScreeningEngine.service.ts'],
  },
  {
    root: engine, destination: '_archive/fluentxverse-custom-contracts-20261019',
    move: ['contracts/screening', 'contracts/payouts', 'cmd/screening-provision',
      'scripts/screening-provision.ts', 'scripts/screening-provision.test.ts'],
    copy: ['internal/httpapi/screening.go', 'internal/httpapi/screening_test.go', 'scripts/screening.ts', 'scripts/screening-artifacts.ts', 'scripts/screening-worker.ts'],
  },
];
function files(base, path) {
  const full = join(base, path);
  if (!existsSync(full)) throw new Error(`Missing source: ${path}`);
  const stat = readdirIfDirectory(full);
  if (!stat) return [path];
  return stat.flatMap(entry => {
    if (entry.isSymbolicLink()) throw new Error(`Review symlink before archiving: ${path}/${entry.name}`);
    if (['node_modules', 'build', 'dist', '.git', '.deployment', 'cache', 'out'].includes(entry.name)) return [];
    if (/^\.env/.test(entry.name) && !entry.name.endsWith('.example')) return [];
    if (/\.(?:ptau|zkey|wtns|pem|key|log)$/.test(entry.name)) return [];
    return files(base, `${path}/${entry.name}`);
  });
}
function readdirIfDirectory(path) {
  try { return readdirSync(path, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOTDIR') return null; throw error; }
}
for (const plan of plans) {
  const target = join(plan.root, plan.destination);
  if (verify) {
    const manifest = JSON.parse(readFileSync(join(target, 'MANIFEST.json'), 'utf8'));
    for (const file of manifest.files) {
      if (file.path.startsWith('/') || file.path.split('/').includes('..') || !['move', 'copy'].includes(file.action)) throw Error('Invalid archive manifest');
      const hash = createHash('sha256').update(readFileSync(join(target, file.path))).digest('hex');
      if (hash !== file.sha256) throw Error(`Archive digest differs: ${file.path}`);
      if (file.action === 'move' && existsSync(join(plan.root, file.path))) throw Error(`Retired file is active again: ${file.path}`);
    }
    console.log(JSON.stringify({ archive: plan.destination, verified: manifest.files.length }));
    continue;
  }
  if (existsSync(join(target, 'MANIFEST.json'))) throw new Error(`Archive already exists: ${target}`);
  const entries = ['move', 'copy'].flatMap(action => plan[action].flatMap(path => files(plan.root, path).map(file => ({ action, path: file,
    sha256: createHash('sha256').update(readFileSync(join(plan.root, file))).digest('hex') }))));
  console.log(JSON.stringify({ archive: target, files: entries.length, apply }));
  if (!apply) continue;
  mkdirSync(target, { recursive: true });
  for (const item of entries) {
    const destination = join(target, item.path);
    if (existsSync(destination)) throw new Error(`Refusing to overwrite ${destination}`);
    mkdirSync(dirname(destination), { recursive: true });
    if (item.action === 'move') renameSync(join(plan.root, item.path), destination);
    else copyFileSync(join(plan.root, item.path), destination);
  }
  writeFileSync(join(target, 'MANIFEST.json'), JSON.stringify({ archivedAt: '2026-10-19', purpose: 'Retired custom application contract paths; historical code only, not an audited release', files: entries }, null, 2) + '\n', { flag: 'wx' });
}
