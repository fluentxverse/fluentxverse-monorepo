import { expect, test } from 'bun:test';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, verifyTypedData } from 'viem';
import { authorizeTutorReward } from './tutor-rewards-authorize';
import { tutorRewardClaimTypes } from './tutor-rewards-claim';
import pin from './tutor-rewards-deployment.json';
const account = privateKeyToAccount(('0x' + '11'.repeat(32)) as `0x${string}`);
const payload = () => ({ signer: { vaultProjectId: pin.projectId, vaultAddress: account.address }, request: {
  userId: 'synthetic-tutor', wallet: account.address, data: '0x1234', periodIds: ['202611'], claim: {
    tutorId: '0x' + '1'.repeat(64), wallet: account.address, rewardToken: '0x1111111111111111111111111111111111111111',
    amountUsd: '12000000', minAmountOut: '1', nonce: '0', quotedAt: '1793800000', deadline: '1793800120',
    assetVersion: '1', executionEpoch: '2', dataHash: keccak256('0x1234'),
  },
} });
test('managed reward signer fixes the domain and simulates the exact authorized claim before returning a signature', async () => {
  let simulated = false;
  const client = { getChainId: async () => 4663, readContract: async () => account.address,
    simulateContract: async (r: any) => {
      expect(r.address).toBe(pin.contract); expect(r.account).toBe(pin.operator); expect(r.functionName).toBe('claim');
      expect(r.args[2]).toBe('0x1234'); expect(r.args[1]).toEqual([202611n]);
      expect(await verifyTypedData({ address: account.address, domain: { name: 'FluentXVerse Tutor Rewards', version: '1', chainId: 4663, verifyingContract: pin.contract as `0x${string}` },
        types: tutorRewardClaimTypes, primaryType: 'Claim', message: r.args[0], signature: r.args[3] })).toBe(true);
      simulated = true;
    } };
  const result = await authorizeTutorReward(payload(), { client, account }); expect(simulated).toBe(true); expect(result.signature).toMatch(/^0x[0-9a-f]{130}$/);
});
test('wrong project, wallet, network, path hash, overflows and duplicate periods cannot be authorized', async () => {
  const base = { getChainId: async () => 4663, readContract: async () => account.address, simulateContract: async () => {} };
  for (const change of [
    (p: any) => { p.signer.vaultProjectId = 'other'; },
    (p: any) => { p.request.wallet = '0x2222222222222222222222222222222222222222'; },
    (p: any) => { p.request.data = '0x5678'; },
    (p: any) => { p.request.claim.deadline = (2n ** 64n).toString(); },
    (p: any) => { p.request.periodIds = ['202611','202611']; },
  ]) { const p = payload(); change(p); await expect(authorizeTutorReward(p, { client: base, account })).rejects.toThrow(); }
  await expect(authorizeTutorReward(payload(), { client: { ...base, getChainId: async () => 1 }, account })).rejects.toThrow('Wrong reward chain');
  await expect(authorizeTutorReward(payload(), { client: { ...base, simulateContract: async () => { throw Error('Rejected by contract'); } }, account })).rejects.toThrow('Rejected by contract');
});
