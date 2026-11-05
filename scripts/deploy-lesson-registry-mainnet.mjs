import { root } from './identity-mainnet-operations.mjs';
import { quote } from './lib/cloud-ssh.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const release = 'output/release/lesson-registry-mainnet-20261104';
const remote = '/opt/fluentxverse/releases/lesson-registry-mainnet-20261104';
const pin = JSON.parse(readFileSync('shared/lessonRegistryDeployment.json'));
const api = JSON.parse(readFileSync(release + '/api-prepared.json'));
const engine = JSON.parse(readFileSync(release + '/prepared.json'));
if (!process.argv.includes('--activate')) throw Error('Explicit --activate required');
const preflight = `import {createPublicClient,http}from'viem';import neo4j from'neo4j-driver';const p=await Bun.stdin.json(),c=createPublicClient({transport:http('https://arb1.arbitrum.io/rpc',{timeout:15000,retryCount:0})});if(await c.getChainId()!==42161)throw Error('Wrong chain');const target={address:p.contract,abi:p.artifact.abi};const runtime=p.artifact.runtime.startsWith('0x')?p.artifact.runtime:'0x'+p.artifact.runtime;if((await c.getCode({address:p.contract}))?.toLowerCase()!==runtime.toLowerCase())throw Error('Runtime mismatch');for(const [fn,expected]of [['owner',p.operator],['engine',p.operator],['reconciler',p.reconciler]])if((await c.readContract({...target,functionName:fn})).toLowerCase()!==expected.toLowerCase())throw Error('Role mismatch');if(await c.readContract({...target,functionName:'paused'})||!await c.readContract({...target,functionName:'nonResponseEnabled'})||!await c.readContract({...target,functionName:'approvedPolicies',args:[p.policyHash]}))throw Error('Registry configuration not active');const d=neo4j.driver(p.URI,p.USER?neo4j.auth.basic(p.USER,p.PASSWORD):undefined),s=d.session();try{const locks=Number((await s.run(\"MATCH(l:EngineWalletLock) WHERE l.lockedUntil > $now AND coalesce(l.transactionId,'')<>'' RETURN count(l) AS n\",{now:new Date().toISOString()})).records[0].get('n'));if(locks)throw Error('Engine signing lock active; defer deployment');const pending=Number((await s.run(\"MATCH(r:DisputeSyncRecord) WHERE r.binding CONTAINS 'production-' AND r.state<>'finalized' RETURN count(r) AS n\")).records[0].get('n'));if(pending)throw Error('Pending production dispute relay; defer deployment');const halted=Number((await s.run(\"MATCH(c:DisputeSyncCursor) WHERE c.id CONTAINS 'production-' AND coalesce(c.halt,'')<>'' RETURN count(c) AS n\")).records[0].get('n'));if(halted)throw Error('Existing relay halted');console.log(JSON.stringify({runtimeMatched:true,rolesMatched:true,policyApproved:true,signingLocks:locks,pendingDisputes:pending}));}finally{await s.close();await d.close();}`;
const py = `import json,subprocess,secrets,os
from pathlib import Path
r=Path('${remote}')
a=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]
e=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
if a['Config']['Image']!='${api.baseline}' or e['Config']['Image']!='${engine.baseline}':raise RuntimeError('Live baseline changed')
if any(c['State'].get('Health',{}).get('Status')!='healthy' for c in [a,e]):raise RuntimeError('Live baseline unhealthy')
backup=r/'private/activation-rollback.private.json'
if backup.exists():raise RuntimeError('Activation already started; inspect persistent release state')
ae=dict(x.split('=',1) for x in a['Config']['Env']);ee=dict(x.split('=',1) for x in e['Config']['Env'])
if ae.get('DISPUTE_CHAIN_CAPTURE')!='true' or ee.get('GMR_ENGINE_DISPUTE_CONFIG_PATH')!='/run/dispute-sync/config.json':raise RuntimeError('Legacy routing not configured')
if ae.get('LESSON_REGISTRY_CAPTURE')=='true' or ee.get('GMR_ENGINE_LESSON_REGISTRY_CONFIG_PATH'):raise RuntimeError('Unexpected existing registry activation')
j=json.loads((r/'private/journal.json').read_text())
if j['contract']!='${pin.contract}' or not all(j['transactions'].get(k,{}).get('complete') for k in ['deploy','policy','propose','accept','enable','unpause']):raise RuntimeError('Contract operations not confirmed')
payload={k:ee.get('GMR_ENGINE_MEMGRAPH_'+k,ee.get('ENGINE_MEMGRAPH_'+k,'')) for k in ['URI','USER','PASSWORD']}
payload.update(json.loads(${JSON.stringify(JSON.stringify(pin))}));payload['reconciler']=j['reconciler'];payload['artifact']=json.loads((r/'engine/scripts/lesson-registry-artifact.json').read_text())
print(subprocess.check_output(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun','${api.image}','--no-env-file','-e',${JSON.stringify(preflight)}],input=json.dumps(payload),text=True))
def private(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump(value,f);f.flush();os.fsync(f.fileno())
private(backup,{'api':a,'engine':e})
key=secrets.token_hex(32)
binding=json.loads(${JSON.stringify(JSON.stringify(pin))});binding={k:binding[k] for k in ['projectId','chainId','contract','operator','policyHash','feedUrl','epoch']}
binding.update({'lessonRegistry':True,'feedKeyEnv':'GMR_ENGINE_LESSON_REGISTRY_FEED_KEY','mode':'production','reconciler':j['reconciler'],'reconcilerWalletRef':j['reconcilerRef']})
config=r/'private/config.production.json';private(config,binding);config.chmod(0o644)
apiOverride=r/'private/api.override.json';private(apiOverride,{'services':{'api':{'image':'${api.image}','environment':{'LESSON_REGISTRY_CAPTURE':'true','LESSON_REGISTRY_CHAIN_ID':'42161','LESSON_REGISTRY_CONTRACT':'${pin.contract}','LESSON_REGISTRY_PRODUCTION':'${pin.epoch}','LESSON_REGISTRY_FEED_KEY':key}}}})
volumes=[{'type':m['Type'],'source':m.get('Name') if m['Type']=='volume' else m['Source'],'target':m['Destination'],'read_only':not m['RW']} for m in e['Mounts']]
volumes.append({'type':'bind','source':str(config),'target':'/run/lesson-registry-sync/config.json','read_only':True})
engineOverride=r/'private/engine.override.json';private(engineOverride,{'services':{'gmr-engine':{'image':'${engine.image}','environment':{'GMR_ENGINE_LESSON_REGISTRY_CONFIG_PATH':'/run/lesson-registry-sync/config.json','GMR_ENGINE_LESSON_REGISTRY_FEED_KEY':key},'volumes':volumes}}})
def args(c):
 labels=c['Config']['Labels'];files=labels['com.docker.compose.project.config_files'].split(',')
 if not all(Path(f).is_file() for f in files):raise RuntimeError('Compose baseline file missing')
 return ['docker','compose','-p',labels['com.docker.compose.project']]+[x for f in files for x in ['-f',f]]
aa=args(a);ea=args(e)
# Start the new worker first. It has no v2 records to sign until the API cutover commits.
subprocess.run(ea+['-f',str(engineOverride),'up','-d','--no-deps','--wait','--wait-timeout','120','gmr-engine'],check=True)
subprocess.run(aa+['-f',str(apiOverride),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)
print(json.dumps({'chainId':42161,'contract':'${pin.contract}','capture':True,'engineMode':'production','legacyWorkerRetained':True,'historicalBookingsEnrolled':False}))
`;
const artifact = readFileSync(release + '/engine-source/internal/contracts/lesson_registry/artifact.json');
root(`install -m 644 /dev/stdin ${remote}/engine/scripts/lesson-registry-artifact.json`, { input: artifact });
const output = root('python3 -c ' + quote(py), { timeout: 300000 });
console.log(output);
writeFileSync(release + '/activation.json', JSON.stringify({ at: new Date().toISOString(), output }, null, 2));
