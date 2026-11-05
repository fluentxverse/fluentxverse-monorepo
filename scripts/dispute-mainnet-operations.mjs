import {root} from './identity-mainnet-operations.mjs';
import {quote} from './lib/cloud-ssh.mjs';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const remote='/opt/fluentxverse/releases/dispute-mainnet-20261103',image='fluentxverse-cloud/gmr-engine:dispute-mainnet-20261103';
const project='2a798002-7ed3-4e98-853e-62306479b9da',policy='0x18a65d4e461f681c8d79db08edb3acf75a4494d16c16d2751d7c13642d841144';
const op=process.argv.find(a=>a.startsWith('--operation='))?.slice(12);
if(process.argv.includes('--configure')){
 for(const step of ['policy','fund-reconciler','propose','accept','enable','unpause']){
   let complete=false;
   for(let attempt=0;attempt<12;attempt++){
     const result=JSON.parse(execFileSync('node',[fileURLToPath(import.meta.url),'--operation='+step],{encoding:'utf8',timeout:110000}));
     console.log(JSON.stringify({operation:step,...result}));
     if(result.status==='confirmed'){complete=true;break;}
     if(result.status!=='submitted')throw Error('Unrecognized activation status');
     await new Promise(resolve=>setTimeout(resolve,1500));
   }
   if(!complete)throw Error('Activation confirmation pending; rerun using the existing journal');
 }
}else if(process.argv.includes('--upload')){
 root(`install -d -m 700 ${remote}/engine ${remote}/private && tar -xzf - -C ${remote}/engine`,{input:readFileSync('output/release/dispute-mainnet-20261103/engine.tar.gz')});
 console.log(root(`docker build --network none -t ${image} ${remote}/engine`));
}else if(op){
 if(!['policy','fund-reconciler','propose','accept','enable','disable','unpause','pause','verify'].includes(op))throw Error('Unsupported production configuration operation');
 const py=`import json,subprocess\nc=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]\nargs=['docker','run','--rm','--network','container:budol-gmr-engine-1','--env-file','/dev/stdin','-v','${remote}/private:/mainnet','--entrypoint','/usr/local/bin/dispute-mainnet','${image}','-journal','/mainnet/journal.json','-project','${project}','-policy','${policy}','-operation','${op}']\nprint(subprocess.check_output(args,input='\\n'.join(c['Config']['Env'])+'\\n',text=True))`;
 console.log(root('python3 -c '+quote(py)));
}else if(process.argv.includes('--negative-checks')){
 const fixture=JSON.parse(readFileSync('output/release/dispute-mainnet-20261103/smoke.json','utf8'));
 const artifact=JSON.parse(readFileSync('output/release/dispute-mainnet-20261103/engine-source/internal/contracts/lesson_disputes/artifact.json','utf8'));
 const code=`import{createPublicClient,http,BaseError,ContractFunctionRevertedError}from'viem';const p=await Bun.stdin.json();const c=createPublicClient({transport:http('https://arb1.arbitrum.io/rpc',{timeout:15000,retryCount:0})});if(await c.getChainId()!==42161)throw Error('Wrong chain');const address='0x90153ced2a37eeba68c68f945653c7959ba0f627',operator='0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1',word='0x'+'1'.repeat(64),other='0x'+'9'.repeat(64);const cases=[{name:'duplicate case',account:operator,functionName:'openStaffReviewCase',args:[p.key,word,'${policy}']},{name:'unauthorized sender',account:'0x1111111111111111111111111111111111111111',functionName:'openCase',args:[other,word,'${policy}']},{name:'unapproved policy',account:operator,functionName:'openCase',args:[other,word,word]},{name:'refund without approval',account:operator,functionName:'recordRefundDelivery',args:[p.key,word]}];const results=[];for(const test of cases){try{await c.simulateContract({address,abi:p.abi,...test});throw Error('Unexpectedly accepted '+test.name);}catch(e){const cause=e instanceof BaseError?e.walk(c=>c instanceof ContractFunctionRevertedError):null;if(!(cause instanceof ContractFunctionRevertedError)||!cause.data?.errorName)throw e;results.push({name:test.name,reverted:cause.data.errorName});}}console.log(JSON.stringify({chainId:42161,simulations:results,transactionsSent:0}));`;
 const result=root('docker exec -i fluentxverse-server bun --no-env-file -e '+quote(code),{input:JSON.stringify({abi:artifact.abi,key:fixture.caseKey})});
 console.log(result);
}else if(process.argv.includes('--verify-case')){
 const fixture=JSON.parse(readFileSync('output/release/dispute-mainnet-20261103/smoke.json','utf8'));
 const artifact=JSON.parse(readFileSync('output/release/dispute-mainnet-20261103/engine-source/internal/contracts/lesson_disputes/artifact.json','utf8'));
 const code=`import{createPublicClient,http,BaseError,ContractFunctionRevertedError}from'viem';const p=await Bun.stdin.json();const c=createPublicClient({transport:http('https://arb1.arbitrum.io/rpc',{timeout:15000,retryCount:0})});if(await c.getChainId()!==42161)throw Error('Wrong chain');const block=await c.getBlock({blockTag:'finalized'}),address='0x90153ced2a37eeba68c68f945653c7959ba0f627';const project=a=>({stage:Number(a.stage),outcome:Number(a.outcome),refundApproved:a.refundApproved,decisionCount:String(a.decisionCount)});const a=await c.readContract({address,abi:p.abi,functionName:'getCase',args:[p.key]});let final=null;try{final=project(await c.readContract({address,abi:p.abi,functionName:'getCase',args:[p.key],blockNumber:block.number}));}catch(e){const cause=e instanceof BaseError?e.walk(c=>c instanceof ContractFunctionRevertedError):null;if(!(cause instanceof ContractFunctionRevertedError)||cause.data?.errorName!=='CaseNotFound')throw e;final={pending:true};}console.log(JSON.stringify({chainId:42161,caseKey:p.key,latest:project(a),finalized:{block:String(block.number),...final}}));`;
 console.log(root('docker exec -i fluentxverse-server bun --no-env-file -e '+quote(code),{input:JSON.stringify({abi:artifact.abi,key:fixture.caseKey})}));
}else if(process.argv.includes('--status')){
 const source=`import neo4j from'neo4j-driver';const p=await Bun.stdin.json();const d=neo4j.driver(p.URI,p.USER?neo4j.auth.basic(p.USER,p.PASSWORD):undefined),s=d.session();try{const cursors=(await s.run("MATCH(c:DisputeSyncCursor) WHERE c.id CONTAINS ':production-20261103-v1:' RETURN c.cursor AS cursor,c.halt AS halt")).records.map(r=>({cursor:Number(r.get('cursor')),halt:r.get('halt')}));const records=(await s.run("MATCH(r:DisputeSyncRecord) WHERE r.binding CONTAINS ':production-20261103-v1:' RETURN r.json AS json ORDER BY r.sequence")).records.map(r=>{const j=JSON.parse(r.get('json'));return {sequence:j.sequence,state:j.state,hash:j.hash,step:j.step,error:j.error}});const receipts=(await s.run("MATCH(r:DisputeSyncReceipt) WHERE r.binding CONTAINS ':production-20261103-v1:' RETURN r.id AS id,r.hash AS hash,r.blockHash AS blockHash ORDER BY r.recordedAt")).records.map(r=>r.toObject());const locks=(await s.run("MATCH(l:EngineWalletLock) WHERE l.transactionId CONTAINS ':production-20261103-v1:' RETURN count(l) AS n")).records[0];console.log(JSON.stringify({cursors,records,receipts,activeProductionNonceLocks:Number(locks.get('n'))}));}finally{await s.close();await d.close();}`;
 const py=`import json,subprocess\ne=dict(x.split('=',1) for x in json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]['Config']['Env'])\np={k:e.get('GMR_ENGINE_MEMGRAPH_'+k,e.get('ENGINE_MEMGRAPH_'+k,'')) for k in ['URI','USER','PASSWORD']}\nprint(subprocess.check_output(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun','fluentxverse-cloud/api:dispute-mainnet-20261103','--no-env-file','-e',${JSON.stringify(source)}],input=json.dumps(p),text=True))`;
 console.log(root('python3 -c '+quote(py)));
}else if(process.argv.includes('--journal')){
 const py=`import json\nfrom pathlib import Path\np=Path('${remote}/private/journal.json')\nj=json.loads(p.read_text())\nprint(json.dumps({'contract':j['contract'],'reconciler':j['reconciler'],'operations':{k:{f:v.get(f) for f in ['hash','complete','finalized','blockHash']} for k,v in j['transactions'].items()}}))`;
 console.log(root('python3 -c '+quote(py)));
}else if(process.argv.includes('--inspect')){
 const code=`import{createPublicClient,http,parseAbi}from'viem';const c=createPublicClient({transport:http('https://arb1.arbitrum.io/rpc',{timeout:15000,retryCount:0})});if(await c.getChainId()!==42161)throw Error('Wrong chain');const address='0x90153ced2a37eeba68c68f945653c7959ba0f627',abi=parseAbi(['function owner() view returns(address)','function engine() view returns(address)','function paused() view returns(bool)','function nonResponseEnabled() view returns(bool)','function reconciler() view returns(address)','function pendingReconciler() view returns(address)','function approvedPolicies(bytes32) view returns(bool)']);const out={chainId:42161,address};for(const name of ['owner','engine','paused','nonResponseEnabled','reconciler','pendingReconciler'])out[name]=await c.readContract({address,abi,functionName:name});out.policyApproved=await c.readContract({address,abi,functionName:'approvedPolicies',args:['${policy}']});out.operatorBalance=String(await c.getBalance({address:out.engine}));console.log(JSON.stringify(out));`;
 console.log(root('docker exec fluentxverse-server bun --no-env-file -e '+quote(code)));
}else throw Error('Use --upload, --operation, --journal or --inspect');
