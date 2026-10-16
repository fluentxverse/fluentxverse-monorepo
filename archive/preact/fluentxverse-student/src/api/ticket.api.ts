// Ticket API functions
import { API_BASE_URL } from '../config/api';

export interface TicketPurchase {
  id: string;
  buyerWallet: string;
  userId?: string;
  tokenId: string;
  tier: 'basic' | 'premium' | 'trial';
  quantity: number;
  pricePerTicket: number;
  totalPrice: number;
  transferTxId?: string;
  paymentTxHash?: string;
  purchaseDate: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface TicketBalance {
  basic: number;
  premium: number;
  trial: number;
  total: number;
}

/**
 * Get the current user's purchase history
 */
export const getMyPurchaseHistory = async (): Promise<TicketPurchase[]> => {
  const response = await fetch(`${API_BASE_URL}/tickets/my-purchases`, {
    credentials: 'include',
  });
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch purchase history');
  }
  
  return result.data;
};

/**
 * Get purchase history by wallet address
 */
export const getPurchaseHistoryByWallet = async (walletAddress: string): Promise<TicketPurchase[]> => {
  const response = await fetch(`${API_BASE_URL}/tickets/purchases/${walletAddress}`, {
    credentials: 'include',
  });
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch purchase history');
  }
  
  return result.data;
};

/**
 * Get ticket balance for a wallet
 */
export const getTicketBalance = async (walletAddress: string): Promise<TicketBalance> => {
  const response = await fetch(`${API_BASE_URL}/tickets/balance/${walletAddress}`, {
    credentials: 'include',
  });
  
  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch ticket balance');
  }
  
  return result.data;
};

/**
 * Invalidate ticket balance cache
 */
export const invalidateTicketCache = async (walletAddress: string): Promise<void> => {
  await fetch(`${API_BASE_URL}/tickets/invalidate-cache/${walletAddress}`, {
    method: 'POST',
    credentials: 'include',
  });
};
