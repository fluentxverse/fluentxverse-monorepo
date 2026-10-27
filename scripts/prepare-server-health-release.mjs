import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ssh } from './lib/cloud-ssh.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = join(root, 'output/release/server-health-20261023');
const baseline = join(root, 'output/release/dashboard-login-recovery-20261023');
const previousDashboard = '398cd39c-6c8a-42ca-93ee-f77105073c17';
if (JSON.parse(readFileSync(join(baseline, 'dashboard-deployment.json'))).version !== previousDashboard) throw Error('Review dashboard baseline.');
mkdirSync(release, { recursive: true });
if (!existsSync(join(release, 'frontend'))) cpSync(join(baseline, 'frontend'), join(release, 'frontend'), {
  recursive: true, verbatimSymlinks: true,
  filter: path => !['dist', '.wrangler', 'node_modules'].includes(path.split('/').at(-1)),
});
const frontend = join(release, 'frontend/fluentxverse-dashboard');
const manifest = { createdAt: new Date().toISOString(), previousDashboard, files: {} };
function copy(from, to) { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); manifest.files[from.replace(root + '/', '')] = createHash('sha256').update(readFileSync(from)).digest('hex'); }
function insert(path, previous, next) {
  const value = readFileSync(path, 'utf8');
  if (value.includes(next)) return;
  if (value.split(previous).length !== 2) throw Error(`Changed baseline: ${path}`);
  writeFileSync(path, value.replace(previous, next));
}
for (const path of ['src/api/serverHealth.api.ts', 'src/pages/ServerHealthPage.tsx', 'src/pages/ServerHealthPage.css', 'tests/browser/serverHealth.cjs']) copy(join(root, 'fluentxverse-dashboard', path), join(frontend, path));
copy(join(root, 'shared/serverHealth.ts'), join(release, 'frontend/shared/serverHealth.ts'));
insert(join(frontend, 'src/App.tsx'), "const EmailPage = lazy(() => import('./pages/EmailPage'));", "const EmailPage = lazy(() => import('./pages/EmailPage'));\nconst ServerHealthPage = lazy(() => import('./pages/ServerHealthPage'));");
insert(join(frontend, 'src/App.tsx'), '<Route path="/testing" component={TestingPage} />', '<Route path="/testing" component={TestingPage} />\n        <Route path="/server-health" component={ServerHealthPage} />');
insert(join(frontend, 'src/components/Header.tsx'), "'/testing':'Testing',", "'/testing':'Testing',\n  '/server-health':'Server Health',");
insert(join(frontend, 'src/components/Sidebar.tsx'), "{ path: '/analytics', icon: 'ri-bar-chart-box-line', label: 'Analytics' },", "{ path: '/analytics', icon: 'ri-bar-chart-box-line', label: 'Analytics' },\n  { path: '/server-health', icon: 'ri-server-line', label: 'Server Health' },");
insert(join(frontend, 'src/components/Sidebar.tsx'), "(item.path !== '/recordings' || permissions.includes('qa'))", "(item.path !== '/recordings' || permissions.includes('qa')) &&\n      (item.path !== '/server-health' || permissions.includes('operations'))");

const api = join(release, 'api');
mkdirSync(api, { recursive: true });
const container = JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Image}}'"));
const index = ssh('docker exec fluentxverse-server cat /app/src/index.ts');
if (index.includes('serverHealthRoute')) throw Error('Cloud already has server metrics; review rather than overwrite.');
writeFileSync(join(api, 'index.ts'), index);
insert(join(api, 'index.ts'), "import Admin from './routes/admin.route';", "import Admin from './routes/admin.route';\nimport { serverHealthRoute } from './routes/serverHealth.route';");
insert(join(api, 'index.ts'), '.use(Admin)', '.use(Admin)\n  .use(serverHealthRoute)');
for (const path of ['src/routes/serverHealth.route.ts', 'src/services/admin.services/serverHealth.service.ts', 'tests/serverHealth.test.ts']) copy(join(root, 'fluentxverse-server', path), join(api, path));
copy(join(root, 'shared/serverHealth.ts'), join(api, 'shared/serverHealth.ts'));
writeFileSync(join(api, 'Dockerfile'), `FROM fluentxverse-cloud/api:20261023\nCOPY --chown=appuser:appgroup index.ts /app/src/index.ts\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\nCOPY shared/ /shared/\n`);
manifest.apiBaselineImage = container;
manifest.apiBaselineIndexHash = createHash('sha256').update(index).digest('hex');
writeFileSync(join(release, 'source-manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Prepared metrics-only API overlay and dashboard snapshot from pinned deployed versions.');
