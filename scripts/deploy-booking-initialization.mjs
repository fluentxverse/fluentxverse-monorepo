import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd(), id = 'booking-initialization-20261028-v3';
const release = join(root, 'output/release', id);
const apps = [
  {name:'student',directory:'fluentxverse-student-solid-prototype',previous:'7b925ceb-64a4-4c8f-8f9a-02855a576d7e',
   domains:['student.fluentxverse.com'],files:['tests/booking-initialization.cjs']},
];
const run = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 10e6, env: { ...process.env, CI: '1' } });
const cwd = app => join(release, app.name, 'frontend', app.directory);
const wrangler = (app, args) => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc'], cwd(app));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const guard = app => {
  const latest = JSON.parse(wrangler(app, ['deployments', 'list', '--json'])).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0];
  if (latest.versions.length !== 1 || latest.versions[0].version_id !== app.previous || latest.versions[0].percentage !== 100) throw Error(`${app.name} baseline changed`);
};
if (existsSync(release)) throw Error('Release already exists');
mkdirSync(release, { recursive: true });
const sources = {};
for (const app of apps) {
  cpSync(join(root, 'output/release/nickname-profile-cards-20261028', app.name, 'frontend'), join(release, app.name, 'frontend'), {
    recursive: true, verbatimSymlinks: true, filter: path => !['dist', '.wrangler'].includes(path.split('/').at(-1)) && !path.split('/').at(-1).startsWith('.env'),
  });
  guard(app);
  for (const file of app.files) {
    const target = join(cwd(app), file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, app.directory, file), target);
    sources[`${app.name}/${file}`] = hash(readFileSync(target));
  }
  // Keep the live booking layout; overlay only this task's initialization regions.
  const file='student/Components/Booking/BookingModal.tsx';
  const path=join(cwd(app),file), source=readFileSync(join(root,app.directory,file),'utf8');
  let scoped=readFileSync(path,'utf8');
  const replaceRegion=(oldStart,newStart,end)=>{
    const from=scoped.indexOf(oldStart),to=scoped.indexOf(end,from);
    const sourceFrom=source.indexOf(newStart),sourceTo=source.indexOf(end,sourceFrom);
    if([from,to,sourceFrom,sourceTo].some(i=>i<0))throw Error('Booking initialization marker changed');
    scoped=scoped.slice(0,from)+source.slice(sourceFrom,sourceTo)+scoped.slice(to);
  };
  replaceRegion('    createEffect(on(() => _props0.isOpen, async open => {','    let availabilityRequest = 0;','    const [isWalletConnecting');
  replaceRegion('    createEffect(on(() => [_props0["isOpen"], _state1.isAuthenticated], () => {','    const reconnectWallet = async () => {','    const reconnectWallet = async () => {');
  replaceRegion('    createEffect(on(() => [_props0["isOpen"], _props0["tutorId"]','    createEffect(on(() => [_props0["isOpen"], _props0["tutorId"]','    // Auto-select slot');
  replaceRegion('    const fetchAvailableSlots = async () => {','    const fetchAvailableSlots = async () => {','    const completeBooking');
  writeFileSync(path,scoped);sources[`${app.name}/${file}`]=hash(readFileSync(path));
  console.log(run('bun', ['run', 'build'], cwd(app)));
}
writeFileSync(join(release, 'manifest.json'), JSON.stringify({ id, apps, sources, preparedAt: new Date().toISOString(), apiUnchanged: true }, null, 2));
const preview = spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5271','--strictPort'],{cwd:cwd(apps[0]),stdio:'ignore',detached:true});
try {
  let ready=false;
  for(let i=0;i<60;i++) {
    try { if((await fetch('http://127.0.0.1:5271/home')).ok){ready=true;break;} } catch {}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!ready)throw Error('Scoped preview did not start');
  console.log(run('env',['STUDENT_TEST_URL=http://127.0.0.1:5271','node','tests/booking-initialization.cjs'],cwd(apps[0])));
} finally {try{process.kill(-preview.pid,'SIGTERM');}catch{}}
const deployed = [];
try {
  for (const app of apps) {
    guard(app);
    const result = wrangler(app, ['deploy']); console.log(result);
    const version = result.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];
    if (!version) throw Error('Missing deployment version');
    deployed.push({ name: app.name, version, previous: app.previous });
  }
  for (const app of apps) {
    const dist = join(cwd(app), 'dist');
    for (const domain of app.domains) {
      const response = await fetch(`https://${domain}/home`, { signal: AbortSignal.timeout(20000) });
      const html = await response.text();
      const refs = text => [...text.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m => m[1]).sort();
      if (!response.ok || JSON.stringify(refs(html)) !== JSON.stringify(refs(readFileSync(join(dist, 'index.html'), 'utf8')))) throw Error(`HTML mismatch: ${domain}`);
      for (const file of app.files.filter(file=>file.startsWith('public/'))) {
        const asset=await fetch(`https://${domain}/${file.slice(7)}`,{signal:AbortSignal.timeout(20000)});
        if(!asset.ok || hash(Buffer.from(await asset.arrayBuffer()))!==hash(readFileSync(join(cwd(app),file))))throw Error('Artwork asset mismatch: '+file);
      }
      for (const file of readdirSync(join(dist, 'assets')).filter(file => /\.(js|css)$/.test(file))) {
        const asset = await fetch(`https://${domain}/assets/${file}`, { signal: AbortSignal.timeout(20000) });
        if (!asset.ok || hash(Buffer.from(await asset.arrayBuffer())) !== hash(readFileSync(join(dist, 'assets', file)))) throw Error(`Asset mismatch: ${domain}/${file}`);
      }
    }
  }
  console.log(run('env', ['STUDENT_TEST_URL=https://student.fluentxverse.com', 'node', 'tests/booking-initialization.cjs'], cwd(apps[0])));
  writeFileSync(join(release, 'deployment.json'), JSON.stringify({ deployed, deployedAt: new Date().toISOString(), publicAssetsVerified: true, apiUnchanged: true }, null, 2));
  console.log('PASS: Coordinated booking initialization deployed; published assets, complete retries and session recovery verified. Booking policy unchanged.');
} catch (error) {
  for (const app of apps.slice().reverse()) if (deployed.some(item => item.name === app.name)) console.log(wrangler(app, ['rollback', app.previous, '--yes']));
  writeFileSync(join(release, 'rollback.json'), JSON.stringify({ reason: error.message, deployed, at: new Date().toISOString() }, null, 2));
  throw error;
}
