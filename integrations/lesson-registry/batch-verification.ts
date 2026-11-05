import { createPublicClient, decodeFunctionData, http } from 'viem';
const p = await Bun.stdin.json();
const address = '0x21e09faf72db719cbf9a801d8878a850823d10d1';
const operator = '0xc67f2499aef7ce2b2e8c2f0cf3f5f0d1583757f1';
const client = createPublicClient({ transport: http('https://arb1.arbitrum.io/rpc', { timeout: 15000, retryCount: 0 }) });
const second = createPublicClient({ transport: http('https://arbitrum-one-rpc.publicnode.com', { timeout: 15000, retryCount: 0 }) });
if (await client.getChainId() !== 42161 || await second.getChainId() !== 42161) throw Error('Wrong chain');
const tx = await client.getTransaction({ hash: p.hash }).catch((error: any) => {
  if (error?.name === 'TransactionNotFoundError') return null;
  throw error;
});
if (!tx) { console.log(JSON.stringify({ pending: true, reason: 'Signed batch awaiting broadcast/inclusion', hash: p.hash })); process.exit(0); }
if (tx.to?.toLowerCase() !== address || tx.from.toLowerCase() !== operator || tx.value !== 0n) throw Error('Unexpected batch transaction');
const decoded = decodeFunctionData({ abi: p.artifact.abi, data: tx.input });
if (decoded.functionName !== 'recordBookings') throw Error('Not a batch registration');
const entries: any[] = decoded.args![0] as any[];
if (entries.length < 8 || entries.length > 32) throw Error('Unexpected batch size');
const receipt = await client.getTransactionReceipt({ hash: p.hash }).catch((error: any) => {
  if (error?.name === 'TransactionReceiptNotFoundError') return null;
  throw error;
});
if (!receipt) { console.log(JSON.stringify({ pending: true, reason: 'Batch included receipt not yet available', hash: p.hash })); process.exit(0); }
for (const e of p.events) {
  const entry = entries.find(entry => entry.lessonKey === e.caseKey);
  if (!entry || entry.commitment !== e.commitment || entry.policyHash !== e.policyHash) throw Error('Batch entry differs from outbox');
  const b: any = await client.readContract({ address, abi: p.artifact.abi, functionName: 'getBooking', args: [e.caseKey] });
  if (b.commitment !== e.commitment || b.policyHash !== e.policyHash || Number(b.revision) !== 1 || Number(b.status) !== 1) throw Error('Booking state differs');
}
if (receipt.status !== 'success' || (await client.getBlock({ blockNumber: receipt.blockNumber })).hash !== receipt.blockHash) throw Error('Receipt not successful/canonical');
const a = await client.getBlock({ blockTag: 'finalized' }), b = await second.getBlock({ blockTag: 'finalized' });
if ((await client.getBlock({ blockNumber: b.number! })).hash !== b.hash) throw Error('Finalized chain heads disagree');
const final = a.number! < b.number! ? a.number! : b.number!;
console.log(JSON.stringify({ at: new Date().toISOString(), chainId: 42161, contract: address, hash: p.hash,
  functionName: decoded.functionName, transactionEntries: entries.length, syntheticBookings: p.events.length, transactions: 1,
  block: String(receipt.blockNumber), blockHash: receipt.blockHash, gasUsed: String(receipt.gasUsed),
  canonical: true, finalized: receipt.blockNumber <= final, commitmentsMatched: true, realParticipants: 0, payments: 0 }));
