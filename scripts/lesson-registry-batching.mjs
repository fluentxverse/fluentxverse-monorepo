import { root } from './identity-mainnet-operations.mjs';
import { quote } from './lib/cloud-ssh.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const release = 'output/release/lesson-registry-batching-20261104';
const remote = '/opt/fluentxverse/releases/lesson-registry-batching-20261104';
const baseline = 'fluentxverse-cloud/gmr-engine:lesson-registry-mainnet-20261104';
const image = 'fluentxverse-cloud/gmr-engine:lesson-registry-batching-20261104';
const mode = process.argv[2];
if (mode === '--upload') {
  root(`install -d -m 700 ${remote}/engine ${remote}/private && tar -xzf - -C ${remote}/engine`, { input: readFileSync(release + '/engine.tar.gz') });
  console.log(root(`docker build --network none -t ${image} ${remote}/engine`));
} else if (mode === '--deploy') {
  const preflight = `import neo4j from'neo4j-driver';const p=await Bun.stdin.json(),d=neo4j.driver(p.URI,p.USER?neo4j.auth.basic(p.USER,p.PASSWORD):undefined),s=d.session();try{const pending=Number((await s.run(\"MATCH(r:DisputeSyncRecord) WHERE r.binding CONTAINS 'production-' AND r.state<>'finalized' RETURN count(r) AS n\")).records[0].get('n'));const locks=Number((await s.run(\"MATCH(l:EngineWalletLock) WHERE coalesce(l.transactionId,'')<>'' AND l.lockedUntil>$now RETURN count(l) AS n\",{now:new Date().toISOString()})).records[0].get('n'));const halted=Number((await s.run(\"MATCH(c:DisputeSyncCursor) WHERE c.id CONTAINS 'production-' AND coalesce(c.halt,'')<>'' RETURN count(c) AS n\")).records[0].get('n'));if(pending||locks||halted)throw Error('Relay must be drained and healthy before deployment');console.log(JSON.stringify({pending,locks,halted}));}finally{await s.close();await d.close();}`;
  const py = `import json,subprocess,os
from pathlib import Path
c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
if c['Config']['Image']!='${baseline}' or c['State']['Health']['Status']!='healthy':raise RuntimeError('Engine baseline changed')
e=dict(x.split('=',1) for x in c['Config']['Env'])
if e.get('GMR_ENGINE_LESSON_REGISTRY_CONFIG_PATH')!='/run/lesson-registry-sync/config.json' or e.get('GMR_ENGINE_DISPUTE_CONFIG_PATH')!='/run/dispute-sync/config.json':raise RuntimeError('Dual routing configuration changed')
p={k:e.get('GMR_ENGINE_MEMGRAPH_'+k,e.get('ENGINE_MEMGRAPH_'+k,'')) for k in ['URI','USER','PASSWORD']}
api=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]
print(subprocess.check_output(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun',api['Config']['Image'],'--no-env-file','-e',${JSON.stringify(preflight)}],input=json.dumps(p),text=True))
r=Path('${remote}/private');backup=r/'rollback.private.json'
if backup.exists():raise RuntimeError('Batch activation already started; inspect private release state')
fd=os.open(backup,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:json.dump(c,f)
labels=c['Config']['Labels'];files=labels['com.docker.compose.project.config_files'].split(',')
if not all(Path(f).is_file() for f in files):raise RuntimeError('Baseline compose file missing')
override=r/'engine.override.json';fd=os.open(override,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:json.dump({'services':{'gmr-engine':{'image':'${image}','environment':{'GMR_ENGINE_LESSON_REGISTRY_BATCH_SIZE':'32'}}}},f)
args=['docker','compose','-p',labels['com.docker.compose.project']]+[v for f in files for v in ['-f',f]]
subprocess.run(args+['-f',str(override),'up','-d','--no-deps','--wait','--wait-timeout','120','gmr-engine'],check=True)
print(json.dumps({'batchSize':32,'apiRestarted':False,'contractRedeployed':False,'bindingAndEpochUnchanged':True}))`;
  const output = root('python3 -c ' + quote(py), { timeout: 300000 }); console.log(output);
  writeFileSync(release + '/activation.json', JSON.stringify({ at: new Date().toISOString(), output }, null, 2));
} else if (mode === '--smoke') {
  const source = readFileSync('integrations/lesson-registry/batch-production-smoke.ts', 'utf8');
  const output = root('docker exec fluentxverse-server bun --no-env-file -e ' + quote(source));
  const result = JSON.parse(output.trim().split('\n').filter(line => line.startsWith('{')).at(-1));
  writeFileSync(release + '/smoke.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} else if (mode === '--status' || mode === '--verify') {
  const code = readFileSync('integrations/lesson-registry/batch-status.ts', 'utf8');
  const py = `import json,subprocess
from pathlib import Path
c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0];e=dict(x.split('=',1) for x in c['Config']['Env'])
config=json.loads(Path('/opt/fluentxverse/releases/lesson-registry-mainnet-20261104/private/config.production.json').read_text())
p={k:e.get('GMR_ENGINE_MEMGRAPH_'+k,e.get('ENGINE_MEMGRAPH_'+k,'')) for k in ['URI','USER','PASSWORD']}
p.update({'config':config,'batchSize':int(e.get('GMR_ENGINE_LESSON_REGISTRY_BATCH_SIZE','1'))})
api=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]
print(subprocess.check_output(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun',api['Config']['Image'],'--no-env-file','-e',${JSON.stringify(code)}],input=json.dumps(p),text=True))
print(json.dumps({'services':[{'name':n,'image':v['Config']['Image'],'health':v['State']['Health']['Status']} for n,v in [('engine',c),('api',api)]]}))`;
  const lines = root('python3 -c ' + quote(py)).trim().split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  const status = { ...lines[0], ...lines[1] };
  writeFileSync(release + '/status.json', JSON.stringify(status, null, 2));
  if (mode === '--status') { console.log(JSON.stringify(status)); process.exit(0); }
  const smoke = JSON.parse(readFileSync(release + '/smoke.json'));
  const artifact = JSON.parse(readFileSync('output/release/lesson-registry-mainnet-20261104/engine-source/internal/contracts/lesson_registry/artifact.json'));
  const members = status.records.filter(record => smoke.events.some(e => e.sequence === record.sequence));
  if (members.length !== 8 || members.some(record => !record.batchLeader)) { console.log(JSON.stringify({ pending: true, reason: 'Waiting for worker lease/intake/batch formation', batchSize: status.batchSize })); process.exit(0); }
  const leaderIds = [...new Set(members.map(member => member.batchLeader))];
  if (leaderIds.length !== 1) throw Error('Synthetic bookings did not form one batch');
  const leader = status.records.find(record => record.id === leaderIds[0]);
  const receipt = status.receipts.find(row => row.id === leader.id + ':0');
  const hash = leader.hash || receipt?.hash;
  if (!hash) { console.log(JSON.stringify({ pending: true, reason: 'Batch frozen; awaiting signing/broadcast' })); process.exit(0); }
  const verify = readFileSync('integrations/lesson-registry/batch-verification.ts', 'utf8');
  const result = JSON.parse(root('docker exec -i fluentxverse-server bun --no-env-file -e ' + quote(verify), { input: JSON.stringify({ events: smoke.events, artifact, hash }) }));
  result.batchSize = status.batchSize; result.services = status.services;
  result.allMembersFinalized = members.every(member => member.state === 'finalized' && member.hash === hash);
  result.activeRegistryNonceLocks = status.activeRegistryNonceLocks;
  result.batchNonceReleased = !status.nonceLocks.includes(leader.id + ':0');
  result.sharedReceiptRecorded = !!receipt;
  writeFileSync(release + '/verification.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} else if (mode === '--monitor') {
  for (let i = 0; i < 90; i++) {
    const result = JSON.parse(execFileSync('node', [fileURLToPath(import.meta.url), '--verify'], { encoding: 'utf8', timeout: 180000 }));
    console.log(JSON.stringify({ at: result.at || new Date().toISOString(), pending: result.pending || false, finalized: result.finalized || false,
      allMembersFinalized: result.allMembersFinalized || false, reason: result.reason, hash: result.hash }));
    if (result.finalized && result.allMembersFinalized && result.sharedReceiptRecorded && result.batchNonceReleased) process.exit(0);
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  throw Error('Finality not yet complete; retain the existing journal');
} else throw Error('Use --upload, --deploy, --smoke, --status, --verify or --monitor');
