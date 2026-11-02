import { mkdirSync, writeFileSync } from 'node:fs';
import { ssh, quote } from './lib/cloud-ssh.mjs';

const baseline = process.argv.includes('--baseline');
const concurrent = process.argv.includes('--concurrency');
const code = `import{validatePayoutAuthorization,validatePayoutProofRelease}from'./src/services/admin.services/tutorPayoutAuthorization.service';
const request=async(path,body)=>{const r=await fetch(process.env.GMR_PAYOUT_ENGINE_API_BASE+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-GMR-Engine-Key':process.env.GMR_PAYOUT_ENGINE_API_KEY},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(250000)});if(!r.ok)throw Error('Engine HTTP '+r.status);return r.json();};
let status;for(let i=0;i<240;i++){status=await request('/v1/payouts/prover');if(status.ready)break;if(status.state==='blocked')throw Error('Payout release blocked');await Bun.sleep(3000);}if(!status?.ready)throw Error('Payout release not ready');const release=validatePayoutProofRelease(status.release),backend=status.release.proverBackend||'snarkjs';if(backend!==${JSON.stringify(baseline ? 'snarkjs' : 'rust')})throw Error('Unexpected prover backend');
let lastEvidence;const results=[];for(let iteration=0;iteration<${concurrent ? 1 : 3};iteration++){
const now=Date.now(),id='rust-pilot-'+crypto.randomUUID(),createdAt=new Date(now-10000).toISOString(),policy='fluentxverse.usd-earnings.v1.zero-fee';
const earnings=[0,1].map(i=>({bookingId:id+'-lesson-'+i,tutorId:id,status:'unclaimed',approvedBy:'synthetic-finance',policy,currency:'USD',units:1,feeCents:0,grossCents:1234,netCents:1234,rateVersion:1,completionAt:new Date(now-60000).toISOString()}));
const evidence={protocol:policy,zkVerified:false,transferEnabled:false,earnings,batch:{id,tutorId:id,approvedBy:'synthetic-finance',policy,currency:'USD',status:'reserved',recipient:'0x0000000000000000000000000000000000001234',totalCents:2468,feeCents:0,bookingIdsJson:JSON.stringify(earnings.map(e=>e.bookingId)),createdAt,expiresAt:new Date(Date.parse(createdAt)+3600000).toISOString()}};
lastEvidence=evidence;
const r=await request('/v1/payouts/authorizations',{evidence});validatePayoutAuthorization(r,evidence,release);if((r.proverBackend||'snarkjs')!==backend)throw Error('Proof backend differs');
const wrong=structuredClone(r);wrong.publicSignals[5]='999';let rejected=false;try{validatePayoutAuthorization(wrong,evidence,release)}catch{rejected=true}if(!rejected)throw Error('Wrong chain was accepted');
results.push({iteration,backend,elapsedMs:Date.now()-now,chainId:release.chainId,domainId:release.domainId,localVerified:r.localVerified,transferEnabled:r.transferEnabled,wrongChainRejected:rejected});}
let concurrentStatuses;if(${concurrent}){concurrentStatuses=await Promise.all([0,1].map(async()=>{const r=await fetch(process.env.GMR_PAYOUT_ENGINE_API_BASE+'/v1/payouts/authorizations',{method:'POST',headers:{'Content-Type':'application/json','X-GMR-Engine-Key':process.env.GMR_PAYOUT_ENGINE_API_KEY},body:JSON.stringify({evidence:lastEvidence}),signal:AbortSignal.timeout(250000)});const body=await r.json();if(r.status===200)validatePayoutAuthorization(body,lastEvidence,release);return r.status;}));if(concurrentStatuses.filter(s=>s===200).length!==1||concurrentStatuses.filter(s=>s===429).length!==1)throw Error('Concurrent proving gate did not serialize work');}
console.log('PILOT '+JSON.stringify({results,concurrentStatuses,transactionsSubmitted:0,applicationRecordsCreated:0}));`;
const output = ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(code)}`, { timeout: 1050000 });
console.log(output);
const result = output.split('\n').find(s => s.startsWith('PILOT '));
if (!result) throw Error('Missing pilot result');
const directory = 'output/release/rust-payout-worker-20261029';
mkdirSync(directory, { recursive: true });
writeFileSync(directory + (concurrent ? '/concurrency-pilot.json' : baseline ? '/baseline-pilot.json' : '/native-pilot.json'), JSON.stringify({ testedAt: new Date().toISOString(), ...JSON.parse(result.slice(6)) }, null, 2));
