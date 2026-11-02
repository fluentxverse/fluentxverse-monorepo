import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {ssh,quote,sshOptions,cloudTarget} from './lib/cloud-ssh.mjs';
const root=process.cwd(),id='notification-resolution-legacy-20261031',release=join(root,'output/release',id),stage='/opt/fluentxverse/releases/'+id;
const previous='fluentxverse-cloud/api:notification-resolution-20261031',previousId='sha256:14adb422d70e93bab70ba999d19ce0fb1af4c60aa723f55426a12d3dcfd16364';
const image='fluentxverse-cloud/api:'+id;
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:8e6});
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const write=(path,value)=>{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,value);};
const replace=(text,from,to)=>{if(!text.includes(from))throw Error('Missing release marker: '+from);return text.replace(from,to);};
const guard=()=>{if(ssh("docker inspect fluentxverse-server --format '{{.Config.Image}} {{.Image}}'").trim()!==previous+' '+previousId)throw Error('API baseline changed');};
const json=(name,value)=>write(join(release,name),JSON.stringify(value,null,2));
if(process.argv.includes('--prepare')){
 guard();
 const servicePath='src/services/notification.services/notification.service.ts';
 let service=ssh('docker exec fluentxverse-server cat '+quote('/app/'+servicePath));
 write(join(release,'baseline',servicePath),service);
 const source=readFileSync(join(root,'fluentxverse-server',servicePath),'utf8');
 const methods=source.slice(source.indexOf('  private lessonChecks'),source.indexOf('  /**'));
 if(!methods.includes('resolveLessonNotifications'))throw Error('Missing new reconciliation methods');
 service=replace(service,"import { notificationData, resolveLessonNotification } from './lessonNotification';","import { notificationData, resolveLessonNotification, lessonNotificationBookingId } from './lessonNotification';");
 const previousMethods=service.slice(service.indexOf('  private lessonChecks'),service.indexOf('  /**'));
 if(!previousMethods.includes('resolveLessonNotifications'))throw Error('Unexpected live reconciliation baseline');
 service=replace(service,previousMethods,methods);
 write(join(release,'api',servicePath),service);
 const reminderPath='src/services/notification.services/reminder.service.ts';
 let reminder=ssh('docker exec fluentxverse-server cat '+quote('/app/'+reminderPath));
 write(join(release,'baseline',reminderPath),reminder);
 if(!reminder.includes('AND (b.reminderSent IS NULL OR b.reminderSent = false)'))throw Error('Reminder precedence fix missing');
 write(join(release,'api',reminderPath),reminder);
 const paths=[servicePath,reminderPath,'src/services/notification.services/lessonNotification.ts','tests/lessonNotification.test.ts','tests/lessonNotification.integration.test.ts'];
 for(const path of paths.slice(2))write(join(release,'api',path),readFileSync(join(root,'fluentxverse-server',path)));
 write(join(release,'api/Dockerfile'),`FROM ${previous}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
 const files=Object.fromEntries([...paths,'Dockerfile'].map(path=>[path,hash(join(release,'api',path))]));
 json('manifest.json',{previous,previousId,files});
 console.log('Prepared legacy session-reminder follow-up over the verified notification API; dispute changes excluded.');
}else if(process.argv.includes('--build')){
 guard();
 const manifest=JSON.parse(readFileSync(join(release,'manifest.json')));
 for(const[file,expected]of Object.entries(manifest.files))if(hash(join(release,'api',file))!==expected)throw Error('Prepared source changed');
 run('tar',['-czf',join(release,'api.tar.gz'),'-C',join(release,'api'),'.']);ssh('mkdir -p '+stage+'/api');
 run('scp',[...sshOptions,join(release,'api.tar.gz'),cloudTarget+':'+stage+'/api.tar.gz']);
 ssh('echo '+quote(hash(join(release,'api.tar.gz'))+'  '+stage+'/api.tar.gz')+' | sha256sum -c -');
 ssh(`tar -xzf ${stage}/api.tar.gz -C ${stage}/api`);
 console.log(ssh(`docker build --pull=false --network=none -t ${image} ${stage}/api`,{timeout:120000}));
 console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/notification-resolution.js`,{timeout:90000}));
 console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test ./tests/lessonNotification.test.ts`,{timeout:30000}));
 const fixture='fluentxverse-notification-resolution-qa';let created=false;
 try{
  ssh(`docker run -d --rm --network none --name ${fixture} fluentxverse-cloud/memgraph:20261023 --bolt-port=17987`);created=true;
  const ready="import{initDriver,closeDriver}from'./src/db/memgraph';await initDriver('bolt://127.0.0.1:17987','','',60,500);await closeDriver();";
  ssh(`docker run --rm --network container:${fixture} --entrypoint bun ${image} --no-env-file -e ${quote(ready)}`,{timeout:60000});
  console.log(ssh(`docker run --rm --network container:${fixture} -e NODE_ENV=test -e NOTIFICATIONS_TEST_URI=bolt://127.0.0.1:17987 --entrypoint bun ${image} --no-env-file test ./tests/lessonNotification.integration.test.ts`,{timeout:60000}));
 }finally{if(created)ssh('docker stop '+fixture);}
 json('verification.json',{passed:true,imageId:ssh(`docker image inspect ${image} --format '{{.Id}}'`).trim(),files:manifest.files,isolatedGraph:true,checkedAt:new Date().toISOString()});
}else if(process.argv.includes('--activate')){
 guard();const verified=JSON.parse(readFileSync(join(release,'verification.json')));
 if(!verified.passed||ssh(`docker image inspect ${image} --format '{{.Id}}'`).trim()!==verified.imageId)throw Error('Verify exact image first');
 for(const[file,expected]of Object.entries(verified.files))if(hash(join(release,'api',file))!==expected)throw Error('Verified source changed');
 const activity=`import{db,closePool}from'./src/db/postgres';import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();try{
 const active=await db.unsafe("SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'");
 const exams=await s.run("MATCH(e:Exam) WHERE e.status IN ['generating','queued','processing'] RETURN count(e) AS n");
 const interviews=await s.run("MATCH(s:InterviewSlot {status:'booked'}) WHERE s.mediaClosedAt IS NULL AND s.date=$today RETURN count(s) AS n",{today:new Date(Date.now()+8*3600000).toISOString().slice(0,10)});
 if(active[0].n||Number(exams.records[0].get('n'))||Number(interviews.records[0].get('n')))throw Error('Active classroom, assessment or unfinished interview: defer restart');
 console.log('No active classroom, assessment or interview will be interrupted.');}finally{await s.close();await closeDriver();await closePool();}`;
 console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(activity)));
 const metadata=ssh('docker inspect fluentxverse-server --format '+quote('{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.project.config_files"}}|{{index .Config.Labels "com.docker.compose.service"}}')).trim().split('|');
 const[project,config,service]=metadata;
 if(!project||service!=='api'||!config?.split(',').every(file=>file.startsWith('/opt/fluentxverse/releases/')))throw Error('Unexpected live Compose ownership');
 const args=['docker','compose','-p',project,...config.split(',').flatMap(file=>['-f',file])];
 const override=stage+'/override.json',rollback=stage+'/rollback.json';
 const configure=`import json,os\nfor path,image in ${JSON.stringify([[override,image],[rollback,previous]])}:\n fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\n with os.fdopen(fd,'w') as f: json.dump({'services':{'api':{'image':image}}},f)`;
 const composeUp=file=>[...args,'-f',file,'up','-d','--no-deps','--wait','--wait-timeout','120',service].map(quote).join(' ');
 let activated=false;
 try{
  ssh('python3 -c '+quote(configure));
  activated=true;
  console.log(ssh(composeUp(override),{timeout:180000}));
  const health=await fetch('https://api.fluentxverse.com/health',{signal:AbortSignal.timeout(20000)});
  if(!health.ok)throw Error('Live API health failed');
  const denied=await fetch('https://api.fluentxverse.com/notifications',{signal:AbortSignal.timeout(20000)});
  if(![401,403].includes(denied.status))throw Error('Notifications must require authentication');
  json('deployment.json',{image,imageId:verified.imageId,previous,verified:true,disputeChangesPromoted:false,deployedAt:new Date().toISOString()});
 }catch(error){
  if(activated)ssh(composeUp(rollback),{timeout:180000});
  throw error;
 }
}else throw Error('Use --prepare, --build or --activate');
