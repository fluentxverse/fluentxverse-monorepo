import{execFileSync,spawn}from'node:child_process';
import{cpSync,mkdirSync,existsSync,symlinkSync,realpathSync,readFileSync,writeFileSync,readdirSync}from'node:fs';
import{join}from'node:path';
const root=process.cwd(),release=join(root,'output/release/identity-pilot-20261103/tutor-ui');
mkdirSync(release,{recursive:true});
const planPath=join(release,'plan.json');
if(process.argv.includes('--prepare')){
 writeFileSync(join(release,'verification.json'),JSON.stringify({passed:false}));
 const candidates=readdirSync(join(root,'output/release')).filter(name=>name.startsWith('tutor-hero-')).flatMap(name=>{
  const file=join(root,'output/release',name,'deployment.json');if(!existsSync(file))return [];
  const d=JSON.parse(readFileSync(file));return d.verified&&d.version?[{baseline:join(root,'output/release',name,'frontend'),version:d.version,at:d.at}]:[];
 }).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 const chosen=candidates[0]||{baseline:join(root,'output/release/interview-join-ui-current-20261102/tutor/frontend'),version:'a67ab17c-fce1-484c-88a3-d37c1bd6cdd0'};
 writeFileSync(planPath,JSON.stringify(chosen));
}
const plan=JSON.parse(readFileSync(planPath));
if(!/^[0-9a-f-]{36}$/.test(plan.version))throw Error('Invalid baseline version');
const baseline=plan.baseline,front=join(release,plan.version,'frontend');
const app='fluentxverse-tutor-solid-prototype',cwd=join(front,app);
const run=(cmd,args,extra={})=>execFileSync(cmd,args,{cwd,encoding:'utf8',env:{...process.env,CI:'1'},maxBuffer:8e6,...extra});
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
if(process.argv.includes('--prepare')){
 if(!existsSync(cwd))cpSync(baseline,front,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(baseline,app,'node_modules')),join(cwd,'node_modules'),'dir');
 cpSync(join(root,app,'tutor/Components/IdentitySubmission.tsx'),join(cwd,'tutor/Components/IdentitySubmission.tsx'));
 console.log(run('bun',['run','build']));
}else if(process.argv.includes('--verify')){
 const child=spawn('bunx',['vite','preview','--host','127.0.0.1','--port','5201','--strictPort'],{cwd,stdio:'ignore',detached:true});
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5201')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}
  if(!ready)throw Error('Preview unavailable');
  console.log(execFileSync('node',['scripts/tests/tutor-identity-ui.cjs'],{cwd:root,encoding:'utf8',env:{...process.env,IDENTITY_ONLY_TUTOR:'true',IDENTITY_TUTOR_URL:'http://127.0.0.1:5201'},maxBuffer:8e6}));
  writeFileSync(join(release,'verification.json'),JSON.stringify({passed:true,version:plan.version}));
 }finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--deploy')){
 const verification=JSON.parse(readFileSync(join(release,'verification.json')));
 if(!verification.passed||verification.version!==plan.version)throw Error('Verify this baseline first');
 const versions=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
 if(versions.length!==1||versions[0].version_id!==plan.version)throw Error('Tutor baseline changed');
 const output=wrangler(['deploy']);console.log(output);writeFileSync(join(release,'deployment.json'),JSON.stringify({output}));
}else throw Error('Use --prepare, --verify or --deploy');
