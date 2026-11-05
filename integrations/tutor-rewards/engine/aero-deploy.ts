import { createPublicClient, createWalletClient, encodeDeployData, getContractAddress, http, keccak256,
  parseTransaction, recoverTransactionAddress, type Hex, type TransactionSerialized } from 'viem';
import { createVaultAccount } from './vault-account';
import release from './tutor-rewards-aero-release.json';

export async function deployAero(p: any) {
  const entry = release.deployments[p.index];
  if (!entry || p.signer?.vaultProjectId !== release.projectId || p.signer?.vaultAddress?.toLowerCase() !== release.operator) throw Error('Unapproved Aero deployment');
  const c = createPublicClient({ transport: http(release.rpcUrl, { timeout: 15000, retryCount: 0 }) });
  if (await c.getChainId() !== 4663) throw Error('Wrong Aero network');
  const a = entry.artifact;
  const data = encodeDeployData({ abi: a.abi as any, bytecode: a.bytecode as Hex, args: entry.args });
  const matches = (code: Hex | undefined) => {
    if (!code || code.length !== a.runtime.length) return false;
    const mask = (raw: string) => {
      const b = Buffer.from(raw.slice(2), 'hex');
      for (const refs of Object.values(a.immutableReferences) as any[]) for (const r of refs) b.fill(0, r.start, r.start + r.length);
      return b.toString('hex');
    };
    return mask(code) === mask(a.runtime);
  };
  if (['broadcast', 'status'].includes(p.action)) {
    const raw = p.raw as TransactionSerialized, tx = parseTransaction(raw);
    const signer = await recoverTransactionAddress({ serializedTransaction: raw });
    if (keccak256(raw) !== p.hash || tx.chainId !== 4663 || tx.to || (tx.value || 0n) !== 0n || tx.data !== data
      || signer.toLowerCase() !== release.operator || tx.nonce !== entry.nonce || !tx.gas || !tx.maxFeePerGas
      || tx.gas * tx.maxFeePerGas > BigInt(entry.feeCapWei)) throw Error('Aero deployment journal mismatch');
    const receipt = await c.getTransactionReceipt({ hash: p.hash }).catch((e: any) => {
      if (e.name === 'TransactionReceiptNotFoundError') return null;
      throw e;
    });
    if (p.action === 'broadcast') {
      if (!receipt) {
        try { await c.sendRawTransaction({ serializedTransaction: raw }); }
        catch { if (!await c.getTransaction({ hash: p.hash }).catch(() => null)) throw Error('Broadcast uncertain; keep exact journal'); }
      }
      return { hash: p.hash };
    }
    if (!receipt) return { found: false };
    const [block, final, code] = await Promise.all([c.getBlock({ blockNumber: receipt.blockNumber }), c.getBlock({ blockTag: 'finalized' }), c.getCode({ address: entry.contract as Hex })]);
    if (receipt.status !== 'success' || receipt.contractAddress?.toLowerCase() !== entry.contract || block.hash !== receipt.blockHash || !matches(code)) throw Error('Aero deployment mismatch');
    for (const [name, value] of Object.entries(entry.bindings)) {
      const actual = await c.readContract({ address: entry.contract as Hex, abi: a.abi as any, functionName: name });
      if (String(actual).toLowerCase() !== String(value).toLowerCase()) throw Error('Unexpected Aero deployment binding');
    }
    if (await c.readContract({ address: entry.contract as Hex, abi: a.abi as any, functionName: 'paused' }) !== true) throw Error('Aero deployment unexpectedly active');
    return { found: true, finalized: receipt.blockNumber <= final.number, hash: p.hash, blockHash: receipt.blockHash,
      blockNumber: String(receipt.blockNumber), gasUsed: String(receipt.gasUsed) };
  }
  if (p.action !== 'prepare') throw Error('Invalid deployment action');
  if (await c.getCode({ address: entry.contract as Hex })) throw Error('Aero address occupied; use original journal');
  const nonce = await c.getTransactionCount({ address: release.operator as Hex, blockTag: 'pending' });
  if (nonce !== entry.nonce || await c.getTransactionCount({ address: release.operator as Hex, blockTag: 'latest' }) !== nonce
    || getContractAddress({ from: release.operator as Hex, nonce: BigInt(nonce) }).toLowerCase() !== entry.contract) throw Error('Aero nonce changed');
  const account = createVaultAccount({ ...p.signer, chainId: 4663, rpcUrl: release.rpcUrl });
  const wallet = createWalletClient({ account, transport: http(release.rpcUrl) });
  const tx = await wallet.prepareTransactionRequest({ account, chain: null, type: 'eip1559', data, value: 0n, nonce });
  if (!tx.maxFeePerGas || tx.maxPriorityFeePerGas === undefined || tx.gas * tx.maxFeePerGas > BigInt(entry.feeCapWei)
    || await c.getBalance({ address: account.address }) < tx.gas * tx.maxFeePerGas) throw Error('Insufficient ETH or Aero deployment fee cap exceeded');
  const raw = await account.signTransaction({ type: 'eip1559', chainId: 4663, data, value: 0n, nonce,
    gas: tx.gas, maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas });
  return { raw, hash: keccak256(raw) };
}
if (import.meta.main) {
  try { console.log(JSON.stringify(await deployAero(await Bun.stdin.json()))); }
  catch { console.error('Aero deployment deferred; preserve the private journal.'); process.exitCode = 1; }
}
