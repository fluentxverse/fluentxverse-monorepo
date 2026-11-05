import assert from 'node:assert/strict';
import { keccak256, toHex } from 'viem';
export async function testProductionBatch(p: any) {
  const { transport, config, rpcUrl, artifact, operator, client, rpc } = p;
  const events = [100, 101].map(sequence => ({ version: 2, sequence, caseSequence: 1, bookingRevision: 1, id: 'registry:' + sequence,
    kind: 'booking', caseKey: keccak256(toHex('production-mode batch fixture ' + sequence)), commitment: keccak256(toHex('production-mode salted fixture ' + sequence)), policyHash: config.policyHash, at: 100 }));
  const base = { config, rpcUrl, artifact, event: events[0], events };
  const plan: any = await transport({ ...base, action: 'plan' });
  assert.equal(plan.operations[0].functionName, 'recordBookings');
  const operation = plan.operations[0], signed: any = await transport({ ...base, action: 'prepare', operation }, operator);
  assert.deepEqual(await transport({ ...base, action: 'validateBatch', operation, ...signed }), { valid: true });
  await transport({ ...base, action: 'broadcast', operation, ...signed });
  await transport({ ...base, action: 'broadcast', operation, ...signed });
  await rpc('anvil_mine', ['0x80']);
  const status: any = await transport({ ...base, action: 'status', hash: signed.hash });
  assert(status.found && status.finalized);
  for (const e of events) {
    const b: any = await client.readContract({ address: config.contract, abi: artifact.abi, functionName: 'getBooking', args: [e.caseKey] });
    assert.equal(b.commitment, e.commitment);
  }
  console.log('PASS exact pinned mainnet binding supports a signed booking batch on disposable Anvil');
}
