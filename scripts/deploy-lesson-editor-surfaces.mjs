import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, realpathSync, symlinkSync, lstatSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd(), id = 'lesson-editor-surfaces-20261030', release = join(root, 'output/release', id);
const app = 'fluentxverse-tutor-solid-prototype', baseline = join(root, 'output/release/interview-chat-20261030/tutor/frontend');
const cwd = join(release, 'tutor/frontend', app), previous = '1d9d5427-296d-48d8-92a5-c633a0f4ff65';
const files = ['tutor/Components/LessonNotesEditor.css','tests/browser/lessonEditorSurfaces.cjs'];
const env = { ...process.env, CI: '1' };
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', env, maxBuffer: 8e6, ...options });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (file, text) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); };
const wrangler = args => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc'], { cwd });
const guard = () => {
  const versions = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0].versions;
  if (versions.length !== 1 || versions[0].version_id !== previous || versions[0].percentage !== 100) throw Error('Live dashboard baseline changed');
};
const published = async url => {
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (response.status < 500) return response;
      await response.body?.cancel(); failure = Error('Server returned ' + response.status);
    } catch (error) { failure = error; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw failure;
};
if (process.argv.includes('--prepare')) {
  if (existsSync(join(release, 'manifest.json')) && !process.argv.includes('--refresh')) throw Error('Release already prepared');
  cpSync(baseline, join(release, 'tutor/frontend'), { recursive: true, verbatimSymlinks: true,
    filter: path => !['node_modules', 'dist', '.wrangler'].includes(path.split('/').at(-1)) && !path.split('/').at(-1).startsWith('.env') && !(lstatSync(path).isSymbolicLink() && existsSync(join(release, 'tutor/frontend', relative(baseline, path)))) });
  if (!existsSync(join(cwd, 'node_modules'))) symlinkSync(realpathSync(join(baseline, app, 'node_modules')), join(cwd, 'node_modules'), 'dir');
  guard();
  const sources = {};
  for (const file of files) {
    const target = join(cwd, file); mkdirSync(dirname(target), { recursive: true }); cpSync(join(root, app, file), target); sources[file] = hash(readFileSync(target));
  }
  console.log(run('bun', ['test','tests/*.test.ts'], { cwd, shell: true }));
  console.log(run('bun', ['run', 'build'], { cwd }));
  write(join(release, 'manifest.json'), JSON.stringify({ id, previous, sources, htmlHash: hash(readFileSync(join(cwd, 'dist/index.html'))), apiUnchanged: true }, null, 2));
} else if (process.argv.includes('--verify')) {
  const preview = spawn(process.execPath, [join(cwd, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5282', '--strictPort'], { cwd, env, stdio: 'ignore', detached: true });
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch('http://127.0.0.1:5282/home')).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw Error('Preview unavailable');
    for (const test of ['lessonEditorSurfaces.cjs']) console.log(run('node', ['tests/browser/' + test], { cwd, env: { ...env, TUTOR_TEST_URL: 'http://127.0.0.1:5282' } }));
    write(join(release, 'verification.json'), JSON.stringify({ passed: true, htmlHash: hash(readFileSync(join(cwd, 'dist/index.html'))), verifiedAt: new Date().toISOString() }, null, 2));
  } finally { try { process.kill(-preview.pid, 'SIGTERM'); } catch {} }
} else if (process.argv.includes('--activate')) {
  const manifest = JSON.parse(readFileSync(join(release, 'manifest.json'))), verified = JSON.parse(readFileSync(join(release, 'verification.json')));
  if (!verified.passed || verified.htmlHash !== manifest.htmlHash || hash(readFileSync(join(cwd, 'dist/index.html'))) !== manifest.htmlHash) throw Error('Verify exact build first');
  for (const [file, expected] of Object.entries(manifest.sources)) if (hash(readFileSync(join(cwd, file))) !== expected) throw Error('Verified source changed');
  guard(); let version;
  try {
    const deployed = wrangler(['deploy']); console.log(deployed);
    version = deployed.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1]; if (!version) throw Error('Missing worker version');
    const dist = join(cwd, 'dist'), refs = text => [...text.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m => m[1]).sort();
    for (const domain of ['tutor.fluentxverse.com']) {
      const response = await published(`https://${domain}/home`), html = await response.text();
      if (!response.ok || JSON.stringify(refs(html)) !== JSON.stringify(refs(readFileSync(join(dist, 'index.html'), 'utf8')))) throw Error('Live HTML mismatch: ' + domain);
      for (const file of readdirSync(join(dist, 'assets')).filter(file => /\.(js|css)$/.test(file))) {
        const asset = await published(`https://${domain}/assets/${file}`);
        if (!asset.ok || hash(Buffer.from(await asset.arrayBuffer())) !== hash(readFileSync(join(dist, 'assets', file)))) throw Error('Live asset mismatch: ' + file);
      }
      for (const file of files.filter(file => file.startsWith('public/'))) {
        const asset = await published(`https://${domain}/${file.slice(7)}`);
        if (!asset.ok || hash(Buffer.from(await asset.arrayBuffer())) !== hash(readFileSync(join(cwd, file)))) throw Error('Live screenshot mismatch: ' + file);
      }
    }
    console.log(run('node', ['tests/browser/lessonEditorSurfaces.cjs'], { cwd, env: { ...env, TUTOR_TEST_URL: 'https://tutor.fluentxverse.com' } }));
    write(join(release, 'deployment.json'), JSON.stringify({ version, previous, apiUnchanged: true, publicAssetsVerified: true, deployedAt: new Date().toISOString() }, null, 2));
    console.log('PASS: Lesson editor surfaces deployed.');
  } catch (error) { if (version) console.log(wrangler(['rollback', previous, '--yes'])); throw error; }
} else throw Error('Use --prepare, --verify or --activate');
