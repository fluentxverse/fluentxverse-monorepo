import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
for (let attempt = 0; attempt < 90; attempt++) {
  const result = JSON.parse(execFileSync('node', ['scripts/verify-lesson-registry-testnet.mjs', '--finality-only'], {
    encoding: 'utf8', timeout: 115000,
  }));
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), ...result }));
  if (result.allFinalized) process.exit(0);
  await new Promise(resolve => setTimeout(resolve, 30000));
}
const last = JSON.parse(readFileSync('output/release/lesson-registry-20261104/verification.json'));
throw Error(`Testnet finality pending at ${last.finalizedHead}; preserve all receipt evidence`);
