import{execFileSync,spawn}from'node:child_process';
import{cpSync,mkdirSync,existsSync,symlinkSync,realpathSync,readFileSync,writeFileSync}from'node:fs';
import{join,dirname}from'node:path';
const root=process.cwd(),app='fluentxverse-dashboard',release=join(root,'output/release/identity-review-workspace-final-20261102');
const base=join(root,'output/release/identity-review-workspace-20261102/frontend'),front=join(release,'frontend'),cwd=join(front,app);
const run=(cmd,args,opts={})=>execFileSync(cmd,args,{cwd,env:{...process.env,CI:'1'},encoding:'utf8',maxBuffer:8e6,...opts});
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
if(process.argv.includes('--prepare')){
 if(!existsSync(cwd))cpSync(base,front,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(base,app,'node_modules')),join(cwd,'node_modules'),'dir');
 for(const f of ['src/components/IdentityReview.tsx','src/pages/IdentityReviewsPage.tsx','src/pages/IdentityReviewsPage.css']){const dest=join(cwd,f);mkdirSync(dirname(dest),{recursive:true});cpSync(join(root,app,f),dest);}
 cpSync(join(root,'shared/ui/tutor-identity.css'),join(front,'shared/ui/tutor-identity.css'));
 console.log(run('bun',['run','build']));
}else if(process.argv.includes('--verify')){
 const child=spawn('bunx',['vite','preview','--host','127.0.0.1','--port','5197','--strictPort'],{cwd,stdio:'ignore',detached:true});
 try{let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5197')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}if(!ready)throw Error('Preview unavailable');
 console.log(run('node',[process.argv.includes('--room-tests')?'scripts/test-interview-chat.cjs':'scripts/tests/tutor-identity-ui.cjs'],{cwd:root,env:{...process.env,IDENTITY_TUTOR_URL:'https://tutor.fluentxverse.com',IDENTITY_DASHBOARD_URL:'http://127.0.0.1:5197',INTERVIEW_TUTOR_URL:'https://tutor.fluentxverse.com',INTERVIEW_DASHBOARD_URL:'http://127.0.0.1:5197'}}));writeFileSync(join(release,'verification.json'),JSON.stringify({passed:true}));
 }finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--deploy')){
 if(!JSON.parse(readFileSync(join(release,'verification.json'))).passed)throw Error('Verify first');
 const v=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
 if(v.length!==1||v[0].version_id!=='1ea75f16-038c-4ca9-8c39-63311705b73f')throw Error('Dashboard baseline changed');
 const output=wrangler(['deploy']);console.log(output);writeFileSync(join(release,'deployment.json'),JSON.stringify({output,apiUnchanged:true}));
}else throw Error('Use --prepare, --verify, --deploy');
