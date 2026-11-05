import assert from 'node:assert/strict';
import { createPublicClient, createWalletClient, http, keccak256, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { transport } from './lesson-registry-sync';
import { main as bootstrap } from './lesson-registry-mainnet';
import deployment from './lesson-registry-deployment.json';
import artifact from '../internal/contracts/lesson_registry/artifact.json';

const rpcUrl = 'http://127.0.0.1:18565';
try { await fetch(rpcUrl); throw Error('Test port occupied'); }
catch (error) { if (String(error).includes('occupied')) throw error; }
const node = Bun.spawn(['anvil', '--silent', '--host', '127.0.0.1', '--port', '18565', '--chain-id', '42161', '--base-fee', '1'], { stdout: 'ignore', stderr: 'ignore' });
try {
  let ready = false;
  for (let i = 0; i < 50; i++) { try { await fetch(rpcUrl); ready = true; break; } catch { await Bun.sleep(100); } }
  assert(ready);
  const rpc = async (method: string, params: any[]) => {
    const r = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const d = await r.json(); if (d.error) throw Error(d.error.message); return d.result;
  };
  const operator = privateKeyToAccount(('0x' + '11'.repeat(32)) as Hex);
  const reconciler = privateKeyToAccount(('0x' + '22'.repeat(32)) as Hex);
  for (const a of [operator, reconciler]) await rpc('anvil_setBalance', [a.address, '0x56BC75E2D63100000']);
  const client = createPublicClient({ transport: http(rpcUrl) }), wallet = createWalletClient({ account: operator, transport: http(rpcUrl) });
  const hash = await wallet.deployContract({ chain: null, abi: artifact.abi, bytecode: ('0x' + artifact.bytecode.replace(/^0x/, '')) as Hex, args: [operator.address, operator.address] });
  const source = (await client.waitForTransactionReceipt({ hash })).contractAddress!;
  // Clone only this disposable node's initialized contract to exercise the exact pinned production address.
  await rpc('anvil_setCode', [deployment.contract, await client.getCode({ address: source })]);
  for (let i = 0; i < 12; i++) await rpc('anvil_setStorageAt', [deployment.contract, toHex(i, { size: 32 }), await client.getStorageAt({ address: source, slot: toHex(i) })]);
  const contract = deployment.contract as Hex;
  const config = { ...deployment, lessonRegistry: true, mode: 'production', operator: operator.address, reconciler: reconciler.address };
  const request = (action: string, fields: any = {}) => ({ action, config, rpcUrl, artifact, ...fields });
  const write = async (functionName: string, args: any[], account = operator) => {
    const h = await createWalletClient({ account, transport: http(rpcUrl) }).writeContract({ chain: null, address: contract, abi: artifact.abi, functionName, args });
    assert.equal((await client.waitForTransactionReceipt({ hash: h })).status, 'success');
  };
  const key = keccak256(toHex('synthetic pinned production transport'));
  const e = { version: 2, sequence: 1, caseSequence: 1, id: 'registry:1', kind: 'booking', bookingRevision: 1, caseKey: key,
    commitment: keccak256(toHex('synthetic production commitment')), policyHash: deployment.policyHash, at: Number((await client.getBlock()).timestamp) };
  const run = async (event: any) => {
    const plan: any = await transport(request('plan', { event }));
    for (const operation of plan.operations) {
      const signed: any = await transport(request('prepare', { event, operation }), operation.signer === 'reconciler' ? reconciler : operator);
      await transport(request('broadcast', { event, operation, ...signed }));
      await transport(request('broadcast', { event, operation, ...signed }));
      await rpc('anvil_mine', ['0x80']);
      const status: any = await transport(request('status', { hash: signed.hash }));
      assert(status.found && status.finalized && !status.reverted);
    }
  };
  await assert.rejects(run(e), /not active/);
  await write('setPolicyStatus', [deployment.policyHash, true]);
  await write('proposeReconciler', [reconciler.address]); await write('acceptReconciler', [], reconciler);
  await write('setNonResponseEnabled', [true]); await write('setPaused', [false]);
  for (const change of [{ contract: source }, { epoch: 'registry-production-other' }, { projectId: 'other' }, { feedUrl: 'https://example.com/internal/lesson-registry/events' }, { mode: 'pilot' }, { lessonRegistry: false }]) {
    await assert.rejects(transport({ ...request('plan', { event: e }), config: { ...config, ...change } }));
  }
  await run(e);
  await run({ ...e, kind: 'open', caseSequence: 2, endedAt: e.at - 60, staffFirst: true });
  await run({ ...e, kind: 'staff', caseSequence: 3, outcome: 2, refund: false });
  const state: any = await client.readContract({ address: contract, abi: artifact.abi, functionName: 'getCase', args: [key] });
  assert.equal(Number(state.stage), 4); assert.equal(Number(state.outcome), 2); assert.equal(state.refundApproved, false);
  await assert.rejects(bootstrap({ chainId: 421614 }), /Unapproved/);
  await assert.rejects(bootstrap({ chainId: 42161, contract: source }), /Unapproved/);
  console.log('PASS pinned mainnet transport on disposable Anvil: booking, linked dispute, resolution, same-byte retry, wrong-binding rejection, and bootstrap isolation');
} finally { node.kill(); await node.exited; }
