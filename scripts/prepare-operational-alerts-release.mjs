import { cpSync, copyFileSync, mkdirSync, readFileSync, readdirSync, symlinkSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { ssh } from './lib/cloud-ssh.mjs';
const root = process.cwd(), release = join(root, 'output/release/operational-alerts-20261024');
const baseline = join(root, 'output/release/business-a4-pilot-20261024');
const previousDashboard = JSON.parse(readFileSync(join(baseline, 'dashboard-deployment.json'))).version;
mkdirSync(release, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const live = await (await fetch('https://dashboard.fluentxverse.com/')).text();
const baselineSite = join(baseline, 'frontend/fluentxverse-dashboard');
if (live !== readFileSync(join(baselineSite, 'dist/index.html'), 'utf8')) throw Error('Dashboard baseline HTML changed.');
const script = live.match(/src="([^"]+\.js)"/)?.[1];
if (!script || hash(Buffer.from(await (await fetch('https://dashboard.fluentxverse.com' + script)).arrayBuffer())) !== hash(readFileSync(join(baselineSite, 'dist', script)))) throw Error('Dashboard baseline bundle changed.');
const frontend = join(release, 'frontend');
if (!existsSync(frontend)) cpSync(join(baseline, 'frontend'), frontend, { recursive: true, verbatimSymlinks: true,
  filter: path => !['node_modules','dist','.wrangler','output'].includes(path.split('/').at(-1)) });
const site = join(frontend, 'fluentxverse-dashboard');
if (!existsSync(join(site, 'node_modules'))) symlinkSync(join(root, 'node_modules'), join(site, 'node_modules'));
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); };
for (const path of ['src/pages/OperationalAlertsPage.tsx','src/pages/OperationalAlertsPage.css','src/api/operationalAlerts.api.ts',
  'src/components/OperationalAlertIndicator.tsx','src/components/OperationalAlertIndicator.css','tests/browser/operationalAlerts.cjs']) copy(join(root, 'fluentxverse-dashboard', path), join(site, path));
copy(join(root, 'shared/operationalAlerts.ts'), join(frontend, 'shared/operationalAlerts.ts'));
const insert = (path, before, after) => { const source = readFileSync(path, 'utf8'); if (source.includes(after)) return;
  if (source.split(before).length !== 2) throw Error('Baseline marker changed: ' + path); writeFileSync(path, source.replace(before, after)); };
insert(join(site,'src/App.tsx'), "const ContainerStatsPage = lazy(() => import('./pages/ContainerStatsPage'));", "const ContainerStatsPage = lazy(() => import('./pages/ContainerStatsPage'));\nconst OperationalAlertsPage = lazy(() => import('./pages/OperationalAlertsPage'));");
insert(join(site,'src/App.tsx'), '<Route path="/stats" component={ContainerStatsPage} />', '<Route path="/stats" component={ContainerStatsPage} />\n        <Route path="/alerts" component={OperationalAlertsPage} />');
insert(join(site,'src/components/Sidebar.tsx'), "{ path: '/stats', icon: 'ri-bar-chart-horizontal-line', label: 'Stats' },", "{ path: '/stats', icon: 'ri-bar-chart-horizontal-line', label: 'Stats' },\n  { path: '/alerts', icon: 'ri-alarm-warning-line', label: 'Alerts' },");
insert(join(site,'src/components/Sidebar.tsx'), "['/server-health', '/stats']", "['/server-health', '/stats', '/alerts']");
insert(join(site,'src/components/Header.tsx'), "import { useActivityClock } from '../hooks/useActivityClock';", "import { useActivityClock } from '../hooks/useActivityClock';\nimport { OperationalAlertIndicator } from './OperationalAlertIndicator';");
insert(join(site,'src/components/Header.tsx'), "'/stats':'Stats',", "'/stats':'Stats',\n  '/alerts':'Alerts',");
insert(join(site,'src/components/Header.tsx'), '<div className="header-right">', '<div className="header-right">\n        <OperationalAlertIndicator />');
const api = join(release, 'api'); mkdirSync(api, { recursive: true });
const apiImage = JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Config.Image}}'"));
const index = ssh('docker exec fluentxverse-server cat /app/src/index.ts');
if (index.includes('operationalAlertsRoute')) throw Error('Alerts already installed; do not reprepare deployment.');
copy(join(root, 'shared/operationalAlerts.ts'), join(api, 'shared/operationalAlerts.ts'));
copy(join(root, 'shared/containerStats.ts'), join(api, 'shared/containerStats.ts'));
writeFileSync(join(api, 'index.ts'), index);
insert(join(api, 'index.ts'), "import { containerStatsRoute } from './routes/containerStats.route';", "import { containerStatsRoute } from './routes/containerStats.route';\nimport { operationalAlertsRoute } from './routes/operationalAlerts.route';");
insert(join(api, 'index.ts'), '.use(containerStatsRoute)', '.use(containerStatsRoute)\n  .use(operationalAlertsRoute)');
for (const path of ['src/routes/operationalAlerts.route.ts','src/services/admin.services/operationalAlerts.service.ts',
  'src/services/admin.services/containerStats.service.ts','tests/operationalAlerts.test.ts']) copy(join(root, 'fluentxverse-server', path), join(api, path));
writeFileSync(join(api, 'Dockerfile'), `FROM ${apiImage}\nCOPY --chown=appuser:appgroup index.ts /app/src/index.ts\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\nCOPY shared/ /shared/\n`);
writeFileSync(join(release, 'source-manifest.json'), JSON.stringify({ previousDashboard, apiImage, apiIndexHash: hash(index),
  dashboardBundle: script, dashboardHash: hash(readFileSync(join(baselineSite, 'dist', script))), preparedAt: new Date().toISOString() }, null, 2));
execFileSync('bun',['run','build'],{cwd:site,stdio:'inherit'});
console.log('PASS scoped alerts release prepared against live API and dashboard.');
