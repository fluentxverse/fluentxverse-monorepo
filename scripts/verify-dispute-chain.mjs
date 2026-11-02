import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { ssh, quote } from './lib/cloud-ssh.mjs';

const directory='output/verification/dispute-chain-20261102';
mkdirSync(directory,{recursive:true});
const artifact=JSON.parse(readFileSync('../budol/gmr-engine/internal/contracts/lesson_disputes/artifact.json'));
const fixture=JSON.parse(readFileSync('output/operations/dispute-chain-sepolia-20261102/fixtures.json'));
const cases=[...new Set(fixture.events.map(e=>e.caseKey))];
const chainSource=String.raw`
import {createPublicClient,http} from 'viem';
const p=await Bun.stdin.json(),map=JSON.parse(process.env.GMR_ENGINE_CHAIN_RPC_URLS||'{}');
const wallet='0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1',address='0x90153ced2a37eeba68c68f945653c7959ba0f627';
const output={};
for(const chainId of [42161,421614]){
 const url=chainId===421614?(process.env.GMR_ENGINE_ARBITRUM_SEPOLIA_RPC_URL||map['421614']||'https://sepolia-rollup.arbitrum.io/rpc'):(map['42161']||'https://arb1.arbitrum.io/rpc');
 const c=createPublicClient({transport:http(url,{timeout:15000,retryCount:0})});
 if(await c.getChainId()!==chainId)throw Error('Wrong chain');
 const read=(functionName,args=[])=>c.readContract({address,abi:p.abi,functionName,args});
 const [owner,engine,paused,nonResponseEnabled,reconciler,policyApproved,balanceWei,code]=await Promise.all([
  read('owner'),read('engine'),read('paused'),read('nonResponseEnabled'),read('reconciler'),read('approvedPolicies',[p.policy]),c.getBalance({address:wallet}),c.getCode({address})]);
 const cases=[];
 if(chainId===421614)for(const key of p.cases){const x=await read('getCase',[key]);cases.push({key,stage:Number(x.stage),outcome:Number(x.outcome),refundApproved:x.refundApproved,nonResponse:x.nonResponse,nonResponseExcused:x.nonResponseExcused,refundRecorded:x.refundReceiptCommitment!=='0x'+'0'.repeat(64)});}
 const runtime=p.runtime.startsWith('0x')?p.runtime:'0x'+p.runtime;
 output[chainId]={address,owner,engine,paused,nonResponseEnabled,reconciler,policyApproved,balanceWei:balanceWei.toString(),runtimeMatches:code?.toLowerCase()===runtime.toLowerCase(),cases};
}
console.log(JSON.stringify(output));
`;
const chains=JSON.parse(ssh('docker exec -i budol-gmr-engine-1 bun --no-env-file -e '+quote(chainSource),{input:JSON.stringify({abi:artifact.abi,runtime:artifact.runtime,policy:fixture.events[0].policyHash,cases}),timeout:120000}));
assert.equal(chains[42161].paused,true);assert.equal(chains[42161].nonResponseEnabled,false);
assert.equal(chains[42161].reconciler,'0x0000000000000000000000000000000000000000');
assert.equal(chains[421614].paused,true);assert.equal(chains[421614].nonResponseEnabled,false);
assert(chains[42161].runtimeMatches&&chains[421614].runtimeMatches);
for(const key of cases){
 const result=chains[421614].cases.find(c=>c.key===key);
 const events=fixture.events.filter(e=>e.caseKey===key);
 const last=events.at(-1);
 if(['staff','cancel','noshow','duration'].includes(last.kind)){assert.equal(result.stage,4);assert.equal(result.outcome,last.outcome);}
 if(events.some(e=>e.kind==='refund'))assert.equal(result.refundRecorded,true);
 if(events.some(e=>e.excuseNonResponse))assert.equal(result.nonResponseExcused,true);
}
const databaseProbe=String.raw`
import json,subprocess
c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
e=dict(x.split('=',1) for x in c['Config']['Env'])
p={k:e.get('GMR_ENGINE_MEMGRAPH_'+k,e.get('ENGINE_MEMGRAPH_'+k,'')) for k in ['URI','USER','PASSWORD']}
source="""import neo4j from 'neo4j-driver';const p=await Bun.stdin.json();const d=neo4j.driver(p.URI,p.USER?neo4j.auth.basic(p.USER,p.PASSWORD):undefined),s=d.session();try{const row=(await s.run("MATCH(c:DisputeSyncCursor) WHERE c.id CONTAINS 'staging-observe-20261102' RETURN c.cursor AS cursor,coalesce(c.halt,'') AS halt")).records[0];if(!row)throw Error('No observer cursor');const r=(await s.run('MATCH(r:DisputeSyncRecord) RETURN count(r) AS n')).records[0];const locks=(await s.run("MATCH(l:EngineWalletLock) WHERE l.transactionId STARTS WITH 'lesson-dispute-sepolia-pilot:' RETURN count(l) AS n")).records[0];console.log(JSON.stringify({cursor:Number(row.get('cursor')),halt:row.get('halt'),importedRecords:Number(r.get('n')),pilotNonceLocks:Number(locks.get('n'))}));}finally{await s.close();await d.close();}"""
subprocess.run(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun','fluentxverse-cloud/api:dispute-sync-20261102-stage-r2','--no-env-file','-e',source],input=json.dumps(p),text=True,check=True)
`;
const database=JSON.parse(ssh('python3 -c '+quote(databaseProbe),{timeout:60000}));
assert(database.cursor>=10);assert.equal(database.halt,'');assert.equal(database.pilotNonceLocks,0);
const containers=ssh("docker inspect budol-gmr-engine-1 fluentxverse-server fxv-dispute-stage-api-1 --format '{{.Name}} {{.Config.Image}} {{.State.Health.Status}}'").trim().split('\n');
assert(containers.some(s=>s.includes('gmr-engine:dispute-sync-20261102-r2 healthy')));
assert(containers.some(s=>s.includes('api:notification-resolution-legacy-20261031 healthy')));
const report={checkedAt:new Date().toISOString(),chains,database,containers,syntheticBusinessEvents:26,rejectionChecks:6,productionApplicationPromoted:false,mainnetWritesEnabled:false};
writeFileSync(directory+'/summary.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({database,containers,chains:Object.fromEntries(Object.entries(chains).map(([k,v])=>[k,{paused:v.paused,nonResponseEnabled:v.nonResponseEnabled,runtimeMatches:v.runtimeMatches,cases:v.cases.length}]))},null,2));
