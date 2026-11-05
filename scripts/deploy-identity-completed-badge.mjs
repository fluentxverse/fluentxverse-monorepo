import{execFileSync,spawn}from'node:child_process';
import{cpSync,mkdirSync,existsSync,symlinkSync,realpathSync,writeFileSync,readFileSync}from'node:fs';
import{join}from'node:path';
import{createHash}from'node:crypto';
const checklist=process.argv.includes('--checklist');
const resultLock=process.argv.includes('--result-lock');
const profile=process.argv.includes('--profile-review');
const app=resultLock?'fluentxverse-dashboard':'fluentxverse-tutor-solid-prototype',dir=profile?'output/release/profile-review-tutor-20261103':resultLock?'output/release/interview-result-lock-20261103':checklist?'output/release/identity-checklist-20261103':'output/release/identity-completed-badge-20261103';
const baseline=profile?'output/release/identity-receipt-status-20261103/frontend':resultLock?'output/release/identity-review-details-20261103/frontend':checklist?'output/release/identity-completed-badge-20261103/frontend':'output/release/identity-disclosure-20261103/frontend',front=join(dir,'frontend'),cwd=join(front,app);
const previous=profile?'a4d84a19-138b-4e3d-89b5-920b0e8099fc':resultLock?'f0bed2ca-7c40-4051-81da-819688b32369':checklist?'2aa77d00-ebd4-4c07-bb9f-6b43771db0c0':'24f710e9-02b4-4503-8d52-8dcbb24d013f',file=profile?'tutor/pages/MyProfilePage.tsx':resultLock?'src/pages/InterviewRoomPage.tsx':checklist?'tutor/Components/IdentitySubmission.tsx':'tutor/pages/HomePage.tsx';
const sha=b=>createHash('sha256').update(b).digest('hex');
const run=(cmd,args)=>execFileSync(cmd,args,{cwd,encoding:'utf8',timeout:180000,maxBuffer:8e6});
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
mkdirSync(dir,{recursive:true});
if(process.argv.includes('--prepare')){
 if(!existsSync(cwd))cpSync(baseline,front,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(baseline,app,'node_modules')),join(cwd,'node_modules'),'dir');
 cpSync(join(app,file),join(cwd,file));if(profile)cpSync('shared/profileReview.ts',join(front,'shared/profileReview.ts'));console.log(run('bun',['run','build']));
}else if(process.argv.includes('--verify')){
 const child=spawn('bunx',['vite','preview','--host','127.0.0.1','--port','5301','--strictPort'],{cwd,detached:true,stdio:'ignore'});
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5301')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Preview unavailable');
  console.log(execFileSync('node',[profile?app+'/tests/browser/profileReviewStatus.cjs':resultLock?app+'/tests/browser/interviewResultLock.cjs':checklist?'scripts/tests/tutor-identity-ui.cjs':app+'/tests/browser/homeStatusHydration.cjs'],{encoding:'utf8',env:{...process.env,INTERVIEW_DASHBOARD_URL:'http://127.0.0.1:5301',TUTOR_TEST_URL:'http://127.0.0.1:5301',IDENTITY_ONLY_TUTOR:'1',IDENTITY_PRODUCTION:'1',IDENTITY_TUTOR_URL:'http://127.0.0.1:5301'},timeout:180000,maxBuffer:4e6}));
  writeFileSync(join(dir,'verification.json'),JSON.stringify({passed:true,source:sha(readFileSync(join(cwd,file))),html:sha(readFileSync(join(cwd,'dist/index.html')))}));
 }finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--deploy')){
 const v=JSON.parse(readFileSync(join(dir,'verification.json')));
 if(!v.passed||v.source!==sha(readFileSync(join(cwd,file)))||v.html!==sha(readFileSync(join(cwd,'dist/index.html'))))throw Error('Verify exact release first');
 const versions=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
 if(versions.length!==1||versions[0].version_id!==previous)throw Error('Tutor baseline changed');
 const output=wrangler(['deploy']);console.log(output);writeFileSync(join(dir,'deployment.json'),JSON.stringify({previous,output,apiUnchanged:true,at:new Date().toISOString()}));
}else throw Error('Use --prepare, --verify or --deploy');
