import { createPublicClient, createWalletClient, encodeDeployData, getContractAddress, http, keccak256,
  parseTransaction, recoverTransactionAddress, type Abi, type Hex, type TransactionSerialized } from 'viem';
import { createHash } from 'node:crypto';
import { createVaultAccount } from './vault-account';
import binding from './tutor-rewards-deployment.json';
import artifact from './tutor-rewards-artifact.json';

const artifactHash = '22cb06b436e95584952015caff719e0919971d81de60e3f8fce2bff415e034cc';
export function matchesRuntime(code: Hex | undefined) {
  if (!code || code.length !== artifact.runtime.length) return false;
  const masked = (raw: string) => {
    const b = Buffer.from(raw.slice(2), 'hex');
    for (const refs of Object.values(artifact.immutableReferences)) for (const r of refs) b.fill(0, r.start, r.start + r.length);
    return b.toString('hex');
  };
  return masked(code) === masked(artifact.runtime);
}

export async function deploy(p: any) {
  if (createHash('sha256').update(JSON.stringify(artifact)).digest('hex') !== artifactHash
    || p.signer?.vaultProjectId !== binding.projectId || p.signer?.vaultAddress?.toLowerCase() !== binding.operator) throw Error('Unapproved rewards release or signer');
  const c = createPublicClient({ transport: http(binding.rpcUrl, { timeout: 15000, retryCount: 0 }) });
  if (await c.getChainId() !== binding.chainId) throw Error('Wrong rewards RPC network');
  const args = [binding.operator, binding.operator, binding.operator, binding.operator, binding.settlementToken];
  const data = encodeDeployData({ abi: artifact.abi as Abi, bytecode: artifact.bytecode as Hex, args });
  const validate = async () => {
    const raw = p.raw as TransactionSerialized, tx = parseTransaction(raw), from = await recoverTransactionAddress({ serializedTransaction: raw });
    if (keccak256(raw) !== p.hash || tx.chainId !== binding.chainId || tx.to || (tx.value || 0n) !== 0n || tx.data !== data
      || from.toLowerCase() !== binding.operator || tx.nonce !== binding.deploymentNonce
      || getContractAddress({ from, nonce: BigInt(tx.nonce) }).toLowerCase() !== binding.contract
      || !tx.gas || !tx.maxFeePerGas || tx.gas * tx.maxFeePerGas > 200_000_000_000_000n) throw Error('Rewards journal does not match pinned deployment');
  };
  if (p.action === 'status' || p.action === 'broadcast') {
    await validate();
    const receipt = await c.getTransactionReceipt({ hash: p.hash }).catch((e: any) => {
      if (e.name === 'TransactionReceiptNotFoundError') return null;
      throw e;
    });
    if (p.action === 'broadcast') {
      if (!receipt) {
        try { await c.sendRawTransaction({ serializedTransaction: p.raw }); }
        catch { if (!await c.getTransaction({ hash: p.hash }).catch(() => null)) throw Error('Broadcast uncertain; retain exact journal'); }
      }
      return { hash: p.hash };
    }
    if (!receipt) return { found: false };
    const [block, final] = await Promise.all([c.getBlock({ blockNumber: receipt.blockNumber }), c.getBlock({ blockTag: 'finalized' })]);
    if (receipt.status !== 'success' || block.hash !== receipt.blockHash || receipt.contractAddress?.toLowerCase() !== binding.contract) throw Error('Rewards deployment failed or is noncanonical');
    if (!matchesRuntime(await c.getCode({ address: binding.contract as Hex }))) throw Error('Rewards runtime mismatch');
    for (const name of ['owner', 'engine', 'claimRelayer', 'guardian']) {
      const value = await c.readContract({ address: binding.contract as Hex, abi: artifact.abi as Abi, functionName: name });
      if (String(value).toLowerCase() !== binding.operator) throw Error('Unexpected rewards role');
    }
    if (String(await c.readContract({ address: binding.contract as Hex, abi: artifact.abi as Abi, functionName: 'settlementToken' })).toLowerCase() !== binding.settlementToken) throw Error('Wrong rewards settlement');
    for (const name of ['claimsPaused', 'allocationsPaused']) if (await c.readContract({ address: binding.contract as Hex, abi: artifact.abi as Abi, functionName: name }) !== true) throw Error('Rewards unexpectedly active');
    const finalized = receipt.blockNumber <= final.number;
    return { found: true, finalized, hash: p.hash, blockHash: receipt.blockHash, blockNumber: String(receipt.blockNumber), gasUsed: String(receipt.gasUsed), runtimeMatched: true, rolesMatched: true, paused: true };
  }
  if (p.action !== 'prepare') throw Error('Unsupported rewards bootstrap action');
  if (await c.getCode({ address: binding.contract as Hex })) throw Error('Rewards address occupied; inspect original journal');
  const nonce = await c.getTransactionCount({ address: binding.operator as Hex, blockTag: 'pending' });
  if (nonce !== binding.deploymentNonce || await c.getTransactionCount({ address: binding.operator as Hex, blockTag: 'latest' }) !== nonce) throw Error('Deployment nonce is unavailable');
  const account = createVaultAccount({ ...p.signer, chainId: binding.chainId, rpcUrl: binding.rpcUrl });
  const wallet = createWalletClient({ account, transport: http(binding.rpcUrl) });
  const tx = await wallet.prepareTransactionRequest({ account, chain: null, type: 'eip1559', data, value: 0n, nonce });
  if (tx.maxFeePerGas === undefined || tx.maxPriorityFeePerGas === undefined || tx.gas * tx.maxFeePerGas > 200_000_000_000_000n) throw Error('Rewards deployment exceeds 0.0002 ETH fee cap');
  if (await c.getBalance({ address: account.address }) < tx.gas * tx.maxFeePerGas) throw Error('Insufficient Robinhood ETH');
  const raw = await account.signTransaction({ type: 'eip1559', chainId: binding.chainId, data, value: 0n, nonce, gas: tx.gas, maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas });
  return { raw, hash: keccak256(raw) };
}
if (import.meta.main) {
  try { console.log(JSON.stringify(await deploy(await Bun.stdin.json()))); }
  catch { console.error('Rewards deployment deferred; retain the private journal and inspect the binding.'); process.exitCode = 1; }
}
