import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cpSync,copyFileSync,existsSync,mkdirSync,readFileSync,symlinkSync,writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {ssh,quote,sshOptions,cloudTarget} from './lib/cloud-ssh.mjs';
const id='payout-activation-20261025',root=process.cwd(),engine=resolve(root,'../budol/gmr-engine');
const release=join(root,'output/release',id),state=join(homedir(),'.local/state/fluentxverse',id),stage='/opt/fluentxverse/releases/'+id;
const composePath='/opt/fluentxverse/releases/20261023/compose.private.json';mkdirSync(release,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const run=(c,a,o={})=>execFileSync(c,a,{encoding:'utf8',maxBuffer:8*1024*1024,...o});
const copy=(a,b)=>{mkdirSync(dirname(b),{recursive:true});copyFileSync(a,b);};
const upload=(a,b)=>run('scp',[...sshOptions,a,`${cloudTarget}:${b}`]);
const images={engine:'fluentxverse-cloud/gmr-engine:'+id,api:'fluentxverse-cloud/api:'+id};
const env={...process.env,GOTOOLCHAIN:'go1.25.14',CGO_ENABLED:'0',GOOS:'linux',GOARCH:'amd64',GOAMD64:'v1'};

if(process.argv.includes('--prepare')){
  const prior=join(root,'output/release/proof-destinations-20261025/engine-source'),source=join(release,'engine-source');
  if(!existsSync(source))cpSync(prior,source,{recursive:true,verbatimSymlinks:true,filter:p=>p.split('/').at(-1)!=='node_modules'});
  if(!existsSync(join(source,'node_modules')))symlinkSync(join(engine,'node_modules'),join(source,'node_modules'));
  const liveEngine=JSON.parse(ssh("docker inspect budol-gmr-engine-1 --format '{{json .Config.Image}}'"));
  if(liveEngine!=='fluentxverse-cloud/gmr-engine:proof-destinations-node-fix-20261025')throw Error('Engine baseline changed');
  run('go',['build','-buildvcs=false','-trimpath','-ldflags=-s -w','-o',join(release,'baseline-engine'),'./cmd/api'],{cwd:source,env});
  const liveHash=ssh('docker exec budol-gmr-engine-1 sha256sum /usr/local/bin/gmr-engine').split(/\s/)[0];
  if(hash(readFileSync(join(release,'baseline-engine')))!==liveHash)throw Error('Engine baseline does not reproduce');
  for(const p of ['internal/httpapi/api.go','internal/httpapi/payout_prover.go','internal/httpapi/payout_prover_test.go',
    'internal/httpapi/screening_prover.go','internal/httpapi/zkverify_policy.go','internal/httpapi/zkverify_receipt.go','internal/config/config.go'])copy(join(engine,p),join(source,p));
  run('go',['test','./internal/...','./cmd/...'],{cwd:source,env,stdio:'inherit'});
  const overlay=join(release,'engine');mkdirSync(overlay,{recursive:true});
  run('go',['build','-buildvcs=false','-trimpath','-ldflags=-s -w','-o',join(overlay,'gmr-engine'),'./cmd/api'],{cwd:source,env});
  for(const p of ['proving-circuits.ts','proving-release.ts','screening-ceremony.ts','payout-private-prover.ts','payout-private-prover.test.ts',
    'payout-private-authorization.mjs','payout-private-worker.mjs','payout-statement.ts','zkverify.ts'])copy(join(engine,'scripts',p),join(overlay,'scripts',p));
  writeFileSync(join(overlay,'Dockerfile'),`FROM ${liveEngine}\nCOPY --chmod=755 gmr-engine /usr/local/bin/gmr-engine\nCOPY scripts/ /app/scripts/\n`);
  const liveAPI=JSON.parse(ssh("docker inspect fluentxverse-server --format '{{json .Config.Image}}'"));
  if(liveAPI!=='fluentxverse-cloud/api:operational-alerts-20261024')throw Error('API baseline changed');
  const api=join(release,'api');mkdirSync(api,{recursive:true});
  for(const p of ['src/routes/tutorEarnings.route.ts','src/services/admin.services/tutorCompensation.service.ts','src/services/admin.services/tutorEarnings.service.ts',
    'src/services/admin.services/tutorPayoutRecovery.service.ts','src/services/admin.services/tutorPayoutAuthorization.service.ts','tests/tutorEarnings.test.ts','tests/tutorPayoutRecovery.test.ts'])copy(join(root,'fluentxverse-server',p),join(api,p));
  writeFileSync(join(api,'Dockerfile'),`FROM ${liveAPI}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
  const previousFrontend=join(root,'output/release/operational-alerts-20261024/frontend'),frontend=join(release,'frontend');
  const liveHTML=await(await fetch('https://dashboard.fluentxverse.com/')).text();
  if(liveHTML!==readFileSync(join(previousFrontend,'fluentxverse-dashboard/dist/index.html'),'utf8'))throw Error('Dashboard baseline changed');
  if(!existsSync(frontend))cpSync(previousFrontend,frontend,{recursive:true,verbatimSymlinks:true,filter:p=>!['node_modules','dist','.wrangler'].includes(p.split('/').at(-1))});
  const dashboard=join(frontend,'fluentxverse-dashboard');if(!existsSync(join(dashboard,'node_modules')))symlinkSync(join(root,'node_modules'),join(dashboard,'node_modules'));
  for(const p of ['TutorPayoutAuthorization.tsx','TutorPayoutAuthorization.css'])copy(join(root,'fluentxverse-dashboard/src/components',p),join(dashboard,'src/components',p));
  const component=join(dashboard,'src/components/TutorCompensation.tsx');let code=readFileSync(component,'utf8');
  if(!code.includes('TutorPayoutAuthorization')){code=code.replace("import './TutorCompensation.css';","import './TutorCompensation.css';\nimport { TutorPayoutAuthorization } from './TutorPayoutAuthorization';");
    code=code.replace('    {draft && data && <RateConfirmation','    {data && <TutorPayoutAuthorization key={tutorId} tutorId={tutorId} />}\n    {draft && data && <RateConfirmation');writeFileSync(component,code);}
  run('bun',['run','build'],{cwd:dashboard,stdio:'inherit'});
  const previousDashboard=JSON.parse(readFileSync(join(root,'output/release/operational-alerts-20261024/dashboard-deployment.json'))).version;
  writeFileSync(join(release,'manifest.json'),JSON.stringify({id,preparedAt:new Date().toISOString(),previousEngine:liveEngine,previousAPI:liveAPI,previousDashboard,
    baselineEngineHash:liveHash,engineHash:hash(readFileSync(join(overlay,'gmr-engine'))),scope:'Payout authorization only; no settlement or unrelated privacy/auth changes'},null,2));
  console.log('PASS scoped payout Engine/API/dashboard release prepared from live baselines');
}else if(process.argv.includes('--build')){
  for(const [name,image]of Object.entries(images)){
    const dir=join(release,name);run('tar',['-czf',join(release,name+'.tar.gz'),'-C',dir,'.']);ssh(`mkdir -p ${stage}/${name}`);upload(join(release,name+'.tar.gz'),`${stage}/${name}.tar.gz`);
    ssh(`tar -xzf ${stage}/${name}.tar.gz -C ${stage}/${name}`);
    console.log(ssh(`docker build --pull=false --network=none -t ${image} ${stage}/${name}`,{timeout:180000}));
  }
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${images.engine} test ./scripts/payout-private-prover.test.ts ./scripts/screening-bridge-prover.test.ts`,{timeout:60000}));
  console.log(ssh(`docker run --rm --network none --entrypoint bun ${images.api} test ./tests/tutorEarnings.test.ts ./tests/tutorPayoutRecovery.test.ts`,{timeout:60000}));
  writeFileSync(join(release,'images-built.json'),JSON.stringify({images,builtAt:new Date().toISOString()},null,2));
}else if(process.argv.includes('--activate')){
  JSON.parse(readFileSync(join(release,'images-built.json')));
  const manifest=JSON.parse(readFileSync(join(release,'manifest.json'))),identity=JSON.parse(readFileSync(join(state,'identity.json')));
  const localRelease=resolve(root,'../budol/gmr-engine/zk/payouts/releases/self-operated-v2-20261025');
  const config=JSON.parse(readFileSync(join(localRelease,'operator-config.json'))),record=JSON.parse(readFileSync(join(localRelease,'verification-record.json')));
  if(record.cryptographicSetupVerified!==true||record.releaseManifestSHA256!==config.releaseManifestSHA256)throw Error('Production payout setup is not verified');
  const remoteRelease=stage+'/artifacts',containerRelease='/app/zk/payouts/releases/self-operated-v2-20261025';
  const artifactTar=join(state,'artifacts.tar.gz');run('tar',['-czf',artifactTar,'--exclude=operator-config.json','-C',localRelease,'.']);
  ssh(`mkdir -p ${remoteRelease}/self-operated-v2-20261025 ${stage}/keys`);upload(artifactTar,stage+'/artifacts.tar.gz');ssh(`tar -xzf ${stage}/artifacts.tar.gz -C ${remoteRelease}/self-operated-v2-20261025`);
  upload(join(state,'issuer-seed'),stage+'/keys/issuer-seed');upload(join(state,'nullifier-key'),stage+'/keys/nullifier-key');ssh(`chmod 600 ${stage}/keys/issuer-seed ${stage}/keys/nullifier-key`);
  for(const key of ['releaseManifestPath','vkPath'])config[key]=containerRelease+'/'+config[key].split('/').at(-1);
  config.issuerSeedPath='/run/fluentxverse-payout-keys/issuer-seed';config.nullifierKeyPath='/run/fluentxverse-payout-keys/nullifier-key';
  const proverFile=join(state,'payout-prover.json');writeFileSync(proverFile,JSON.stringify({[identity.projectId]:{enabled:true,config}},null,2),{mode:0o600});
  const original=ssh(`cat ${composePath}`),compose=JSON.parse(original);
  if(compose.services['gmr-engine'].image!==manifest.previousEngine||compose.services.api.image!==manifest.previousAPI)throw Error('Live images changed');
  const policyPath='/opt/fluentxverse/releases/20261023/shared/gmr-engine-0/zkverify-projects.json';
  const oldPolicies=ssh(`cat ${policyPath}`),policies=JSON.parse(oldPolicies);
  if(policies[identity.projectId])throw Error('Payout policy already exists; reconcile release state');
  policies[identity.projectId]={network:'zkVerify',proofSystem:'groth16',domainId:2,vkHash:config.vkHash,publicInputs:20,methods:[],statementType:'fluentxverse.payout-authorization.v2',
    bindings:{valid:'1',policyHash:config.policyHash,issuerHash:config.issuerHash,issuerAx:config.issuerAx,issuerAy:config.issuerAy,chainId:'8453',currency:'840',scopeHash:config.scopeHash}};
  const p=join(state,'zkverify-projects.private.json');writeFileSync(p,JSON.stringify(policies,null,2),{mode:0o600});
  const processes=ssh('docker top budol-gmr-engine-1 -eo pid,comm').trim().split('\n').slice(1).map(v=>v.trim().split(/\s+/).at(-1));
  if(processes.some(p=>!['docker-init','gmr-engine','wget'].includes(p)))throw Error('Engine child operation running');
  const active="import{db,closePool}from'./src/db/postgres';try{const r=await db`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'`;if(r[0].n>0)throw Error('Active classrooms');console.log(JSON.stringify({activeClassrooms:r[0].n}));}finally{await closePool();}";
  console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(active)}`));
  compose.services['gmr-engine'].image=images.engine;
  compose.services['gmr-engine'].volumes.push({type:'bind',source:remoteRelease,target:'/app/zk/payouts/releases',read_only:true,bind:{create_host_path:false,selinux:'Z'}},
    {type:'bind',source:stage+'/keys',target:'/run/fluentxverse-payout-keys',read_only:true,bind:{create_host_path:false,selinux:'Z'}});
  compose.services['gmr-engine'].environment.GMR_ENGINE_PAYOUT_PROVER_PATH='/app/config/payout-prover.json';
  compose.services.api.image=images.api;
  Object.assign(compose.services.api.environment,{GMR_PAYOUT_ENGINE_API_BASE:'http://gmr-engine:8090',GMR_PAYOUT_ENGINE_API_KEY:identity.apiKey,PAYOUT_ARTIFACTS_APPROVED:'true',
    PAYOUT_RELEASE_MANIFEST_SHA256:config.releaseManifestSHA256,PAYOUT_ZKVERIFY_VK_HASH:config.vkHash,PAYOUT_ISSUER_HASH:config.issuerHash,PAYOUT_SCOPE_HASH:config.scopeHash,
    PAYOUT_RELEASE_POLICY:'self-operated',PAYOUT_VERIFICATION_NETWORK:'zkVerify',PAYOUT_CHAIN_ID:'8453',PAYOUT_ZKVERIFY_DOMAIN_ID:'2',PAYOUT_PROOF_SUBMISSIONS_ENABLED:'false'});
  const next=join(state,'compose.private.json');writeFileSync(next,JSON.stringify(compose,null,2),{mode:0o600});
  if(ssh(`cat ${composePath}`)!==original||ssh(`cat ${policyPath}`)!==oldPolicies)throw Error('Live configuration changed');
  const backup=composePath+'.pre-payout-'+Date.now(),policyBackup=policyPath+'.pre-payout-'+Date.now();ssh(`cp -p ${composePath} ${backup}`);ssh(`cp -p ${policyPath} ${policyBackup}`);
  upload(p,policyPath+'.next');upload(proverFile,'/opt/fluentxverse/releases/20261023/shared/gmr-engine-0/payout-prover.json');upload(next,composePath+'.next');
  try{
    ssh(`chmod 600 ${policyPath}.next ${composePath}.next /opt/fluentxverse/releases/20261023/shared/gmr-engine-0/payout-prover.json`);
    ssh(`mv ${policyPath}.next ${policyPath}`);ssh(`mv ${composePath}.next ${composePath}`);
    console.log(ssh(`docker compose -f ${composePath} up -d --no-deps --wait --wait-timeout 120 gmr-engine api`,{timeout:180000}));
    for(const url of ['https://api.fluentxverse.com/health','https://engine.fluentxverse.com/healthz']){const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Public health failed');}
  }catch(error){ssh(`cp -p ${backup} ${composePath}`);ssh(`cp -p ${policyBackup} ${policyPath}`);ssh(`docker compose -f ${composePath} up -d --no-deps --wait --wait-timeout 120 gmr-engine api`,{timeout:180000});throw error;}
  writeFileSync(join(release,'deployment.json'),JSON.stringify({deployedAt:new Date().toISOString(),images,previousCompose:backup,previousPolicies:policyBackup,
    projectId:identity.projectId,releaseManifestSHA256:config.releaseManifestSHA256,paidSubmissionsEnabled:false,transfersEnabled:false},null,2));
  console.log('PASS payout prover/API deployed; paid submissions remain gated on live pilot');
}else if(process.argv.includes('--enable-submissions')){
  const deploymentPath=join(release,'deployment.json'),deployment=JSON.parse(readFileSync(deploymentPath));
  const pilot=JSON.parse(readFileSync(join(release,'pilot.json')));
  if(pilot.stage!=='complete'||pilot.nativeStatus!=='finalized'||pilot.receipt?.verifiedOnBase!==true||pilot.receipt.chainId!==8453
    ||pilot.checks?.refundedEntitlementRejected!==true||pilot.checks?.duplicateSubmissionRejected!==true)throw Error('Completed live payout pilot required');
  const verify=`import{tutorPayoutAuthorizationService as p}from'./src/services/admin.services/tutorPayoutAuthorization.service';
    const r=await p.readiness();if(!r.ready||r.chainId!==8453||r.verificationNetwork!=='zkVerify')throw Error('Production payout prover not ready');
    const url=process.env.GMR_PAYOUT_ENGINE_API_BASE+'/v1/zkverify/proofs/'+${JSON.stringify(pilot.engineSubmissionId)};
    const h={'X-GMR-Engine-Key':process.env.GMR_PAYOUT_ENGINE_API_KEY};
    const s=await(await fetch(url,{headers:h})).json(),v=await(await fetch(url+'/receipt',{headers:h})).json();
    if(s.submission?.status!=='finalized'||v.receipt?.status!=='base_finalized'||v.receipt.verifiedOnBase!==true||v.receipt.chainId!==8453)throw Error('Pilot receipt not currently verified');
    const{db,closePool}=await import('./src/db/postgres');try{const a=await db\`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'\`;if(a[0].n>0)throw Error('Active classrooms');}finally{await closePool();}
    console.log(JSON.stringify({ready:true,pilotReceiptVerified:true}));process.exit(0);`;
  console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(verify)}`,{timeout:120000}));
  const original=ssh(`cat ${composePath}`),compose=JSON.parse(original);
  if(compose.services.api.image!==images.api||compose.services['gmr-engine'].image!==images.engine)throw Error('Release changed');
  compose.services.api.environment.PAYOUT_PROOF_SUBMISSIONS_ENABLED='true';
  compose.services.api.environment.PAYOUT_PRODUCTION_PILOT_SUBMISSION=pilot.engineSubmissionId;
  const next=join(state,'compose.submissions.private.json');writeFileSync(next,JSON.stringify(compose,null,2),{mode:0o600});
  const backup=composePath+'.pre-payout-submissions-'+Date.now();ssh(`cp -p ${composePath} ${backup}`);upload(next,composePath+'.next');
  if(ssh(`cat ${composePath}`)!==original)throw Error('Live configuration changed');
  try{ssh(`chmod 600 ${composePath}.next`);ssh(`mv ${composePath}.next ${composePath}`);
    console.log(ssh(`docker compose -f ${composePath} up -d --no-deps --wait --wait-timeout 120 api`,{timeout:180000}));
    const check=`import{tutorPayoutAuthorizationService as p}from'./src/services/admin.services/tutorPayoutAuthorization.service';const r=await p.readiness();if(!r.ready||!r.submissionsEnabled||r.transferEnabled!==false)throw Error('Payout activation failed');console.log(JSON.stringify(r));process.exit(0);`;
    console.log(ssh(`docker exec fluentxverse-server bun -e ${quote(check)}`,{timeout:30000}));
  }catch(error){ssh(`cp -p ${backup} ${composePath}`);ssh(`docker compose -f ${composePath} up -d --no-deps --wait --wait-timeout 120 api`,{timeout:180000});throw error;}
  writeFileSync(deploymentPath,JSON.stringify({...deployment,paidSubmissionsEnabled:true,activatedAt:new Date().toISOString(),pilotSubmissionId:pilot.engineSubmissionId,transfersEnabled:false},null,2));
  console.log('PASS private payout proof submissions activated after live zkVerify/Base pilot; settlement is not enabled');
}else if(process.argv.includes('--dashboard')){
  JSON.parse(readFileSync(join(release,'deployment.json')));const manifest=JSON.parse(readFileSync(join(release,'manifest.json'))),cwd=join(release,'frontend/fluentxverse-dashboard');
  const wrangler=args=>run('npx',['--yes','wrangler',...args,'--config','wrangler.jsonc'],{cwd,env:{...process.env,CI:'1'}});
  const versions=[...wrangler(['deployments','list']).matchAll(/Version\(s\):\s+\(100%\)\s+([a-f0-9-]{36})/g)];
  if(versions.at(-1)?.[1]!==manifest.previousDashboard)throw Error('Dashboard release changed');
  const out=wrangler(['deploy']);console.log(out);const version=out.match(/Current Version ID:\s*([a-f0-9-]{36})/)?.[1];if(!version)throw Error('Check dashboard deployment');
  writeFileSync(join(release,'dashboard-deployment.json'),JSON.stringify({version,previous:manifest.previousDashboard,deployedAt:new Date().toISOString()},null,2));
}else throw Error('Use --prepare, --build, --activate, --enable-submissions, --dashboard');
