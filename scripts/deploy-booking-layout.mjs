import {execFileSync,spawn} from 'node:child_process';
import {cpSync,mkdirSync,existsSync,symlinkSync,realpathSync,readFileSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
const root=process.cwd(),app='fluentxverse-tutor-solid-prototype',release=join(root,'output/release/tutor-identity-design-20261102');
const base=join(root,'output/release/booking-layout-20261102/frontend'),front=join(release,'frontend'),cwd=join(front,app);
const run=(cmd,args,opts={})=>execFileSync(cmd,args,{cwd,encoding:'utf8',env:{...process.env,CI:'1'},maxBuffer:8e6,...opts});
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
if(process.argv.includes('--prepare')){
 if(!existsSync(cwd))cpSync(base,front,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(base,app,'node_modules')),join(cwd,'node_modules'),'dir');
 for(const f of ['tutor/Components/IdentitySubmission.tsx','tutor/Components/IdentitySubmission.css','tutor/pages/InterviewBookingPage.tsx']){const dest=join(cwd,f);mkdirSync(dirname(dest),{recursive:true});cpSync(join(root,app,f),dest);}
 console.log(run('bun',['run','build']));
}else if(process.argv.includes('--verify')){
 const child=spawn('bunx',['vite','preview','--host','127.0.0.1','--port','5199','--strictPort'],{cwd,stdio:'ignore',detached:true});
 try{let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5199')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}if(!ready)throw Error('Preview failed');
 console.log(run('node',['scripts/tests/booking-layout.cjs'],{cwd:root}));
 console.log(run('node',['scripts/tests/tutor-identity-ui.cjs'],{cwd:root,env:{...process.env,IDENTITY_TUTOR_URL:'http://127.0.0.1:5199',IDENTITY_DASHBOARD_URL:'https://dashboard.fluentxverse.com'}}));writeFileSync(join(release,'verification.json'),JSON.stringify({passed:true}));
 }finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--deploy')){
 if(!JSON.parse(readFileSync(join(release,'verification.json'))).passed)throw Error('Verify first');
 const v=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
 if(v.length!==1||v[0].version_id!=='d4388ffb-7762-47d4-89a6-8abacac64360')throw Error('Tutor baseline changed');
 const output=wrangler(['deploy']);console.log(output);writeFileSync(join(release,'deployment.json'),JSON.stringify({output,apiUnchanged:true}));
}else throw Error('Use --prepare, --verify, --deploy');
