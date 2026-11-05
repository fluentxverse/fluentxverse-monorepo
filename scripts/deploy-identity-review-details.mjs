import{execFileSync,spawn}from'node:child_process';
import{cpSync,mkdirSync,readFileSync,writeFileSync,existsSync,symlinkSync,realpathSync}from'node:fs';
import{join,dirname}from'node:path';
import{createHash}from'node:crypto';
import{root}from'./identity-mainnet-operations.mjs';
import{quote}from'./lib/cloud-ssh.mjs';
const dir='output/release/identity-review-details-20261103',remote='/opt/fluentxverse/releases/identity-review-details-20261103';
const previous='fluentxverse-cloud/api:identity-disclosure-20261103',image='fluentxverse-cloud/api:identity-review-details-20261103';
const app='fluentxverse-dashboard',cwd=join(dir,'frontend',app),baseline='output/release/interview-join-ui-current-20261102/dashboard/frontend';
const version='2b1089da-0065-432b-b910-4090ab46f094',sha=b=>createHash('sha256').update(b).digest('hex');
const run=(cmd,args)=>execFileSync(cmd,args,{cwd,encoding:'utf8',timeout:180000,maxBuffer:8e6});
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
mkdirSync(dir,{recursive:true});
if(process.argv.includes('--prepare')){
 for(const f of ['src/services/tutorIdentity/service.ts','src/services/tutorIdentity/reviewApplicant.ts','tests/identityReviewApplicant.test.ts']){
   const p=join(dir,'api',f);mkdirSync(dirname(p),{recursive:true});cpSync(join('fluentxverse-server',f),p);
 }
 mkdirSync(join(dir,'api/shared'),{recursive:true});cpSync('shared/tutorIdentity.ts',join(dir,'api/shared/tutorIdentity.ts'));
 writeFileSync(join(dir,'api/Dockerfile'),`FROM ${previous}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\nCOPY --chown=appuser:appgroup shared/ /shared/\n`);
 root(`mkdir -p ${remote}/api && tar -xzf - -C ${remote}/api`,{input:execFileSync('tar',['-czf','-','-C',join(dir,'api'),'.'])});
 console.log(root(`docker build --network none -t ${image} ${remote}/api`));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/identity-review.js`));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test tests/identityReviewApplicant.test.ts tests/tutorIdentity.http.test.ts tests/identityProduction.test.ts`));
 if(!existsSync(cwd))cpSync(baseline,join(dir,'frontend'),{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(baseline,app,'node_modules')),join(cwd,'node_modules'),'dir');
 cpSync(join(app,'src/components/IdentityReview.tsx'),join(cwd,'src/components/IdentityReview.tsx'));
 for(const f of ['tutorIdentity.ts','ui/tutor-identity.css'])cpSync(join('shared',f),join(dir,'frontend/shared',f));
 console.log(run('bun',['run','build']));
}else if(process.argv.includes('--verify')){
 const child=spawn('bunx',['vite','preview','--host','127.0.0.1','--port','5302','--strictPort'],{cwd,detached:true,stdio:'ignore'});
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5302')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Preview unavailable');
  console.log(execFileSync('node',['scripts/tests/tutor-identity-ui.cjs'],{encoding:'utf8',env:{...process.env,IDENTITY_ONLY_ADMIN:'1',IDENTITY_DASHBOARD_URL:'http://127.0.0.1:5302'},timeout:180000,maxBuffer:2e6}));
  writeFileSync(join(dir,'verification.json'),JSON.stringify({passed:true,html:sha(readFileSync(join(cwd,'dist/index.html')))}));
 }finally{try{process.kill(-child.pid,'SIGTERM');}catch{}}
}else if(process.argv.includes('--deploy')){
 const v=JSON.parse(readFileSync(join(dir,'verification.json')));if(!v.passed||v.html!==sha(readFileSync(join(cwd,'dist/index.html'))))throw Error('Verify first');
 const live=JSON.parse(wrangler(['deployments','list','--json'])).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0].versions;
 if(live.length!==1||live[0].version_id!==version)throw Error('Dashboard baseline changed');
 const py=`import json,subprocess\nfrom pathlib import Path\nc=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]\nif c['Config']['Image']!='${previous}': raise RuntimeError('API baseline changed')\nfiles=c['Config']['Labels']['com.docker.compose.project.config_files'].split(',');project=c['Config']['Labels']['com.docker.compose.project']\nargs=['docker','compose','-p',project]+[s for f in files for s in ['-f',f]]\np=Path('${remote}/override.json');p.write_text(json.dumps({'services':{'api':{'image':'${image}'}}}))\ntry: subprocess.run(args+['-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)\nexcept Exception:\n subprocess.run(args+['up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)\n raise\nprint(json.dumps({'apiUpdated':True,'mainnetConfigurationPreserved':True}))`;
 console.log(root('python3 -c '+quote(py),{timeout:180000}));
 const output=wrangler(['deploy']);console.log(output);writeFileSync(join(dir,'deployment.json'),JSON.stringify({image,previous,output,at:new Date().toISOString()}));
}else throw Error('Use --prepare, --verify or --deploy');
