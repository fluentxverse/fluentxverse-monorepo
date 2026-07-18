import { createWalletClient, custom, getAddress, type Address } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

type SignMessageArgs = { message: string };

export type WalletAccount = {
  address: Address;
  signMessage: (args: SignMessageArgs) => Promise<`0x${string}`>;
};

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

const TICKET_CHAIN_ID = Number(import.meta.env.VITE_TICKET_CHAIN_ID || 421614);
const TICKET_CHAIN_HEX = `0x${TICKET_CHAIN_ID.toString(16)}`;

function getProvider(): Eip1193Provider {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No EVM wallet found. Please install or open this page in a wallet-enabled browser.');
  }
  return window.ethereum;
}

async function switchToTicketChain(provider: Eip1193Provider) {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: TICKET_CHAIN_HEX }],
    });
  } catch (error: any) {
    if (error?.code !== 4902) {
      throw error;
    }

    if (TICKET_CHAIN_ID !== arbitrumSepolia.id) {
      throw new Error(`Please add chain ${TICKET_CHAIN_ID} to your wallet before continuing.`);
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: TICKET_CHAIN_HEX,
        chainName: 'Arbitrum Sepolia',
        nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
        blockExplorerUrls: ['https://sepolia.arbiscan.io'],
      }],
    });
  }
}

class BrowserWallet {
  private account: WalletAccount | null = null;

  async connect(): Promise<WalletAccount> {
    const provider = getProvider();
    const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
    await switchToTicketChain(provider);
    const address = getAddress(accounts?.[0] || '');
    const walletClient = createWalletClient({
      account: address,
      chain: arbitrumSepolia,
      transport: custom(provider),
    });

    this.account = {
      address,
      signMessage: ({ message }) => walletClient.signMessage({ account: address, message }),
    };
    localStorage.setItem('fxv_wallet_connected', 'true');
    return this.account;
  }

  async autoConnect(): Promise<WalletAccount | null> {
    if (typeof window === 'undefined' || !window.ethereum) return null;
    if (localStorage.getItem('fxv_wallet_connected') !== 'true') return null;

    const provider = getProvider();
    const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
    if (!accounts?.[0]) return null;

    await switchToTicketChain(provider);
    const address = getAddress(accounts[0]);
    const walletClient = createWalletClient({
      account: address,
      chain: arbitrumSepolia,
      transport: custom(provider),
    });

    this.account = {
      address,
      signMessage: ({ message }) => walletClient.signMessage({ account: address, message }),
    };
    return this.account;
  }

  getAccount(): WalletAccount | null {
    return this.account;
  }

  async disconnect() {
    this.account = null;
    localStorage.removeItem('fxv_wallet_connected');
  }
}

export const appWallet = new BrowserWallet();

export async function connectWallet() {
  return appWallet.connect();
}

export async function autoConnectWallet() {
  return appWallet.autoConnect();
}

export async function getOrConnectWallet() {
  return appWallet.getAccount() || await appWallet.connect();
}
