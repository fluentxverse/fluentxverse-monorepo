import { writeFileSync } from 'node:fs';
import { ssh, quote } from './lib/cloud-ssh.mjs';

const script = `import neo4j from 'neo4j-driver';import{randomBytes,createHash}from'node:crypto';
const i=JSON.parse(await Bun.stdin.text()),d=neo4j.driver(i.uri,neo4j.auth.basic(i.user,i.password)),s=d.session();
const token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex');
const root='2a798002-7ed3-4e98-853e-62306479b9da';
const request=async(path,method='GET',body)=>{const r=await fetch('http://budol-gmr-engine-1:8090'+path,{method,headers:{cookie:i.cookie+'='+token,origin:'https://engine.fluentxverse.com','content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(95000)});if(!r.ok)throw Error(path+' HTTP '+r.status);return r.json();};
try{
 const owner=(await s.run('MATCH(o:GMRAccount)-[:OWNS_ENGINE_APP]->(:EngineApp{id:$root}) RETURN o.id AS id',{root})).records[0].get('id');
 await s.run('MATCH(o:GMRAccount{id:$owner}) CREATE(o)-[:HAS_GMR_SESSION]->(:GMRAccountSession{id:$id,accountId:$owner,tokenHash:$hash,expiresAt:$expiresAt,createdAt:$now})',{owner,id:crypto.randomUUID(),hash,expiresAt:new Date(Date.now()+600000).toISOString(),now:new Date().toISOString()});
 const apps=(await s.run('MATCH(a:EngineApp) WHERE a.id=$root OR a.parentProjectId=$root RETURN a.id AS id',{root})).records.map(r=>r.get('id'));
 for(const id of apps){const setting=await request('/dashboard/projects/'+id+'/zkverify/destination');if(setting.destination.chainId!==42161||setting.destination.domainId!==10)throw Error('Destination mismatch');console.log('CHECK '+JSON.stringify({project:id,chainId:setting.destination.chainId,domainId:setting.destination.domainId}));}
 const setting=await request('/dashboard/projects/'+root+'/zkverify/destination');
 const saved=await request('/dashboard/projects/'+root+'/zkverify/destination','PUT',{chainId:42161,revision:setting.revision});if(saved.destination.domainId!==10)throw Error('Saved destination mismatch');
 const project=await request('/dashboard/projects/'+root);
 const {detail:wallet}=await request('/dashboard/projects/'+root+'/wallets/'+project.serverWallet.id+'/detail');
 if(wallet.nativeBalance.chainId!==42161)throw Error('Wrong balance chain');
 console.log('CHECK '+JSON.stringify({dashboardSaveStatus:200,walletBalanceStatus:200,balanceChain:wallet.nativeBalance.chainId,balance:wallet.nativeBalance.value,symbol:wallet.nativeBalance.symbol}));
 const account=await request('/dashboard/projects/'+root+'/zkverify/account?network=zkVerify');console.log('CHECK '+JSON.stringify({verificationAccountStatus:200,network:account.network}));
}finally{await s.run('MATCH(x:GMRAccountSession{tokenHash:$hash}) DETACH DELETE x',{hash});await s.close();await d.close();}`;
const python = `import json,subprocess
c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
e=dict(x.split('=',1) for x in c['Config']['Env'])
payload=json.dumps({'uri':e['GMR_ENGINE_MEMGRAPH_URI'],'user':e.get('GMR_ENGINE_MEMGRAPH_USER',''),'password':e.get('GMR_ENGINE_MEMGRAPH_PASSWORD',''),'cookie':e.get('GMR_ENGINE_DASHBOARD_COOKIE','gmr_engine_session')})
r=subprocess.run(['docker','exec','-i','fluentxverse-server','bun','--no-env-file','-e',${JSON.stringify(script)}],input=payload,text=True,capture_output=True,timeout=150)
if r.returncode: raise RuntimeError(r.stderr[-1500:])
print(r.stdout)`;
if (!process.argv.includes('--readiness-only')) {
  const checks = ssh(`python3 -c ${quote(python)}`, { timeout: 180000 });
  console.log(checks);
  writeFileSync('output/release/arbitrum-migration-20261029/dashboard-verification.json', JSON.stringify({ verifiedAt: new Date().toISOString(), checks: checks.split('\n').filter(s => s.startsWith('CHECK ')).map(s => JSON.parse(s.slice(6))) }, null, 2));
}

const readiness = `import{approvedScreeningArtifacts}from'./src/services/screening/prover';import{screeningChainConfig}from'./src/services/screening/chain';import{tutorPayoutAuthorizationService}from'./src/services/admin.services/tutorPayoutAuthorization.service';import{horizenReceiptReader}from'./src/services/proof.services/horizenReceipt';
for(let n=0;n<240;n++){try{await approvedScreeningArtifacts();const c=screeningChainConfig();if(c.chainId!==42161||c.domainId!==10)throw Error('Screening destination mismatch');await horizenReceiptReader.check({...c,rpcUrl:process.env.SCREENING_RPC_URL});const payout=await tutorPayoutAuthorizationService.readiness();if(!payout.ready||payout.chainId!==42161)throw Error('Payout not ready');console.log('READY '+JSON.stringify({screeningReady:true,payoutReady:true,chainId:42161,domainId:10,bridgeChecked:true}));process.exit(0);}catch(error){if(n===239)throw error;await Bun.sleep(3000);}}`;
const result = ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(readiness)}`, { timeout: 1020000 });
console.log(result);
const verified = result.split('\n').find(s => s.startsWith('READY '));
if (!verified) throw Error('Missing readiness verification');
writeFileSync('output/release/arbitrum-migration-20261029/prover-readiness.json', JSON.stringify({ verifiedAt: new Date().toISOString(), ...JSON.parse(verified.slice(6)) }, null, 2));
