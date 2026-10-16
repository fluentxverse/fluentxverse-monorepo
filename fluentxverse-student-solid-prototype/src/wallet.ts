import { createWalletClient, custom, getAddress, verifyMessage, type EIP1193Provider } from 'viem';
import { baseSepolia, arbitrumSepolia } from 'viem/chains';

export async function connectWallet(provider: EIP1193Provider | undefined, chainId = 84532, rpc?: string) {
  if (!provider) throw new Error('No browser wallet detected. Open this prototype in a wallet-enabled browser.');
  const chain = [baseSepolia, arbitrumSepolia].find(item => item.id === chainId);
  if (!chain) throw new Error(`Unsupported ticket chain ${chainId}.`);
  const accounts = await provider.request({ method: 'eth_requestAccounts', params: undefined });
  if (!accounts[0]) throw new Error('The wallet did not share an account.');
  const address = getAddress(accounts[0]);
  const hex = `0x${chain.id.toString(16)}`;
  try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] }); }
  catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: hex, chainName: chain.name, nativeCurrency: chain.nativeCurrency, rpcUrls: [rpc || chain.rpcUrls.default.http[0]], blockExplorerUrls: [chain.blockExplorers.default.url] }] });
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
  }
  const actual = await provider.request({ method: 'eth_chainId', params: undefined });
  if (Number(actual) !== chain.id) throw new Error('The wallet did not switch to the ticket test network.');
  const wallet = createWalletClient({ account: address, chain, transport: custom(provider) });
  return {
    address,
    chainId: chain.id,
    sign: async (message: string) => {
      const current = await provider.request({ method: 'eth_accounts', params: undefined });
      if (!current[0] || getAddress(current[0]) !== address) throw new Error('Wallet account changed. Reconnect before signing.');
      const signature = await wallet.signMessage({ message, account: address });
      if (!await verifyMessage({ address, message, signature })) throw new Error('The message signature did not match the connected wallet.');
      return signature;
    },
  };
}
