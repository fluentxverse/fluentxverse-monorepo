import{execFileSync,spawn}from'node:child_process';
import{cpSync,mkdirSync,existsSync,symlinkSync,realpathSync,readFileSync,writeFileSync}from'node:fs';
import{join,dirname}from'node:path';
const root=process.cwd(),release=join(root,'output/release/application-step-centering-20261102'),app='fluentxverse-dashboard';
const base=join(root,'output/release/application-label-alignment-20261102/frontend'),front=join(release,'frontend'),cwd=join(front,app),previous='492a18c7-b6c2-4dec-b34c-72baf8f08565';
const run=(cmd,args,options={})=>execFileSync(cmd,args,{cwd,env:{...process.env,CI:'1'},encoding:'utf8',maxBuffer:8e6,...options});
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
const guard=()=>{const v=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;if(v.length!==1||v[0].version_id!==previous)throw Error('Dashboard baseline changed');};
if(process.argv.includes('--prepare')){
 if(!existsSync(cwd))cpSync(base,front,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(base,app,'node_modules')),join(cwd,'node_modules'),'dir');
 for(const f of [app+'/src/pages/ApplicationsPage.css']){const dest=join(front,f);mkdirSync(dirname(dest),{recursive:true});cpSync(join(root,f),dest);}
 console.log(run('bun',['test','shared/tests/profileApplicationStatus.test.ts'],{cwd:front}));console.log(run('bun',['run','build']));
}else if(process.argv.includes('--verify')){
 const child=spawn('bunx',['vite','preview','--host','127.0.0.1','--port','5197','--strictPort'],{cwd,stdio:'ignore',detached:true});
 try{let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5197')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}if(!ready)throw Error('Preview unavailable');
 console.log(run('node',['scripts/tests/application-profile-columns.cjs'],{cwd:root}));writeFileSync(join(release,'verification.json'),JSON.stringify({passed:true,at:new Date().toISOString()}));
 }finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--deploy')){
 if(!JSON.parse(readFileSync(join(release,'verification.json'))).passed)throw Error('Verify first');guard();
 const output=wrangler(['deploy']);console.log(output);writeFileSync(join(release,'deployment.json'),JSON.stringify({previous,output,apiUnchanged:true,at:new Date().toISOString()},null,2));
}else throw Error('Use --prepare, --verify, --deploy');
