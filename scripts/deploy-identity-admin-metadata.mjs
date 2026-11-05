import {execFileSync,spawn} from 'node:child_process';
import {cpSync,mkdirSync,readFileSync,writeFileSync,existsSync,symlinkSync,realpathSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {root} from './identity-mainnet-operations.mjs';
import {quote} from './lib/cloud-ssh.mjs';
const profile=process.argv.includes('--profile-review'),activity=process.argv.includes('--activity'),release=profile?'profile-review-consistency-20261103':activity?'admin-activity-feed-20261103':'identity-admin-metadata-20261103';
const dir='output/release/'+release,remote='/opt/fluentxverse/releases/'+release;
const previous=profile?'fluentxverse-cloud/api:admin-activity-feed-20261103':activity?'fluentxverse-cloud/api:identity-metadata-rate-limit-20261103':'fluentxverse-cloud/api:identity-receipt-status-20261103',image='fluentxverse-cloud/api:'+release;
const app='fluentxverse-dashboard',cwd=join(dir,'frontend',app),baseline=profile?'output/release/admin-activity-feed-20261103/frontend':activity?'output/release/identity-admin-metadata-20261103/frontend':'output/release/tutor-table-compact-20261103/frontend';
const version=profile?'e9a3f4ca-ae17-4880-8679-c48fd37f7222':activity?'8a9139c3-6bf6-4d52-9462-6e42c236456a':'c39254da-a208-43c6-b00e-56b4d31bf4d1',sha=b=>createHash('sha256').update(b).digest('hex');
const apiFiles=profile?['src/services/admin.services/admin.service.ts','src/services/tutor.services/tutor.service.ts','tests/profileReview.test.ts']:activity?['src/services/admin.services/admin.service.ts','src/services/admin.services/admin.interface.ts','src/services/admin.services/activityFeed.ts','src/services/tutorIdentity/issuanceWorker.ts','src/routes/admin.route.ts','tests/adminActivityFeed.test.ts']:['src/services/admin.services/operations.service.ts','src/services/tutorIdentity/adminCredential.ts','tests/identityAdminCredential.test.ts'];
const frontFiles=profile?['src/pages/ApplicationsPage.tsx']:activity?['src/components/Header.tsx','src/components/Header.css','src/api/admin.api.ts']:['src/components/OperationsAccountDetail.tsx','src/components/TutorIdentityCredentials.tsx','src/components/TutorIdentityCredentials.css'];
const run=(cmd,args)=>execFileSync(cmd,args,{cwd,encoding:'utf8',timeout:180000,maxBuffer:8e6});
const wrangler=args=>run('bunx',['--bun','wrangler@4.152.0',...args,'--config','wrangler.jsonc']);
mkdirSync(dir,{recursive:true});
if(process.argv.includes('--prepare')){
 for(const f of apiFiles){const p=join(dir,'api',f);mkdirSync(dirname(p),{recursive:true});cpSync(join('fluentxverse-server',f),p);}
 if(profile){mkdirSync(join(dir,'api/shared'),{recursive:true});cpSync('shared/profileReview.ts',join(dir,'api/shared/profileReview.ts'));}
 writeFileSync(join(dir,'api/Dockerfile'),`FROM ${previous}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n${profile?'COPY --chown=appuser:appgroup shared/ /shared/\n':''}`);
 root(`mkdir -p ${remote}/api && tar -xzf - -C ${remote}/api`,{input:execFileSync('tar',['-czf','-','-C',join(dir,'api'),'.'])});
 console.log(root(`docker build --network none -t ${image} ${remote}/api`));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file build src/index.ts --target=bun --outfile=/tmp/identity-admin.js`));
 console.log(root(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test ${profile?'tests/profileReview.test.ts':activity?'tests/adminActivityFeed.test.ts tests/adminActivityTimestamp.test.ts':'tests/identityAdminCredential.test.ts'} tests/identityProduction.test.ts`));
 if(!existsSync(cwd))cpSync(baseline,join(dir,'frontend'),{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))&&!p.split('/').at(-1).startsWith('.env')});
 if(!existsSync(join(cwd,'node_modules')))symlinkSync(realpathSync(join(baseline,app,'node_modules')),join(cwd,'node_modules'),'dir');
 for(const f of frontFiles)cpSync(join(app,f),join(cwd,f));
 if(profile)cpSync('shared/profileReview.ts',join(dir,'frontend/shared/profileReview.ts'));
 console.log(run('bun',['run','build']));
}else if(process.argv.includes('--data-check') && activity){
 const code=`import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';import{AdminService}from'./src/services/admin.services/admin.service';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD,1);const s=getDriver().session();try{const id=(await s.run('MATCH(a:Admin) RETURN a.id AS id LIMIT 1')).records[0]?.get('id');const start=Date.now();const rows=await new AdminService().getRecentActivity(250,id||'');if(!rows.length)throw Error('Expected live activity');console.log(JSON.stringify({count:rows.length,types:[...new Set(rows.map(r=>r.type))],durationMs:Date.now()-start,privatePayload:rows.some(r=>'issuanceJson' in r||'details' in r)}));}finally{await s.close();await closeDriver();}`;
 const py=`import json,subprocess\nc=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]\nargs=['docker','run','--rm','--network','container:fluentxverse-server','--env-file','/dev/stdin','--entrypoint','bun','${image}','--no-env-file','-e',${JSON.stringify(code)}]\nprint(subprocess.check_output(args,input='\\n'.join(c['Config']['Env'])+'\\n',text=True))`;
 console.log(root('python3 -c '+quote(py)));
}else if(process.argv.includes('--verify')){
 const child=spawn('bunx',['vite','preview','--host','127.0.0.1','--port','5304','--strictPort'],{cwd,detached:true,stdio:'ignore'});
 try{
  let ready=false;for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5304')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}if(!ready)throw Error('Preview unavailable');
  console.log(execFileSync('node',[app+'/tests/browser/'+(profile?'profileReviewCount.cjs':activity?'adminActivityFeed.cjs':'tutorIdentityMetadata.cjs')],{encoding:'utf8',env:{...process.env,IDENTITY_DASHBOARD_URL:'http://127.0.0.1:5304'},timeout:180000,maxBuffer:2e6}));
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
