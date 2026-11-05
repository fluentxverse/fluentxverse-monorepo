import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, realpathSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd(), app = 'fluentxverse-tutor-solid-prototype';
const release = join(root, 'output/release/tutor-report-modal-20261103');
const base = join(root, 'output/release/tutor-classroom-no-banner-20261103/frontend');
const cwd = join(release, 'frontend', app), file = 'tutor/assets/css/tutor-design.css';
const previous = '6eef890d-da06-46cc-a30e-777ca80d587a';
const sha = value => createHash('sha256').update(value).digest('hex');
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd, encoding: 'utf8', timeout: 240000, maxBuffer: 8e6, ...options });
const wrangler = args => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc']);
const guard = () => {
  const versions = JSON.parse(wrangler(['deployments', 'list', '--json'])).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
  if (versions.length !== 1 || versions[0].version_id !== previous) throw Error('Tutor baseline changed');
};
const record = (name, data) => writeFileSync(join(release, name), JSON.stringify(data, null, 2));
const test = url => console.log(run('node', ['tests/browser/classroomIssueReport.cjs'], { cwd: join(root,app), env: { ...process.env, TUTOR_ONLY: '1', TUTOR_TEST_URL: url } }));
if (process.argv.includes('--prepare')) {
  mkdirSync(release, { recursive: true });
  if (!existsSync(cwd)) cpSync(base, join(release, 'frontend'), { recursive: true, verbatimSymlinks: true, filter: p => !['node_modules','dist','.wrangler'].includes(p.split('/').at(-1)) && !p.split('/').at(-1).startsWith('.env') });
  if (!existsSync(join(cwd, 'node_modules'))) symlinkSync(realpathSync(join(base, app, 'node_modules')), join(cwd, 'node_modules'), 'dir');
  guard();
  const source = readFileSync(join(root,app,file));
  cpSync(join(root,app,file),join(cwd,file));
  console.log(run('bun', ['run', 'build']));
  record('manifest.json', { previous, source: sha(source), html: sha(readFileSync(join(cwd, 'dist/index.html'))) });
} else if (process.argv.includes('--verify')) {
  const child = spawn(process.execPath, [join(cwd, 'node_modules/vite/bin/vite.js'), 'preview','--host','127.0.0.1','--port','5310','--strictPort'], { cwd, detached: true, stdio: 'ignore' });
  try {
    let ready = false;
    for (let i=0;i<80;i++) { try { if ((await fetch('http://127.0.0.1:5310')).ok) { ready=true;break; } } catch {} await new Promise(r=>setTimeout(r,250)); }
    if (!ready) throw Error('Preview unavailable');
    test('http://127.0.0.1:5310');
    record('verification.json', { passed: true, html: sha(readFileSync(join(cwd, 'dist/index.html'))) });
  } finally { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
} else if (process.argv.includes('--deploy')) {
  const m=JSON.parse(readFileSync(join(release,'manifest.json'))), v=JSON.parse(readFileSync(join(release,'verification.json')));
  if (!v.passed || v.html!==m.html || m.html!==sha(readFileSync(join(cwd,'dist/index.html'))) || m.source!==sha(readFileSync(join(cwd,file)))) throw Error('Verify exact build first');
  guard(); let version;
  try {
    const output=wrangler(['deploy']);console.log(output);
    version=output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1]; if(!version) throw Error('Missing deployment version');
    for(const asset of readdirSync(join(cwd,'dist/assets')).filter(f=>/\.(js|css)$/.test(f))) {
      const r=await fetch('https://tutor.fluentxverse.com/assets/'+asset,{signal:AbortSignal.timeout(20000)});
      if(!r.ok || sha(Buffer.from(await r.arrayBuffer()))!==sha(readFileSync(join(cwd,'dist/assets',asset)))) throw Error('Published asset mismatch: '+asset);
    }
    test('https://tutor.fluentxverse.com');
    record('deployment.json',{previous,version,verified:true,apiUnchanged:true,studentUnchanged:true,at:new Date().toISOString()});
  } catch(error) { if(version) console.log(wrangler(['rollback',previous,'--yes']));throw error; }
} else throw Error('Use --prepare, --verify or --deploy');
