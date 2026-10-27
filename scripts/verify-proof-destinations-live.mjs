import { ssh, quote } from './lib/cloud-ssh.mjs';
import { writeFileSync } from 'node:fs';
const configPath = '/opt/fluentxverse/releases/20261023/compose.private.json';
const config = JSON.parse(ssh(`cat ${quote(configPath)}`));
const engine = config.services['gmr-engine'].environment;
const envNames = ['GMR_ENGINE_MEMGRAPH_URI', 'GMR_ENGINE_MEMGRAPH_USER', 'GMR_ENGINE_MEMGRAPH_PASSWORD', 'GMR_ENGINE_DASHBOARD_COOKIE'];
const env = envNames.filter(key => engine[key] !== undefined).flatMap(key => ['-e', `${key}=${engine[key]}`]);
const code = `import neo4j from 'neo4j-driver';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
const driver=neo4j.driver(process.env.GMR_ENGINE_MEMGRAPH_URI,neo4j.auth.basic(process.env.GMR_ENGINE_MEMGRAPH_USER||'',process.env.GMR_ENGINE_MEMGRAPH_PASSWORD||''));
const session=driver.session(),run=randomUUID(),root=randomUUID(),child=randomUUID(),other=randomUUID(),foreign=randomUUID(),owner=randomUUID();
const token=randomBytes(32).toString('base64url'),tokenHash=createHash('sha256').update(token).digest('hex');
const now=new Date().toISOString(),expires=new Date(Date.now()+300000).toISOString();
const checks=[];
const request=async(id,method='GET',body,expected=200,cookie=true,resource='destination')=>{
 const r=await fetch('https://engine.fluentxverse.com/dashboard/projects/'+id+'/zkverify/'+resource,{method,headers:{origin:'https://engine.fluentxverse.com','content-type':'application/json',...(cookie?{cookie:(process.env.GMR_ENGINE_DASHBOARD_COOKIE||'gmr_engine_session')+'='+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(r.status!==expected)throw Error('Unexpected destination status: '+r.status+' expected '+expected);
 const data=await r.json();if(resource==='destination'&&r.headers.get('cache-control')!=='private, no-store'&&expected===200)throw Error('Cache headers missing');return data;
};
try{
 await session.run([
 "CREATE(o:GMRAccount{id:$owner,status:'active',createdAt:$now,updatedAt:$now,qaProofDestinationRun:$run}),",
 "(s:GMRAccountSession{id:$run,tokenHash:$hash,expiresAt:$expires,qaProofDestinationRun:$run}),",
 "(p:EngineApp{id:$root,name:'Temporary destination QA',environment:'development',status:'active',allowedChains:[8453],allowedSolanaNetworks:[],allowedContracts:[],rateLimitPerMinute:60,createdAt:$now,updatedAt:$now,qaProofDestinationRun:$run}),",
 "(c:EngineApp{id:$child,name:'Temporary destination module',parentProjectId:$root,moduleName:'QA',environment:'development',status:'active',allowedChains:[8453],allowedSolanaNetworks:[],allowedContracts:[],rateLimitPerMinute:60,createdAt:$now,updatedAt:$now,qaProofDestinationRun:$run}),",
 "(q:EngineApp{id:$other,name:'Temporary independent project',environment:'development',status:'active',allowedChains:[8453],allowedSolanaNetworks:[],allowedContracts:[],rateLimitPerMinute:60,createdAt:$now,updatedAt:$now,qaProofDestinationRun:$run}),",
 "(f:EngineApp{id:$foreign,name:'Temporary foreign project',environment:'development',status:'active',qaProofDestinationRun:$run})",
 "CREATE(o)-[:HAS_GMR_SESSION]->(s),(o)-[:OWNS_ENGINE_APP]->(p),(o)-[:OWNS_ENGINE_APP]->(c),(o)-[:OWNS_ENGINE_APP]->(q)"
 ].join(' '),{owner,run,root,child,other,foreign,now,expires,hash:tokenHash});
 await request(root,'GET',undefined,401,false);await request(foreign,'GET',undefined,404);checks.push('authentication and ownership');
 let state=await request(root);if(state.destination.chainId!==8453||state.destinations.length!==5||state.destinations.some(d=>d.chainId===26514))throw Error('Default/choices differ');
 for(const chainId of [8453,33139,42161,10,4663]){
  state=await request(child,'PUT',{chainId,revision:state.revision});
  const persisted=await request(root);if(persisted.projectId!==root||persisted.destination.chainId!==chainId||persisted.revision!==state.revision)throw Error('Root/module persistence failed');
 }
 checks.push('five chains saved through module and persisted on root');
 if((await request(other)).destination.chainId!==8453)throw Error('Project isolation failed');checks.push('independent project isolation');
 await request(root,'PUT',{chainId:10,revision:0},409);await request(root,'PUT',{chainId:26514,revision:state.revision},400);
 await request(root,'PUT',{chainId:8453,revision:state.revision,rpc:'http://invalid'},400);checks.push('stale saves, Horizen and RPC injection rejected');
 const audit=await session.run('MATCH(n:EngineProofDestinationAudit{projectId:$id}) RETURN count(n) AS n',{id:root});if(audit.records[0].get('n').toNumber()!==5)throw Error('Audit count mismatch');checks.push('five audited changes');
 for(let i=0;i<3;i++){
  const result=await request(root,'GET',undefined,200,true,'account?network=zkVerify');
  if(result.network!=='zkVerify'||!result.account?.address||!/^\\d+$/.test(result.account.freeBalance)||result.account.nonce===undefined)throw Error('Real mainnet account data missing');
 }
 checks.push('three real authenticated mainnet account reads through production Node and public Worker');
 console.log(JSON.stringify({passed:true,checks,paidProofsSubmitted:0,realProjectSettingsChanged:false}));
}finally{
 await session.run('MATCH(n) WHERE n.qaProofDestinationRun=$run OR (n:EngineProofDestinationAudit AND n.projectId=$id) DETACH DELETE n',{run,id:root});
 const remaining=await session.run('MATCH(n) WHERE n.qaProofDestinationRun=$run OR (n:EngineProofDestinationAudit AND n.projectId=$id) RETURN count(n) AS n',{run,id:root});
 if(remaining.records[0].get('n').toNumber()!==0)throw Error('Temporary fixture cleanup failed');
 await session.close();await driver.close();
}`;
// Only the business API image supplies the existing JS driver; all data is in Engine Memgraph.
const args = ['docker', 'exec', ...env, 'fluentxverse-server', 'bun', '-e', code].map(quote).join(' ');
let result;
try { result = JSON.parse(ssh(args, { timeout: 120000 })); }
catch { throw Error('Live destination QA failed; inspect temporary fixture cleanup without logging private environment values.'); }
writeFileSync('output/release/proof-destinations-20261025/live-api-verification.json', JSON.stringify({ ...result, verifiedAt: new Date().toISOString() }, null, 2));
console.log(JSON.stringify(result));
