import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ssh } from './lib/cloud-ssh.mjs';
const id = 'proof-destinations-node-fix-20261025';
const release = join(process.cwd(), 'output/release', id), overlay = join(release, 'engine');
const baseline = 'fluentxverse-cloud/gmr-engine:proof-destinations-20261025';
if (JSON.parse(ssh("docker inspect budol-gmr-engine-1 --format '{{json .Config.Image}}'")) !== baseline) throw Error('Engine runtime changed');
mkdirSync(join(overlay, 'scripts'), { recursive: true });
const binary = join(process.cwd(), 'output/release/proof-destinations-20261025/engine/gmr-engine');
const hash = createHash('sha256').update(readFileSync(binary)).digest('hex');
if (ssh('docker exec budol-gmr-engine-1 sha256sum /usr/local/bin/gmr-engine').split(/\s/)[0] !== hash) throw Error('Engine binary changed');
copyFileSync(binary, join(overlay, 'gmr-engine'));
for (const file of ['horizen-receipt.ts', 'screening-bridge-prover.ts', 'zkverify-node-runtime.test.mjs']) {
  const source = join(process.cwd(), '../budol/gmr-engine/scripts', file);
  if (!file.endsWith('.mjs')) {
    const live = ssh('docker exec budol-gmr-engine-1 cat /app/scripts/' + file);
    if (live.replace("from './proof-destinations';", "from './proof-destinations.ts';") !== readFileSync(source, 'utf8')) throw Error('Unrelated worker changes: ' + file);
  }
  copyFileSync(source, join(overlay, 'scripts', file));
}
writeFileSync(join(overlay, 'Dockerfile'), `FROM ${baseline}\nCOPY scripts/ /app/scripts/\n`);
writeFileSync(join(release, 'manifest.json'), JSON.stringify({ preparedAt: new Date().toISOString(), engineImage: baseline, baselineEngineHash: hash, changes: 'Explicit .ts imports for production Node; runtime regression tests', frontendChanged: false, proofPoliciesChanged: false }, null, 2));
console.log('PASS scoped Node import fix prepared; Engine binary and frontend unchanged');
