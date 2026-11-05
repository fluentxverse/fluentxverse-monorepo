import {execFileSync,spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,cpSync,existsSync,symlinkSync,realpathSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {root} from './identity-mainnet-operations.mjs';
import {quote} from './lib/cloud-ssh.mjs';
import {studentPublicBuildEnv} from './lib/student-public-build-env.mjs';
const dir='output/release/attendance-recovery-20261103',api=join(dir,'api');
const baseline='fluentxverse-cloud/api:dispute-mainnet-20261103-feed',image='fluentxverse-cloud/api:attendance-recovery-20261103';
const remote='/opt/fluentxverse/releases/attendance-recovery-20261103';
const files=['src/routes/student.route.ts','src/services/schedule.services/schedule.service.ts','src/services/schedule.services/attendance.job.ts','src/services/schedule.services/trialPolicy.ts','src/services/ticket.services/cancellationRefund.service.ts'];
const run=(cmd,args,cwd=process.cwd(),env=process.env)=>execFileSync(cmd,args,{cwd,env,encoding:'utf8',maxBuffer:8e6,timeout:240000});
const app='fluentxverse-student-solid-prototype',front=join(dir,'frontend'),cwd=join(front,app),base='output/release/student-no-evidence-20261103/frontend';
const version='0f48b8a4-869f-489a-818f-c70b367e99a6';
if(process.argv.includes('--prepare')){
 mkdirSync(api,{recursive:true});
 if(root("docker inspect fluentxverse-server --format '{{.Config.Image}}'").trim()!==baseline)throw Error('API baseline changed');
 const archive=root('docker exec fluentxverse-server tar -czf - -C /app '+[...files,'src/services/studentDispute.service.ts'].join(' '),{encoding:null});
 execFileSync('tar',['-xzf','-','-C',api],{input:archive});
 const edit=(file,before,after)=>{const p=join(api,file),s=readFileSync(p,'utf8');if(s.split(before).length!==2)throw Error('Anchor changed: '+file);writeFileSync(p,s.replace(before,after));};
 edit('src/services/schedule.services/schedule.service.ts',"WHERE b.status <> 'cancelled' AND coalesce(b.attendanceSource, '') <> 'admin'\n      WITH b", "WHERE b.status <> 'cancelled' AND coalesce(b.attendanceSource, '') <> 'admin'\n        AND b.issueDecision IS NULL\n      WITH b");
 edit('src/services/schedule.services/attendance.job.ts',"import { ScheduleService } from './schedule.service';","import { ScheduleService } from './schedule.service';\nimport { attendanceRecoveryService } from './attendanceRecovery.service';");
 edit('src/services/schedule.services/attendance.job.ts','const unbooked = await scheduleService.reconcileMissedOpenSlotAttendance();','const unbooked = await scheduleService.reconcileMissedOpenSlotAttendance();\n      await attendanceRecoveryService.reconcile();');
 edit('src/services/schedule.services/trialPolicy.ts',"WHERE CASE WHEN b.status = 'cancelled'", "WHERE b.paymentTransferredTo IS NULL AND coalesce(b.trialRefunded,false)=false AND CASE WHEN b.status = 'cancelled'");
 const patch=execFileSync('git',['diff','--',...files.filter(f=>!f.endsWith('attendance.job.ts')&&!f.endsWith('trialPolicy.ts')).map(f=>'fluentxverse-server/'+f)]);
 execFileSync('git',['apply','--unsafe-paths','-p2','--directory',api],{input:patch});
 let dispute=readFileSync(join(api,'src/services/studentDispute.service.ts'),'utf8');
 const needle="WHERE b.penaltyCode='301' AND b.refundApprovedBy IS NULL";
 if(dispute.split(needle).length!==2)throw Error('Dispute refund anchor changed');
 writeFileSync(join(api,'src/services/studentDispute.service.ts'),dispute.replace(needle,"WHERE b.penaltyCode='301' AND b.paymentTransferredTo IS NULL AND b.refundApprovedBy IS NULL"));
 for(const f of ['src/services/schedule.services/attendanceRecovery.service.ts','tests/attendanceRecovery.test.ts','tests/attendanceRecovery.integration.ts']){
  mkdirSync(dirname(join(api,f)),{recursive:true});cpSync(join('fluentxverse-server',f),join(api,f));
 }
 writeFileSync(join(api,'Dockerfile'),`FROM ${baseline}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
 root(`mkdir -p ${remote}/api && tar -xzf - -C ${remote}/api`,{input:execFileSync('tar',['-czf','-','-C',api,'.'])});
 console.log(root(`docker build --network none -t ${image} ${remote}/api`));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/check.js`));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test tests/attendanceRecovery.test.ts tests/attendanceWindow.test.ts tests/trialLaunch.test.ts`));
 if(!existsSync(cwd))cpSync(base,front,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(base,app,'node_modules')),join(cwd,'node_modules'),'dir');
 for(const f of ['student/Components/Settings/SettingsModal.tsx','student/Components/Settings/SettingsModal.css','student/Components/Settings/ReplacementPreference.tsx'])cpSync(join(app,f),join(cwd,f));
 let lesson=readFileSync(join(base,app,'student/pages/LessonPage.tsx'),'utf8');
 lesson=lesson.replace('interface LessonDetails {','interface LessonDetails {\n    replacementBookingId?: string;\n    replacementFor?: string;');
 const local=readFileSync(join(app,'student/pages/LessonPage.tsx'),'utf8');
 const lines=local.split('\n').filter(l=>l.includes('lesson().replacementBookingId &&')||l.includes('lesson().replacementFor &&'));
 if(lines.length!==2)throw Error('Missing replacement links');
 lesson=lesson.replace('              <StudentLessonRecap',lines.join('\n')+'\n              <StudentLessonRecap');
 writeFileSync(join(cwd,'student/pages/LessonPage.tsx'),lesson);
 console.log(run('bun',['run','build'],cwd,{...process.env,...studentPublicBuildEnv(process.cwd())}));
 writeFileSync(join(dir,'prepared.json'),JSON.stringify({image,baseline,version}));
}else if(process.argv.includes('--verify-api')){
 root(`tar -xzf - -C ${remote}/api/tests`,{input:execFileSync('tar',['-czf','-','-C','fluentxverse-server/tests','attendanceRecovery.integration.ts'])});
 root('docker run -d --rm --name fxv-attendance-release-test -p 127.0.0.1:7721:7687 memgraph/memgraph:latest');
 try {
  root(`cp ${remote}/api/tests/attendanceRecovery.integration.ts /tmp/fxv-attendance-test.ts`);
  console.log(root(`docker run --rm --network host -e TEST_MEMGRAPH_URI=bolt://127.0.0.1:7721 -v /tmp/fxv-attendance-test.ts:/app/tests/attendanceRecovery.integration.ts:ro --entrypoint bun ${image} --no-env-file run tests/attendanceRecovery.integration.ts`,{timeout:180000}));
  writeFileSync(join(dir,'api-verified.json'),JSON.stringify({passed:true,image}));
 } finally {root('docker stop fxv-attendance-release-test');}
}else if(process.argv.includes('--verify-student')){
 const child=spawn('bunx',['vite','preview','--host','127.0.0.1','--port','5318','--strictPort'],{cwd,env:{...process.env,...studentPublicBuildEnv(process.cwd())},detached:true,stdio:'ignore'});
 try {
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:5318')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!ready)throw Error('Preview unavailable');
  console.log(run('node',['tests/student/replacementPreference.cjs'],app,{...process.env,STUDENT_TEST_URL:'http://127.0.0.1:5318'}));
  writeFileSync(join(dir,'student-verified.json'),JSON.stringify({passed:true}));
 }finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--deploy-api')){
 if(!JSON.parse(readFileSync(join(dir,'api-verified.json'))).passed)throw Error('Verify API first');
 const py=`import json,subprocess\nfrom pathlib import Path\nc=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]\nif c['Config']['Image']!='${baseline}':raise RuntimeError('API baseline changed')\nfiles=c['Config']['Labels']['com.docker.compose.project.config_files'].split(',');project=c['Config']['Labels']['com.docker.compose.project']\nargs=['docker','compose','-p',project]+[s for f in files for s in ['-f',f]]\np=Path('${remote}/override.json');p.write_text(json.dumps({'services':{'api':{'image':'${image}','environment':{'BOOKED_ATTENDANCE_RECOVERY_ENABLED':'true'}}}}))\ntry:subprocess.run(args+['-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)\nexcept Exception:\n subprocess.run(args+['up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True);raise\nprint(json.dumps({'apiUpdated':True,'prospectiveOnly':True}))`;
 console.log(root('python3 -c '+quote(py),{timeout:180000}));
}else if(process.argv.includes('--deploy-student')){
 const v=JSON.parse(run('bunx',['--bun','wrangler@4.152.0','deployments','list','--json','--config','wrangler.jsonc'],cwd)).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
 if(v.length!==1||v[0].version_id!==version)throw Error('Student baseline changed');
 const output=run('bunx',['--bun','wrangler@4.152.0','deploy','--config','wrangler.jsonc'],cwd);
 console.log(output);writeFileSync(join(dir,'student-deployment.json'),JSON.stringify({output,version}));
}else throw Error('Use --prepare, --deploy-api, --deploy-student');
