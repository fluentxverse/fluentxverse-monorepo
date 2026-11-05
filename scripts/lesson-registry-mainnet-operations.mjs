import { root } from './identity-mainnet-operations.mjs';
import { quote } from './lib/cloud-ssh.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const release = 'output/release/lesson-registry-mainnet-20261104';
const remote = '/opt/fluentxverse/releases/lesson-registry-mainnet-20261104';
const image = 'fluentxverse-cloud/gmr-engine:lesson-registry-mainnet-20261104';
const pin = JSON.parse(readFileSync('shared/lessonRegistryDeployment.json'));
const mode = process.argv[2];
if (mode === '--upload') {
  root(`install -d -m 700 ${remote}/engine ${remote}/private && tar -xzf - -C ${remote}/engine`, { input: readFileSync(release + '/engine.tar.gz') });
  console.log(root(`docker build --network none -t ${image} ${remote}/engine`));
} else if (mode === '--initialize') {
  const script = `import json,os
from pathlib import Path
p=Path('${remote}/private/journal.json')
if p.exists():
 j=json.loads(p.read_text())
 if j['contract']!='${pin.contract}':raise RuntimeError('Unexpected saved contract')
 print(json.dumps({'journalExists':True,'contract':j['contract']}))
else:
 old=json.loads(Path('/opt/fluentxverse/releases/dispute-mainnet-20261103/private/journal.json').read_text())
 if old['project']!='${pin.projectId}' or old['operator'].lower()!='${pin.operator}' or old['policy']!='${pin.policyHash}' or old['reconciler'].lower()==old['operator'].lower():raise RuntimeError('Legacy role binding changed')
 j={k:old[k] for k in ['project','operator','policy','reconciler','reconcilerRef']}
 j.update({'contract':'${pin.contract}','transactions':{}})
 fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump(j,f);f.flush();os.fsync(f.fileno())
 print(json.dumps({'journalInitialized':True,'contract':j['contract'],'operator':j['operator'],'reconciler':j['reconciler']}))`;
  console.log(root('python3 -c ' + quote(script)));
} else if (mode === '--operation') {
  const operation = process.argv[3];
  if (!['deploy', 'policy', 'propose', 'accept', 'enable', 'disable', 'unpause', 'pause', 'verify'].includes(operation)) throw Error('Unsupported registry mainnet operation');
  const script = `import json,subprocess
c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
args=['docker','run','--rm','--network','container:budol-gmr-engine-1','--env-file','/dev/stdin','-v','${remote}/private:/registry-mainnet','--entrypoint','/usr/local/bin/lesson-registry-mainnet','${image}','-journal','/registry-mainnet/journal.json','-project','${pin.projectId}','-policy','${pin.policyHash}','-operation','${operation}']
print(subprocess.check_output(args,input='\\n'.join(c['Config']['Env'])+'\\n',text=True))`;
  const output = JSON.parse(root('python3 -c ' + quote(script)));
  console.log(JSON.stringify(output));
  if (operation === 'deploy' && output.status === 'confirmed') writeFileSync(release + '/deployment.json', JSON.stringify({ chainId: 42161, ...output }, null, 2));
} else if (mode === '--configure' || mode === '--deploy') {
  const steps = mode === '--deploy' ? ['deploy'] : ['policy', 'propose', 'accept', 'enable', 'unpause'];
  for (const operation of steps) {
    let done = false;
    for (let attempt = 0; attempt < 45; attempt++) {
      const result = JSON.parse(execFileSync('node', [fileURLToPath(import.meta.url), '--operation', operation], { encoding: 'utf8', timeout: 110000 }));
      console.log(JSON.stringify({ operation, ...result }));
      if (result.status === 'confirmed') { done = true; break; }
      if (result.status !== 'submitted') throw Error('Unexpected operation status; preserve journal');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    if (!done) throw Error('Operation pending; retry only with the existing journal');
  }
} else if (mode === '--journal') {
  const script = `import json
from pathlib import Path
j=json.loads(Path('${remote}/private/journal.json').read_text())
print(json.dumps({'contract':j['contract'],'operator':j['operator'],'reconciler':j['reconciler'],'transactions':{k:{f:v.get(f) for f in ['hash','complete','finalized','blockHash']} for k,v in j['transactions'].items()}}))`;
  const result = JSON.parse(root('python3 -c ' + quote(script)));
  console.log(JSON.stringify(result));
  mkdirSync(release, { recursive: true }); writeFileSync(release + '/transactions.json', JSON.stringify(result, null, 2));
} else if (mode === '--preflight') {
  const artifact = JSON.parse(readFileSync(release + '/engine-source/internal/contracts/lesson_registry/artifact.json'));
  const code = `import{createPublicClient,http,encodeDeployData,getContractAddress}from'viem';const p=await Bun.stdin.json(),c=createPublicClient({transport:http('https://arb1.arbitrum.io/rpc',{timeout:15000,retryCount:0})});if(await c.getChainId()!==42161)throw Error('Wrong chain');const nonce=await c.getTransactionCount({address:p.operator,blockTag:'pending'}),latest=await c.getTransactionCount({address:p.operator,blockTag:'latest'});if(nonce!==latest||getContractAddress({from:p.operator,nonce:BigInt(nonce)}).toLowerCase()!==p.contract)throw Error('Pinned deployment nonce unavailable');if(await c.getCode({address:p.contract}))throw Error('Deployment already exists');const data=encodeDeployData({abi:p.artifact.abi,bytecode:p.artifact.bytecode.startsWith('0x')?p.artifact.bytecode:'0x'+p.artifact.bytecode,args:[p.operator,p.operator]}),gas=await c.estimateGas({account:p.operator,data}),fees=await c.estimateFeesPerGas(),balance=await c.getBalance({address:p.operator}),maximum=gas*fees.maxFeePerGas;if(maximum>200000000000000n||balance<maximum+100000000000000n)throw Error('Deployment gas or reserve check failed');console.log(JSON.stringify({chainId:42161,predicted:p.contract,nonce,gas:String(gas),maximumFeeWei:String(maximum),balanceWei:String(balance)}));`;
  console.log(root('docker exec -i fluentxverse-server bun --no-env-file -e ' + quote(code), { input: JSON.stringify({ ...pin, artifact }) }));
} else if (mode === '--snapshot-api') {
  const metadata = JSON.parse(root(`python3 -c ${quote(`import json,subprocess
c=json.loads(subprocess.check_output(['docker','inspect','fluentxverse-server']))[0]
print(json.dumps({'image':c['Config']['Image'],'health':c['State']['Health']['Status']}))`)}`));
  if (metadata.health !== 'healthy') throw Error('Live API not healthy');
  mkdirSync(release + '/live-api', { recursive: true });
  const files = ['src/index.ts', 'src/services/disputeChain/outbox.ts', 'src/services/studentDispute.service.ts',
    'src/services/schedule.services/schedule.service.ts', 'src/services/schedule.services/attendanceRecovery.service.ts', 'src/services/admin.services/operations.service.ts'];
  const archive = root('docker exec fluentxverse-server tar -czf - -C /app ' + files.join(' '), { encoding: null });
  execFileSync('tar', ['-xzf', '-', '-C', release + '/live-api'], { input: archive });
  writeFileSync(release + '/api-baseline.json', JSON.stringify({ ...metadata, files }));
  console.log(JSON.stringify({ snapshot: true, ...metadata, files }));
} else throw Error('Use --upload, --initialize, --deploy, --configure, --operation, --journal, --preflight or --snapshot-api');
