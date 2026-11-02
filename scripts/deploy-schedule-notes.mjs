import {execFileSync,spawn} from 'node:child_process';
import {cpSync,existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync,realpathSync,symlinkSync,lstatSync} from 'node:fs';
import {join,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {ssh,quote,sshOptions,cloudTarget} from './lib/cloud-ssh.mjs';

const root=process.cwd(),id='schedule-notes-indicators-20261028',release=join(root,'output/release',id),stage='/opt/fluentxverse/releases/'+id;
const previousAPI='fluentxverse-cloud/api:admin-booking-settings-20261028',previousImageId='sha256:8b65c9821c9705b99ba447ebc28a3256c57e1de2fb1b2ea029c81b18ce01f290';
const previousWorker='b863aaf4-357e-44c2-bc4a-2a19f2ea829d',image='fluentxverse-cloud/api:'+id,compose='/opt/fluentxverse/releases/20261023/compose.private.json';
const app='fluentxverse-tutor-solid-prototype',cwd=join(release,'tutor/frontend',app);
const appFiles=['tutor/pages/SchedulePage.tsx','tutor/api/schedule.api.ts','tutor/utils/slotNotesIndicator.ts','tests/slotNotesIndicator.test.ts','tests/browser/scheduleNotes.cjs'];
const apiExisting=['src/services/schedule.services/schedule.service.ts','src/services/schedule.services/schedule.interface.ts','src/services/lessonWorkflow.service.ts'];
const apiNew=['src/utils/lessonNotesStatus.ts','tests/lessonNotesStatus.test.ts','tests/scheduleNotes.persistence.ts'];
const run=(cmd,args,options={})=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:8e6,...options});
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const write=(path,text)=>{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,text);};
const copy=(from,to)=>{mkdirSync(dirname(to),{recursive:true});cpSync(from,to);};
const replace=(text,from,to)=>{if(!text.includes(from))throw Error('Source marker changed: '+from);return text.replace(from,to);};
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc'],{cwd,env:{...process.env,CI:'1'}});
const guard=()=>{
 if(ssh("docker inspect fluentxverse-server --format '{{.Config.Image}} {{.Image}}'").trim()!==previousAPI+' '+previousImageId)throw Error('API baseline changed');
 const versions=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
 if(versions.length!==1||versions[0].version_id!==previousWorker||versions[0].percentage!==100)throw Error('Tutor baseline changed');
};
const fetchPublic=async url=>{let error;for(let i=0;i<3;i++){try{return await fetch(url,{signal:AbortSignal.timeout(20000)});}catch(e){error=e;await new Promise(resolve=>setTimeout(resolve,1000));}}throw error;};

if(process.argv.includes('--prepare')){
 if(existsSync(join(release,'built.json')))throw Error('Release already built');
 const baseline=join(root,'output/release/classroom-chat-panels-20261028/tutor/frontend'),destination=join(release,'tutor/frontend');
 cpSync(baseline,destination,{recursive:true,verbatimSymlinks:true,filter:path=>!['node_modules','dist','.wrangler'].includes(path.split('/').at(-1))&&!path.split('/').at(-1).startsWith('.env')&&!(lstatSync(path).isSymbolicLink()&&existsSync(join(destination,relative(baseline,path))))});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(baseline,app,'node_modules')),join(cwd,'node_modules'),'dir');
 guard();
 for(const file of appFiles)copy(join(root,app,file),join(cwd,file));
 for(const file of apiExisting){
  let text=ssh('docker exec fluentxverse-server cat '+quote('/app/'+file));write(join(release,'baseline',file),text);
  if(file.endsWith('schedule.service.ts')){
   text=replace(text,"import { getDriver } from '../../db/memgraph';","import { getDriver } from '../../db/memgraph';\nimport { lessonNotesStatus } from '../../utils/lessonNotesStatus';");
   text=replace(text,'        const history = ta303History.get(slot.slotId);',`        const history = ta303History.get(slot.slotId);
        const lessonStart = booking?.slotDateTime?.toStandardDate?.().getTime()
          ?? Date.parse(\`\${slot.slotDate}T\${this.convert12hTo24h(slot.slotTime)}:00+08:00\`);
        const lessonEnd = lessonStart + (Number(booking?.durationMinutes) || 25) * 60_000;`);
   text=replace(text,'          bookingId: booking?.bookingId,','          bookingId: booking?.bookingId,\n          lessonEndsAt: booking && Number.isFinite(lessonEnd) ? new Date(lessonEnd).toISOString() : undefined,\n          notesStatus: booking ? lessonNotesStatus(booking) : undefined,');
  }else if(file.endsWith('schedule.interface.ts'))text=replace(text,'    bookingId?: string;','    bookingId?: string;\n    lessonEndsAt?: string;\n    notesStatus?: \'draft\' | \'changes_pending\' | \'submitted\' | \'not_required\';');
  else{
   text=replace(text,"import { getDriver } from '../db/memgraph';","import { getDriver } from '../db/memgraph';\nimport { lessonNotesStatus } from '../utils/lessonNotesStatus';");
   text=replace(text,"    outcome: lessonOutcome(booking), notesStatus: booking.attendanceStudent === 'absent' || booking.attendanceTutor === 'absent' || booking.status === 'cancelled'\n      ? 'not_required' : booking.notesSubmittedAt ? (booking.notesDraftDirty ? 'changes_pending' : 'submitted') : 'draft',","    outcome: lessonOutcome(booking), notesStatus: lessonNotesStatus(booking),");
  }
  write(join(release,'api',file),text);
 }
 for(const file of apiNew)copy(join(root,'fluentxverse-server',file),join(release,'api',file));
 write(join(release,'api/Dockerfile'),`FROM ${previousAPI}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
 const files=Object.fromEntries([...apiExisting,...apiNew,'Dockerfile'].map(file=>['api/'+file,hash(join(release,'api',file))]));
 for(const file of appFiles)files['tutor/frontend/'+app+'/'+file]=hash(join(cwd,file));
 write(join(release,'manifest.json'),JSON.stringify({id,files,previousAPI,previousImageId,previousWorker},null,2));
 console.log('Prepared only schedule note-status changes over the live API and tutor app.');
}else if(process.argv.includes('--build')){
 guard();
 const manifest=JSON.parse(readFileSync(join(release,'manifest.json')));
 for(const [file,expected]of Object.entries(manifest.files))if(hash(join(release,file))!==expected)throw Error('Prepared source changed: '+file);
 console.log(run('bun',['run','build'],{cwd}));
 run('tar',['-czf',join(release,'api.tar.gz'),'-C',join(release,'api'),'.']);ssh('mkdir -p '+stage+'/api');
 run('scp',[...sshOptions,join(release,'api.tar.gz'),cloudTarget+':'+stage+'/api.tar.gz']);
 ssh('echo '+quote(hash(join(release,'api.tar.gz'))+'  '+stage+'/api.tar.gz')+' | sha256sum -c -');
 ssh(`tar -xzf ${stage}/api.tar.gz -C ${stage}/api`);
 console.log(ssh(`docker build --pull=false --network=none -t ${image} ${stage}/api`,{timeout:120000}));
 console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/schedule-notes-api.js`,{timeout:90000}));
 console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test ./tests/lessonNotesStatus.test.ts`,{timeout:30000}));
 write(join(release,'built.json'),JSON.stringify({imageId:ssh(`docker image inspect ${image} --format '{{.Id}}'`).trim(),htmlHash:hash(join(cwd,'dist/index.html'))},null,2));
}else if(process.argv.includes('--verify')){
 const built=JSON.parse(readFileSync(join(release,'built.json'))),fixture='fluentxverse-schedule-notes-qa';let created=false;
 try{
  ssh(`docker run -d --rm --network none --name ${fixture} fluentxverse-cloud/memgraph:20261023 --bolt-port=17738`);created=true;
  const ready="import{initDriver,closeDriver}from'./src/db/memgraph';await initDriver('bolt://127.0.0.1:17738','','',60,500);await closeDriver();";
  ssh(`docker run --rm --network container:${fixture} --entrypoint bun ${built.imageId} --no-env-file -e ${quote(ready)}`,{timeout:60000});
  console.log(ssh(`docker run --rm --network container:${fixture} -e NODE_ENV=test -e SCHEDULE_NOTES_TEST_URI=bolt://127.0.0.1:17738 --entrypoint bun ${built.imageId} --no-env-file test ./tests/scheduleNotes.persistence.ts`,{timeout:60000}));
 }finally{if(created)ssh('docker stop '+fixture);}
 const preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5273','--strictPort'],{cwd,stdio:'ignore',detached:true});
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5273/schedule')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
  if(!ready)throw Error('Preview unavailable');
  console.log(run('node',['tests/browser/scheduleNotes.cjs'],{cwd,env:{...process.env,TUTOR_TEST_URL:'http://127.0.0.1:5273'}}));
  write(join(release,'verification.json'),JSON.stringify({passed:true,...built,isolatedGraph:true,verifiedAt:new Date().toISOString()},null,2));
 }finally{try{process.kill(-preview.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--activate')){
 const manifest=JSON.parse(readFileSync(join(release,'manifest.json'))),built=JSON.parse(readFileSync(join(release,'built.json'))),verified=JSON.parse(readFileSync(join(release,'verification.json')));
 if(!verified.passed||verified.imageId!==built.imageId||verified.htmlHash!==built.htmlHash)throw Error('Verify exact builds first');
 for(const [file,expected]of Object.entries(manifest.files))if(hash(join(release,file))!==expected)throw Error('Prepared source changed');
 if(hash(join(cwd,'dist/index.html'))!==built.htmlHash||ssh(`docker image inspect ${image} --format '{{.Id}}'`).trim()!==built.imageId)throw Error('Verified builds changed');
 guard();
 const activity=`import{db,closePool}from'./src/db/postgres';import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();try{
 const r=await db.unsafe("SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'");
 const q=await s.run("MATCH(e:Exam) WHERE e.status IN ['generating','queued','processing'] RETURN count(e) AS n");
 const c=await s.run("MATCH(s:InterviewSlot {status:'booked'}) WHERE s.mediaClosedAt IS NULL AND s.date=$today RETURN count(s) AS n",{today:new Date(Date.now()+8*3600000).toISOString().slice(0,10)});
 if(r[0].n||Number(q.records[0].get('n'))||Number(c.records[0].get('n')))throw Error('Active classrooms, assessments or unfinished interviews; defer restart');console.log('No active classroom or assessment will be interrupted.');
 }finally{await s.close();await closeDriver();await closePool();}`;
 console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(activity)));
 const backup=stage+'/compose.rollback.private.json';
 const configure=`import json,os,shutil\np=${JSON.stringify(compose)}\nc=json.load(open(p))\nif c['services']['api']['image']!=${JSON.stringify(previousAPI)}: raise RuntimeError('Compose baseline changed')\nshutil.copy2(p,${JSON.stringify(backup)})\nc['services']['api']['image']=${JSON.stringify(image)}\nfd=os.open(p+'.next',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\nwith os.fdopen(fd,'w') as f: json.dump(c,f)\nos.replace(p+'.next',p)`;
 let worker;
 try{
  ssh('python3 -c '+quote(configure));console.log(ssh(`docker compose -f ${quote(compose)} up -d --no-deps --wait --wait-timeout 120 api`,{timeout:180000}));
  if(!(await fetchPublic('https://api.fluentxverse.com/health')).ok)throw Error('API health failed');
  const denied=await fetchPublic('https://api.fluentxverse.com/schedule/week');if(![401,403].includes(denied.status))throw Error('Schedule is not authenticated');
  const deployed=wrangler(['deploy']);console.log(deployed);worker=deployed.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];if(!worker)throw Error('Worker version missing');
  const dist=join(cwd,'dist'),html=await(await fetchPublic('https://tutor.fluentxverse.com/schedule')).text();
  const refs=text=>[...text.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]).sort();
  if(JSON.stringify(refs(html))!==JSON.stringify(refs(readFileSync(join(dist,'index.html'),'utf8'))))throw Error('Published HTML mismatch');
  for(const file of readdirSync(join(dist,'assets')).filter(file=>/\.(js|css)$/.test(file))){const response=await fetchPublic('https://tutor.fluentxverse.com/assets/'+file);if(!response.ok||createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')!==hash(join(dist,'assets',file)))throw Error('Asset mismatch: '+file);}
  console.log(run('node',['tests/browser/scheduleNotes.cjs'],{cwd,env:{...process.env,TUTOR_TEST_URL:'https://tutor.fluentxverse.com'}}));
  write(join(release,'deployment.json'),JSON.stringify({image,imageId:built.imageId,worker,previousWorker,previousAPI,publicAssetsVerified:true,deployedAt:new Date().toISOString()},null,2));
  console.log('PASS: Schedule note indicators deployed and verified.');
 }catch(error){if(worker)console.log(wrangler(['rollback',previousWorker,'--yes']));ssh(`test -f ${quote(backup)} && cp -p ${quote(backup)} ${quote(compose)} && docker compose -f ${quote(compose)} up -d --no-deps --wait --wait-timeout 120 api`,{timeout:180000});throw error;}
}else throw Error('Use --prepare, --build, --verify or --activate');
