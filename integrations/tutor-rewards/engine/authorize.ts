import { createPublicClient, http, keccak256, hashTypedData, recoverTypedDataAddress, type Hex } from 'viem';
import { createVaultAccount } from './vault-account';
import pin from './tutor-rewards-deployment.json';
import artifact from './tutor-rewards-artifact.json';
import { tutorRewardClaimTypes as claimTypes } from './tutor-rewards-claim';
export async function authorizeTutorReward(p: any, dependencies?: { client: any; account: any }) {
  const r = p.request, raw = r.claim;
  if (p.signer?.vaultProjectId !== pin.projectId || r.wallet?.toLowerCase() !== p.signer?.vaultAddress?.toLowerCase()
    || raw.wallet?.toLowerCase() !== r.wallet.toLowerCase() || !/^0x[0-9a-f]{64}$/i.test(raw.tutorId || '')
    || !/^0x[0-9a-f]{40}$/i.test(raw.rewardToken || '') || !/^0x[0-9a-f]+$/i.test(r.data || '') || keccak256(r.data) !== raw.dataHash
    || !Array.isArray(r.periodIds) || r.periodIds.length > 32 || new Set(r.periodIds).size !== r.periodIds.length) throw Error('Invalid bound claim');
  const claim: any = {};
  for (const f of claimTypes.Claim) {
    if (f.type.startsWith('uint')) {
      const s = String(raw[f.name]); if (!/^(0|[1-9][0-9]{0,77})$/.test(s)) throw Error('Invalid numeric claim');
      const n = BigInt(s), bits = Number(f.type.slice(4)); if (n >= 2n ** BigInt(bits)) throw Error('Claim overflow');
      claim[f.name] = n;
    } else claim[f.name] = raw[f.name];
  }
  const client = dependencies?.client || createPublicClient({ transport: http(pin.rpcUrl, { timeout: 15000, retryCount: 0 }) });
  if (await client.getChainId() !== 4663) throw Error('Wrong reward chain');
  const address = pin.contract as Hex, abi = artifact.abi as any;
  if (String(await client.readContract({ address, abi, functionName: 'tutorWallets', args: [claim.tutorId] })).toLowerCase() !== r.wallet.toLowerCase()) throw Error('Tutor wallet changed');
  const typed = { domain: { name: 'FluentXVerse Tutor Rewards', version: '1', chainId: 4663, verifyingContract: address }, types: claimTypes, primaryType: 'Claim' as const, message: claim };
  const account = dependencies?.account || createVaultAccount({ ...p.signer, chainId: 4663, rpcUrl: pin.rpcUrl });
  const signature = await account.signTypedData(typed);
  if ((await recoverTypedDataAddress({ ...typed, signature })).toLowerCase() !== r.wallet.toLowerCase()) throw Error('Unexpected managed signer');
  await client.simulateContract({ address, abi, functionName: 'claim', args: [claim, r.periodIds.map((v: string) => {
    if (!/^[1-9][0-9]{0,77}$/.test(v)) throw Error('Invalid reward period'); return BigInt(v);
  }), r.data, signature], account: pin.operator as Hex });
  return { signature, digest: hashTypedData(typed) };
}
if (import.meta.main) {
  try { console.log(JSON.stringify(await authorizeTutorReward(await Bun.stdin.json()))); }
  catch { console.error('Managed reward authorization rejected.'); process.exitCode = 1; }
}
