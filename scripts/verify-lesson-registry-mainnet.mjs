import { root } from './identity-mainnet-operations.mjs';
import { quote } from './lib/cloud-ssh.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const release = 'output/release/lesson-registry-mainnet-20261104';
const remote = '/opt/fluentxverse/releases/lesson-registry-mainnet-20261104';
const pin = JSON.parse(readFileSync('shared/lessonRegistryDeployment.json'));
const mode = process.argv[2] || '--verify';
if (mode === '--smoke') {
  const output = root('docker exec fluentxverse-server bun --no-env-file tests/lessonRegistry.production.smoke.ts');
  const result = JSON.parse(output.trim().split('\n').filter(line => line.startsWith('{')).at(-1));
  writeFileSync(release + '/smoke.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} else if (mode === '--status' || mode === '--verify') {
  const code = `import neo4j from'neo4j-driver';const p=await Bun.stdin.json(),d=neo4j.driver(p.URI,p.USER?neo4j.auth.basic(p.USER,p.PASSWORD):undefined),s=d.session();try{const binding=p.config.projectId+':'+p.config.epoch+':'+p.config.contract+':42161';const cursors=(await s.run('MATCH(c:DisputeSyncCursor {id:$binding}) RETURN c.cursor AS cursor,c.halt AS halt',{binding})).records.map(r=>({cursor:Number(r.get('cursor')),halt:r.get('halt')}));const records=(await s.run('MATCH(r:DisputeSyncRecord {binding:$binding}) RETURN r.json AS json ORDER BY r.sequence',{binding})).records.map(r=>{const j=JSON.parse(r.get('json')),e=j.event;return {id:j.id,sequence:j.sequence,state:j.state,hash:j.hash,step:j.step,error:j.error,kind:e.kind}});const receipts=(await s.run('MATCH(r:DisputeSyncReceipt {binding:$binding}) RETURN r.id AS id,r.hash AS hash,r.blockHash AS blockHash ORDER BY r.recordedAt',{binding})).records.map(r=>r.toObject());const locks=Number((await s.run(\"MATCH(l:EngineWalletLock) WHERE l.transactionId CONTAINS $epoch RETURN count(l) AS n\",{epoch:p.config.epoch})).records[0].get('n'));const response=await fetch(p.config.feedUrl+'?after=0',{headers:{'X-FXV-Dispute-Feed-Key':p.feedKey},redirect:'error',signal:AbortSignal.timeout(15000)});if(response.status!==200)throw Error('Private registry feed unavailable');const page=await response.json();if(page.version!==2||page.chainId!==42161||page.contract!==p.config.contract||page.policyHash!==p.config.policyHash)throw Error('Live feed deployment mismatch');if(page.events.some(e=>['salt','artifact','studentId','tutorId','reasonArtifact','reasonSalt'].some(k=>k in e)))throw Error('Private feed disclosure');const denied=await fetch(p.config.feedUrl,{redirect:'error',signal:AbortSignal.timeout(15000)});if(denied.status!==404)throw Error('Unauthorized feed not rejected');console.log(JSON.stringify({cursors,records,receipts,activeRegistryNonceLocks:locks,feed:{authorized:true,unauthorizedRejected:true,events:page.events.length,bindingMatched:true,privateFieldsExcluded:true}}));}finally{await s.close();await d.close();}`;
  const py = `import json,subprocess
from pathlib import Path
c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0];e=dict(x.split('=',1) for x in c['Config']['Env'])
config=json.loads(Path('${remote}/private/config.production.json').read_text())
p={k:e.get('GMR_ENGINE_MEMGRAPH_'+k,e.get('ENGINE_MEMGRAPH_'+k,'')) for k in ['URI','USER','PASSWORD']}
p.update({'config':config,'feedKey':e[config['feedKeyEnv']]})
print(subprocess.check_output(['docker','run','--rm','-i','--network','container:budol-gmr-engine-1','--entrypoint','bun','fluentxverse-cloud/api:lesson-registry-mainnet-20261104','--no-env-file','-e',${JSON.stringify(code)}],input=json.dumps(p),text=True))
health=[]
for name in ['fluentxverse-server','budol-gmr-engine-1']:
 x=json.loads(subprocess.check_output(['docker','inspect',name]))[0];health.append({'name':name,'image':x['Config']['Image'],'health':x['State']['Health']['Status']})
print(json.dumps({'health':health}))`;
  const lines = root('python3 -c ' + quote(py)).trim().split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  const status = { ...lines[0], ...lines[1] };
  writeFileSync(release + '/status.json', JSON.stringify(status, null, 2));
  if (mode === '--status') { console.log(JSON.stringify(status)); process.exit(0); }
  execFileSync('node', ['scripts/lesson-registry-mainnet-operations.mjs', '--journal']);
  const transactions = JSON.parse(readFileSync(release + '/transactions.json'));
  const smoke = JSON.parse(readFileSync(release + '/smoke.json'));
  const artifact = JSON.parse(readFileSync(release + '/engine-source/internal/contracts/lesson_registry/artifact.json'));
  const verify = readFileSync("integrations/lesson-registry/mainnet-verification.ts", "utf8");
  const txs = Object.entries(transactions.transactions).map(([operation, tx]) => ({ operation, hash: tx.hash }));
  const smokeRecords = status.records.filter(record => record.sequence === smoke.sequence);
  for (const receipt of status.receipts) if (smokeRecords.some(record => receipt.id.startsWith(record.id + ':')) && !txs.some(t => t.hash === receipt.hash)) txs.push({ operation: 'relay-synthetic-booking', hash: receipt.hash });
  for (const record of smokeRecords) if (record.hash && !txs.some(t => t.hash === record.hash)) txs.push({ operation: 'relay-' + record.kind, hash: record.hash });
  const result = JSON.parse(root('docker exec -i fluentxverse-server bun --no-env-file -e ' + quote(verify), {
    input: JSON.stringify({ ...pin, artifact, reconciler: transactions.reconciler, smoke, transactions: txs }),
  }));
  result.services = status.health; result.feed = status.feed;
  result.relayStates = smokeRecords.map(({ sequence, kind, state }) => ({ sequence, kind, state }));
  writeFileSync(release + '/verification.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
} else if (mode === '--monitor') {
  for (let attempt = 0; attempt < 75; attempt++) {
    const result = JSON.parse(execFileSync('node', [fileURLToPath(import.meta.url), '--verify'], { encoding: 'utf8', timeout: 180000 }));
    console.log(JSON.stringify({ at: result.at, finalized: result.transactions.filter(t => t.finalized).length, total: result.transactions.length, relayStates: result.relayStates }));
    if (result.allFinalized && result.relayStates.some(r => r.kind === 'booking') && result.relayStates.every(r => r.state === 'finalized')) process.exit(0);
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  throw Error('Finality still pending; consult the saved verification report');
} else throw Error('Use --smoke, --status, --verify or --monitor');
