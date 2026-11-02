import { ssh, quote } from './lib/cloud-ssh.mjs';

const code = `
import { initDriver, getDriver, closeDriver } from './src/db/memgraph';
import { payableCompletion } from './src/services/admin.services/tutorEarnings.service';
import { plainNode } from './src/utils/adminOperations';
await initDriver(process.env.MEMGRAPH_URI, process.env.MEMGRAPH_USER, process.env.MEMGRAPH_PASSWORD);
const session = getDriver().session();
try {
  const rows = await session.run("MATCH(b:Booking) WHERE b.status='completed' RETURN b");
  let payable = 0;
  for (const row of rows.records) {
    try { payableCompletion(row.get('b').properties); payable++; } catch {}
  }
  console.log(JSON.stringify({ completedLessons: rows.records.length, payableLessons: payable }));
  for (const label of ['TutorEarning', 'TutorPayoutBatch']) {
    const result = await session.run('MATCH(n:' + label + ') RETURN n.status AS status,count(n) AS count');
    console.log(JSON.stringify({ label, counts: result.records.map(row => plainNode(row.toObject())) }));
  }
  const request = async path => {
    const response = await fetch(process.env.GMR_PAYOUT_ENGINE_API_BASE + path, {
      headers: { 'X-GMR-Engine-Key': process.env.GMR_PAYOUT_ENGINE_API_KEY },
      signal: AbortSignal.timeout(90000), redirect: 'error',
    });
    if (!response.ok) throw Error(path + ' HTTP ' + response.status);
    return response.json();
  };
  console.log(JSON.stringify({ destination: await request('/v1/zkverify/destination'), account: await request('/v1/zkverify/account') }));
  const prover = await request('/v1/payouts/prover');
  console.log(JSON.stringify({ prover }, (key, value) => key === 'vk' ? undefined : value));
  const response = await fetch('https://arb1.arbitrum.io/rpc', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: ['0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1', 'latest'] }),
    signal: AbortSignal.timeout(20000),
  });
  const balance = await response.json();
  if (!balance.result) throw Error('Arbitrum ETH balance unavailable');
  console.log(JSON.stringify({ arbitrumWalletBalanceWei: BigInt(balance.result).toString() }));
} finally { await session.close(); await closeDriver(); }
`;
console.log(ssh('docker exec fluentxverse-server bun --no-env-file -e ' + quote(code), { timeout: 300000 }));
