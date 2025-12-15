/**
 * Test file for ticket purchase simulation
 * This demonstrates the NFT transfer flow that happens when a user purchases tickets
 * 
 * The actual implementation is in:
 * - ticket.service.ts: processPurchase() method
 * - ticket.route.ts: POST /tickets/purchase endpoint
 * - TicketsPage.tsx: handleCheckoutSuccess() function
 */

import { thirdwebClient } from "@/services/utils.services/utils";
import { defineChain, Engine, getContract } from "thirdweb";
import { safeTransferFrom, getNFTs, totalSupply } from "thirdweb/extensions/erc1155";
import { getUserEmail } from "thirdweb/wallets";


const client = thirdwebClient;

// Connect to ticket contract
const contract = getContract({
  client,
  chain: defineChain(421614), // Arbitrum Sepolia
  address: "0x6fB1BbF7929AF18Dbd6f4F15b03307d067E838db",
});

// Server wallet for signing transactions
const serverWallet = Engine.serverWallet({
  client,
  address: process.env.THIRDWEB_VAULT_WALLET_ADDRESS!,
  vaultAccessToken: process.env.THIRDWEB_VAULT_ACCESS_TOKEN!,
});

/**
 * Test function to simulate a ticket purchase
 * This transfers NFT tickets from the server wallet to a buyer
 */
const testPurchase = async () => {
  try {
    // Test buyer wallet address
    const buyerWallet = "0xa2a3D233b95fCB94409555B12444399d4b72E239";
    const tokenId = 1n; // Basic ticket token ID
    const quantity = 1n;

    console.log("=== Test Ticket Purchase ===");
    console.log(`Buyer: ${buyerWallet}`);
    console.log(`Token ID: ${tokenId}`);
    console.log(`Quantity: ${quantity}`);
    console.log("============================");

    // Check current supply
    const supply = await totalSupply({ contract, id: tokenId });
    console.log(`Current supply for token ${tokenId}: ${supply}`);

    // Transfer the NFT ticket to buyer
    console.log("Transferring NFT ticket...");
    
    const transaction = safeTransferFrom({
      contract,
      from: process.env.THIRDWEB_VAULT_WALLET_ADDRESS!,
      to: buyerWallet as `0x${string}`,
      tokenId,
      value: quantity,
      data: "0x",
    });

    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
      simulate: false,
    });

    console.log("✅ Transaction submitted!");
    console.log(`Transaction ID: ${transactionId}`);
    console.log("NFT ticket transfer initiated successfully!");
    console.log("");
    console.log("Note: The user will receive the ticket in their wallet once the transaction is confirmed.");
    console.log("Check the transaction status using the transaction ID.");
  } catch (error) {
    console.error("❌ Error during test purchase:", error);
  }
};

/**
 * List all NFTs in the contract
 */
const listNFTs = async () => {
  try {
    console.log("=== Listing Contract NFTs ===");
    const nfts = await getNFTs({
      contract,
      start: 0,
      count: 10,
    });

    for (const nft of nfts) {
      const supply = await totalSupply({ contract, id: nft.id });
      console.log(`Token ID ${nft.id}: ${nft.metadata.name} - Supply: ${supply}`);
    }
    console.log("=============================");
  } catch (error) {
    console.error("Error listing NFTs:", error);
  }
};

// Run tests
await listNFTs();
// Uncomment to test purchase:
// await testPurchase();


getUserEmail