import {root} from './identity-mainnet-operations.mjs';
import {quote} from './lib/cloud-ssh.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
const dir='output/release/dispute-mainnet-20261103';
const code=readFileSync('fluentxverse-server/tests/disputeMainnet.smoke.ts','utf8');
const result=root('docker exec -i -w /app/tests fluentxverse-server bun --no-env-file -e '+quote(code));
console.log(result);writeFileSync(dir+'/smoke.json',result.trim()+'\n');
