import { createPublicClient, http, BaseError, ContractFunctionRevertedError } from 'viem';

const p = await Bun.stdin.json();
if (p.chainId !== 42161 || p.contract !== '0x21e09faf72db719cbf9a801d8878a850823d10d1') throw Error('Wrong verification target');
const urls = ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com'];
const clients = urls.map(url => createPublicClient({ transport: http(url, { timeout: 15000, retryCount: 0 }) }));
const primary = clients[0]!;
const target = { address: p.contract, abi: p.artifact.abi };
const report: any = { chainId: 42161, contract: p.contract, at: new Date().toISOString(), rpcs: [], transactions: [], negativeChecks: [] };
let final = 2n ** 256n - 1n;
for (let i = 0; i < clients.length; i++) {
  const client = clients[i]!;
  if (await client.getChainId() !== 42161) throw Error('Wrong RPC chain');
  const head = await client.getBlock({ blockTag: 'finalized' });
  final = final < head.number! ? final : head.number!;
  // Secondary free RPCs can refuse historical receipts. Cross-check their finalized chain hash instead.
  if ((await primary.getBlock({ blockNumber: head.number! })).hash !== head.hash) throw Error('Finalized RPC heads disagree');
  const runtime = p.artifact.runtime.startsWith('0x') ? p.artifact.runtime : '0x' + p.artifact.runtime;
  if ((await client.getCode({ address: p.contract }))?.toLowerCase() !== runtime.toLowerCase()) throw Error('Runtime mismatch');
  report.rpcs.push({ url: urls[i], finalizedBlock: String(head.number), finalizedHash: head.hash, runtimeMatched: true, finalizedHeadCrossChecked: true });
}
for (const [functionName, expected] of [['owner', p.operator], ['engine', p.operator], ['reconciler', p.reconciler]]) {
  const actual: any = await primary.readContract({ ...target, functionName });
  if (actual.toLowerCase() !== expected.toLowerCase()) throw Error('Role mismatch');
}
report.paused = await primary.readContract({ ...target, functionName: 'paused' });
report.nonResponseEnabled = await primary.readContract({ ...target, functionName: 'nonResponseEnabled' });
report.policyApproved = await primary.readContract({ ...target, functionName: 'approvedPolicies', args: [p.policyHash] });
if (report.paused || !report.nonResponseEnabled || !report.policyApproved) throw Error('Registry inactive');
const booking: any = await primary.readContract({ ...target, functionName: 'getBooking', args: [p.smoke.caseKey] });
if (booking.commitment !== p.smoke.commitment || Number(booking.revision) !== 1 || Number(booking.status) !== 1 || booking.policyHash !== p.policyHash)
  throw Error('Synthetic booking differs');
report.syntheticBooking = { key: p.smoke.caseKey, revision: 1, status: 'confirmed', commitmentMatched: true };
for (const transaction of p.transactions) {
  const receipt = await primary.getTransactionReceipt({ hash: transaction.hash });
  if (receipt.status !== 'success' || (await primary.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash)
    throw Error('Receipt reverted or noncanonical');
  report.transactions.push({ ...transaction, block: String(receipt.blockNumber), blockHash: receipt.blockHash, canonical: true,
    finalized: receipt.blockNumber <= final, receiptRpc: urls[0] });
}
const word = '0x' + '1'.repeat(64), other = '0x' + 'e'.repeat(64);
const tests = [
  { name: 'duplicate booking', error: 'BookingAlreadyExists', account: p.operator, functionName: 'recordBooking', args: [p.smoke.caseKey, word, p.policyHash] },
  { name: 'unauthorized writer', error: 'Unauthorized', account: '0x1111111111111111111111111111111111111111', functionName: 'recordBooking', args: [other, word, p.policyHash] },
  { name: 'unapproved policy', error: 'PolicyNotApproved', account: p.operator, functionName: 'recordBooking', args: [other, word, word] },
  { name: 'orphan dispute', error: 'BookingNotFound', account: p.operator, functionName: 'openStaffReviewCase', args: [other, word, p.policyHash] },
];
for (const test of tests) {
  try {
    await primary.simulateContract({ ...target, account: test.account, functionName: test.functionName, args: test.args });
    throw Error('Unexpectedly accepted operation');
  } catch (error) {
    const cause = error instanceof BaseError ? error.walk(e => e instanceof ContractFunctionRevertedError) : null;
    if (!(cause instanceof ContractFunctionRevertedError) || cause.data?.errorName !== test.error) throw error;
    report.negativeChecks.push({ name: test.name, error: test.error });
  }
}
report.allFinalized = report.transactions.length >= 7 && report.transactions.every((tx: any) => tx.finalized);
console.log(JSON.stringify(report));
