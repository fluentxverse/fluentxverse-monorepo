import { writeFileSync } from 'node:fs';
import { ssh, quote } from './lib/cloud-ssh.mjs';

const program = `import{validatePayoutAuthorization,validatePayoutProofRelease}from'./src/services/admin.services/tutorPayoutAuthorization.service';
const started=Date.now(),policy='fluentxverse.usd-earnings.v1.zero-fee',createdAt=new Date(started-10000).toISOString(),id='arbitrum-qa-'+crypto.randomUUID();
const earnings=[0,1].map(i=>({bookingId:id+'-lesson-'+i,tutorId:id,status:'unclaimed',approvedBy:'synthetic-finance',policy,currency:'USD',units:1,feeCents:0,grossCents:1234,netCents:1234,rateVersion:1,completionAt:new Date(started-60000).toISOString()}));
const evidence={protocol:policy,zkVerified:false,transferEnabled:false,earnings,batch:{id,tutorId:id,approvedBy:'synthetic-finance',policy,currency:'USD',status:'reserved',recipient:'0x0000000000000000000000000000000000001234',totalCents:2468,feeCents:0,bookingIdsJson:JSON.stringify(earnings.map(e=>e.bookingId)),createdAt,expiresAt:new Date(Date.parse(createdAt)+3600000).toISOString()}};
const request=async(path,body)=>{const r=await fetch(process.env.GMR_PAYOUT_ENGINE_API_BASE+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-GMR-Engine-Key':process.env.GMR_PAYOUT_ENGINE_API_KEY},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(250000)});if(!r.ok)throw Error(path+' HTTP '+r.status);return r.json();};
const status=await request('/v1/payouts/prover');if(!status.ready)throw Error('Payout prover not ready');const release=validatePayoutProofRelease(status.release);
if(release.chainId!==42161||release.domainId!==10)throw Error('Wrong destination');
const proof=await request('/v1/payouts/authorizations',{evidence});validatePayoutAuthorization(proof,evidence,release);
const wrong=structuredClone(proof);wrong.publicSignals[5]='8453';let rejected=false;try{validatePayoutAuthorization(wrong,evidence,release);}catch{rejected=true;}if(!rejected)throw Error('Base binding was accepted');
console.log('PROOF '+JSON.stringify({localVerified:proof.localVerified,chainId:release.chainId,domainId:release.domainId,publicSignals:proof.publicSignals.length,wrongChainRejected:rejected,transferEnabled:proof.transferEnabled,elapsedMs:Date.now()-started,submittedOnChain:false}));`;
const result = ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(program)}`, { timeout: 300000 });
console.log(result);
const proof = result.split('\n').find(line => line.startsWith('PROOF '));
if (!proof) throw Error('Missing proof result');
writeFileSync('output/release/arbitrum-migration-20261029/synthetic-proof.json', JSON.stringify({ testedAt: new Date().toISOString(), ...JSON.parse(proof.slice(6)) }, null, 2));
