import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const teachingAccess = process.argv.includes('--teaching-access');
const applicantTabs = process.argv.includes('--applicant-tabs');
const root = process.cwd(), release = join(root, applicantTabs ? 'output/release/applicant-tabs-20261027' : teachingAccess ? 'output/release/teaching-access-20261026' : 'output/release/interview-calendar-20261026');
const tutor = 'fluentxverse-tutor-solid-prototype', frontend = join(release, 'frontend'), app = join(frontend, tutor);
const previous = applicantTabs ? '2302bada-5e64-487c-8ccb-9b0a1fd2e37a' : teachingAccess ? '44763936-3df1-4fd2-a138-c7848b1954dd' : 'da256ab6-3713-4fa0-b076-12e90bab1d0d';
const paths = applicantTabs ? ['tutor/index.tsx', 'tutor/pages/HomePage.tsx', 'tutor/pages/MyProfilePage.tsx', 'tutor/config/protectedPaths.ts', 'tests/browser/teachingAccess.cjs']
  : teachingAccess ? ['tutor/index.tsx', 'tutor/Components/ProtectedRoute.tsx', 'tutor/utils/teachingAccess.ts',
  'tutor/Components/IndexOne/SideBar.tsx', 'tutor/Components/Common/AttendanceReminder.tsx',
  'tutor/pages/HomePage.tsx', 'tutor/pages/MyProfilePage.tsx', 'tests/teachingAccess.test.ts',
  'tests/browser/teachingAccess.cjs', 'tests/browser/authFlows.cjs', 'tests/browser/performanceMetrics.cjs']
  : ['tutor/pages/InterviewBookingPage.tsx', 'tutor/pages/InterviewBookingPage.css', 'tests/browser/interviewCalendar.cjs'];
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...options });
const wrangler = args => run('npx', ['wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc'], { cwd: app, env: { ...process.env, CI: '1' } });
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const checkBaseline = () => {
  const latest = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0];
  if (latest.versions.length !== 1 || latest.versions[0].version_id !== previous || latest.versions[0].percentage !== 100) throw Error('Tutor deployment changed');
};
if (process.argv.includes('--prepare')) {
  if (existsSync(join(release, 'manifest.json'))) throw Error('Already prepared');
  mkdirSync(release, { recursive: true });
  cpSync(join(root, applicantTabs ? 'output/release/teaching-access-20261026/frontend' : teachingAccess ? 'output/release/interview-calendar-20261026/frontend' : 'output/release/read-aloud-screening-20261026/frontend'), frontend, { recursive: true, verbatimSymlinks: true,
    filter: path => !['node_modules', 'dist', '.wrangler'].includes(path.split('/').at(-1)) && !path.split('/').at(-1).startsWith('.env') });
  for (const path of [frontend, app]) symlinkSync(join(root, 'node_modules'), join(path, 'node_modules'));
  for (const path of paths) cpSync(join(root, tutor, path), join(app, path));
  checkBaseline();
  run('bun', ['run', 'build'], { cwd: app, stdio: 'inherit' });
  writeFileSync(join(release, 'manifest.json'), JSON.stringify({ previous, preparedAt: new Date().toISOString(),
    files: Object.fromEntries(paths.map(path => [path, hash(join(app, path))])), backendChanged: false }, null, 2));
} else if (process.argv.includes('--deploy')) {
  const manifest = JSON.parse(readFileSync(join(release, 'manifest.json')));
  for (const [path, expected] of Object.entries(manifest.files)) if (hash(join(app, path)) !== expected) throw Error('Release source changed');
  checkBaseline();
  const log = wrangler(['deploy']); console.log(log);
  const version = log.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
  if (!version) throw Error('Deployment version missing');
  const html = await fetch('https://tutor.fluentxverse.com/interview', { cache: 'no-store' });
  if (!html.ok || !Buffer.from(await html.arrayBuffer()).equals(readFileSync(join(app, 'dist/index.html')))) throw Error('Published HTML differs');
  writeFileSync(join(release, 'deployment.json'), JSON.stringify({ version, previous, deployedAt: new Date().toISOString(), backendChanged: false }, null, 2));
} else throw Error('Use --prepare or --deploy');
