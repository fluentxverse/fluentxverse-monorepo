import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ssh, sshOptions, cloudTarget, quote } from './lib/cloud-ssh.mjs';

const source = '../budol/gmr-engine/benchmarks/groth16-rust';
const output = 'output/benchmarks/rust-prover-20261029';
const stage = '/opt/fluentxverse/benchmarks/rust-prover-20261029';
mkdirSync(output, { recursive: true });
if (process.argv.includes('--status')) {
  const status = `import json,os
p='${stage}/partial.json'
print(json.dumps([{k:r.get(k) for k in ['backend','iterations','elapsedMs','maxRssKiB','peakContainerMiB']} for r in json.load(open(p))]) if os.path.exists(p) else 'No completed trial yet')`;
  console.log(ssh('python3 -c ' + quote(status)));
  process.exit(0);
}
if (process.argv.includes('--finish')) {
  const finish = `import json,os,subprocess
running=subprocess.check_output(['docker','ps','-q','--filter','label=fluentxverse.benchmark=rust-prover-20261029'],text=True).strip()
if running: raise RuntimeError('A benchmark is still running')
states={}
for name in ['fluentxverse-server','budol-gmr-engine-1']:
 c=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
 states[name]={'image':c['Config']['Image'],'health':c['State'].get('Health',{}).get('Status')}
 if states[name]['health']!='healthy': raise RuntimeError('Production service is not healthy')
for name in ['fixture.json','preparation.json']:
 p='${stage}/work/'+name
 if os.path.isfile(p): os.unlink(p)
print(json.dumps({'services':states,'benchmarkContainersRunning':0,'syntheticInputsRemoved':True,'productionConfigChanged':False}))`;
  const check = ssh('python3 -c ' + quote(finish));
  writeFileSync(join(output, 'post-check.json'), check);
  console.log(check);
  process.exit(0);
}
const upload = (from, to) => execFileSync('scp', [...sshOptions, from, `${cloudTarget}:${to}`], { stdio: 'inherit' });
ssh(`mkdir -p ${stage} && chmod 700 ${stage}`);
if (!process.argv.includes('--prepare-only')) upload('output/rust-prover-target/release/gmr-groth16-bench', stage + '/gmr-groth16-bench');
for (const file of ['fixture.mjs', 'snarkjs.mjs', 'run-vps.py', 'Cargo.lock']) upload(join(source, file), stage + '/' + file);
const argument = process.argv.includes('--prepare-only') ? '--prepare-only' : process.argv.includes('--validate-only') ? '--validate-only' : '';
console.log(ssh(`python3 ${stage}/run-vps.py ${argument}`, { timeout: 900000, maxBuffer: 4e6 }));
if (process.argv.includes('--prepare-only')) process.exit(0);
if (process.argv.includes('--validate-only')) {
  writeFileSync(join(output, 'validation.json'), ssh(`cat ${quote(stage + '/validation.json')}`));
  process.exit(0);
}
const report = ssh(`cat ${quote(stage + '/report.json')}`);
writeFileSync(join(output, 'report.json'), report);
copyFileSync(join(source, 'Cargo.lock'), join(output, 'Cargo.lock'));
console.log(JSON.stringify(JSON.parse(readFileSync(join(output, 'report.json'), 'utf8')).summary, null, 2));
