import { getContract, defineChain, sendAndConfirmTransaction } from "thirdweb";
import { type Account } from "thirdweb/wallets";
import { safeTransferFrom } from "thirdweb/extensions/erc1155";
import { thirdwebClient } from "../config/wallet";

// Contract configuration - should match server
const TICKET_CONTRACT_ADDRESS = import.meta.env.VITE_TICKET_CONTRACT_ADDRESS || "0x6fB1BbF7929AF18Dbd6f4F15b03307d067E838db";
const CHAIN_ID = Number(import.meta.env.VITE_TICKET_CHAIN_ID) || 421614; // Arbitrum Sepolia testnet
const VAULT_WALLET_ADDRESS = import.meta.env.VITE_VAULT_WALLET_ADDRESS || "";
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8765';

// Get contract instance
const getTicketContract = () => {
  return getContract({
    client: thirdwebClient,
    chain: defineChain(CHAIN_ID),
    address: TICKET_CONTRACT_ADDRESS,
  });
};

export type TicketTier = 'basic' | 'premium';

export interface TicketBalance {
  basic: number;
  premium: number;
  basicTokenId: string | null;
  premiumTokenId: string | null;
}

export interface TransferResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

/**
 * Get the user's ticket balance for both Basic and Premium tickets
 * Fetches from server API which knows the correct token IDs
 */
export const getTicketBalance = async (walletAddress: string): Promise<TicketBalance> => {
  try {
    const response = await fetch(`${API_BASE_URL}/tickets/balance/${walletAddress}`);
    const result = await response.json();
    
    if (result.success) {
      console.log('[TicketService] Got balance from server:', result.data);
      return result.data;
    } else {
      console.error('[TicketService] Server error:', result.error);
      return { basic: 0, premium: 0, basicTokenId: null, premiumTokenId: null };
    }
  } catch (error) {
    console.error('[TicketService] Error fetching ticket balance:', error);
    return { basic: 0, premium: 0, basicTokenId: null, premiumTokenId: null };
  }
};

/**
 * Transfer a ticket from the user's wallet to the vault wallet for booking a lesson
 * This must be called BEFORE booking the slot on the backend
 * 
 * @param account - The connected user's account from useActiveAccount()
 * @param tier - The ticket tier to use ('basic' or 'premium')
 * @param quantity - Number of tickets to transfer (default 1)
 * @returns TransferResult with transaction hash on success
 */
export const transferTicketForBooking = async (
  account: Account,
  tier: TicketTier = 'basic',
  quantity: number = 1
): Promise<TransferResult> => {
  if (!VAULT_WALLET_ADDRESS) {
    return {
      success: false,
      error: 'Vault wallet address not configured',
    };
  }

  try {
    // First, get the balance which includes the correct tokenId from the server
    const balance = await getTicketBalance(account.address);
    const tokenIdStr = tier === 'basic' ? balance.basicTokenId : balance.premiumTokenId;
    const availableBalance = tier === 'basic' ? balance.basic : balance.premium;
    
    if (!tokenIdStr) {
      return {
        success: false,
        error: `No ${tier} ticket token found. Please contact support.`,
      };
    }

    if (availableBalance < quantity) {
      return {
        success: false,
        error: `Insufficient ${tier} tickets. You have ${availableBalance} but need ${quantity}.`,
      };
    }

    const tokenId = BigInt(tokenIdStr);
    const contract = getTicketContract();

    console.log(`[TicketService] Transferring ${quantity} ${tier} ticket(s) to vault...`);
    console.log(`[TicketService] From: ${account.address}`);
    console.log(`[TicketService] To: ${VAULT_WALLET_ADDRESS}`);
    console.log(`[TicketService] TokenId: ${tokenId}`);
    console.log(`[TicketService] Available balance: ${availableBalance}`);

    // Create the transfer transaction
    const transaction = safeTransferFrom({
      contract,
      from: account.address,
      to: VAULT_WALLET_ADDRESS as `0x${string}`,
      tokenId,
      value: BigInt(quantity),
      data: "0x",
    });

    // Execute the transaction and wait for confirmation
    const receipt = await sendAndConfirmTransaction({
      account,
      transaction,
    });

    console.log(`[TicketService] ✅ Transfer successful!`);
    console.log(`[TicketService] Transaction hash: ${receipt.transactionHash}`);

    return {
      success: true,
      transactionHash: receipt.transactionHash,
    };
  } catch (error: any) {
    console.error('[TicketService] Transfer failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to transfer ticket',
    };
  }
};

/**
 * Check if the user has enough tickets to book a lesson
 */
export const hasEnoughTickets = async (
  walletAddress: string,
  tier: TicketTier = 'basic',
  quantity: number = 1
): Promise<boolean> => {
  const balance = await getTicketBalance(walletAddress);
  const available = tier === 'basic' ? balance.basic : balance.premium;
  return available >= quantity;
};

export const ticketService = {
  getTicketBalance,
  transferTicketForBooking,
  hasEnoughTickets,
  VAULT_WALLET_ADDRESS,
  TICKET_CONTRACT_ADDRESS,
};
