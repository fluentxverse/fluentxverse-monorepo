import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { studentPublicBuildEnv } from './lib/student-public-build-env.mjs';

const root = process.cwd(), id = 'student-social-login-20261028-v2';
const publicBuildEnv = studentPublicBuildEnv(root);
const release = join(root, 'output/release', id);
const apps = [
  {name:'student',directory:'fluentxverse-student-solid-prototype',previous:'0b5dbea6-298d-45d3-a723-cd9909b14dd5',
   domains:['student.fluentxverse.com'],files:['vite.config.ts','tests/guest-booking-login.cjs']},
];
const run = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 10e6, env: { ...process.env, ...publicBuildEnv, CI: '1' } });
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
  cpSync(join(root, 'output/release/booking-initialization-20261028-v3', app.name, 'frontend'), join(release, app.name, 'frontend'), {
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
  replaceRegion('    const fetchAvailableSlots = async () => {','    const fetchAvailableSlots = async () => {','    const completeBooking');
  replaceRegion('    const handleBookSlot = async () => {','    const handleBookSlot = async () => {','        if (!creditMode())');
  replaceRegion('                <button class="booking-modal-confirm"','                <button class="booking-modal-confirm"','\n');
  writeFileSync(path,scoped);sources[`${app.name}/${file}`]=hash(readFileSync(path));
  console.log(run('bun', ['run', 'build'], cwd(app)));
}
writeFileSync(join(release, 'manifest.json'), JSON.stringify({ id, apps, sources, preparedAt: new Date().toISOString(), apiUnchanged: true }, null, 2));
const preview = spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5271','--strictPort'],{cwd:cwd(apps[0]),env:{...process.env,...publicBuildEnv},stdio:'ignore',detached:true});
try {
  let ready=false;
  for(let i=0;i<60;i++) {
    try { if((await fetch('http://127.0.0.1:5271/home')).ok){ready=true;break;} } catch {}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!ready)throw Error('Scoped preview did not start');
  console.log(run('env',['STUDENT_TEST_URL=http://127.0.0.1:5271','node','tests/guest-booking-login.cjs'],cwd(apps[0])));
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
  console.log(run('env', ['STUDENT_TEST_URL=https://student.fluentxverse.com', 'VERIFY_LIVE_OAUTH=1', 'node', 'tests/guest-booking-login.cjs'], cwd(apps[0])));
  writeFileSync(join(release, 'deployment.json'), JSON.stringify({ deployed, deployedAt: new Date().toISOString(), publicAssetsVerified: true, apiUnchanged: true }, null, 2));
  console.log('PASS: Student social sign-in configuration and guest booking sign-in restored; published assets, SDK configuration and Google authorization redirect verified.');
} catch (error) {
  for (const app of apps.slice().reverse()) if (deployed.some(item => item.name === app.name)) console.log(wrangler(app, ['rollback', app.previous, '--yes']));
  writeFileSync(join(release, 'rollback.json'), JSON.stringify({ reason: error.message, deployed, at: new Date().toISOString() }, null, 2));
  throw error;
}
