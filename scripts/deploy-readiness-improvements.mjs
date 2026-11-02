import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, symlinkSync, lstatSync, realpathSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { studentPublicBuildEnv } from './lib/student-public-build-env.mjs';

const cleanupFollowUp = process.argv.includes('--device-cleanup');
const root = process.cwd(), release = join(root, 'output/release', cleanupFollowUp ? 'readiness-device-cleanup-20261031' : 'readiness-improvements-20261031');
const env = { ...process.env, ...studentPublicBuildEnv(root), CI: '1' };
const apps = [
  { name: 'tutor', dir: 'fluentxverse-tutor-solid-prototype', previous: '1d3806ba-a97c-47c0-a166-60fcb452f057',
    baseline: 'tutor-kb-refresh-20261031', port: 5286, domain: 'tutor.fluentxverse.com' },
  { name: 'student', dir: 'fluentxverse-student-solid-prototype', previous: 'b4a05ca8-37c1-4bff-80cf-068f89daaab6',
    baseline: 'student-notification-contrast-20261030', port: 5287, domain: 'student.fluentxverse.com' },
];
if(cleanupFollowUp)for(const app of apps){
  app.baseline='readiness-improvements-20261031';
  app.previous=app.name==='tutor'?'218dba6b-37aa-46ca-b736-12c5c1823be4':'5402414a-7f1d-4fd9-b743-ed78a8f9c475';
}
const run = (cmd, args, cwd = root, extra = {}) => execFileSync(cmd, args, { cwd, env, encoding: 'utf8', maxBuffer: 8e6, ...extra });
const cwd = app => join(release, app.name, 'frontend', app.dir);
const hash = value => createHash('sha256').update(value).digest('hex');
const write = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, value); };
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); cpSync(from, to); };
const wrangler = (app, args) => run('bunx', ['--bun', 'wrangler@4.152.0', ...args, '--config', 'wrangler.jsonc'], cwd(app));
const guard = app => {
  const current = JSON.parse(wrangler(app, ['deployments', 'list', '--json'])).sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
  if (current.length !== 1 || current[0].version_id !== app.previous || current[0].percentage !== 100) throw Error('Live baseline changed: '+app.name);
};
const replace = (text, from, to) => { if (!text.includes(from)) throw Error('Missing release marker: '+from); return text.replace(from,to); };
const patchClassroom = (text, app) => {
  if (app.name === 'tutor') {
    text = replace(text, 'const [signalingConnected, setSignalingConnected] = createSignal(false);', 'const [classroomJoined, setClassroomJoined] = createSignal(false);\n    const [signalingConnected, setSignalingConnected] = createSignal(false);');
    text = replace(text, 'const onConnect = () => {', 'const onConnect = () => {\n                setClassroomJoined(false);');
    text = replace(text, 'const onDisconnect = () => {', 'const onDisconnect = () => {\n                setClassroomJoined(false);');
    text = replace(text, "setMediaProvider(previous => data.mediaProvider || previous || 'webrtc');", "setClassroomJoined(true);\n                setMediaProvider(previous => data.mediaProvider || previous || 'webrtc');");
  }
  text = replace(text, 'setSignalingError(data.message);', 'setClassroomJoined(false);\n                setSignalingError(data.message);');
  text = replace(text, 'return lessonStart.live;\n        } });', 'return classroomJoined() && lessonStart.live;\n        }, get prepare() {\n            return classroomJoined() && !lessonStart.closed;\n        } });');
  const state = app.name === 'tutor' ? '_state4' : '_state3';
  const marker = '        {lessonStart.wrapUp &&';
  const preview = `        {classroomJoined() && !lessonStart.live && !lessonStart.closed && <div class="classroom-device-preview" role="status">
            <span>{${state}.error || (${state}.localStream ? 'Device preview is private. Audio and video are shared only when the lesson starts.' : 'Preparing your camera and microphone...')}</span>
            {${state}.error && <button type="button" onClick={() => void ${state}.retryDevices().catch(() => {})}>Retry devices</button>}
        </div>}
`;
  return replace(text, marker, preview + marker);
};
const files = app => cleanupFollowUp ? [app.name+'/hooks/useWebRTC.ts'] : [
  `${app.name}/hooks/useClassroomMedia.ts`, `${app.name}/hooks/useWebRTC.ts`, `${app.name}/assets/css/app-theme.css`,
  'public/assets/css/dark-mode-gap-fix.css',
  ...(app.name === 'tutor' ? ['tutor/Components/Dashboard/FirstLessonGuide.tsx','tutor/Components/Dashboard/FirstLessonGuide.css',
    'tutor/pages/InterviewRoomPage.tsx','tutor/content/knowledgeBase.ts','tutor/utils/notificationLink.ts','tutor/types/notification.types.ts',
    'tests/browser/firstLessonGuide.cjs','tests/knowledgeBase.test.ts','tests/notificationLink.test.ts'] : []),
];
const published = async url => {
  let error;
  for (let i=0;i<3;i++) {
    try { const response=await fetch(url,{signal:AbortSignal.timeout(20000)}); if(response.ok)return response; error=Error(url+' '+response.status); await response.body?.cancel(); } catch(e){error=e;}
  }
  throw error;
};
if (process.argv.includes('--prepare')) {
  if (existsSync(join(release,'deployment.json'))) throw Error('Release already deployed');
  const sources={};
  for (const app of apps) {
    const baseline=join(root,'output/release',app.baseline,app.name,'frontend'), destination=join(release,app.name,'frontend');
    if (!existsSync(cwd(app))) cpSync(baseline,destination,{recursive:true,verbatimSymlinks:true,
      filter:path=>!['node_modules','dist','.wrangler'].includes(path.split('/').at(-1))&&!path.split('/').at(-1).startsWith('.env')&&!(lstatSync(path).isSymbolicLink()&&existsSync(join(destination,relative(baseline,path))))});
    if(!existsSync(join(cwd(app),'node_modules')))symlinkSync(realpathSync(join(baseline,app.dir,'node_modules')),join(cwd(app),'node_modules'),'dir');
    guard(app);
    for(const file of files(app)) { copy(join(root,app.dir,file),join(cwd(app),file)); sources[app.name+'/'+file]=hash(readFileSync(join(cwd(app),file))); }
    if(!cleanupFollowUp){
    const page=app.name+'/pages/ClassroomPage.tsx';
    write(join(cwd(app),page),patchClassroom(readFileSync(join(baseline,app.dir,page),'utf8'),app));
    sources[app.name+'/'+page]=hash(readFileSync(join(cwd(app),page)));
    }
    if(app.name==='tutor'&&!cleanupFollowUp) {
      const lesson='tutor/pages/StudentProfilePage.tsx';
      const text=replace(readFileSync(join(baseline,app.dir,lesson),'utf8'),"<p>{error() || 'Student not found'}</p>","<p>{error() || 'Student not found'}</p>\n            <a href=\"/schedule\">Return to My schedule</a>");
      write(join(cwd(app),lesson),text);sources[app.name+'/'+lesson]=hash(text);
      for(const file of readdirSync(join(root,app.dir,'public/assets/img/first-lesson')).filter(file=>/^(choose-material|save-lesson-notes|submit-lesson-notes)-/.test(file))){
        const path='public/assets/img/first-lesson/'+file;copy(join(root,app.dir,path),join(cwd(app),path));sources[app.name+'/'+path]=hash(readFileSync(join(cwd(app),path)));
      }
    }
    const shared='shared/ui/classroom-layout.css';
    copy(join(root,shared),join(destination,shared));sources[app.name+'/'+shared]=hash(readFileSync(join(destination,shared)));
    if(app.name==='tutor')console.log(run('bun',['test','./tests/notificationLink.test.ts','./tests/knowledgeBase.test.ts','./tests/classroomMedia.test.ts','./tests/firstLessonGuide.test.ts'],cwd(app)));
    console.log(run('bun',['run','build'],cwd(app)));
  }
  write(join(release,'manifest.json'),JSON.stringify({sources,apps,apiUnchanged:true},null,2));
} else if (process.argv.includes('--serve') || process.argv.includes('--verify')) {
  const processes=[];
  try {
    for(const app of apps) {
      const child=spawn(process.execPath,[join(cwd(app),'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(app.port),'--strictPort'],{cwd:cwd(app),env,stdio:'ignore',detached:true});processes.push(child);
      let ready=false;
      for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:'+app.port)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
      if(!ready)throw Error('Preview failed: '+app.name);
    }
    if(process.argv.includes('--serve')) { console.log('Tutor http://127.0.0.1:5286 Student http://127.0.0.1:5287'); await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);}); }
    else {
      const testEnv={...env,TUTOR_TEST_URL:'http://127.0.0.1:5286',STUDENT_TEST_URL:'http://127.0.0.1:5287'};
      for(const test of cleanupFollowUp?['scripts/tests/classroom-readiness.cjs']:['scripts/tests/classroom-readiness.cjs','scripts/tests/classroom-standardization.cjs','scripts/tests/theme-contrast.cjs'])console.log(run('node',[test],root,{env:testEnv}));
      if(!cleanupFollowUp){
      for(const test of ['firstLessonGuide.cjs','notificationsInbox.cjs','knowledgeBase.cjs'])console.log(run('node',['tests/browser/'+test],cwd(apps[0]),{env:testEnv}));
      console.log(run('node',['scripts/test-interview-chat.cjs'],root,{env:{...testEnv,INTERVIEW_TUTOR_URL:testEnv.TUTOR_TEST_URL,INTERVIEW_DASHBOARD_URL:'https://dashboard.fluentxverse.com'}}));
      }
      write(join(release,'verification.json'),JSON.stringify({passed:true,htmlHashes:Object.fromEntries(apps.map(app=>[app.name,hash(readFileSync(join(cwd(app),'dist/index.html')))])),checkedAt:new Date().toISOString()},null,2));
    }
  } finally { for(const child of processes)try{process.kill(-child.pid,'SIGTERM');}catch{} }
} else if(process.argv.includes('--activate')) {
  const verified=JSON.parse(readFileSync(join(release,'verification.json'))),manifest=JSON.parse(readFileSync(join(release,'manifest.json')));
  if(!verified.passed)throw Error('Verify first');
  for(const app of apps){guard(app);if(hash(readFileSync(join(cwd(app),'dist/index.html')))!==verified.htmlHashes[app.name])throw Error('Build changed');}
  for(const [key,expected]of Object.entries(manifest.sources)){
    const [name,...parts]=key.split('/'),app=apps.find(app=>app.name===name),file=parts.join('/');
    const path=file.startsWith('shared/')?join(release,name,'frontend',file):join(cwd(app),file);
    if(hash(readFileSync(path))!==expected)throw Error('Source changed: '+key);
  }
  const deployed=[];
  try {
    for(const app of apps){
      guard(app);const output=wrangler(app,['deploy']);console.log(output);
      const version=output.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];if(!version)throw Error('Missing version');
      deployed.push({name:app.name,version,previous:app.previous});
    }
    for(const app of apps){
      const dist=join(cwd(app),'dist');
      const refs=value=>[...value.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m=>m[1]).sort();
      const expected=refs(readFileSync(join(dist,'index.html'),'utf8'));
      let matching=false;
      for(let attempt=0;attempt<15;attempt++){
        const response=await published('https://'+app.domain+'/home'),html=await response.text(),actual=refs(html);
        if(JSON.stringify(actual)===JSON.stringify(expected)){matching=true;break;}
        write(join(release,'html-propagation-'+app.name+'.json'),JSON.stringify({attempt,at:new Date().toISOString(),url:response.url,cache:response.headers.get('cf-cache-status'),expected,actual},null,2));
        await new Promise(resolve=>setTimeout(resolve,3000));
      }
      if(!matching)throw Error('Live HTML mismatch: '+app.name);
      for(const file of readdirSync(join(dist,'assets')).filter(file=>/\.(js|css)$/.test(file))){
        if(hash(Buffer.from(await (await published('https://'+app.domain+'/assets/'+file)).arrayBuffer()))!==hash(readFileSync(join(dist,'assets',file))))throw Error('Live asset mismatch: '+file);
      }
      for(const key of Object.keys(manifest.sources).filter(key=>key.startsWith(app.name+'/public/'))){
        const file=key.slice(app.name.length+8);
        const expected=hash(readFileSync(join(cwd(app),'public',file)));
        let matching=false;
        for(let attempt=0;attempt<12;attempt++){
          const response=await published('https://'+app.domain+'/'+file),actual=hash(Buffer.from(await response.arrayBuffer()));
          if(actual===expected){matching=true;break;}
          write(join(release,'asset-propagation-'+app.name+'.json'),JSON.stringify({file,attempt,at:new Date().toISOString(),cache:response.headers.get('cf-cache-status'),type:response.headers.get('content-type'),actual,expected},null,2));
          await new Promise(resolve=>setTimeout(resolve,3000));
        }
        if(!matching)throw Error('Live public asset mismatch: '+app.name+'/'+file);
      }
    }
    const testEnv={...env,TUTOR_TEST_URL:'https://tutor.fluentxverse.com',STUDENT_TEST_URL:'https://student.fluentxverse.com'};
    for(const file of ['scripts/tests/classroom-readiness.cjs','scripts/tests/theme-contrast.cjs'])console.log(run('node',[file],root,{env:testEnv}));
    if(!cleanupFollowUp)console.log(run('node',['tests/browser/firstLessonGuide.cjs'],cwd(apps[0]),{env:testEnv}));
    write(join(release,'deployment.json'),JSON.stringify({deployed,apiUnchanged:true,verified:true,deployedAt:new Date().toISOString()},null,2));
  } catch(error) {for(const app of apps.slice().reverse())if(deployed.some(item=>item.name===app.name))console.log(wrangler(app,['rollback',app.previous,'--yes']));throw error;}
} else throw Error('Use --prepare, --serve, --verify or --activate');
