import assert from 'node:assert/strict';
import { createPublicClient, createWalletClient, decodeEventLog, http, keccak256, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { transport } from './lesson-registry-sync';
import artifact from '../internal/contracts/lesson_registry/artifact.json';

const rpcUrl = 'http://127.0.0.1:18566';
const direct = 'http://127.0.0.1:18567';
for (const url of [rpcUrl, direct]) {
  try { await fetch(url); throw Error('Test port occupied'); }
  catch (e) { if (String(e).includes('occupied')) throw e; }
}
const node = Bun.spawn(['anvil', '--silent', '--host', '127.0.0.1', '--port', '18567', '--chain-id', '421614', '--base-fee', '1', '--disable-min-priority-fee'], { stdout: 'ignore', stderr: 'ignore' });
let fixtureRpc: ReturnType<typeof Bun.serve> | undefined;
try {
  let ready = false;
  for (let i = 0; i < 50; i++) { try { await fetch(direct); ready = true; break; } catch { await Bun.sleep(100); } }
  assert(ready);
  // Deterministic low fee advice for this local fixture; real EVM gas, signatures and production fee cap remain intact.
  fixtureRpc = Bun.serve({ hostname: '127.0.0.1', port: 18566, async fetch(request) {
    const input: any = await request.json();
    if (input.method === 'eth_fillTransaction') return Response.json({ jsonrpc: '2.0', id: input.id, error: { code: -32601, message: 'Fixture uses standard fee estimation' } });
    if (input.method === 'eth_maxPriorityFeePerGas') return Response.json({ jsonrpc: '2.0', id: input.id, result: '0x0' });
    return fetch(direct, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  } });
  const rpc = async (method: string, params: any[]) => {
    const r = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const d = await r.json(); if (d.error) throw Error(d.error.message); return d.result;
  };
  const operator = privateKeyToAccount(('0x' + '11'.repeat(32)) as Hex);
  await rpc('anvil_setBalance', [operator.address, '0x56BC75E2D63100000']);
  const client = createPublicClient({ transport: http(rpcUrl) }), wallet = createWalletClient({ account: operator, transport: http(rpcUrl) });
  const deploy = await wallet.deployContract({ chain: null, abi: artifact.abi, bytecode: ('0x' + artifact.bytecode.replace(/^0x/, '')) as Hex, args: [operator.address, operator.address] });
  const address = (await client.waitForTransactionReceipt({ hash: deploy })).contractAddress!;
  const policyHash = keccak256(toHex('synthetic booking batch policy'));
  for (const [functionName, args] of [['setPolicyStatus', [policyHash, true]], ['setPaused', [false]]] as const) {
    const hash = await wallet.writeContract({ chain: null, address, abi: artifact.abi, functionName, args });
    assert.equal((await client.waitForTransactionReceipt({ hash })).status, 'success');
  }
  const config = { lessonRegistry: true, chainId: 421614, contract: address, operator: operator.address, mode: 'pilot', epoch: 'registry-batch-local', policyHash };
  const event = (sequence: number): any => ({ version: 2, sequence, caseSequence: 1, bookingRevision: 1, id: 'registry:' + sequence,
    kind: 'booking', caseKey: keccak256(toHex('synthetic batch key ' + sequence)), commitment: keccak256(toHex('synthetic salted fixture ' + sequence)), policyHash, at: 100 });
  const request = (action: string, events: any[], fields: any = {}) => ({ config, rpcUrl, artifact, action, event: events[0], events, ...fields });
  const send = async (events: any[]) => {
    const plan: any = await transport(request('plan', events));
    assert.equal(plan.operations.length, 1); assert.equal(plan.operations[0].functionName, 'recordBookings');
    const operation = plan.operations[0];
    const signed: any = await transport(request('prepare', events, { operation }), operator);
    assert.deepEqual(await transport(request('validateBatch', events, { operation, ...signed })), { valid: true });
    await assert.rejects(transport(request('validateBatch', events, { operation, ...signed, hash: keccak256(toHex('wrong hash')) })), /differs/);
    const changed = events.map((e, i) => i === events.length - 1 ? { ...e, commitment: keccak256(toHex('tampered fixture')) } : e);
    await assert.rejects(transport(request('broadcast', changed, { operation, ...signed })), /differs/);
    await assert.rejects(transport({ ...request('broadcast', events, { operation, ...signed }), events: undefined }), /frozen/);
    await transport(request('broadcast', events, { operation, ...signed }));
    await transport(request('broadcast', events, { operation, ...signed }));
    const receipt = await client.waitForTransactionReceipt({ hash: signed.hash });
    assert.equal(receipt.status, 'success');
    const logs = receipt.logs.map(log => { try { return decodeEventLog({ abi: artifact.abi, data: log.data, topics: log.topics }); } catch { return null; } });
    assert.equal(logs.filter(log => log?.eventName === 'BookingRecorded').length, events.length);
    await rpc('anvil_mine', ['0x80']);
    const status: any = await transport({ config, rpcUrl, artifact, action: 'status', hash: signed.hash });
    assert(status.found && status.finalized && !status.reverted);
    for (const e of events) {
      const b: any = await client.readContract({ address, abi: artifact.abi, functionName: 'getBooking', args: [e.caseKey] });
      assert.equal(b.commitment, e.commitment); assert.equal(Number(b.revision), 1); assert.equal(Number(b.status), 1);
    }
    return signed.hash;
  };
  const eight = Array.from({ length: 8 }, (_, i) => event(i + 1));
  await send(eight);
  const forty = Array.from({ length: 40 }, (_, i) => event(i + 9));
  const first = await send(forty.slice(0, 32)), second = await send(forty.slice(32));
  assert.notEqual(first, second);
  for (const events of [[], [event(50)], Array.from({ length: 33 }, (_, i) => event(i + 50)),
    [event(50), { ...event(51), caseKey: event(50).caseKey }], [event(50), event(52)],
    [event(50), { ...event(51), version: 1 }], [event(50), { ...event(51), kind: 'open' }],
    [event(50), { ...event(51), policyHash: keccak256(toHex('different policy')) }]]) {
    await assert.rejects(transport(request('plan', events)), /[Bb]atch/);
  }
  const fresh = event(100);
  await assert.rejects(client.simulateContract({ account: operator.address, address, abi: artifact.abi, functionName: 'recordBookings',
    args: [[{ lessonKey: fresh.caseKey, commitment: fresh.commitment, policyHash }, { lessonKey: eight[0].caseKey, commitment: eight[0].commitment, policyHash }]] }));
  await assert.rejects(client.readContract({ address, abi: artifact.abi, functionName: 'getBooking', args: [fresh.caseKey] }));
  console.log('PASS real batch transport: 8 bookings/one transaction, 40 split 32+8, identical-byte retry, finalized receipts, immutable membership, invalid batch rejection, and atomic revert');
} finally { fixtureRpc?.stop(true); node.kill(); await node.exited; }
