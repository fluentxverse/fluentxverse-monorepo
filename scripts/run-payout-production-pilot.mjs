import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { sshOptions, cloudTarget } from './lib/cloud-ssh.mjs';
const root=process.cwd(),state=join(homedir(),'.local/state/fluentxverse/payout-activation-20261025'),release=join(root,'output/release/payout-activation-20261025');
const identity=JSON.parse(readFileSync(join(state,'identity.json'))),config=JSON.parse(readFileSync(resolve(root,'../budol/gmr-engine/zk/payouts/releases/self-operated-v2-20261025/operator-config.json')));
if(!process.argv.includes('--live')&&!process.argv.includes('--reconcile'))throw Error('Use --live to authorize exactly one zkVerify mainnet submission, or --reconcile');
const journal=join(state,'pilot-journal.json');
if(process.argv.includes('--live')&&existsSync(journal))throw Error('Pilot journal exists; reconcile it, never blindly resend');
const run=(c,a,o={})=>execFileSync(c,a,{encoding:'utf8',...o});
const name='fxv-payout-production-pilot-memgraph';
if(!run('docker',['ps','-a','--filter','name=^/'+name+'$','--format','{{.Names}}']).trim())
  run('docker',['run','-d','--name',name,'--restart=no','--memory=384m','--cpus=1','-p','127.0.0.1:17699:7687','memgraph/memgraph:latest','--memory-limit=256','--storage-wal-enabled=true','--storage-snapshot-interval-sec=300']);
else run('docker',['start',name]);
const tunnel=spawn('ssh',[...sshOptions,'-o','ExitOnForwardFailure=yes','-N','-L','127.0.0.1:18090:127.0.0.1:8090',cloudTarget],{stdio:['ignore','ignore','pipe']});
let failed=false;tunnel.on('exit',()=>{failed=true;});tunnel.stderr.on('data',()=>{});
try{
  await new Promise(r=>setTimeout(r,2000));if(failed)throw Error('Private Engine tunnel failed');
  for(let i=0;;i++){
    const response=await fetch('http://127.0.0.1:18090/v1/payouts/prover',{headers:{'X-GMR-Engine-Key':identity.apiKey},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Engine prover status '+response.status);
    const status=await response.json();
    if(status.ready===true){if(status.release.releaseManifestSHA256!==config.releaseManifestSHA256)throw Error('Unexpected production release');break;}
    if(status.state==='blocked'||i>=120)throw Error('Production payout setup blocked or timed out');
    if(i%3===0)console.log(JSON.stringify({event:'production-payout-setup-verification',state:status.state}));
    await new Promise(r=>setTimeout(r,10000));
  }
  run('bun',['--no-env-file','tests/payout.production.pilot.ts'],{cwd:join(root,'fluentxverse-server'),stdio:'inherit',timeout:900000,env:{...process.env,
    RUN_LIVE_PAYOUT_PILOT:'one-authorized-mainnet-submission',PAYOUT_PILOT_GRAPH:'bolt://127.0.0.1:17699',PAYOUT_PILOT_JOURNAL:journal,
    PAYOUT_PILOT_OPERATOR_CONFIG:resolve(root,'../budol/gmr-engine/zk/payouts/releases/self-operated-v2-20261025/operator-config.json'),
    GMR_PAYOUT_ENGINE_API_BASE:'http://127.0.0.1:18090',GMR_PAYOUT_ENGINE_API_KEY:identity.apiKey,PAYOUT_ARTIFACTS_APPROVED:'true',
    PAYOUT_RELEASE_MANIFEST_SHA256:config.releaseManifestSHA256,PAYOUT_ZKVERIFY_VK_HASH:config.vkHash,PAYOUT_ISSUER_HASH:config.issuerHash,PAYOUT_SCOPE_HASH:config.scopeHash,
    PAYOUT_RELEASE_POLICY:'self-operated',PAYOUT_VERIFICATION_NETWORK:'zkVerify',PAYOUT_CHAIN_ID:'8453',PAYOUT_ZKVERIFY_DOMAIN_ID:'2',PAYOUT_PROOF_SUBMISSIONS_ENABLED:'true'}});
  const result=JSON.parse(readFileSync(journal));
  // Journal has synthetic identifiers only, but the public report omits operational IDs and balances.
  writeFileSync(join(release,'pilot.json'),JSON.stringify({synthetic:true,stage:result.stage,engineSubmissionId:result.engineSubmissionId,nativeStatus:result.nativeStatus,
    nativeResult:result.nativeResult,receipt:result.receipt,productionKeyQA:result.productionKeyQA,checks:result.checks,transfersEnabled:false,lastCheckedAt:result.lastCheckedAt},null,2));
}finally{if(tunnel.exitCode===null){const closed=new Promise(r=>tunnel.once('close',r));tunnel.kill('SIGTERM');await closed;}run('docker',['stop',name]);}
