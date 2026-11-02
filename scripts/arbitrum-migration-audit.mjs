import { ssh, quote } from './lib/cloud-ssh.mjs';

const code = `import json,subprocess
c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
e=dict(x.split('=',1) for x in c['Config']['Env'])
mount=next(m for m in c['Mounts'] if m['Destination']=='/app/config')
root='2a798002-7ed3-4e98-853e-62306479b9da'
for key in ['GMR_ENGINE_ZKVERIFY_POLICY_PATH','GMR_ENGINE_SCREENING_PROVER_PATH','GMR_ENGINE_PAYOUT_PROVER_PATH']:
 path=mount['Source']+e[key][len('/app/config'):]
 data=json.load(open(path))
 out={}
 for id,p in data.items():
  cfg=p.get('config',p)
  out[id]={k:cfg[k] for k in ['enabled','chainId','domainId','network','verificationNetwork','bindings','releasePolicy'] if k in cfg}
 print(json.dumps({'setting':key,'projects':out}))
a=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]
ae=dict(x.split('=',1) for x in a['Config']['Env'])
print(json.dumps({'apiImage':a['Config']['Image'],'engineImage':c['Config']['Image'],'rpcChains':list(json.loads(e.get('GMR_ENGINE_CHAIN_RPC_URLS','{}'))),'env':{k:v for k,v in ae.items() if any(k.startswith(p) for p in ['SCREENING_','PAYOUT_','ANONYMOUS_REVIEWS_','LESSON_PASSES_','ZKVERIFY_']) and any(k.endswith(s) for s in ['CHAIN_ID','DOMAIN_ID','ENABLED','NETWORK','BRIDGE'])}}))
script="""import neo4j from 'neo4j-driver';const input=JSON.parse(await Bun.stdin.text());const d=neo4j.driver(input.uri,neo4j.auth.basic(input.user,input.password));const s=d.session();try{const r=await s.run('MATCH(a:EngineApp) WHERE a.id=$root OR a.parentProjectId=$root RETURN a.id AS id,a.name AS name,a.moduleName AS module,a.allowedChains AS chains,a.proofReceiptChainId AS destination,a.proofDestinationRevision AS revision',{root:input.root});console.log(JSON.stringify({projects:r.records.map(r=>r.toObject())}));const p=await s.run('MATCH(p:ZKProofSubmission) WHERE p.appId IN $ids RETURN p.status AS status,count(p) AS count',{ids:r.records.map(r=>r.get('id'))});console.log(JSON.stringify({proofs:p.records.map(r=>r.toObject())}));}finally{await s.close();await d.close();}"""
payload=json.dumps({'uri':e['GMR_ENGINE_MEMGRAPH_URI'],'user':e.get('GMR_ENGINE_MEMGRAPH_USER',''),'password':e.get('GMR_ENGINE_MEMGRAPH_PASSWORD',''),'root':root})
result=subprocess.run(['docker','exec','-i','fluentxverse-server','bun','--no-env-file','-e',script],input=payload,text=True,capture_output=True)
if result.returncode: raise RuntimeError('Graph audit failed: '+result.stderr[:200])
print(result.stdout)
details="""import neo4j from 'neo4j-driver';const i=JSON.parse(await Bun.stdin.text()),d=neo4j.driver(i.uri,neo4j.auth.basic(i.user,i.password)),s=d.session();try{const r=await s.run(\"MATCH(p:ZKProofSubmission) WHERE p.status<>'finalized' RETURN p.id AS id,p.appId AS appId,p.domainId AS domain,p.status AS status,p.createdAt AS createdAt,p.transactionResult AS result\");console.log(JSON.stringify({pending:r.records.map(r=>{const v=r.toObject();try{const t=JSON.parse(v.result||'{}');v.result={status:t.status,txHash:t.txHash,domainId:t.domainId};}catch{v.result={};}return v;})}));}finally{await s.close();await d.close();}"""
result=subprocess.run(['docker','exec','-i','fluentxverse-server','bun','--no-env-file','-e',details],input=payload,text=True,capture_output=True)
if result.returncode: raise RuntimeError('Proof audit failed')
print(result.stdout)
census="""import{initDriver,getDriver,closeDriver}from'./src/db/memgraph';await initDriver(process.env.MEMGRAPH_URI,process.env.MEMGRAPH_USER,process.env.MEMGRAPH_PASSWORD);const s=getDriver().session();try{for(const label of ['TutorScreeningCredential','TutorPayoutAuthorization','AnonymousReviewGroup','LessonPassAccount']){const r=await s.run('MATCH(n:'+label+') RETURN n.status AS status,n.revoked AS revoked,count(n) AS count');console.log(JSON.stringify({label,states:r.records.map(r=>r.toObject())}));}}finally{await s.close();await closeDriver();}"""
result=subprocess.run(['docker','exec','fluentxverse-server','bun','--no-env-file','-e',census],text=True,capture_output=True)
if result.returncode: raise RuntimeError('Application audit failed')
print(result.stdout)
`;
console.log(ssh(`python3 -c ${quote(code)}`, { timeout: 60000 }));
