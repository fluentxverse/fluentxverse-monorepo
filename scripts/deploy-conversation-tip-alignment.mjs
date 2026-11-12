import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { studentPublicBuildEnv } from './lib/student-public-build-env.mjs';

const root = process.cwd(), release = join(root, 'output/release/conversation-tip-alignment-20261107');
const apps = [
  { role: 'dashboard', name: 'fluentxverse-dashboard', baseline: 'output/release/dashboard-dispatch-archives-20261105/frontend', previous: '9cfd426a-5e3c-4d5a-af1e-1f8bcf338302', css: 'src/pages/ConversationalSkillsPreview.css' },
  { role: 'tutor', name: 'fluentxverse-tutor-solid-prototype', baseline: 'output/release/dispatch-standard-20261105/tutor/frontend', previous: '7ddd6ecc-742e-4286-b9a3-6d5ee3bbe475', css: 'tutor/pages/ConversationalSkillsLessonPage.css' },
  { role: 'student', name: 'fluentxverse-student-solid-prototype', baseline: 'output/release/dispatch-standard-20261105/student/frontend', previous: 'f94a05db-7741-40db-b1c8-b21bc18cdca4', css: 'student/pages/ConversationalSkillsLessonPage.css' },
];
const cwd = app => join(release, app.role, 'frontend', app.name);
const env = app => ({ ...process.env, CI: '1', ...(app.role === 'student' ? studentPublicBuildEnv(root) : {}) });
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 8e6, timeout: 240000, ...options });
const wrangler = (app, args, prepared = true) => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc'], { cwd: prepared ? cwd(app) : join(root, app.name), env: env(app) });
const hash = value => createHash('sha256').update(value).digest('hex');
const save = (file, value) => writeFileSync(join(release, file), JSON.stringify(value, null, 2));
const read = file => JSON.parse(readFileSync(join(release, file), 'utf8'));
const guard = (app, prepared = true) => {
  const deployment = JSON.parse(wrangler(app, ['deployments', 'list', '--json'], prepared)).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0];
  if (deployment.versions.length !== 1 || deployment.versions[0].version_id !== app.previous || deployment.versions[0].percentage !== 100) throw Error('Live release changed: ' + app.role);
};
const verify = live => console.log(run('node', ['scripts/tests/conversation-tip-alignment.cjs'], { cwd: root, env: { ...process.env, TIP_ALIGNMENT_RELEASE: release, TIP_ALIGNMENT_LIVE: live ? '1' : '0' } }));

if (process.argv.includes('--prepare')) {
  if (existsSync(join(release, 'manifest.json'))) throw Error('Release already prepared');
  mkdirSync(release, { recursive: true });
  for (const app of apps) {
    guard(app, false);
    const destination = join(release, app.role, 'frontend');
    cpSync(join(root, app.baseline), destination, { recursive: true, verbatimSymlinks: true, filter: p => !['node_modules', 'dist', '.wrangler', '.git'].includes(p.split('/').at(-1)) && !p.split('/').at(-1).startsWith('.env') });
    symlinkSync(realpathSync(join(root, app.name, 'node_modules')), join(cwd(app), 'node_modules'), 'dir');
    cpSync(join(root, app.name, app.css), join(cwd(app), app.css));
    app.sourceHash = hash(readFileSync(join(cwd(app), app.css)));
    console.log(run('bun', ['run', 'build'], { cwd: cwd(app), env: env(app) }));
    const assetDir = join(cwd(app), 'dist/assets');
    const cssFiles = readdirSync(assetDir).filter(file => file.endsWith('.css') && readFileSync(join(assetDir, file), 'utf8').includes('.csp-tip-icon'));
    if (cssFiles.length !== 1) throw Error('Expected exactly one lesson stylesheet: ' + app.role);
    app.tipCss = cssFiles[0];
    app.htmlHash = hash(readFileSync(join(cwd(app), 'dist/index.html')));
    app.assets = Object.fromEntries(readdirSync(assetDir).filter(file => /\.(js|css)$/.test(file)).map(file => [file, hash(readFileSync(join(assetDir, file)))]));
  }
  save('manifest.json', { apps, cssOnlySourceChange: true, apiChanged: false });
  verify(false);
  save('verification.json', { passed: true, at: new Date().toISOString() });
} else if (process.argv.includes('--deploy')) {
  const manifest = read('manifest.json'), deployed = [];
  if (!read('verification.json').passed) throw Error('Verify first');
  for (const app of manifest.apps) {
    guard(app);
    if (hash(readFileSync(join(cwd(app), app.css))) !== app.sourceHash || hash(readFileSync(join(cwd(app), 'dist/index.html'))) !== app.htmlHash) throw Error('Prepared release changed');
    for (const [file, expected] of Object.entries(app.assets)) if (hash(readFileSync(join(cwd(app), 'dist/assets', file))) !== expected) throw Error('Prepared asset changed');
  }
  try {
    for (const app of manifest.apps) {
      const result = wrangler(app, ['deploy']); console.log(result);
      const version = result.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
      if (!version) throw Error('Missing deployed version');
      deployed.push({ role: app.role, previous: app.previous, version });
      save('deployment-progress.json', { deployed });
      for (const [file, expected] of Object.entries(app.assets)) {
        let matched = false;
        for (let attempt = 0; attempt < 6 && !matched; attempt++) {
          const bytes = run('curl', ['-fsS', '--retry', '2', '--max-time', '25', '-H', 'Cache-Control: no-cache', `https://${app.role}.fluentxverse.com/assets/${file}?release=${version}`], { encoding: null });
          matched = hash(bytes) === expected;
          if (!matched) await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if (!matched) throw Error('Live asset mismatch: ' + app.role + '/' + file);
      }
      const html = run('curl', ['-fsS', '--retry', '2', '--max-time', '25', `https://${app.role}.fluentxverse.com/`]);
      if (hash(html) !== app.htmlHash) throw Error('Live HTML mismatch: ' + app.role);
    }
    verify(true);
    save('deployment.json', { deployed, verified: true, cssOnlySourceChange: true, apiChanged: false, at: new Date().toISOString() });
  } catch (error) {
    for (const item of deployed.reverse()) {
      const app = manifest.apps.find(app => app.role === item.role);
      console.log(wrangler(app, ['rollback', item.previous, '--yes']));
    }
    throw error;
  }
} else throw Error('Use --prepare or --deploy');
