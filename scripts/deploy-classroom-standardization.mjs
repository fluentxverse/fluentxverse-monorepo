import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, symlinkSync, lstatSync, realpathSync, unlinkSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { studentPublicBuildEnv } from './lib/student-public-build-env.mjs';
import { sharedChatPanels } from './lib/classroom-chat-panels.mjs';
const followUp=process.argv.includes('--chat-panels');
const root=process.cwd(),id=followUp?'classroom-chat-panels-20261028':'classroom-standardization-20261028',release=join(root,'output/release',id);
const env={...process.env,...studentPublicBuildEnv(root),CI:'1'};
const apps=[
 {name:'tutor',directory:'fluentxverse-tutor-solid-prototype',source:'tutor',previous:'1250fbd5-3060-4aa8-91a1-2ce18edf6b3a',baseline:'lesson-notes-surface-20261028-v2',port:5271,domain:'tutor.fluentxverse.com'},
 {name:'student',directory:'fluentxverse-student-solid-prototype',source:'student',previous:'d49afe06-bb7b-4e86-a032-caa7adb19596',baseline:'profile-booking-button-20261028',port:5272,domain:'student.fluentxverse.com'},
];
if(followUp)for(const app of apps){app.baseline='classroom-standardization-20261028';app.previous=app.name==='tutor'?'228e342c-b90b-4364-aec9-461462264e02':'42b2779d-9646-4daf-a02c-f4bf41a7812b';}
const shared=['ui/classroom-student-base.css','ui/classroom-layout.css','ui/ClassroomRecordingFlag.tsx','ui/LessonRecordingNotice.tsx','ui/lesson-recording-notice.css'];
if(followUp)shared.push('ui/ClassroomChatPanels.tsx');
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,env,encoding:'utf8',maxBuffer:8e6});
const cwd=app=>join(release,app.name,'frontend',app.directory);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(path,content)=>{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,content);};
const copy=(from,to)=>{mkdirSync(dirname(to),{recursive:true});cpSync(from,to);};
const wrangler=(app,args)=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc'],cwd(app));
const guard=app=>{
 const versions=JSON.parse(wrangler(app,['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
 if(versions.length!==1||versions[0].version_id!==app.previous||versions[0].percentage!==100)throw Error(app.name+' live baseline changed');
};
const replace=(text,from,to)=>{if(!text.includes(from))throw Error('Source marker changed: '+from);return text.replace(from,to);};
const fetchPublished=async url=>{
 let failure;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
   if(response.status<500)return response;
   await response.body?.cancel();failure=Error('Published server returned '+response.status);
  }catch(error){failure=error;}
  await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
 }
 throw failure;
};
if(process.argv.includes('--prepare')){
 if(existsSync(join(release,'deployment.json')))throw Error('Already deployed');
 const sources={};
 for(const app of apps){
  const baseline=join(root,'output/release',app.baseline,app.name,'frontend'),destination=join(release,app.name,'frontend');
  cpSync(baseline,destination,{
   recursive:true,verbatimSymlinks:true,filter:path=>!['dist','.wrangler','node_modules'].includes(path.split('/').at(-1))&&!path.split('/').at(-1).startsWith('.env')&&!(lstatSync(path).isSymbolicLink()&&existsSync(join(destination,relative(baseline,path)))),
  });
  const modules=join(cwd(app),'node_modules'),expectedModules=realpathSync(join(baseline,app.directory,'node_modules'));
  if(existsSync(modules)&&realpathSync(modules)!==expectedModules){if(!lstatSync(modules).isSymbolicLink())throw Error('Unexpected release dependencies');unlinkSync(modules);}
  if(!existsSync(modules))symlinkSync(expectedModules,modules,'dir');
  guard(app);
  const page=`${app.source}/pages/ClassroomPage.tsx`,path=join(cwd(app),page);
  let text=readFileSync(path,'utf8');
  if(followUp)text=sharedChatPanels(text);
  else{
  const styles="import '../../../shared/ui/classroom-student-base.css';\nimport '../../../shared/ui/classroom-layout.css';\nimport ClassroomRecordingFlag from '../../../shared/ui/ClassroomRecordingFlag';";
  text=replace(text,"import './ClassroomPage.css';",(app.name==='tutor'?"import './ClassroomPage.css';\n":'')+styles);
  text=replace(text,"    const [recordingAvailable, setRecordingAvailable] = createSignal(false);","    const [recordingAvailable, setRecordingAvailable] = createSignal(false);\n    const [recordingStatus, setRecordingStatus] = createSignal('');");
  text=replace(text,'return (<div class="classroom-container">',`return (<div class="classroom-container classroom-standardized classroom-role-${app.name}">`);
  if(app.name==='tutor'){
   text=replace(text,'src="/assets/img/logo/icon_logo.png"','src="/assets/img/logo/icon_logo.webp"');
   text=replace(text,'<TutorIcon name="fi fi-sr-comment-alt"/>','<TutorArt name="community" size={30}/>');
   text=replace(text,'<TutorIcon name="fi fi-sr-book-open-reader"/>','<TutorArt name="training" size={30}/>');
   text=replace(text,'<TutorIcon name="fas fa-clipboard-list"/>','<TutorArt name="schedule" size={30}/>');
   text=replace(text,'<TutorIcon name={materialTabIconClass()}/>','<TutorArt name={viewingDispatchArticle() ? \'dispatch\' : \'training\'} size={30}/>');
   text=replace(text,'<TutorArt name="training" size={32}/>','<TutorArt name="schedule" size={30}/>');
  }
  text=replace(text,'<ClassroomRecordingNotice socket={socketInstance()} provider={mediaProvider()} openRevision={recordingRevision()} onAvailabilityChange={setRecordingAvailable}/>',
   '<ClassroomRecordingNotice socket={socketInstance()} provider={mediaProvider()} openRevision={recordingRevision()} onAvailabilityChange={setRecordingAvailable} autoPrompt={false} onStatusChange={setRecordingStatus}/>\n        <ClassroomRecordingFlag available={recordingAvailable()} status={recordingStatus()} onPreferences={() => setRecordingRevision(value => value + 1)}/>');
  }
  write(path,text);sources[`${app.name}/${page}`]=hash(text);
  const notice=`${app.source}/Components/ClassroomRecordingNotice.tsx`;
  copy(join(root,app.directory,notice),join(cwd(app),notice));sources[`${app.name}/${notice}`]=hash(readFileSync(join(cwd(app),notice)));
  const lesson=app.name==='tutor'?'tutor/pages/StudentProfilePage.tsx':'student/pages/LessonPage.tsx';
  if(followUp){}
  else if(app.name==='tutor')copy(join(root,app.directory,lesson),join(cwd(app),lesson));
  else{
   let text=readFileSync(join(cwd(app),lesson),'utf8');
   text=replace(text,"import './LessonPage.css';","import './LessonPage.css';\nimport LessonRecordingNotice from '../../../shared/ui/LessonRecordingNotice';");
   text=replace(text,'<StudentLessonIssueReport bookingId={bookingId()!}/>','<StudentLessonIssueReport bookingId={bookingId()!}/>\n              <LessonRecordingNotice/>');
   write(join(cwd(app),lesson),text);
  }
  sources[`${app.name}/${lesson}`]=hash(readFileSync(join(cwd(app),lesson)));
  for(const file of shared){const target=join(release,app.name,'frontend/shared',file);copy(join(root,'shared',file),target);sources[`${app.name}/shared/${file}`]=hash(readFileSync(target));}
  for(const file of ['video-v1.webp','profile-v1.webp','training-v1.webp','schedule-v1.webp','community-v1.webp','dispatch-v1.png']){
   const path='public/assets/img/home-icons/'+file;
   copy(join(root,app.directory,path),join(cwd(app),path));sources[`${app.name}/${path}`]=hash(readFileSync(join(cwd(app),path)));
  }
  console.log(run('bun',['run','build'],cwd(app)));
 }
 write(join(release,'manifest.json'),JSON.stringify({id,apps,sources,apiUnchanged:true,preparedAt:new Date().toISOString()},null,2));
}else if(process.argv.includes('--verify')){
 const previews=[];
 try{
  for(const app of apps){
   const preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(app.port),'--strictPort'],{cwd:cwd(app),env,stdio:'ignore',detached:true});previews.push(preview);
   let ready=false;for(let i=0;i<80;i++){try{if((await fetch(`http://127.0.0.1:${app.port}/home`)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
   if(!ready)throw Error(app.name+' scoped preview failed');
  }
  console.log(run('node',['scripts/tests/classroom-standardization.cjs']));
  console.log(run('env',['TUTOR_TEST_URL=http://127.0.0.1:5271','node','tests/browser/recordingDialogDesign.cjs'],join(root,apps[0].directory)));
  console.log(run('env',['STUDENT_TEST_URL=http://127.0.0.1:5272','TEST_WIDTHS=1566,320','node','tests/student/classroomDesign.cjs'],join(root,apps[1].directory)));
  write(join(release,'verification.json'),JSON.stringify({passed:true,htmlHashes:Object.fromEntries(apps.map(app=>[app.name,hash(readFileSync(join(cwd(app),'dist/index.html')))])),verifiedAt:new Date().toISOString()},null,2));
 }finally{for(const preview of previews)try{process.kill(-preview.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--activate')){
 const verified=JSON.parse(readFileSync(join(release,'verification.json'))),manifest=JSON.parse(readFileSync(join(release,'manifest.json')));
 if(!verified.passed)throw Error('Verify the release first');
 for(const app of apps){guard(app);if(hash(readFileSync(join(cwd(app),'dist/index.html')))!==verified.htmlHashes[app.name])throw Error('Verified build changed');}
 for(const [file,expected]of Object.entries(manifest.sources)){
  const [name,...parts]=file.split('/'),app=apps.find(app=>app.name===name),relative=parts.join('/');
  const path=relative.startsWith('shared/')?join(release,name,'frontend',relative):join(cwd(app),relative);
  if(hash(readFileSync(path))!==expected)throw Error('Prepared source changed: '+file);
 }
 const deployed=[];
 try{
  for(const app of apps){guard(app);const result=wrangler(app,['deploy']);console.log(result);const version=result.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];if(!version)throw Error('Missing version');deployed.push({name:app.name,version,previous:app.previous});}
  for(const app of apps){
   const dist=join(cwd(app),'dist'),response=await fetchPublished(`https://${app.domain}/home`),html=await response.text();
   const refs=text=>[...text.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]).sort();
   if(!response.ok||JSON.stringify(refs(html))!==JSON.stringify(refs(readFileSync(join(dist,'index.html'),'utf8'))))throw Error('Published HTML mismatch');
   for(const file of readdirSync(join(dist,'assets')).filter(file=>/\.(js|css)$/.test(file))){
    const response=await fetchPublished(`https://${app.domain}/assets/${file}`);
    if(!response.ok||hash(Buffer.from(await response.arrayBuffer()))!==hash(readFileSync(join(dist,'assets',file))))throw Error('Published asset mismatch: '+app.name+'/'+file);
   }
  }
  console.log(run('env',['TUTOR_TEST_URL=https://tutor.fluentxverse.com','STUDENT_TEST_URL=https://student.fluentxverse.com','node','scripts/tests/classroom-standardization.cjs']));
  write(join(release,'deployment.json'),JSON.stringify({deployed,apiUnchanged:true,publicAssetsVerified:true,deployedAt:new Date().toISOString()},null,2));
  console.log('PASS: Shared classroom UI and QA notices deployed; recording authorization and role-specific teaching tools preserved.');
 }catch(error){for(const app of apps.slice().reverse())if(deployed.some(item=>item.name===app.name))console.log(wrangler(app,['rollback',app.previous,'--yes']));throw error;}
}else throw Error('Use --prepare, --verify or --activate');
