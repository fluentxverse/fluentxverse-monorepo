import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { studentPublicBuildEnv } from './lib/student-public-build-env.mjs';

const root = process.cwd(), release = join(root, 'output/release/listening-useful-language-20261111');
const baseline = 'output/release/conversation-tip-alignment-20261107';
const apps = [
  { role: 'dashboard', name: 'fluentxverse-dashboard', previous: '37381ce1-954a-45bc-87d5-3b4452806f26', source: 'src/pages/ConversationalSkillsPreview.tsx' },
  { role: 'tutor', name: 'fluentxverse-tutor-solid-prototype', previous: 'c8547aeb-5e0d-4ba9-8b76-021a7f0ae68f', source: 'tutor/pages/ConversationalSkillsLessonPage.tsx' },
  { role: 'student', name: 'fluentxverse-student-solid-prototype', previous: 'c4eca6cf-419d-4eba-84de-be1d0a15c7b9', source: 'student/pages/ConversationalSkillsLessonPage.tsx' },
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
const verify = live => console.log(run('node', ['scripts/tests/lesson6-please-dont-cancel.cjs'], { cwd: root, env: { ...process.env, LESSON6_RELEASE: release, LESSON6_LIVE: live ? '1' : '0' } }));

if (process.argv.includes('--prepare')) {
  if (existsSync(join(release, 'manifest.json'))) throw Error('Release already prepared');
  mkdirSync(release, { recursive: true });
  for (const app of apps) {
    guard(app, false);
    const destination = join(release, app.role, 'frontend');
    cpSync(join(root, baseline, app.role, 'frontend'), destination, { recursive: true, verbatimSymlinks: true, filter: p => !['node_modules', 'dist', '.wrangler', '.git'].includes(p.split('/').at(-1)) && !p.split('/').at(-1).startsWith('.env') });
    const modules = existsSync(join(root, app.name, 'node_modules')) ? join(root, app.name, 'node_modules') : join(root, 'node_modules');
    symlinkSync(realpathSync(modules), join(cwd(app), 'node_modules'), 'dir');
    const source = readFileSync(join(root, app.name, app.source), 'utf8');
    const start = source.indexOf('const renderListeningContent =');
    const end = source.indexOf('// Render discussion type content', start);
    const listening = source.slice(start, end);
    const addition = listening.match(/      \{(?:data|_props7\["data"\]).showGrammarTip[\s\S]*?      \)\}\n\n/);
    if (!addition || source.replace(addition[0], '') !== readFileSync(join(cwd(app), app.source), 'utf8')) throw Error('Expected only the listening useful-language block: ' + app.role);
    cpSync(join(root, app.name, app.source), join(cwd(app), app.source));
    app.sourceHash = hash(source);
    console.log(run('bun', ['run', 'build'], { cwd: cwd(app), env: env(app) }));
    const assetDir = join(cwd(app), 'dist/assets');
    app.htmlHash = hash(readFileSync(join(cwd(app), 'dist/index.html')));
    app.assets = Object.fromEntries(readdirSync(assetDir).filter(file => /\.(js|css)$/.test(file)).map(file => [file, hash(readFileSync(join(assetDir, file)))]));
  }
  save('manifest.json', { apps, change: 'Show configured useful language in listening challenges only', apiChanged: false });
  verify(false);
  save('verification.json', { passed: true, at: new Date().toISOString() });
} else if (process.argv.includes('--deploy')) {
  const manifest = read('manifest.json'), deployed = [];
  if (!read('verification.json').passed) throw Error('Verify first');
  for (const app of manifest.apps) {
    guard(app);
    if (hash(readFileSync(join(cwd(app), app.source))) !== app.sourceHash || hash(readFileSync(join(cwd(app), 'dist/index.html'))) !== app.htmlHash) throw Error('Prepared release changed');
    for (const [file, expected] of Object.entries(app.assets)) if (hash(readFileSync(join(cwd(app), 'dist/assets', file))) !== expected) throw Error('Prepared asset changed');
  }
  try {
    for (const app of manifest.apps) {
      guard(app);
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
    save('deployment.json', { deployed, verified: true, apiChanged: false, at: new Date().toISOString() });
  } catch (error) {
    for (const item of deployed.reverse()) {
      const app = manifest.apps.find(app => app.role === item.role);
      console.log(wrangler(app, ['rollback', item.previous, '--yes']));
    }
    throw error;
  }
} else throw Error('Use --prepare or --deploy');
