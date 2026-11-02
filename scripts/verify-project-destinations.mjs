import { writeFileSync } from 'node:fs';
import { ssh, quote } from './lib/cloud-ssh.mjs';

const script = `import neo4j from'neo4j-driver';import{randomBytes,createHash}from'node:crypto';import{currentReviewConfig}from'./src/services/anonymousReviews/policy';import{approvedScreeningArtifacts}from'./src/services/screening/prover';import{validatePayoutAuthorization,validatePayoutProofRelease}from'./src/services/admin.services/tutorPayoutAuthorization.service';
const input=JSON.parse(await Bun.stdin.text()),driver=neo4j.driver(input.uri,neo4j.auth.basic(input.user,input.password)),session=driver.session();
const token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex'),root='2a798002-7ed3-4e98-853e-62306479b9da';
const request=async(path,method='GET',body)=>{const r=await fetch('http://budol-gmr-engine-1:8090'+path,{method,headers:{cookie:input.cookie+'='+token,origin:'https://engine.fluentxverse.com','content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(path+' HTTP '+r.status);return r.json();};
const proofs=async(ids)=>createHash('sha256').update(JSON.stringify((await session.run('MATCH(p:ZKProofSubmission) WHERE p.appId IN $ids RETURN properties(p) AS p ORDER BY p.id',{ids})).records.map(r=>r.get('p')))).digest('hex');
let saved,initial,ids,history;
try{
 const owner=(await session.run('MATCH(o:GMRAccount)-[:OWNS_ENGINE_APP]->(:EngineApp{id:$root}) RETURN o.id AS id',{root})).records[0].get('id');
 await session.run('MATCH(o:GMRAccount{id:$owner}) CREATE(o)-[:HAS_GMR_SESSION]->(:GMRAccountSession{id:$id,accountId:$owner,tokenHash:$hash,expiresAt:$expiresAt,createdAt:$now})',{owner,id:crypto.randomUUID(),hash,expiresAt:new Date(Date.now()+600000).toISOString(),now:new Date().toISOString()});
 ids=(await session.run('MATCH(a:EngineApp) WHERE a.id=$root OR a.parentProjectId=$root RETURN a.id AS id',{root})).records.map(r=>r.get('id'));if(ids.length!==6)throw Error('Expected six projects');history=await proofs(ids);
 initial=saved=await request('/dashboard/projects/'+root+'/zkverify/destination');
 const pins=new Map();for(const id of ids){const {policy}=await request('/dashboard/projects/'+id+'/zkverify/policy');if(policy)pins.set(id,policy.vkHash);}
 for(const destination of initial.destinations){
  saved=await request('/dashboard/projects/'+root+'/zkverify/destination','PUT',{chainId:destination.chainId,revision:saved.revision});
  for(const id of ids){
   const selection=await request('/dashboard/projects/'+id+'/zkverify/destination');if(selection.destination.chainId!==destination.chainId||selection.destination.domainId!==destination.domainId)throw Error('Module destination differs');
   const {policy}=await request('/dashboard/projects/'+id+'/zkverify/policy');
   if(policy&&(policy.domainId!==destination.domainId||policy.vkHash!==pins.get(id)||policy.bindings?.chainId&&policy.bindings.chainId!==String(destination.chainId)))throw Error('Effective module policy differs');
  }
  const review=await currentReviewConfig();if(review.chainId!==destination.chainId||review.domainId!==destination.domainId||review.bridge.toLowerCase()!==destination.bridge.toLowerCase())throw Error('Application review destination differs');
  if(input.ready){
   const screening=await approvedScreeningArtifacts();if(screening.chainId!==destination.chainId||screening.domainId!==destination.domainId)throw Error('Screening release differs');
   const r=await fetch(process.env.GMR_PAYOUT_ENGINE_API_BASE+'/v1/payouts/prover',{headers:{'X-GMR-Engine-Key':process.env.GMR_PAYOUT_ENGINE_API_KEY},signal:AbortSignal.timeout(10000)});const status=await r.json();if(!r.ok||!status.ready)throw Error('Payout release not ready');const payout=validatePayoutProofRelease(status.release);if(payout.chainId!==destination.chainId||payout.domainId!==destination.domainId)throw Error('Payout release differs');
   if(input.proof&&destination.chainId===33139){
    const now=Date.now(),id='destination-qa-'+crypto.randomUUID(),policy='fluentxverse.usd-earnings.v1.zero-fee',createdAt=new Date(now-10000).toISOString();
    const earnings=[0,1].map(i=>({bookingId:id+'-lesson-'+i,tutorId:id,status:'unclaimed',approvedBy:'synthetic-finance',policy,currency:'USD',units:1,feeCents:0,grossCents:1234,netCents:1234,rateVersion:1,completionAt:new Date(now-60000).toISOString()}));
    const evidence={protocol:policy,zkVerified:false,transferEnabled:false,earnings,batch:{id,tutorId:id,approvedBy:'synthetic-finance',policy,currency:'USD',status:'reserved',recipient:'0x0000000000000000000000000000000000001234',totalCents:2468,feeCents:0,bookingIdsJson:JSON.stringify(earnings.map(e=>e.bookingId)),createdAt,expiresAt:new Date(Date.parse(createdAt)+3600000).toISOString()}};
    const generated=await fetch(process.env.GMR_PAYOUT_ENGINE_API_BASE+'/v1/payouts/authorizations',{method:'POST',headers:{'Content-Type':'application/json','X-GMR-Engine-Key':process.env.GMR_PAYOUT_ENGINE_API_KEY},body:JSON.stringify({evidence}),signal:AbortSignal.timeout(250000)});
    if(!generated.ok)throw Error('Synthetic proof HTTP '+generated.status);const proof=await generated.json();validatePayoutAuthorization(proof,evidence,payout);
    console.log('SYNTHETIC_PROOF '+JSON.stringify({chainId:destination.chainId,domainId:destination.domainId,localVerified:proof.localVerified,transferEnabled:proof.transferEnabled,elapsedMs:Date.now()-now,submittedOnChain:false}));
   }
  }
  console.log('DESTINATION '+JSON.stringify({chainId:destination.chainId,domainId:destination.domainId,projects:ids.length,applicationMatched:true,proversReady:input.ready}));
 }
}finally{
 try{
  if(initial&&saved){const now=await request('/dashboard/projects/'+root+'/zkverify/destination');if(now.revision!==saved.revision)throw Error('Concurrent owner change; do not overwrite it');if(now.destination.chainId!==initial.destination.chainId)await request('/dashboard/projects/'+root+'/zkverify/destination','PUT',{chainId:initial.destination.chainId,revision:now.revision});}
  if(ids&&history!==await proofs(ids))throw Error('Historical proof records changed');
  console.log('PRESERVED '+JSON.stringify({historicalProofsUnchanged:true,restoredChainId:initial?.destination.chainId,transactionsSubmitted:0}));
 }finally{await session.run('MATCH(s:GMRAccountSession{tokenHash:$hash}) DETACH DELETE s',{hash});await session.close();await driver.close();}
}`;
const python = `import json,subprocess
c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
e=dict(x.split('=',1) for x in c['Config']['Env'])
i={'uri':e['GMR_ENGINE_MEMGRAPH_URI'],'user':e.get('GMR_ENGINE_MEMGRAPH_USER',''),'password':e.get('GMR_ENGINE_MEMGRAPH_PASSWORD',''),'cookie':e.get('GMR_ENGINE_DASHBOARD_COOKIE','gmr_engine_session'),'ready':${process.argv.includes('--ready') ? 'True' : 'False'},'proof':${process.argv.includes('--proof') ? 'True' : 'False'}}
r=subprocess.run(['docker','exec','-i','fluentxverse-server','bun','--no-env-file','-e',${JSON.stringify(script)}],input=json.dumps(i),text=True,capture_output=True,timeout=480)
if r.returncode: raise RuntimeError(r.stderr[-2000:])
print(r.stdout)`;
const result = ssh('python3 -c ' + quote(python), { timeout: 510000 });
console.log(result);
writeFileSync('output/release/project-destinations-20261029/' + (process.argv.includes('--ready') ? 'ready-verification.json' : 'routing-verification.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), results: result.split('\n').filter(Boolean) }, null, 2));
