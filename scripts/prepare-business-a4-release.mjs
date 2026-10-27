import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseline = join(root, 'output/release/container-stats-20261023');
const release = join(root, 'output/release/business-a4-pilot-20261024');
const previousDashboard = '60326031-5f7c-4222-b00b-caa7078047a2';
if (JSON.parse(readFileSync(join(baseline, 'dashboard-deployment.json'), 'utf8')).version !== previousDashboard) {
  throw Error('Review the dashboard baseline before preparing the A4 pilot.');
}
mkdirSync(release, { recursive: true });
if (!existsSync(join(release, 'frontend'))) {
  cpSync(join(baseline, 'frontend'), join(release, 'frontend'), {
    recursive: true, verbatimSymlinks: true,
    filter: path => !['node_modules', 'dist', '.wrangler'].includes(path.split('/').at(-1)),
  });
}
const files = [
  'src/pages/BusinessEnglishVisualEditor.tsx',
  'src/pages/BusinessEnglishPreview.tsx',
  'src/components/businessEnglish/a4Pagination.ts',
  'src/components/businessEnglish/BusinessEnglishA4Document.tsx',
  'src/components/businessEnglish/BusinessEnglishA4Document.css',
  'tests/businessA4Pagination.test.ts',
  'tests/browser/businessA4.cjs',
  'tests/browser/businessMaterialHeader.cjs',
];
const frontend = join(release, 'frontend/fluentxverse-dashboard');
const manifest = { createdAt: new Date().toISOString(), previousDashboard, files: {} };
for (const path of files) {
  const source = join(root, 'fluentxverse-dashboard', path);
  const target = join(frontend, path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  manifest.files[path] = createHash('sha256').update(readFileSync(source)).digest('hex');
}
const modules = join(frontend, 'node_modules');
if (!existsSync(modules)) symlinkSync(join(root, 'node_modules'), modules, 'dir');
writeFileSync(join(release, 'source-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Prepared A4 Lesson 1 pilot from the deployed dashboard baseline. No lesson data changed.');
