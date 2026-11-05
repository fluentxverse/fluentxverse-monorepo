import {cpSync,mkdirSync,existsSync,readFileSync,writeFileSync,symlinkSync,realpathSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {studentPublicBuildEnv} from './lib/student-public-build-env.mjs';
const dir='output/release/dispute-mainnet-20261103/frontends';
const apps=[
 {role:'tutor',app:'fluentxverse-tutor-solid-prototype',baseline:'output/release/tutor-report-modal-20261103/frontend',version:'f7d69bcb-6cc5-4254-baf7-bf0092ef813d',port:5197,page:'tutor/pages/InboxPage.tsx'},
 {role:'student',app:'fluentxverse-student-solid-prototype',baseline:'output/release/readiness-device-cleanup-20261031/student/frontend',version:'37071ce5-f8c2-4db9-9968-9d29b7e59b29',port:5196,page:'student/pages/InboxPage.tsx'},
 {role:'admin',app:'fluentxverse-dashboard',baseline:'output/release/profile-review-consistency-20261103/frontend',version:'0f83601b-a348-46a3-9721-b41275df1c8a',port:5195,page:'src/pages/InboxPage.tsx'},
];
const sha=b=>createHash('sha256').update(b).digest('hex');
const cwd=a=>join(dir,a.role,'frontend',a.app);
const run=(a,cmd,args)=>execFileSync(cmd,args,{cwd:cwd(a),env:{...process.env,...(a.role==='student'?studentPublicBuildEnv(process.cwd()):{})},encoding:'utf8',timeout:180000,maxBuffer:6000000});
const wrangler=(a,args)=>run(a,'bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
const replace=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Missing scoped frontend anchor: '+a);return s.replace(a,b);};
mkdirSync(dir,{recursive:true});
if(process.argv.includes('--prepare')){
 for(const a of apps){
  const front=join(dir,a.role,'frontend');
  if(!existsSync(cwd(a)))cpSync(a.baseline,front,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
  if(a.role==='tutor')cpSync(join(a.baseline,a.app,'tutor/pages/ClassroomPage.tsx'),join(cwd(a),'tutor/pages/ClassroomPage.tsx'));
  if(a.role==='tutor')cpSync(join(a.baseline,a.app,'tutor/assets/css/tutor-design.css'),join(cwd(a),'tutor/assets/css/tutor-design.css'));
  if(!existsSync(join(cwd(a),'node_modules')))symlinkSync(realpathSync(join(a.baseline,a.app,'node_modules')),join(cwd(a),'node_modules'),'dir');
  for(const file of ['ui/DisputeInbox.tsx','ui/lesson-issue-threads.css']){mkdirSync(join(front,'shared','ui'),{recursive:true});cpSync(join('shared',file),join(front,'shared',file));}
  let page=readFileSync(join(a.baseline,a.app,a.page),'utf8');
  if(a.role==='admin'){
   const target=join(cwd(a),'src/components/StudentDisputes.tsx');cpSync(join(a.app,'src/components/StudentDisputes.tsx'),target);
   if(!page.includes("import StudentDisputes"))page="import StudentDisputes from '../components/StudentDisputes';\n"+page;
   if(!page.includes('<StudentDisputes/>'))page=replace(page,'    {notice &&','    <StudentDisputes/>\n    {notice &&');
  }else{
   page="import DisputeInbox from '../../../shared/ui/DisputeInbox';\nimport { client } from '../api/utils';\n"+page;
   page=a.role==='tutor'?replace(page,'        <div class={`inbox-error-slot',`        <DisputeInbox client={client} role="tutor"/>\n        <div class={\`inbox-error-slot`):replace(page,'      {error() &&',`      <DisputeInbox client={client} role="student"/>\n      {error() &&`);
   // Keep the current report form and its request schema; this release adds the
   // private case lifecycle without changing the existing attendance/report rules.
   if(a.role==='student')for(const file of ['student/Components/StudentLessonIssueReport.tsx','student/Components/StudentLessonIssueReport.css','student/api/lessonIssueReport.api.ts'])cpSync(join(a.baseline,a.app,file),join(cwd(a),file));
  }
  writeFileSync(join(cwd(a),a.page),page);console.log(run(a,'bun',['run','build']));
 }
}else if(process.argv.includes('--verify')){
 const children=apps.map(a=>spawn('bunx',['vite','preview','--host','127.0.0.1','--port',String(a.port),'--strictPort'],{cwd:cwd(a),env:{...process.env,...(a.role==='student'?studentPublicBuildEnv(process.cwd()):{})},detached:true,stdio:'ignore'}));
 try{
  for(const a of apps){let ready=false;for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:'+a.port)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200));}if(!ready)throw Error('Preview unavailable');}
  console.log(execFileSync('node',['tests/browser/studentDisputes.cjs'],{cwd:'fluentxverse-tutor-solid-prototype',encoding:'utf8',timeout:180000,maxBuffer:4000000}));
  writeFileSync(join(dir,'verification.json'),JSON.stringify({passed:true,hashes:Object.fromEntries(apps.map(a=>[a.role,sha(readFileSync(join(cwd(a),'dist/index.html')))]))}));
 }finally{for(const child of children)try{process.kill(-child.pid,'SIGTERM')}catch{}}
}else if(process.argv.includes('--deploy')){
 const v=JSON.parse(readFileSync(join(dir,'verification.json')));if(!v.passed)throw Error('Verify first');
 for(const a of apps){if(v.hashes[a.role]!==sha(readFileSync(join(cwd(a),'dist/index.html'))))throw Error('Verified artifact changed');const live=JSON.parse(wrangler(a,['deployments','list','--json'])).sort((x,y)=>Date.parse(y.created_on)-Date.parse(x.created_on))[0].versions;if(live.length!==1||live[0].version_id!==a.version)throw Error('Deployment baseline changed: '+a.role);}
 const results=[];for(const a of apps){const output=wrangler(a,['deploy']);console.log(output);results.push({role:a.role,previous:a.version,output});writeFileSync(join(dir,'deployment.json'),JSON.stringify({results,at:new Date().toISOString()}));}
}else throw Error('Use --prepare, --verify, --deploy');
