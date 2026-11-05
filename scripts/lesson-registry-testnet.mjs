import { root } from './identity-mainnet-operations.mjs';
import { quote } from './lib/cloud-ssh.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const release = 'output/release/lesson-registry-20261104';
const remote = '/opt/fluentxverse/releases/lesson-registry-20261104';
const runner = '/app/deployments/lesson-registry-pilot-20261104';
const image = 'fluentxverse-cloud/gmr-engine:lesson-registry-20261104';
const project = '2a798002-7ed3-4e98-853e-62306479b9da';
const policy = '0x18a65d4e461f681c8d79db08edb3acf75a4494d16c16d2751d7c13642d841144';
const mode = process.argv[2];
if (mode === '--configure' || mode === '--run-replay') {
  const operations = mode === '--configure' ? ['policy', 'unpause'] : ['replay'];
  for (const operation of operations) {
    let done = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const result = JSON.parse(execFileSync('node', [fileURLToPath(import.meta.url), '--operation', operation], { encoding: 'utf8', timeout: 110000 }));
      console.log(JSON.stringify({ operation, ...result }));
      if (result.status === 'confirmed' || result.status === 'pilot-cases-confirmed') { done = true; break; }
      if (result.status !== 'submitted') throw Error('Unexpected testnet operation status');
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    if (!done) throw Error('Testnet operation still pending; retain journal');
  }
} else if (mode === '--upload') {
  root(`install -d -m 700 ${remote}/engine ${remote}/private && tar -xzf - -C ${remote}/engine`, { input: readFileSync(release + '/engine.tar.gz') });
  console.log(root(`docker build --network none -t ${image} ${remote}/engine`));
} else if (mode === '--operation') {
  const operation = process.argv[3];
  if (!['deploy', 'policy', 'unpause', 'pause', 'verify', 'replay'].includes(operation)) throw Error('Unsupported registry testnet operation');
  const script = `import json,subprocess
c=json.loads(subprocess.check_output(['docker','inspect','budol-gmr-engine-1']))[0]
args=['docker','run','--rm','--network','container:budol-gmr-engine-1','--env-file','/dev/stdin','-v','${remote}/private:${runner}/private','--entrypoint','/usr/local/bin/lesson-registry-pilot','${image}','-journal','${runner}/private/journal.json','-project','${project}','-policy','${policy}','-operation','${operation}']
if '${operation}'=='replay': args+=['-fixture','${runner}/private/fixtures.json']
print(subprocess.check_output(args,input='\\n'.join(c['Config']['Env'])+'\\n',text=True))`;
  const output = JSON.parse(root('python3 -c ' + quote(script)));
  if (operation === 'deploy' && output.contract) {
    mkdirSync(release, { recursive: true });
    writeFileSync(release + '/deployment.json', JSON.stringify({ chainId: 421614, ...output }, null, 2));
  }
  console.log(JSON.stringify(output));
} else if (mode === '--fixture') {
  const input = readFileSync(process.argv[3], 'utf8'), parsed = JSON.parse(input);
  const first = parsed.events[0], fresh = '0x' + 'f'.repeat(64), word = '0x' + 'e'.repeat(64);
  const event = { ...first, id: 'negative:registry', sequence: 1, caseSequence: 1, caseKey: fresh };
  const disputed = parsed.events.find(e => e.kind === 'open').caseKey;
  parsed.rejections = [
    { event: { ...first, id: 'negative:duplicate' } },
    { event, signer: 'reconciler' },
    { event, operation: { functionName: 'recordBooking', args: [fresh, word, word], signer: 'operator' } },
    { event, operation: { functionName: 'rescheduleBooking', args: [first.caseKey, '99', word, policy, word], signer: 'operator' } },
    { event: { ...event, kind: 'open', caseSequence: 2, endedAt: first.at - 1 } },
    { event, operation: { functionName: 'rescheduleBooking', args: [disputed, '1', word, policy, word], signer: 'operator' } },
  ];
  const fixture = JSON.stringify(parsed, null, 2);
  if (!parsed.events.length || parsed.events.some(e => e.version !== 2) || /"(?:salt|artifact|raw|privateKey)"/.test(fixture)) throw Error('Public synthetic v2 fixture required');
  const deployment = JSON.parse(readFileSync(release + '/deployment.json'));
  if (deployment.chainId !== 421614) throw Error('Testnet deployment required');
  const script = `from pathlib import Path
import sys
p=Path('${remote}/private/fixtures.json');value=sys.stdin.read()
if p.exists() and p.read_text()!=value: raise RuntimeError('Frozen fixture changed')
p.write_text(value);p.chmod(0o600)
print('Synthetic registry fixture installed')`;
  console.log(root('python3 -c ' + quote(script), { input: fixture }));
  writeFileSync(release + '/fixtures.json', fixture);
} else if (mode === '--journal') {
  const script = `import json
from pathlib import Path
j=json.loads(Path('${remote}/private/journal.json').read_text())
print(json.dumps({'contract':j['contract'],'operations':{k:{f:v.get(f) for f in ['hash','complete','finalized','blockHash']} for k,v in j['transactions'].items()}}))`;
  console.log(root('python3 -c ' + quote(script)));
} else throw Error('Use --upload, --operation, --fixture or --journal');
