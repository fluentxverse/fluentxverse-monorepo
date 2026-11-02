import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ssh, quote } from './lib/cloud-ssh.mjs';
const root=process.cwd(), release=join(root,'output/release/dispute-sync-20261102');
const meta=JSON.parse(readFileSync(join(release,'prepared.json')));
const remote='/opt/fluentxverse/releases/dispute-sync-20261102';
const runner='/app/deployments/dispute-pilot-20261102';
const journal=runner+'/private/journal.json';
const project='2a798002-7ed3-4e98-853e-62306479b9da';
const policy='0x18a65d4e461f681c8d79db08edb3acf75a4494d16c16d2751d7c13642d841144';
const run=(cmd,args,options={})=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:8e6,...options});
if(process.argv.includes('--pilot-upload')){
  ssh(`install -d -m 700 ${remote}/pilot && tar -xzf - -C ${remote}/pilot`,{input:readFileSync(join(release,'pilot.tar.gz'))});
  console.log(ssh(`docker exec budol-gmr-engine-1 mkdir -p ${runner} && docker cp ${remote}/pilot/. budol-gmr-engine-1:${runner}/`));
}else if(process.argv.includes('--pilot-operation')){
  const op=process.argv[process.argv.indexOf('--pilot-operation')+1];
  if(!['deploy','policy','unpause','fund-reconciler','propose','accept','enable','disable','pause','verify'].includes(op))throw Error('Invalid pilot operation');
  console.log(ssh(`docker exec -w ${runner} budol-gmr-engine-1 ./dispute-pilot -journal ${journal} -project ${project} -policy ${policy} -operation ${op}`,{timeout:120000}));
}else if(process.argv.includes('--upload')){
  if(ssh("docker inspect budol-gmr-engine-1 --format '{{.Config.Image}}'").trim()!==meta.baseline)throw Error('Engine baseline changed');
  ssh(`install -d -m 700 ${remote}/engine && tar -xzf - -C ${remote}/engine`,{input:readFileSync(join(release,'engine.tar.gz'))});
  console.log(ssh(`docker build --pull=false --network=none -t ${meta.image} ${remote}/engine`,{timeout:180000}));
}else if(process.argv.includes('--staging')){
  const paths=['fluentxverse-server/src/services/studentDispute.service.ts','fluentxverse-server/src/services/ticket.services/cancellationRefund.service.ts','fluentxverse-server/src/services/disputeChain','fluentxverse-server/src/routes/disputeChain.route.ts','shared/disputeChainPolicy.json'];
  const bundle=execFileSync('tar',['-czf','-',...paths],{cwd:root,maxBuffer:8e6});
  ssh(`install -d -m 700 ${remote}/api && tar -xzf - -C ${remote}/api`,{input:bundle});
  const script=String.raw`
import json,os,secrets,subprocess
from pathlib import Path
p=Path('/opt/fluentxverse/staging/disputes-20261031')
release=Path('/opt/fluentxverse/releases/dispute-sync-20261102')
c=json.loads((p/'compose.json').read_text())
if c['services']['api']['image']!='fluentxverse-cloud/api:dispute-staging-20261031': raise RuntimeError('Staging API baseline changed')
image='fluentxverse-cloud/api:dispute-sync-20261102-stage'
index=subprocess.check_output(['docker','exec','fxv-dispute-stage-api-1','cat','/app/src/index.ts'],text=True)
if 'disputeChainRoute' in index: raise RuntimeError('Route already installed')
index=index.replace("import Elysia from", "import { disputeChainRoute } from './routes/disputeChain.route';\nimport Elysia from",1)
if index.count('.use(Inbox)')!=1: raise RuntimeError('Unexpected staging route layout')
index=index.replace('.use(Inbox)','.use(Inbox)\n  .use(disputeChainRoute)',1)
f=release/'api/fluentxverse-server/src/index.ts';f.write_text(index)
(release/'api/Dockerfile').write_text('FROM fluentxverse-cloud/api:dispute-staging-20261031\nCOPY fluentxverse-server/src/ /app/src/\nCOPY shared/disputeChainPolicy.json /shared/disputeChainPolicy.json\n')
subprocess.run(['docker','build','--pull=false','--network=none','-t',image,str(release/'api')],check=True,stdout=subprocess.DEVNULL)
backup=release/'stage-rollback.private.json'
if backup.exists(): raise RuntimeError('Staging rollback already exists')
backup.write_text(json.dumps(c));backup.chmod(0o600)
secret=secrets.token_hex(32)
secretfile=release/'feed-key.private';secretfile.write_text(secret);secretfile.chmod(0o600)
c['services']['api']['image']=image
c['services']['api']['environment']['DISPUTE_CHAIN_CAPTURE']='true'
c['services']['api']['environment']['DISPUTE_CHAIN_FEED_KEY']=secret
target=p/'compose.json';next=Path(str(target)+'.next');next.write_text(json.dumps(c));next.chmod(0o600);os.replace(next,target)
subprocess.run(['docker','compose','-f',str(target),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)
print(json.dumps({'image':image,'captureEnabled':True,'productionApiUnchanged':True,'mainnetWrites':False}))
`;
  console.log(ssh('python3 -c '+quote(script),{timeout:180000}));
}else if(process.argv.includes('--engine-hardening')){
  const r2=join(root,'output/release/dispute-sync-20261102-r2');
  const m=JSON.parse(readFileSync(join(r2,'prepared.json')));
  if(ssh("docker inspect budol-gmr-engine-1 --format '{{.Config.Image}}'").trim()!==m.baseline)throw Error('Engine image changed');
  const dest='/opt/fluentxverse/releases/'+m.id;
  ssh(`install -d -m 700 ${dest}/engine && tar -xzf - -C ${dest}/engine`,{input:readFileSync(join(r2,'engine.tar.gz'))});
  console.log(ssh(`docker build --pull=false --network=none -t ${m.image} ${dest}/engine`,{timeout:180000}));
  const script=String.raw`
import json,os,subprocess
from pathlib import Path
p=Path('/opt/fluentxverse/releases/20261023/compose.private.json');r=Path('/opt/fluentxverse/releases/dispute-sync-20261102-r2')
c=json.loads(p.read_text());s=c['services']['gmr-engine']
if s['image']!='fluentxverse-cloud/gmr-engine:dispute-sync-20261102': raise RuntimeError('Engine image changed')
binding=json.loads(Path('/opt/fluentxverse/releases/dispute-sync-20261102/config.mainnet-observe.json').read_text())
if binding['mode']!='observe' or binding['chainId']!=42161: raise RuntimeError('Observer binding changed')
inspect=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0];env=dict(x.split('=',1) for x in inspect['Config']['Env'])
payload={k:env.get('GMR_ENGINE_MEMGRAPH_'+k,env.get('ENGINE_MEMGRAPH_'+k,'')) for k in ['URI','USER','PASSWORD']}
source="""import neo4j from 'neo4j-driver';const p=await Bun.stdin.json();const d=neo4j.driver(p.URI,p.USER?neo4j.auth.basic(p.USER,p.PASSWORD):undefined),s=d.session();try{const r=await s.run("MATCH(n) WHERE (n:EngineTransaction OR n:ZKProofSubmission OR any(label IN labels(n) WHERE label ENDS WITH 'Deployment')) AND n.status IN ['queued','signing','deploying','processing','pending','submitting','submitted'] RETURN labels(n)[0] AS kind,n.status AS status,coalesce(n.transactionResult,'') AS result");for(const row of r.records){let q={};try{q=JSON.parse(row.get('result'));}catch{}if(row.get('kind')==='ZKProofSubmission'&&q.status==='finalized')continue;throw Error('Unsettled operation; defer restart');}console.log('No unsettled Engine operations');}finally{await s.close();await d.close();}"""
subprocess.run(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun','fluentxverse-cloud/api:dispute-sync-20261102-stage-r2','--no-env-file','-e',source],input=json.dumps(payload),text=True,check=True)
backup=r/'rollback.private.json'
if backup.exists(): raise RuntimeError('Rollback already exists')
backup.write_text(json.dumps(c));backup.chmod(0o600)
s['image']='fluentxverse-cloud/gmr-engine:dispute-sync-20261102-r2'
next=Path(str(p)+'.next');next.write_text(json.dumps(c));next.chmod(0o600);os.replace(next,p)
try:
 subprocess.run(['docker','compose','-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','180','gmr-engine'],check=True)
except Exception:
 current=json.loads(p.read_text())
 if current['services']['gmr-engine']['image']!=s['image']: raise RuntimeError('Concurrent deployment')
 next.write_text(backup.read_text());next.chmod(0o600);os.replace(next,p)
 subprocess.run(['docker','compose','-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','180','gmr-engine'],check=True)
 raise
print(json.dumps({'engineImage':s['image'],'mode':'observe','mainnetWrites':False}))
`;
  console.log(ssh('python3 -c '+quote(script),{timeout:240000}));
}else if(process.argv.includes('--stage-hardening')){
  const paths=['fluentxverse-server/src/services/studentDispute.service.ts','fluentxverse-server/src/routes/studentDispute.route.ts','fluentxverse-server/tests/disputeChain.staging.ts'];
  const bundle=execFileSync('tar',['-czf','-',...paths],{cwd:root,maxBuffer:8e6});
  ssh(`install -d -m 700 ${remote}/hardening && tar -xzf - -C ${remote}/hardening`,{input:bundle});
  const script=String.raw`
import json,os,subprocess
from pathlib import Path
p=Path('/opt/fluentxverse/staging/disputes-20261031/compose.json');r=Path('/opt/fluentxverse/releases/dispute-sync-20261102/hardening')
c=json.loads(p.read_text())
if c['services']['api']['image']!='fluentxverse-cloud/api:dispute-sync-20261102-stage': raise RuntimeError('Staging image changed')
backup=r/'rollback.private.json'
if backup.exists(): raise RuntimeError('Hardening rollback already exists')
backup.write_text(json.dumps(c));backup.chmod(0o600)
(r/'Dockerfile').write_text('FROM fluentxverse-cloud/api:dispute-sync-20261102-stage\nCOPY fluentxverse-server/src/services/studentDispute.service.ts /app/src/services/studentDispute.service.ts\nCOPY fluentxverse-server/src/routes/studentDispute.route.ts /app/src/routes/studentDispute.route.ts\nCOPY fluentxverse-server/tests/disputeChain.staging.ts /app/tests/disputeChain.staging.ts\n')
image='fluentxverse-cloud/api:dispute-sync-20261102-stage-r2'
subprocess.run(['docker','build','--pull=false','--network=none','-t',image,str(r)],check=True,stdout=subprocess.DEVNULL)
c['services']['api']['image']=image
next=Path(str(p)+'.next');next.write_text(json.dumps(c));next.chmod(0o600);os.replace(next,p)
try:
 subprocess.run(['docker','compose','-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)
 subprocess.run(['docker','exec','fxv-dispute-stage-api-1','bun','--no-env-file','tests/disputeChain.staging.ts'],check=True)
except Exception:
 current=json.loads(p.read_text())
 if current['services']['api']['image']!=image: raise RuntimeError('Concurrent staging deployment')
 next.write_text(backup.read_text());next.chmod(0o600);os.replace(next,p)
 subprocess.run(['docker','compose','-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','120','api'],check=True)
 raise
print(json.dumps({'stagingImage':image,'evidenceContentsBound':True,'canonicalSecondDeadlines':True,'productionApiUnchanged':True}))
`;
  console.log(ssh('python3 -c '+quote(script),{timeout:180000}));
}else if(process.argv.includes('--activate-observer')){
  const preflight=String.raw`
import json,subprocess
c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
e=dict(x.split('=',1) for x in c['Config']['Env'])
api=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]['Config']['Image']
payload={k:e.get('GMR_ENGINE_MEMGRAPH_'+k,e.get('ENGINE_MEMGRAPH_'+k,'')) for k in ['URI','USER','PASSWORD']}
if not payload['URI']: raise RuntimeError('Engine database not configured')
source="""import neo4j from 'neo4j-driver';const p=await Bun.stdin.json();const d=neo4j.driver(p.URI,p.USER?neo4j.auth.basic(p.USER,p.PASSWORD):undefined),s=d.session();try{const r=await s.run("MATCH(n) WHERE (n:EngineTransaction OR n:ZKProofSubmission OR any(label IN labels(n) WHERE label ENDS WITH 'Deployment')) AND n.status IN ['queued','signing','deploying','processing','pending','submitting','submitted'] RETURN labels(n)[0] AS kind,n.status AS status,coalesce(n.transactionResult,'') AS result");let historical=0;for(const row of r.records){let result={};try{result=JSON.parse(row.get('result'));}catch{}if(row.get('kind')==='ZKProofSubmission'&&result.status==='finalized'){historical++;continue;}throw Error('Unsettled Engine operation; defer restart');}console.log(JSON.stringify({unsettledOperations:0,historicalFinalizedProofs:historical}));}finally{await s.close();await d.close();}"""
subprocess.run(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun',api,'--no-env-file','-e',source],input=json.dumps(payload),text=True,check=True)
private=json.loads(subprocess.check_output(['docker','exec','budol-gmr-engine-1','cat','/app/deployments/dispute-pilot-20261102/private/journal.json']))
if any(not t.get('complete') for t in private['transactions'].values()): raise RuntimeError('Pilot transaction still pending')
print(json.dumps({'pilotConfirmedTransactions':len(private['transactions'])}))
`;
  console.log(ssh('python3 -c '+quote(preflight),{timeout:60000}));
  const script=String.raw`
import json,os,subprocess
from pathlib import Path
p=Path('/opt/fluentxverse/releases/20261023/compose.private.json')
r=Path('/opt/fluentxverse/releases/dispute-sync-20261102')
c=json.loads(p.read_text());s=c['services']['gmr-engine']
if s['image']!='fluentxverse-cloud/gmr-engine:lesson-disputes-shared-roles-20261102': raise RuntimeError('Engine baseline changed')
backup=r/'engine-rollback.private.json'
if backup.exists(): raise RuntimeError('Engine rollback already exists')
backup.write_text(json.dumps(c));backup.chmod(0o600)
binding={'projectId':'2a798002-7ed3-4e98-853e-62306479b9da','chainId':42161,'contract':'0x90153ced2a37eeba68c68f945653c7959ba0f627','operator':'0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1','policyHash':'0x18a65d4e461f681c8d79db08edb3acf75a4494d16c16d2751d7c13642d841144','feedUrl':'http://fxv-dispute-stage-api-1:8765/internal/dispute-chain/events','feedKeyEnv':'GMR_ENGINE_DISPUTE_FEED_KEY','mode':'observe','epoch':'staging-observe-20261102'}
config=r/'config.mainnet-observe.json';config.write_text(json.dumps(binding));config.chmod(0o644)
s['image']='fluentxverse-cloud/gmr-engine:dispute-sync-20261102'
s.setdefault('environment',{})['GMR_ENGINE_DISPUTE_FEED_KEY']=(r/'feed-key.private').read_text()
s['environment']['GMR_ENGINE_DISPUTE_CONFIG_PATH']='/run/dispute-sync/config.json'
s.setdefault('volumes',[]).append(str(config)+':/run/dispute-sync/config.json:ro')
networks=s.get('networks',[])
if isinstance(networks,dict): networks['dispute-stage']={}
else:
 if not networks: networks=['default']
 if 'dispute-stage' not in networks: networks.append('dispute-stage')
s['networks']=networks
c.setdefault('networks',{})['dispute-stage']={'external':True,'name':'fxv-dispute-stage_stage'}
next=Path(str(p)+'.next');next.write_text(json.dumps(c));next.chmod(0o600);os.replace(next,p)
try:
 subprocess.run(['docker','compose','-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','180','gmr-engine'],check=True)
except Exception:
 failed=json.loads(p.read_text())
 if failed['services']['gmr-engine']['image']!='fluentxverse-cloud/gmr-engine:dispute-sync-20261102': raise RuntimeError('Concurrent deployment; do not overwrite')
 next.write_text(backup.read_text());next.chmod(0o600);os.replace(next,p)
 subprocess.run(['docker','compose','-f',str(p),'up','-d','--no-deps','--wait','--wait-timeout','180','gmr-engine'],check=True)
 raise
print(json.dumps({'engineImage':s['image'],'mode':'observe','chainId':42161,'contract':binding['contract'],'productionApiUnchanged':True,'mainnetWrites':False}))
`;
  console.log(ssh('python3 -c '+quote(script),{timeout:240000}));
}else throw Error('Choose --pilot-upload, --pilot-operation, --upload, --staging or --activate-observer');
