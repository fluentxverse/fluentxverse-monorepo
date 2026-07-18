import { createPublicClient, createWalletClient, custom, http, type Address } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { API_BASE_URL } from '../config/api';
import type { WalletAccount } from '../config/wallet';

const TICKET_CONTRACT_ADDRESS = (import.meta.env.VITE_TICKET_CONTRACT_ADDRESS || '0x6fB1BbF7929AF18Dbd6f4F15b03307d067E838db') as Address;
const VAULT_WALLET_ADDRESS = (import.meta.env.VITE_VAULT_WALLET_ADDRESS || '') as Address;
const TICKET_RPC_URL = import.meta.env.VITE_TICKET_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc';

const erc1155Abi = [
  {
    type: 'function',
    name: 'safeTransferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

export type TicketTier = 'basic' | 'premium' | 'trial';

export interface TicketBalance {
  basic: number;
  premium: number;
  trial: number;
  basicTokenId: string | null;
  premiumTokenId: string | null;
  trialTokenId: string | null;
}

export interface TransferResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

export const getTicketBalance = async (walletAddress: string): Promise<TicketBalance> => {
  try {
    const response = await fetch(`${API_BASE_URL}/tickets/balance/${walletAddress}`);
    const result = await response.json();

    if (result.success) {
      return result.data;
    }

    console.error('[TicketService] Server error:', result.error);
    return { basic: 0, premium: 0, trial: 0, basicTokenId: null, premiumTokenId: null, trialTokenId: null };
  } catch (error) {
    console.error('[TicketService] Error fetching ticket balance:', error);
    return { basic: 0, premium: 0, trial: 0, basicTokenId: null, premiumTokenId: null, trialTokenId: null };
  }
};

export const transferTicketForBooking = async (
  account: WalletAccount,
  tier: TicketTier = 'basic',
  quantity = 1
): Promise<TransferResult> => {
  if (!VAULT_WALLET_ADDRESS) {
    return { success: false, error: 'Vault wallet address not configured' };
  }

  if (typeof window === 'undefined' || !window.ethereum) {
    return { success: false, error: 'No EVM wallet found. Please connect a wallet.' };
  }

  try {
    const balance = await getTicketBalance(account.address);
    const tokenIdStr = tier === 'basic' ? balance.basicTokenId : tier === 'premium' ? balance.premiumTokenId : balance.trialTokenId;
    const availableBalance = tier === 'basic' ? balance.basic : tier === 'premium' ? balance.premium : balance.trial;

    if (!tokenIdStr) {
      return { success: false, error: `No ${tier} ticket token found. Please contact support.` };
    }

    if (availableBalance < quantity) {
      return { success: false, error: `Insufficient ${tier} tickets. You have ${availableBalance} but need ${quantity}.` };
    }

    const walletClient = createWalletClient({
      account: account.address,
      chain: arbitrumSepolia,
      transport: custom(window.ethereum),
    });
    const publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(TICKET_RPC_URL),
    });

    const hash = await walletClient.writeContract({
      address: TICKET_CONTRACT_ADDRESS,
      abi: erc1155Abi,
      functionName: 'safeTransferFrom',
      args: [account.address, VAULT_WALLET_ADDRESS, BigInt(tokenIdStr), BigInt(quantity), '0x'],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      return { success: false, error: 'Ticket transfer failed on-chain' };
    }

    return { success: true, transactionHash: hash };
  } catch (error: any) {
    console.error('[TicketService] Transfer failed:', error);
    return { success: false, error: error.message || 'Failed to transfer ticket' };
  }
};

export const hasEnoughTickets = async (
  walletAddress: string,
  tier: TicketTier = 'basic',
  quantity = 1
): Promise<boolean> => {
  const balance = await getTicketBalance(walletAddress);
  const available = tier === 'basic' ? balance.basic : tier === 'premium' ? balance.premium : balance.trial;
  return available >= quantity;
};

export const ticketService = {
  getTicketBalance,
  transferTicketForBooking,
  hasEnoughTickets,
  VAULT_WALLET_ADDRESS,
  TICKET_CONTRACT_ADDRESS,
};
