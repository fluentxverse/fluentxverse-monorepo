import { createPublicClient, createWalletClient, custom, http, type Address } from 'viem';
import { ticketChain, ticketRPC } from '../config/ticketChain';
import { API_BASE_URL } from '../config/api';
import type { WalletAccount } from '../config/wallet';

const TICKET_CONTRACT_ADDRESS = (import.meta.env.VITE_TICKET_CONTRACT_ADDRESS || '') as Address;
const VAULT_WALLET_ADDRESS = (import.meta.env.VITE_VAULT_WALLET_ADDRESS || '') as Address;

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
  account: Pick<WalletAccount, 'address'>,
  tier: TicketTier = 'basic',
  quantity = 1
): Promise<TransferResult> => {
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

    if (tokenIdStr.startsWith('mock-')) {
      const response = await fetch(`${API_BASE_URL}/tickets/consume`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: account.address, tier, quantity }),
      });
      const result = await response.json();
      return result.success
        ? { success: true, transactionHash: result.data.transactionHash }
        : { success: false, error: result.error || 'Failed to use ticket' };
    }

    if (!VAULT_WALLET_ADDRESS) {
      return { success: false, error: 'Vault wallet address not configured' };
    }

    if (typeof window === 'undefined' || !window.ethereum) {
      return { success: false, error: 'This ticket requires an EVM wallet. Please connect the wallet that holds your ticket.' };
    }

    if (!TICKET_CONTRACT_ADDRESS) return { success: false, error: 'Lesson-ticket contract has not been configured on this network.' };
    const walletClient = createWalletClient({
      account: account.address,
      chain: ticketChain,
      transport: custom(window.ethereum),
    });
    const publicClient = createPublicClient({
      chain: ticketChain,
      transport: http(ticketRPC),
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
