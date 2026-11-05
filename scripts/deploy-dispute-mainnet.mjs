import {root} from './identity-mainnet-operations.mjs';
import {quote} from './lib/cloud-ssh.mjs';
import {writeFileSync} from 'node:fs';
const remote='/opt/fluentxverse/releases/dispute-mainnet-20261103';
if(!process.argv.includes('--activate'))throw Error('Explicit --activate required');
const py=`import json,subprocess,secrets,os
from pathlib import Path
r=Path('${remote}')
api=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]
engine=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
if api['Config']['Image']!='fluentxverse-cloud/api:profile-review-consistency-20261103' or engine['Config']['Image']!='fluentxverse-cloud/gmr-engine:erc1155-abi-20261102': raise RuntimeError('Live baseline changed')
ae=dict(x.split('=',1) for x in api['Config']['Env']);ee=dict(x.split('=',1) for x in engine['Config']['Env'])
if not ae.get('QA_RECORDING_ENCRYPTION_KEY') or not ae.get('SEAWEED_FILER_URL'): raise RuntimeError('Encrypted evidence storage not configured')
evidence="""import {lessonIssueImageStorage}from'./src/services/lessonIssueImages';const id=crypto.randomUUID(),bytes=Buffer.from('synthetic production storage verification');try{await lessonIssueImageStorage.put(id,bytes);if(!(await lessonIssueImageStorage.get(id)).equals(bytes))throw Error('Storage roundtrip failed');console.log(JSON.stringify({encryptedStorageRoundtrip:true}));}finally{await lessonIssueImageStorage.remove(id);} """
def candidate(code):
 return subprocess.check_output(['docker','run','--rm','--network','container:fluentxverse-server','--env-file','/dev/stdin','--entrypoint','bun','fluentxverse-cloud/api:dispute-mainnet-20261103','--no-env-file','-e',code],input='\\n'.join(api['Config']['Env'])+'\\n',text=True)
print(candidate(evidence))
source="""import neo4j from'neo4j-driver';const p=await Bun.stdin.json();const d=neo4j.driver(p.URI,p.USER?neo4j.auth.basic(p.USER,p.PASSWORD):undefined),s=d.session();try{const txs=await s.run(\"MATCH(t:EngineTransaction) WHERE NOT t.status IN ['confirmed','mined','failed','errored','cancelled'] RETURN count(t) AS n\");if(Number(txs.records[0].get('n')))throw Error('Unsettled Engine transactions; defer activation');const locks=await s.run(\"MATCH(l:EngineWalletLock) WHERE l.lockedUntil > $now AND coalesce(l.transactionId,'')<>'' RETURN count(l) AS n\",{now:new Date().toISOString()});if(Number(locks.records[0].get('n')))throw Error('Active signing lock; defer activation');console.log(JSON.stringify({enginePreflight:true}));}finally{await s.close();await d.close();}"""
p={k:ee.get('GMR_ENGINE_MEMGRAPH_'+k,ee.get('ENGINE_MEMGRAPH_'+k,'')) for k in ['URI','USER','PASSWORD']}
print(subprocess.check_output(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun',api['Config']['Image'],'--no-env-file','-e',source],input=json.dumps(p),text=True))
backup=r/'private/production-rollback.private.json'
if backup.exists(): raise RuntimeError('Activation already started; inspect saved release state')
backup.write_text(json.dumps({'api':api,'engine':engine}));backup.chmod(0o600)
j=json.loads((r/'private/journal.json').read_text())
if not all(j['transactions'].get(k,{}).get('complete') for k in ['policy','propose','accept','enable','unpause']): raise RuntimeError('Contract configuration not confirmed')
key=secrets.token_hex(32)
binding={'projectId':'2a798002-7ed3-4e98-853e-62306479b9da','chainId':42161,'contract':'0x90153ced2a37eeba68c68f945653c7959ba0f627','operator':j['operator'],'policyHash':j['policy'],'feedUrl':'https://api.fluentxverse.com/internal/dispute-chain/events','feedKeyEnv':'GMR_ENGINE_DISPUTE_FEED_KEY','mode':'production','epoch':'production-20261103-v1','reconciler':j['reconciler'],'reconcilerWalletRef':j['reconcilerRef']}
config=r/'private/config.production.json';config.write_text(json.dumps(binding));config.chmod(0o644)
(r/'private/feed-key').write_text(key);(r/'private/feed-key').chmod(0o600)
def args(c):
 labels=c['Config']['Labels'];files=labels['com.docker.compose.project.config_files'].split(',')
 return ['docker','compose','-p',labels['com.docker.compose.project']]+[s for f in files for s in ['-f',f]]
a=args(api);g=args(engine)
apiOverride=r/'private/api.override.json';apiOverride.write_text(json.dumps({'services':{'api':{'image':'fluentxverse-cloud/api:dispute-mainnet-20261103','environment':{'DISPUTE_CHAIN_CAPTURE':'true','DISPUTE_CHAIN_FEED_KEY':key}}}}));apiOverride.chmod(0o600)
volumes=[{'type':m['Type'],'source':m.get('Name') if m['Type']=='volume' else m['Source'],'target':m['Destination'],'read_only':not m['RW']} for m in engine['Mounts'] if m['Destination']!='/run/dispute-sync/config.json']
volumes.append({'type':'bind','source':str(config),'target':'/run/dispute-sync/config.json','read_only':True})
engOverride=r/'private/engine.override.json';engOverride.write_text(json.dumps({'services':{'gmr-engine':{'image':'fluentxverse-cloud/gmr-engine:dispute-mainnet-20261103','environment':{'GMR_ENGINE_DISPUTE_FEED_KEY':key,'GMR_ENGINE_DISPUTE_CONFIG_PATH':'/run/dispute-sync/config.json'},'volumes':volumes}}}));engOverride.chmod(0o600)
try:
 subprocess.run(a+['-f',str(apiOverride),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)
 subprocess.run(g+['-f',str(engOverride),'up','-d','--no-deps','--wait','--wait-timeout','120','gmr-engine'],check=True)
except Exception:
 subprocess.run(g+['up','-d','--no-deps','--wait','--wait-timeout','120','gmr-engine'],check=True)
 subprocess.run(a+['up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)
 raise
print(json.dumps({'productionCapture':True,'engineMode':'production','chainId':42161,'historicalCasesReplayed':False,'reconciler':j['reconciler']}))
`;
const output=root('python3 -c '+quote(py),{timeout:300000});console.log(output);
writeFileSync('output/release/dispute-mainnet-20261103/activation.json',JSON.stringify({at:new Date().toISOString(),output}));
