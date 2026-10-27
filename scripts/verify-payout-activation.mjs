import { readFileSync, writeFileSync } from 'node:fs';
import { ssh, quote } from './lib/cloud-ssh.mjs';
const probe=`import neo4j from'neo4j-driver';import{signAuthToken}from'./src/utils/jwt';import{adminCapabilities}from'./src/utils/adminOperations';
const d=neo4j.driver(process.env.MEMGRAPH_URI,neo4j.auth.basic(process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD)),s=d.session();
try{const rows=(await s.run("MATCH(a:Admin) WHERE a.role IN ['admin','superadmin'] RETURN a")).records;
const a=rows.map(r=>r.get('a').properties).find(a=>adminCapabilities(a).includes('finance'));if(!a)throw Error('No finance admin');
const payload={userId:a.id,email:a.email||'',role:a.role},valid='adminAuth='+await signAuthToken(payload,60),checks=[];
for(const[label,cookie,origin,allowed]of[['anonymous','','https://dashboard.fluentxverse.com',[401,403]],['invalid','adminAuth=invalid','https://dashboard.fluentxverse.com',[401,403]],['wrong role','adminAuth='+await signAuthToken({...payload,role:'tutor'},60),'https://dashboard.fluentxverse.com',[403]],['untrusted origin',valid,'https://untrusted.example',[403]],['finance',valid,'https://dashboard.fluentxverse.com',[200]]]){
const r=await fetch('https://api.fluentxverse.com/admin/operations/compensation/payout-authorization/readiness',{headers:{cookie,origin},signal:AbortSignal.timeout(20000)});
const cache=r.headers.get('cache-control')||'';if(!allowed.includes(r.status)||!cache.includes('private')||!cache.includes('no-store'))throw Error('Payout auth/cache failure: '+label+' '+r.status);
if(r.status===200){const body=await r.json();if(!body.success||!body.data.ready||body.data.chainId!==8453||body.data.verificationNetwork!=='zkVerify'||body.data.transferEnabled!==false)throw Error('Unexpected live readiness');checks.push({label,status:r.status,readiness:body.data});}else checks.push({label,status:r.status});}
for(const path of ['/v1/wallets','/v1/screening/prover']){const r=await fetch(process.env.GMR_PAYOUT_ENGINE_API_BASE+path,{headers:{'X-GMR-Engine-Key':process.env.GMR_PAYOUT_ENGINE_API_KEY},signal:AbortSignal.timeout(10000)});if(r.status!==403)throw Error('Payout key not isolated: '+path);checks.push({label:'dedicated key isolation '+path,status:r.status});}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),checks}));}finally{await s.close();await d.close();}`;
const result=JSON.parse(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(probe)}`,{timeout:120000}));
const deployment=JSON.parse(readFileSync('output/release/payout-activation-20261025/deployment.json'));
const info=JSON.parse(ssh('docker inspect budol-gmr-engine-1'))[0];
const env=Object.fromEntries(info.Config.Env.map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
const count=`import neo4j from'neo4j-driver';const r=await Bun.stdin.json(),d=neo4j.driver(r.uri,neo4j.auth.basic(r.user,r.password)),s=d.session();try{const rows=(await s.run('MATCH(:EngineApp {id:$id})-[:HAS_ZK_PROOF_SUBMISSION]->(p:ZKProofSubmission) RETURN p.id AS id,p.status AS status',{id:r.project})).records;if(rows.length!==1||rows[0].get('status')!=='finalized')throw Error('Pilot is not exactly one finalized native submission');console.log(JSON.stringify({submissionCount:rows.length,submissionId:rows[0].get('id')}));}finally{await s.close();await d.close();}`;
result.nativeJournal=JSON.parse(ssh(`docker exec -i fluentxverse-server bun --no-env-file -e ${quote(count)}`,{input:JSON.stringify({project:deployment.projectId,uri:env.GMR_ENGINE_MEMGRAPH_URI,user:env.GMR_ENGINE_MEMGRAPH_USER||'',password:env.GMR_ENGINE_MEMGRAPH_PASSWORD||''}),timeout:30000}));
const response=await fetch('https://dashboard.fluentxverse.com/',{signal:AbortSignal.timeout(20000)});
if(!response.ok)throw Error('Dashboard unavailable');
result.dashboardStatus=response.status;
writeFileSync('output/release/payout-activation-20261025/live-verification.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
