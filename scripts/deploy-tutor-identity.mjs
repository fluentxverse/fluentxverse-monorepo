import {execFileSync,spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,cpSync,existsSync,symlinkSync,realpathSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,dirname} from 'node:path';
import {ssh,quote,sshOptions,cloudTarget} from './lib/cloud-ssh.mjs';
const followup=process.argv.includes('--followup'),id=followup?'tutor-identity-admin-20261102':'tutor-identity-20261102';
const root=process.cwd(),release=join(root,'output/release',id);
const previous=followup?'fluentxverse-cloud/api:tutor-identity-20261102':'fluentxverse-cloud/api:notification-resolution-legacy-20261031',image='fluentxverse-cloud/api:'+id;
const existing=['src/index.ts','src/utils/jwt.ts','src/services/exam.services/applicationPolicy.ts','src/services/auth.services/tutor.service.ts','src/services/interview.services/interview.service.ts','src/socket/handlers/interview.handler.ts','src/services/lessonIssueImages.ts','src/services/schedule.services/schedulingGuards.ts','src/services/schedule.services/schedule.service.ts','src/services/tutor.services/tutor.service.ts'];
const fresh=['src/routes/tutorIdentity.route.ts',...['service','storage','schema','worker'].map(f=>'src/services/tutorIdentity/'+f+'.ts')];
const write=(p,data)=>{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,data);};
const run=(cmd,args,opts={})=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:10e6,...opts});
if(process.argv.includes('--inspect')){
  for(const f of existing){try{write(join(release,'baseline',f),ssh('docker exec fluentxverse-server cat '+quote('/app/'+f)));}catch{console.log('Missing baseline: '+f);}}
  console.log(ssh("docker inspect fluentxverse-server --format '{{.Image}}'"));
}else if(process.argv.includes('--prepare') && followup){
  cpSync(join(root,'output/release/tutor-identity-20261102/api'),join(release,'api'),{recursive:true});
  for(const f of fresh)write(join(release,'api',f),readFileSync(join(root,'fluentxverse-server',f)));
  const f='src/services/admin.services/admin.service.ts';
  let service=ssh('docker exec fluentxverse-server cat '+quote('/app/'+f)),source=readFileSync(join(root,'fluentxverse-server',f),'utf8');
  for(const name of ['getApplications','getTutors']){
    const start=service.indexOf('  async '+name+'('),end=service.indexOf('\n  /**',start);
    const a=source.indexOf('  async '+name+'('),b=source.indexOf('\n  /**',a);
    if(start<0||end<0||a<0||b<0)throw Error('Missing method');service=service.slice(0,start)+source.slice(a,b)+service.slice(end);
  }
  write(join(release,'api',f),service);
  const iface='src/services/admin.services/admin.interface.ts';
  write(join(release,'api',iface),ssh('docker exec fluentxverse-server cat '+quote('/app/'+iface)).replace('export interface TutorListItem {','export interface TutorListItem {\n  identityStatus?: string;'));
  write(join(release,'api/shared/tutorApplications.ts'),readFileSync(join(root,'shared/tutorApplications.ts')));
  write(join(release,'api/Dockerfile'),`FROM ${previous}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup shared/ /shared/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
}else if(process.argv.includes('--prepare')){
  for(const f of existing.filter(f=>!['src/index.ts','src/services/schedule.services/schedule.service.ts','src/services/lessonIssueImages.ts'].includes(f)))write(join(release,'api',f),readFileSync(join(root,'fluentxverse-server',f)));
  write(join(release,'api/src/services/lessonIssueImages.ts'),readFileSync(join(root,'fluentxverse-server/src/services/lessonIssueImages.ts')));
  const replace=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Ambiguous baseline marker: '+a);return s.replace(a,b);};
  let index=readFileSync(join(release,'baseline/src/index.ts'),'utf8');
  index=replace(index,"import Interview from './routes/interview.route';","import Interview from './routes/interview.route';\nimport TutorIdentity from './routes/tutorIdentity.route';\nimport { startTutorIdentityWorker } from './services/tutorIdentity/worker';");
  index=replace(index,'  .use(Interview)','  .use(Interview)\n  .use(TutorIdentity)');
  index=replace(index,'  startSpeakingWorker();','  startSpeakingWorker();\n  startTutorIdentityWorker();');
  index=replace(index,"    if (path.startsWith('/exam/')) {",`    if (path.startsWith('/tutor-identity/')) {
      const failure = applicationFailure(error);
      set.status = ['VALIDATION', 'PARSE'].includes(String(code)) ? 400 : failure.status;
      set.headers['Cache-Control'] = 'private, no-store';
      return { success: false, error: set.status === 400 ? 'Invalid identity request.' : failure.message };
    }
    if (path.startsWith('/exam/')) {`);
  write(join(release,'api/src/index.ts'),index);
  let schedule=readFileSync(join(release,'baseline/src/services/schedule.services/schedule.service.ts'),'utf8');
  schedule=replace(schedule,'u.profileStatus as profileStatus, u.email as email`,','u.profileStatus as profileStatus, u.email as email,\n           u.identityBanned AS identityBanned,u.identityRequired AS identityRequired,u.identityVerified AS identityVerified`,');
  schedule=replace(schedule,'      if (certificationResult.records.length > 0) {',`      if (certificationResult.records.length > 0) {
        const identity = certificationResult.records[0]!;
        if (identity.get('identityBanned') === true || (identity.get('identityRequired') === true && identity.get('identityVerified') !== true))
          throw new Error('This tutor needs identity approval before accepting lessons.');`);
  write(join(release,'api/src/services/schedule.services/schedule.service.ts'),schedule);
  for(const f of fresh)write(join(release,'api',f),readFileSync(join(root,'fluentxverse-server',f)));
  for(const f of ['shared/tutorIdentity.ts'])write(join(release,'api',f),readFileSync(join(root,f)));
  for(const f of ['tutorIdentity.test.ts','tutorIdentity.http.test.ts'])write(join(release,'api/tests',f),readFileSync(join(root,'fluentxverse-server/tests',f)));
  write(join(release,'api/Dockerfile'),`FROM ${previous}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup shared/ /shared/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
}else if(process.argv.includes('--build')){
  run('tar',['-czf',join(release,'api.tar.gz'),'-C',join(release,'api'),'.']);
  const stage='/opt/fluentxverse/releases/'+id;
  ssh('mkdir -p '+stage+'/api');
  run('scp',[...sshOptions,join(release,'api.tar.gz'),cloudTarget+':'+stage+'/api.tar.gz']);
  console.log(ssh(`tar -xzf ${stage}/api.tar.gz -C ${stage}/api && docker build --network=none -t ${image} ${stage}/api`,{timeout:120000}));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/identity.js`,{timeout:90000}));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test tests/tutorIdentity.test.ts tests/tutorIdentity.http.test.ts`,{timeout:60000}));
}else if(process.argv.includes('--frontends')){
  if(followup){
    const base=join(root,'output/release/tutor-identity-20261102/dashboard/frontend'),dest=join(release,'dashboard/frontend');
    cpSync(base,dest,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))});
    const cwd=join(dest,'fluentxverse-dashboard');symlinkSync(realpathSync(join(base,'fluentxverse-dashboard/node_modules')),join(cwd,'node_modules'),'dir');
    const page=join(cwd,'src/pages/TutorsPage.tsx');let s=readFileSync(page,'utf8');
    s=s.replace('<th key="status" scope="col">Status</th>','<th key="status" scope="col">Status</th><th>Profile approval</th><th>Identity verification</th>');
    s=s.replace('<col key="status" className="status-column" />','<col key="status" className="status-column" /><col className="status-column" /><col className="status-column" />');
    s=s.replace('<td key="status">{getStatusBadge(tutor)}</td>',`<td key="status">{getStatusBadge(tutor)}</td><td>{(tutor.profileStatus || 'incomplete').replaceAll('_',' ')}</td><td><a href="/identity-reviews">{(tutor.identityStatus || 'not_submitted').replaceAll('_',' ')}</a></td>`);write(page,s);
    const api=join(cwd,'src/api/admin.api.ts');write(api,readFileSync(api,'utf8').replace('export interface TutorListItem {','export interface TutorListItem {\n identityStatus?: string;'));
    const apps=join(cwd,'src/pages/ApplicationsPage.tsx'),marker='  const getStatusInfo = (app: TutorApplication) => {';
    const insert=readFileSync(join(root,'fluentxverse-dashboard/src/pages/ApplicationsPage.tsx'),'utf8').split(marker)[1].split('\n')[1];
    write(apps,readFileSync(apps,'utf8').replace(marker,marker+'\n'+insert));
    write(join(dest,'shared/tutorApplications.ts'),readFileSync(join(root,'shared/tutorApplications.ts')));
    console.log(run('bun',['run','build'],{cwd}));process.exit(0);
  }
  const apps=[{name:'tutor',dir:'fluentxverse-tutor-solid-prototype',baseline:'readiness-device-cleanup-20261031',files:['tutor/pages/InterviewBookingPage.tsx','tutor/Components/IdentitySubmission.tsx']},
    {name:'dashboard',dir:'fluentxverse-dashboard',baseline:'interview-chat-20261030',files:['src/App.tsx','src/components/Sidebar.tsx','src/pages/InterviewSchedulePage.tsx','src/pages/InterviewRoomPage.tsx','src/components/IdentityReview.tsx','src/pages/IdentityReviewsPage.tsx']}];
  for(const app of apps){
    const base=join(root,'output/release',app.baseline,app.name,'frontend'),dest=join(release,app.name,'frontend'),cwd=join(dest,app.dir);
    if(!existsSync(cwd))cpSync(base,dest,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
    if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(base,app.dir,'node_modules')),join(cwd,'node_modules'),'dir');
    for(const file of [...app.files.map(f=>app.dir+'/'+f),'shared/tutorIdentity.ts','shared/ui/tutor-identity.css'])write(join(dest,file),readFileSync(join(root,file)));
    console.log(run('bun',['run','build'],{cwd,env:{...process.env,CI:'1'}}));
  }
}else if(process.argv.includes('--verify-frontends')){
  const children=[];
  try{
    for(const [name,dir,port] of [['tutor','fluentxverse-tutor-solid-prototype',5194],['dashboard','fluentxverse-dashboard',5193]]){
      const cwd=join(release,name,'frontend',dir);
      const child=spawn('bunx',['vite','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd,stdio:'ignore',detached:true});children.push(child);
      let ready=false;for(let n=0;n<60;n++){try{if((await fetch('http://127.0.0.1:'+port)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}if(!ready)throw Error('Preview failed');
    }
    console.log(run('node',['scripts/tests/tutor-identity-ui.cjs'],{env:{...process.env,IDENTITY_TUTOR_URL:'http://127.0.0.1:5194',IDENTITY_DASHBOARD_URL:'http://127.0.0.1:5193'}}));
    write(join(release,'frontend-verification.json'),JSON.stringify({passed:true,at:new Date().toISOString()}));
  }finally{for(const child of children)try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--activate-api')){
  if(ssh("docker inspect fluentxverse-server --format '{{.Config.Image}}'").trim()!==previous)throw Error('API baseline changed');
  const activity=`import{db,closePool}from'./src/db/postgres';import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();try{const active=await db.unsafe("SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'");const exams=await s.run("MATCH(e:Exam) WHERE e.status IN ['generating','queued','processing'] RETURN count(e) AS n");if(active[0].n||Number(exams.records[0].get('n')))throw Error('Active classroom or assessment: defer restart');console.log('No active classrooms or grading jobs.');}finally{await s.close();await closeDriver();await closePool();}`;
  console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(activity)));
  const interviewActivity=`import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';import{interviewStart}from'./src/services/interview.services/interviewTime';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();try{const r=await s.run("MATCH(s:InterviewSlot {status:'booked'}) WHERE s.mediaClosedAt IS NULL RETURN s.date AS date,s.time AS time");if(r.records.some(r=>{const start=interviewStart(r.get('date'),r.get('time'));return Date.now()>=start-900000&&Date.now()<start+1800000;}))throw Error('Interview in progress or imminent: defer restart');console.log('No interview in progress or imminent.');}finally{await s.close();await closeDriver();}`;
  console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(interviewActivity)));
  const[project,configs,service]=ssh('docker inspect fluentxverse-server --format '+quote('{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.project.config_files"}}|{{index .Config.Labels "com.docker.compose.service"}}')).trim().split('|');
  if(service!=='api'||!configs.split(',').every(f=>f.startsWith('/opt/fluentxverse/releases/')))throw Error('Unexpected Compose owner');
  const stage='/opt/fluentxverse/releases/'+id,override=stage+'/override.json',rollback=stage+'/rollback.json';
  const config={services:{api:{image,environment:{TUTOR_IDENTITY_ENABLED:'false'}}}};
  ssh('python3 -c '+quote(`import os,json\nfor path,data in ${JSON.stringify([[override,config],[rollback,{services:{api:{image:previous}}}]])}:\n fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\n with os.fdopen(fd,'w') as f: json.dump(data,f)`));
  const up=f=>['docker','compose','-p',project,...configs.split(',').flatMap(f=>['-f',f]),'-f',f,'up','-d','--no-deps','--wait','--wait-timeout','120','api'].map(quote).join(' ');
  try{
    console.log(ssh(up(override),{timeout:180000}));
    const health=await fetch('https://api.fluentxverse.com/health',{signal:AbortSignal.timeout(20000)});if(!health.ok)throw Error('API health failed');
    const auth=await fetch('https://api.fluentxverse.com/tutor-identity/status');if(auth.status!==401)throw Error('Identity authentication check failed');
    write(join(release,'api-deployment.json'),JSON.stringify({image,previous,collectionEnabled:false,at:new Date().toISOString()},null,2));
  }catch(error){console.log(ssh(up(rollback),{timeout:180000}));throw error;}
}else if(process.argv.includes('--deploy-frontends')){
  if(!followup && !JSON.parse(readFileSync(join(release,'frontend-verification.json'))).passed)throw Error('Verify first');
  const apps=followup?[['dashboard','fluentxverse-dashboard','129253ea-545e-479b-812c-4834ac9272c6']]:[['tutor','fluentxverse-tutor-solid-prototype','2f2644c9-2e16-45ca-bb0d-aa031cc84a62'],['dashboard','fluentxverse-dashboard','f2892a87-ce95-4b6b-bdae-d9525d41982b']];
  const deployed=[];
  for(const[name,dir,expected]of apps){
    const cwd=join(release,name,'frontend',dir),wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc'],{cwd,env:{...process.env,CI:'1'}});
    const latest=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];
    if(latest.versions.length!==1||latest.versions[0].version_id!==expected)throw Error('Frontend baseline changed: '+name);
    const output=wrangler(['deploy']);console.log(output);deployed.push({name,previous:expected,output});
    write(join(release,'frontend-deployment.json'),JSON.stringify(deployed,null,2));
  }
}else if(process.argv.includes('--verify-live')){
  const hash=b=>createHash('sha256').update(b).digest('hex');
  for(const[name,dir,domain]of [['tutor','fluentxverse-tutor-solid-prototype','tutor.fluentxverse.com'],['dashboard','fluentxverse-dashboard','dashboard.fluentxverse.com']]){
    const dist=join(release,name,'frontend',dir,'dist');
    const html=await(await fetch('https://'+domain)).text(),refs=s=>[...s.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]).sort();
    if(JSON.stringify(refs(html))!==JSON.stringify(refs(readFileSync(join(dist,'index.html'),'utf8'))))throw Error('Public HTML mismatch: '+name);
    const assets=readdirSync(join(dist,'assets')).filter(f=>/^(index-|InterviewBookingPage-|pages-interviews-)/.test(f)&&/\.(css|js)$/.test(f));
    for(const f of assets){const response=await fetch('https://'+domain+'/assets/'+f);if(!response.ok||hash(Buffer.from(await response.arrayBuffer()))!==hash(readFileSync(join(dist,'assets',f))))throw Error('Asset mismatch '+f);}
    console.log(name+': HTML and '+assets.length+' key assets verified');
  }
  for(const[path,status,origin]of [['/health',200,''],['/tutor-identity/status',401,'https://tutor.fluentxverse.com'],['/tutor-identity/admin',403,'https://dashboard.fluentxverse.com']]){
    const r=await fetch('https://api.fluentxverse.com'+path,{headers:origin?{origin}:{}});if(r.status!==status)throw Error('Unexpected status '+path+': '+r.status);console.log(path+': '+r.status);
  }
  write(join(release,'live-verification.json'),JSON.stringify({passed:true,collectionEnabled:false,walletIssuanceEnabled:false,at:new Date().toISOString()},null,2));
}else throw Error('Unknown release action');
