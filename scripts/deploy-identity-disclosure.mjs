import{execFileSync,spawn}from'node:child_process';
import{cpSync,mkdirSync,readFileSync,writeFileSync,existsSync,symlinkSync,realpathSync}from'node:fs';
import{join,dirname}from'node:path';
import{root}from'./identity-mainnet-operations.mjs';
import{quote}from'./lib/cloud-ssh.mjs';
const receiptStatus=process.argv.includes('--receipt-status');
const tag=receiptStatus?'identity-receipt-status-20261103':'identity-disclosure-20261103';
const dir='output/release/'+tag,remote='/opt/fluentxverse/releases/'+tag;
const previous=receiptStatus?'fluentxverse-cloud/api:identity-review-details-20261103':'fluentxverse-cloud/api:identity-mainnet-20261103',image='fluentxverse-cloud/api:'+tag;
const app='fluentxverse-tutor-solid-prototype',cwd=join(dir,'frontend',app),baseline=receiptStatus?'output/release/identity-checklist-20261103/frontend':'output/release/identity-mainnet-20261103/frontend-9177f159';
const run=(cmd,args)=>execFileSync(cmd,args,{cwd,encoding:'utf8',timeout:180000,maxBuffer:8e6});
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
mkdirSync(dir,{recursive:true});
const mode=process.argv[2];
if(mode==='--prepare'){
 for(const f of receiptStatus?['src/services/tutorIdentity/issuance.ts','src/services/tutorIdentity/gateway.ts','src/services/tutorIdentity/issuanceWorker.ts','tests/identityProduction.test.ts']:['src/services/tutorIdentity/production.ts','src/services/tutor.services/tutor.service.ts','src/routes/tutor.route.ts','tests/identityProduction.test.ts']){
   const p=join(dir,'api',f);mkdirSync(dirname(p),{recursive:true});cpSync(join('fluentxverse-server',f),p);
 }
 writeFileSync(join(dir,'api/Dockerfile'),`FROM ${previous}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
 root(`mkdir -p ${remote}/api && tar -xzf - -C ${remote}/api`,{input:execFileSync('tar',['-czf','-','-C',join(dir,'api'),'.'])});
 console.log(root(`docker build --network none -t ${image} ${remote}/api`));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/identity-disclosure.js`));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test tests/identityProduction.test.ts tests/identityIssuance.test.ts tests/identityCredential.test.ts`));
 if(!existsSync(cwd))cpSync(baseline,join(dir,'frontend'),{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(baseline,app,'node_modules')),join(cwd,'node_modules'),'dir');
 for(const f of receiptStatus?['tutor/Components/IdentitySubmission.tsx']:['tutor/Components/IdentitySubmission.tsx','tutor/Components/IdentitySubmission.css','tutor/pages/MyProfilePage.tsx'])cpSync(join(app,f),join(cwd,f));
 console.log(run('bun',['run','build']));
}else if(mode==='--verify'){
 const child=spawn('bunx',['vite','preview','--host','127.0.0.1','--port','5300','--strictPort'],{cwd,detached:true,stdio:'ignore'});
 try{
   let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5300')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Preview unavailable');
   console.log(execFileSync('node',['scripts/tests/tutor-identity-ui.cjs'],{encoding:'utf8',env:{...process.env,IDENTITY_ONLY_TUTOR:'1',IDENTITY_PRODUCTION:'1',IDENTITY_TUTOR_URL:'http://127.0.0.1:5300'},timeout:120000,maxBuffer:2e6}));
   writeFileSync(join(dir,'verification.json'),JSON.stringify({passed:true}));
 }finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(mode==='--deploy'){
 if(!JSON.parse(readFileSync(join(dir,'verification.json'))).passed)throw Error('Verify first');
 const versions=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
 if(versions.length!==1||versions[0].version_id!==(receiptStatus?'a7e39370-cbdb-449a-a65d-1e7d35d0b2dd':'ab978015-cd3b-450b-9810-7e85a7b400fe'))throw Error('Frontend baseline changed');
 const py=`import json,subprocess\nfrom pathlib import Path\nc=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]\nif c['Config']['Image']!='${previous}': raise RuntimeError('API baseline changed')\nfiles=c['Config']['Labels']['com.docker.compose.project.config_files'].split(',');project=c['Config']['Labels']['com.docker.compose.project']\nargs=['docker','compose','-p',project]+[s for f in files for s in ['-f',f]]\np=Path('${remote}/override.json');p.write_text(json.dumps({'services':{'api':{'image':'${image}'}}}))\ntry: subprocess.run(args+['-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)\nexcept Exception:\n subprocess.run(args+['up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)\n raise\nprint(json.dumps({'apiUpdated':True,'mainnetConfigurationPreserved':True}))`;
 console.log(root('python3 -c '+quote(py),{timeout:180000}));
 const output=wrangler(['deploy']);console.log(output);writeFileSync(join(dir,'deployment.json'),JSON.stringify({image,previous,output,at:new Date().toISOString()}));
}else throw Error('Use --prepare, --verify or --deploy');
