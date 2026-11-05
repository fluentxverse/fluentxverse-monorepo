import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ssh, sshOptions, cloudHost, quote } from './lib/cloud-ssh.mjs';

const directory='output/release/identity-pilot-20261103';
mkdirSync(directory,{recursive:true,mode:0o700});
const journal=join(directory,'operations.json');
const state=existsSync(journal)?JSON.parse(readFileSync(journal,'utf8')):{};
const save=()=>writeFileSync(journal,JSON.stringify(state,null,2),{mode:0o600});
const project='2a798002-7ed3-4e98-853e-62306479b9da';
const operator='0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1';
const root=command=>execFileSync('ssh',[...sshOptions,'root@'+cloudHost,command],{encoding:'utf8',timeout:120000,maxBuffer:2e6});
function database(query,params={}){
  const code=`import neo4j from 'neo4j-driver';const p=await Bun.stdin.json();for(const k of ['old','chains'])if(p.params[k])p.params[k]=p.params[k].map(n=>neo4j.int(n));const d=neo4j.driver(p.uri,neo4j.auth.basic(p.user,p.password),{disableLosslessIntegers:true}),s=d.session();try{console.log(JSON.stringify((await s.run(p.query,p.params)).records.map(r=>r.toObject())));}finally{await s.close();await d.close();}`;
  const python=`import json,subprocess\ne=dict(x.split('=',1) for x in json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]['Config']['Env'])\ndef env(k): return e.get('GMR_ENGINE_MEMGRAPH_'+k,e.get('ENGINE_MEMGRAPH_'+k,''))\np={'uri':env('URI'),'user':env('USER'),'password':env('PASSWORD'),'query':${JSON.stringify(query)},'params':json.loads(${JSON.stringify(JSON.stringify(params))})}\nimage=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]['Config']['Image']\nprint(subprocess.check_output(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun',image,'--no-env-file','-e',${JSON.stringify(code)}],input=json.dumps(p),text=True))`;
  return JSON.parse(root('python3 -c '+quote(python)));
}
function request(path,body){
  const code=`const p=await Bun.stdin.json();const r=await fetch('http://127.0.0.1:8090'+p.path,{method:p.body===null?'GET':'POST',headers:{'Content-Type':'application/json','X-GMR-Engine-Key':p.key},body:p.body===null?undefined:JSON.stringify(p.body),signal:AbortSignal.timeout(60000)});const d=await r.json();console.log(JSON.stringify({status:r.status,data:d}));`;
  const python=`import json,subprocess\nfrom pathlib import Path\np=json.loads(Path('/opt/fluentxverse/releases/identity-pilot-20261103/connection.private.json').read_text())\np.update({'path':${JSON.stringify(path)},'body':json.loads(${JSON.stringify(JSON.stringify(body??null))})})\nimage=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]['Config']['Image']\nprint(subprocess.check_output(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun',image,'--no-env-file','-e',${JSON.stringify(code)}],input=json.dumps(p),text=True))`;
  const response=JSON.parse(root('python3 -c '+quote(python)));
  if(response.status<200||response.status>=300)throw Error('Pilot Engine request failed '+response.status+': '+JSON.stringify(response.data));
  return response.data;
}
const mode=process.argv[2];
if(mode==='--create-connection'){
  const code=`const p=await Bun.stdin.json();const r=await fetch('http://127.0.0.1:8090/admin/apps/${project}/api-keys',{method:'POST',headers:{'Content-Type':'application/json','X-GMR-Engine-Admin-Key':p.admin},body:JSON.stringify({name:'Identity Sepolia pilot 20261103',scopes:['contracts:read','contracts:write','transactions:read','transactions:write']})});if(!r.ok)throw Error('Pilot key creation failed '+r.status);console.log(JSON.stringify(await r.json()));`;
  const python=`import json,subprocess,os\nfrom pathlib import Path\np=Path('/opt/fluentxverse/releases/identity-pilot-20261103/connection.private.json');p.parent.mkdir(parents=True,exist_ok=True,mode=0o700)\nif p.exists():\n print(json.dumps({'connectionAlreadyCreated':True}))\nelse:\n e=dict(x.split('=',1) for x in json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]['Config']['Env'])\n admin=e.get('GMR_ENGINE_ADMIN_API_KEY',e.get('ENGINE_ADMIN_API_KEY',''))\n image=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]['Config']['Image']\n result=json.loads(subprocess.check_output(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun',image,'--no-env-file','-e',${JSON.stringify(code)}],input=json.dumps({'admin':admin}),text=True))\n fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)\n with os.fdopen(fd,'w') as f: json.dump({'key':result['plaintext'],'keyId':result['key']['id'],'projectId':'${project}'},f)\n print(json.dumps({'connectionCreated':True,'keyId':result['key']['id']}))`;
  console.log(root('python3 -c '+quote(python)));
}else if(mode==='--allow-testnet'){
  const rows=database('MATCH(a:EngineApp {id:$id}) RETURN a.allowedChains AS chains',{id:project});
  if(rows.length!==1)throw Error('Expected FluentXVerse project');
  if(!rows[0].chains.includes(421614)){
    state.originalAllowedChains=rows[0].chains;save();
    const result=database(`MATCH(a:EngineApp {id:$id}) WHERE a.allowedChains=$old
      CREATE(:EngineIdentityPilotAudit {id:$event,projectId:$id,reason:'Enable Arbitrum Sepolia identity credential pilot',at:$at,previousChains:$old})
      SET a.allowedChains=$chains RETURN a.id AS id`,{id:project,old:rows[0].chains,chains:[...rows[0].chains,421614],event:crypto.randomUUID(),at:new Date().toISOString()});
    if(result.length!==1)throw Error('Project policy changed; abort');
  }
  console.log(JSON.stringify({testnetAllowed:true,mainnetDestinationsUnchanged:true}));
}else if(mode==='--deploy-collection'){
  if(state.deploymentAttempted){
    if(!process.argv.includes('--retry-confirmed-403'))throw Error('A deployment was already attempted. Inspect --status; do not submit another.');
    const rows=database("MATCH(d:ERC1155EditionDeployment {appId:$project,chainId:421614,name:'FluentXVerse TEST Identity'}) RETURN d.id AS id",{project});
    if(rows.length||state.deploymentId)throw Error('Existing deployment; do not retry');
    state.previousAttemptDenied403=state.deploymentAttempted;
  }
  state.deploymentAttempted=new Date().toISOString();save();
  const {deployment:d}=request('/v1/contracts/erc1155-editions/deployments',{name:'FluentXVerse TEST Identity',symbol:'FXVIDTEST',
    chainId:421614,ownerAddress:operator,recipientAddress:operator,initialTokenId:'0',initialSupply:'0',
    baseUri:'https://api.fluentxverse.com/proof/tutor-identity/test-metadata/{id}.json',contractUri:'',
    description:'TEST ONLY. Synthetic or mock interview identity attestations. Not a production KYC credential.'});
  state.deploymentId=d.id;save();console.log(JSON.stringify({deploymentId:d.id,status:d.status,chainId:421614}));
}else if(mode==='--status'){
  const rows=database(`MATCH(d:ERC1155EditionDeployment {appId:$project,chainId:421614,name:'FluentXVerse TEST Identity'})
    RETURN d.id AS id,d.status AS status,d.contractAddress AS address,d.transactionHash AS transactionHash,d.error AS error`,{project});
  if(rows.length===1){state.deploymentId=rows[0].id;state.collection=rows[0].address;state.deploymentStatus=rows[0].status;save();}
  console.log(JSON.stringify(rows));
}else if(mode==='--proof-status'){
  console.log(JSON.stringify(database(`MATCH(p:ZKProofSubmission {appId:$project}) WHERE p.createdAt >= '2026-11-03'
    RETURN p.id AS id,p.status AS status,p.zkVerifyNetwork AS network,p.error AS error,p.transactionResult AS transactionResult ORDER BY p.createdAt DESC LIMIT 5`,{project})));
}else if(mode==='--resume-unsubmitted-proof'){
  const rows=database("MATCH(p:ZKProofSubmission {appId:$project}) WHERE p.createdAt >= '2026-11-03' RETURN p.id AS id",{project});
  if(rows.length)throw Error('Engine has a proof record; reconcile it instead of submitting again');
  const code=`import neo4j from 'neo4j-driver';const d=neo4j.driver('bolt://fxv-identity-pilot-graph:7687'),s=d.session();try{await s.executeWrite(async tx=>{const j=(await tx.run('MATCH(j:TutorIdentityCredential {id:$id}) RETURN j',{id:'identity-pilot-20261103-submission'})).records[0]?.get('j').properties;if(!j||j.issuanceStage!=='reconciliation_required'||j.proofSubmissionId||j.mintTransactionId)throw Error('Unexpected pilot stage');const job=JSON.parse(j.issuanceJson);if(!job.proof||job.proofSubmissionId||job.mintTransactionId)throw Error('Unexpected pilot side effect');job.stage='proved';await tx.run("MATCH(j:TutorIdentityCredential {id:$id}) SET j.issuanceStage='proved',j.issuanceJson=$json,j.reconciledReason='Runner DNS failure; Engine has no submission record',j.issuanceNextAttempt=$at",{id:j.id,json:JSON.stringify(job),at:new Date().toISOString()});});console.log(JSON.stringify({resumedUnsubmittedProof:true,chainTransactions:0}));}finally{await s.close();await d.close();}`;
  console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(code)));
}else if(mode==='--mint-status'||mode==='--capture-result'){
  const code=`import neo4j from'neo4j-driver';const d=neo4j.driver('bolt://fxv-identity-pilot-graph:7687'),s=d.session();try{const j=(await s.run('MATCH(j:TutorIdentityCredential {id:$id}) RETURN j',{id:'identity-pilot-20261103-submission'})).records[0].get('j').properties;const m=(await s.run('MATCH(m:TutorIdentityPublicMetadata) RETURN m.json AS json LIMIT 1')).records[0]?.get('json');const job=JSON.parse(j.issuanceJson);console.log(JSON.stringify({stage:j.issuanceStage,mintId:j.mintTransactionId,job,metadata:m?JSON.parse(m):null}));}finally{await s.close();await d.close();}`;
  const info=JSON.parse(ssh('docker exec fluentxverse-server bun --no-env-file -e '+quote(code)));
  const transaction=info.mintId?request('/v1/transactions/'+encodeURIComponent(info.mintId)).transaction:null;
  console.log(JSON.stringify({stage:info.stage,tokenId:info.job.tokenId,mintStatus:transaction?.status,mintHash:transaction?.transactionHash,mintError:transaction?.error}));
  if(mode==='--capture-result'){
    if(info.stage!=='issued'||!info.metadata)throw Error('Pilot has not passed finality checks');
    const report={passed:true,mock:true,chainId:421614,collection:info.job.binding.collection,tokenId:info.job.tokenId,
      nativeProofTransaction:info.job.nativeProofTransactionHash,mintTransaction:info.job.mintTransactionHash,metadata:info.metadata};
    writeFileSync(join(directory,'pilot-result.json'),JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({captured:true,passed:true}));
  }
}else if(mode==='--lock'){
  if(!/^0x[a-fA-F0-9]{40}$/.test(state.collection||'')||state.deploymentStatus!=='confirmed')throw Error('Confirm deployment first');
  const abi=[{type:'function',name:'lockTransfersPermanently',stateMutability:'nonpayable',inputs:[],outputs:[]}];
  const {transaction:t}=request('/v1/transactions',{idempotencyKey:'fxv-identity-pilot-lock-20261103',chainId:421614,walletAddress:operator,
    contractAddress:state.collection,kind:'contract_write',method:'lockTransfersPermanently',args:[],value:'0',metadata:{abi}});
  state.lockTransactionId=t.id;save();console.log(JSON.stringify({transactionId:t.id,status:t.status}));
}else throw Error('Use --create-connection, --allow-testnet, --deploy-collection, --status or --lock');
