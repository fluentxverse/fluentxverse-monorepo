import assert from 'node:assert/strict';
import { createPublicClient, createWalletClient, http, keccak256, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { transport } from './lesson-registry-sync';
import artifact from '../internal/contracts/lesson_registry/artifact.json';

// Disposable loopback Anvil and public fixture keys only; never use a configured external RPC.
const rpcUrl = 'http://127.0.0.1:18564';
try { await fetch(rpcUrl); throw Error('Test port occupied'); }
catch (error) { if (String(error).includes('occupied')) throw error; }
const node = Bun.spawn(['anvil', '--silent', '--host', '127.0.0.1', '--port', '18564', '--chain-id', '421614', '--base-fee', '1'], { stdout: 'ignore', stderr: 'pipe' });
try {
  let ready = false;
  for (let i = 0; i < 50; i++) { try { await fetch(rpcUrl); ready = true; break; } catch { await Bun.sleep(100); } }
  assert(ready);
  const operator = privateKeyToAccount(('0x' + '11'.repeat(32)) as Hex), reconciler = privateKeyToAccount(('0x' + '22'.repeat(32)) as Hex);
  const client = createPublicClient({ transport: http(rpcUrl) });
  const rpc = async (method: string, params: any[] = []) => {
    const response = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const data = await response.json(); if (data.error) throw Error(data.error.message); return data.result;
  };
  for (const account of [operator, reconciler]) await rpc('anvil_setBalance', [account.address, '0x56BC75E2D63100000']);
  const wallet = createWalletClient({ account: operator, transport: http(rpcUrl) });
  const hash = await wallet.deployContract({ chain: null, abi: artifact.abi,
    bytecode: (artifact.bytecode.startsWith('0x') ? artifact.bytecode : '0x' + artifact.bytecode) as Hex, args: [operator.address, operator.address] });
  const deployed = await client.waitForTransactionReceipt({ hash }); assert(deployed.contractAddress);
  const contract = deployed.contractAddress, policyHash = keccak256(toHex('disposable registry policy'));
  const config = { lessonRegistry: true, epoch: 'registry-local-e2e', chainId: 421614, contract, operator: operator.address,
    reconciler: reconciler.address, mode: 'pilot', policyHash };
  const read = (functionName: string, args: any[] = []) => client.readContract({ address: contract, abi: artifact.abi, functionName, args }) as Promise<any>;
  const write = async (functionName: string, args: any[], account = operator) => {
    const w = createWalletClient({ account, transport: http(rpcUrl) });
    const h = await w.writeContract({ chain: null, address: contract, abi: artifact.abi, functionName, args });
    assert.equal((await client.waitForTransactionReceipt({ hash: h })).status, 'success');
  };
  await write('setPolicyStatus', [policyHash, true]);
  let sequence = 0;
  const event = async (kind: string, caseKey: Hex, fields: any = {}) => ({ version: 2, sequence: ++sequence, kind, caseKey, policyHash,
    at: Number((await client.getBlock()).timestamp), commitment: keccak256(toHex(`fixture ${sequence}`)), ...fields });
  const request = (action: string, fields: any = {}) => ({ action, config, rpcUrl, artifact, ...fields });
  const run = async (e: any) => {
    const plan: any = await transport(request('plan', { event: e }));
    for (const operation of plan.operations) {
      const signed: any = await transport(request('prepare', { event: e, operation }), operation.signer === 'reconciler' ? reconciler : operator);
      assert.equal((await transport(request('status', { hash: signed.hash })) as any).found, false);
      await assert.rejects(transport(request('broadcast', { event: e, operation, ...signed, wallet: reconciler.address === signed.wallet ? operator.address : reconciler.address })), /mismatch/);
      await transport(request('broadcast', { event: e, operation, ...signed }));
      await transport(request('broadcast', { event: e, operation, ...signed }));
      await rpc('anvil_mine', ['0x80']);
      const status: any = await transport(request('status', { hash: signed.hash }));
      assert(status.found && status.finalized && !status.reverted);
    }
  };
  const key = keccak256(toHex('opaque primary booking'));
  await assert.rejects(run(await event('booking', key, { bookingRevision: 1 })), /not active/);
  await write('setPaused', [false]);
  await run(await event('booking', key, { bookingRevision: 1 }));
  await run(await event('booking_reschedule', key, { bookingRevision: 2, reasonCommitment: keccak256(toHex('salted reason')) }));
  await assert.rejects(run(await event('booking_reschedule', key, { bookingRevision: 2, reasonCommitment: keccak256(toHex('stale')) })), /revision/);
  await run(await event('open', key));
  await assert.rejects(run(await event('booking_cancel', key, { bookingRevision: 3 })), /./);
  let requestedAt = Number((await client.getBlock()).timestamp);
  await run(await event('request', key, { endedAt: requestedAt - 60, requestedAt }));
  await run(await event('response', key, { automaticTA301: false }));
  await run(await event('staff', key, { outcome: 2, refund: true }));
  await run(await event('refund', key));
  const originalReceipt = (await read('getCase', [key])).refundReceiptCommitment;
  await assert.rejects(run(await event('refund', key)), /./);
  await run(await event('staff', key, { outcome: 3, refund: false }));
  const final = await read('getCase', [key]);
  assert(final.refundApproved && final.refundReceiptCommitment === originalReceipt && Number(final.decisionCount) === 2);
  assert.equal(Number((await read('getBooking', [key])).revision), 2);
  const cancelled = keccak256(toHex('opaque cancelled booking'));
  await run(await event('booking', cancelled, { bookingRevision: 1 }));
  await run(await event('booking_cancel', cancelled, { bookingRevision: 2 }));
  await assert.rejects(run(await event('booking_reschedule', cancelled, { bookingRevision: 3 })), /status/);
  const absent = keccak256(toHex('opaque absent booking'));
  await run(await event('booking', absent, { bookingRevision: 1 }));
  await run(await event('open', absent));
  requestedAt = Number((await client.getBlock()).timestamp);
  await run(await event('request', absent, { endedAt: requestedAt - 60, requestedAt }));
  await rpc('evm_increaseTime', [86401]); await rpc('evm_mine');
  const timeout = await event('nonresponse', absent, { outcome: 1, refund: true });
  await assert.rejects(run(timeout), /reconciler/);
  await write('proposeReconciler', [reconciler.address]); await write('acceptReconciler', [], reconciler);
  await write('setNonResponseEnabled', [true]); await run(timeout);
  assert((await read('getCase', [absent])).nonResponse);
  await assert.rejects(transport({ ...request('inspect'), config: { ...config, chainId: 42161 } }), /testnet-only/);
  console.log('PASS real registry transport on disposable Anvil: booking revisions, cancellation, dispute/refund lifecycle, separate timeout signer, finality, exact-byte retries, journal tamper rejection, and mainnet prohibition');
} finally { node.kill(); await node.exited; }
