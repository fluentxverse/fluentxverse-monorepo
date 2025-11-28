import OnchainClient from "./clientOnchain";

const onchainClient = new OnchainClient();

export async function stakeEth(amount: string) {
  return onchainClient.stakeEth(amount);
}

export async function getStakingStats() {
  return onchainClient.getStakingStats();
}
