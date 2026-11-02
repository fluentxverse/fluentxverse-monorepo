import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ssh, quote, sshOptions, cloudTarget } from './lib/cloud-ssh.mjs';

const receipts = process.argv.includes('--receipts');
const release = receipts ? 'arbitrum-receipts-20261029' : 'arbitrum-tally-20261029', image = 'fluentxverse-cloud/api:' + release;
const baseline = 'fluentxverse-cloud/api:' + (receipts ? 'arbitrum-tally-20261029' : 'arbitrum-migration-20261029');
const local = join(process.cwd(), 'output/release', release), stage = '/opt/fluentxverse/releases/' + release;
const compose = '/opt/fluentxverse/releases/20261023/compose.private.json';
const guard = () => {
  if (ssh("docker inspect fluentxverse-server --format '{{.Config.Image}}'").trim() !== baseline)
    throw Error('Live API baseline changed');
};
guard();
const files = receipts
  ? ['src/services/proof.services/horizenReceipt.ts', 'src/services/web3.services/gmrProofReceipt.service.ts', 'tests/gmrProofReceipt.test.ts', 'tests/reviewTally.test.ts']
  : ['src/services/anonymousReviews/tally.ts', 'tests/reviewTally.test.ts', 'tests/reviewTally.fixture.ts'];
for (const file of files) {
  mkdirSync(join(local, file, '..'), { recursive: true });
  cpSync(join('fluentxverse-server', file), join(local, file));
}
writeFileSync(join(local, 'Dockerfile'), `FROM ${baseline}\nCOPY --chown=appuser:appgroup src/ /app/src/\nCOPY --chown=appuser:appgroup tests/ /app/tests/\n`);
execFileSync('tar', ['-czf', local + '.tar.gz', '-C', local, '.']);
ssh(`mkdir -p ${stage}`);
execFileSync('scp', [...sshOptions, local + '.tar.gz', `${cloudTarget}:${stage}/source.tar.gz`]);
console.log(ssh(`tar -xzf ${stage}/source.tar.gz -C ${stage} && docker build --pull=false --network=none -t ${image} ${stage}`, { timeout: 120000 }));
console.log(ssh(`docker run --rm --network none --entrypoint bun ${image} --no-env-file test tests/reviewTally.test.ts tests/receiptDestinations.test.ts tests/baseMigration.test.ts ${receipts ? 'tests/gmrProofReceipt.test.ts' : ''}`, { timeout: 60000 }));
guard();
const idle = `import{db,closePool}from'./src/db/postgres';try{const r=await db\`SELECT count(*)::int AS n FROM session_participants WHERE is_active=true AND COALESCE(last_seen_at,joined_at)>NOW()-INTERVAL '30 seconds'\`;if(r[0].n)throw Error('Active classrooms; defer restart');console.log('No active classrooms');}finally{await closePool();}`;
console.log(ssh(`docker exec fluentxverse-server bun --no-env-file -e ${quote(idle)}`));
const configure = `import json,os,shutil
p=${JSON.stringify(compose)}
c=json.load(open(p))
if c['services']['api']['image']!=${JSON.stringify(baseline)}: raise RuntimeError('Compose baseline changed')
shutil.copy2(p,${JSON.stringify(stage + '/compose.rollback.private.json')})
c['services']['api']['image']=${JSON.stringify(image)}
fd=os.open(p+'.next',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as f: json.dump(c,f)
os.replace(p+'.next',p)`;
try {
  ssh('python3 -c ' + quote(configure));
  console.log(ssh(`docker compose -f ${compose} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 }));
  const health = await fetch('https://api.fluentxverse.com/health', { signal: AbortSignal.timeout(30000) });
  if (!health.ok) throw Error('Public API health failed');
  writeFileSync(join(local, 'deployment.json'), JSON.stringify({ image, baseline, deployedAt: new Date().toISOString(), testsPassed: true }, null, 2));
} catch (error) {
  console.log(ssh(`cp -p ${stage}/compose.rollback.private.json ${compose} && docker compose -f ${compose} up -d --no-deps --wait --wait-timeout 120 api`, { timeout: 180000 }));
  throw error;
}
