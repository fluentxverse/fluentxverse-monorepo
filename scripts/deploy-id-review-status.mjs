import{execFileSync,spawn}from'node:child_process';
import{cpSync,mkdirSync,existsSync,symlinkSync,realpathSync,readFileSync,writeFileSync}from'node:fs';
import{join,dirname}from'node:path';
import{ssh,sshOptions,cloudHost,quote}from'./lib/cloud-ssh.mjs';
const rootSSH=(command,options={})=>execFileSync('ssh',[...sshOptions,'root@'+cloudHost,command],{encoding:'utf8',maxBuffer:8e6,...options});
const root=process.cwd(),id='id-resubmission-20261102',release=join(root,'output/release',id),remote='/opt/fluentxverse/releases/'+id;
const previous='fluentxverse-cloud/api:id-review-status-20261102',image='fluentxverse-cloud/api:'+id;
const app='fluentxverse-tutor-solid-prototype',base=join(root,'output/release/id-review-status-20261102/frontend'),front=join(release,'frontend'),cwd=join(front,app),prevWorker='8efafa93-7a99-4798-983b-0e23aa8cb82f';
const run=(cmd,args,opts={})=>execFileSync(cmd,args,{cwd,encoding:'utf8',env:{...process.env,CI:'1'},maxBuffer:8e6,...opts});
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
if(process.argv.includes('--prepare')){
 for(const f of ['src/services/tutorIdentity/service.ts','src/services/tutorIdentity/worker.ts','tests/tutorIdentity.test.ts','tests/tutorIdentity.http.test.ts']){const dest=join(release,'api',f);mkdirSync(dirname(dest),{recursive:true});cpSync(join(root,'fluentxverse-server',f),dest);}
 writeFileSync(join(release,'api/Dockerfile'),`FROM ${previous}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
 if(!existsSync(cwd))cpSync(base,front,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(base,app,'node_modules')),join(cwd,'node_modules'),'dir');
 for(const f of [app+'/tutor/Components/IdentitySubmission.tsx','shared/ui/tutor-identity.css']){const dest=join(front,f);mkdirSync(dirname(dest),{recursive:true});cpSync(join(root,f),dest);}
 console.log(run('bun',['run','build']));
 const tar=execFileSync('tar',['-czf','-','-C',join(release,'api'),'.']);ssh(`mkdir -p ${remote}/api && tar -xzf - -C ${remote}/api`,{input:tar});
 console.log(ssh(`docker build --network=none -t ${image} ${remote}/api`,{timeout:120000}));
 console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/review.js`,{timeout:90000}));
 console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test tests/tutorIdentity.test.ts tests/tutorIdentity.http.test.ts`,{timeout:60000}));
}else if(process.argv.includes('--verify')){
 const child=spawn('bunx',['vite','preview','--host','127.0.0.1','--port','5199','--strictPort'],{cwd,stdio:'ignore',detached:true});
 try{let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5199')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}if(!ready)throw Error('Preview failed');
 console.log(run('node',['scripts/tests/tutor-identity-ui.cjs'],{cwd:root,env:{...process.env,IDENTITY_TUTOR_URL:'http://127.0.0.1:5199',IDENTITY_DASHBOARD_URL:'https://dashboard.fluentxverse.com'}}));
 writeFileSync(join(release,'verification.json'),JSON.stringify({passed:true,at:new Date().toISOString()}));
 }finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--activate')){
 if(!JSON.parse(readFileSync(join(release,'verification.json'))).passed)throw Error('Verify first');
 if(ssh("docker inspect fluentxverse-server --format '{{.Config.Image}}'").trim()!==previous)throw Error('API baseline changed');
 const checks=readFileSync(join(root,'scripts/activate-tutor-identity-storage.mjs'),'utf8').split('const checks=`')[1].split('`;')[0];console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(checks)));
 const [project,files]=ssh('docker inspect fluentxverse-server --format '+quote('{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.project.config_files"}}')).trim().split('|');
 const conf={services:{api:{image}}};ssh('python3 -c '+quote(`import json,os\np='${remote}/override.json'\nfd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)\nwith os.fdopen(fd,'w') as f: json.dump(${JSON.stringify(conf)},f)`));
 const args=['docker','compose','-p',project,...files.split(',').flatMap(f=>['-f',f])];
 const up=extra=>[...args,...extra,'up','-d','--no-deps','--wait','--wait-timeout','120','api'].map(quote).join(' ');
 try{console.log(rootSSH(up(['-f',remote+'/override.json']),{timeout:180000}));if(!(await fetch('https://api.fluentxverse.com/health')).ok)throw Error('API health failed');}
 catch(e){console.log(rootSSH(up([]),{timeout:180000}));throw e;}
 writeFileSync(join(release,'api-deployment.json'),JSON.stringify({image,previous,at:new Date().toISOString()}));
 const v=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
 if(v.length!==1||v[0].version_id!==prevWorker)throw Error('Tutor baseline changed');
 const output=wrangler(['deploy']);console.log(output);writeFileSync(join(release,'frontend-deployment.json'),JSON.stringify({previous:prevWorker,output,at:new Date().toISOString()},null,2));
}else throw Error('Use --prepare, --verify, --activate');
