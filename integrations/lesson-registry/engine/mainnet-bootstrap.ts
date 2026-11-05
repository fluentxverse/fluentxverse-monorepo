import { createPublicClient, createWalletClient, encodeDeployData, encodeFunctionData, getContractAddress,
  http, keccak256, parseTransaction, recoverTransactionAddress, type Hex, type TransactionSerialized } from 'viem';
import { createHash } from 'node:crypto';
import { createVaultAccount } from './vault-account';
import deployment from './lesson-registry-deployment.json';

const allowed = ['deploy', 'policy', 'propose', 'accept', 'enable', 'disable', 'unpause', 'pause', 'verify'];
const functions: Record<string, string> = { policy: 'setPolicyStatus', propose: 'proposeReconciler', accept: 'acceptReconciler',
  enable: 'setNonResponseEnabled', disable: 'setNonResponseEnabled', unpause: 'setPaused', pause: 'setPaused' };
export async function main(p: any) {
  if (p.chainId !== deployment.chainId || p.contract?.toLowerCase() !== deployment.contract
    || p.operator?.toLowerCase() !== deployment.operator || p.signer?.vaultProjectId !== deployment.projectId
    || p.policyHash !== deployment.policyHash || !allowed.includes(p.operation)
    || createHash('sha256').update(JSON.stringify(p.artifact)).digest('hex') !== deployment.artifactSHA256)
    throw Error('Unapproved registry mainnet binding');
  const client = createPublicClient({ transport: http(p.rpcUrl, { timeout: 15000, retryCount: 0 }) });
  if (await client.getChainId() !== deployment.chainId) throw Error('Wrong RPC chain');
  if (p.action === 'status') {
    const receipt = await client.getTransactionReceipt({ hash: p.hash }).catch((e: any) => {
      if (e?.name === 'TransactionReceiptNotFoundError') return null;
      throw e;
    });
    if (!receipt) return { found: false };
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    const final = await client.getBlock({ blockTag: 'finalized' });
    return { found: true, success: receipt.status === 'success', canonical: block.hash === receipt.blockHash,
      finalized: final.number !== null && final.number >= receipt.blockNumber, blockHash: receipt.blockHash, contract: receipt.contractAddress };
  }
  const data: Hex = p.operation === 'deploy'
    ? encodeDeployData({ abi: p.artifact.abi, bytecode: (p.artifact.bytecode.startsWith('0x') ? p.artifact.bytecode : '0x' + p.artifact.bytecode) as Hex,
      args: [deployment.operator, deployment.operator] })
    : encodeFunctionData({ abi: p.artifact.abi, functionName: functions[p.operation], args: p.operation === 'policy' ? [deployment.policyHash, true]
      : p.operation === 'propose' ? [p.reconciler] : p.operation === 'accept' ? []
        : [p.operation === 'pause' || p.operation === 'enable'] });
  const expected = p.operation === 'accept' ? p.reconciler : deployment.operator;
  if (!expected || p.reconciler?.toLowerCase() === deployment.operator) throw Error('Independent reconciler required');
  if (p.action === 'broadcast') {
    const tx = parseTransaction(p.raw), signer = await recoverTransactionAddress({ serializedTransaction: p.raw });
    if (keccak256(p.raw) !== p.hash || tx.chainId !== deployment.chainId || signer.toLowerCase() !== expected.toLowerCase()
      || (tx.value || 0n) !== 0n || tx.data !== data || (p.operation === 'deploy' ? !!tx.to
        || getContractAddress({ from: signer, nonce: BigInt(tx.nonce!) }).toLowerCase() !== deployment.contract
        : tx.to?.toLowerCase() !== deployment.contract)) throw Error('Mainnet registry journal mismatch');
    try { await client.sendRawTransaction({ serializedTransaction: p.raw as TransactionSerialized }); }
    catch { if (!await client.getTransaction({ hash: p.hash }).catch(() => null)) throw Error('Broadcast uncertain; retain journal'); }
    return { hash: p.hash };
  }
  if (p.action !== 'prepare') throw Error('Unsupported bootstrap action');
  const account = createVaultAccount({ ...p.signer, chainId: deployment.chainId, rpcUrl: p.rpcUrl });
  if (account.address.toLowerCase() !== expected.toLowerCase()) throw Error('Unexpected signer');
  const to = p.operation === 'deploy' ? undefined : deployment.contract as Hex;
  if (to) {
    const runtime = p.artifact.runtime.startsWith('0x') ? p.artifact.runtime : '0x' + p.artifact.runtime;
    if ((await client.getCode({ address: to }))?.toLowerCase() !== runtime.toLowerCase()) throw Error('Registry runtime mismatch');
  } else if (await client.getCode({ address: deployment.contract as Hex })) throw Error('Deployment address already occupied');
  const wallet = createWalletClient({ account, transport: http(p.rpcUrl) });
  const tx = await wallet.prepareTransactionRequest({ account, chain: null, type: 'eip1559', to, data, value: 0n });
  if (!to && getContractAddress({ from: account.address, nonce: BigInt(tx.nonce) }).toLowerCase() !== deployment.contract)
    throw Error('Deployment nonce changed; do not change the pinned binding');
  if (tx.maxFeePerGas === undefined || tx.maxPriorityFeePerGas === undefined || tx.gas * tx.maxFeePerGas > 200000000000000n)
    throw Error('Registry bootstrap exceeds 0.0002 ETH transaction cap');
  if (await client.getBalance({ address: account.address }) < tx.gas * tx.maxFeePerGas) throw Error('Insufficient signer balance');
  const raw = await account.signTransaction({ type: 'eip1559', chainId: deployment.chainId, to, data, value: 0n,
    nonce: tx.nonce, gas: tx.gas, maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas });
  return { raw, hash: keccak256(raw), contract: deployment.contract };
}
if (import.meta.main) {
  try { console.log(JSON.stringify(await main(await Bun.stdin.json()))); }
  catch { console.error('Registry mainnet configuration deferred; retain private journal'); process.exitCode = 1; }
}
