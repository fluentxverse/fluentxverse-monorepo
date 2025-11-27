//** API EDEN TREATY IMPORT */
import { api } from "../api";
import type { WalletTransactionResponse } from "@server/insight.services/insight.interface";

export class InsightClient {
  /**
   * Get ETH and SWETH price (GET /insight/eth/price)
   */
  async getEthSwethPrice(token: string): Promise<any> {
    const res = await api.eth.price.get({
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.data) throw new Error("Failed to fetch ETH/SWETH price");
    return res.data;
  }
  

  /**
   * Get wallet transactions (GET /insight/transactions/:walletAddress/:chain)
   */
  async getWalletTransactions(token: string, walletAddress: string, chain: string): Promise<WalletTransactionResponse> {
    const res = await api.transactions({ walletAddress })({ chain }).get({
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.data) throw new Error("Failed to fetch wallet transactions");
    return res.data as WalletTransactionResponse;
  }
}
