import { thirdwebClient } from "../utils.services/utils";
import { defineChain, Engine, getContract } from "thirdweb";
import { mintTo, mintAdditionalSupplyTo, getNFTs, getNFT, totalSupply, safeTransferFrom, balanceOf } from "thirdweb/extensions/erc1155";
import { upload } from "thirdweb/storage";
import * as fs from "fs";
import * as path from "path";
import { getIO } from "../../socket/socket.server";
import { NotificationService } from "../notification.services/notification.service";
import { getDriver } from "../../db/memgraph";
import { v4 as uuidv4 } from "uuid";
import { TICKETS_PER_LESSON, REFUND_POLICY } from "../../config/constant";

// Contract configuration
const TICKET_CONTRACT_ADDRESS = process.env.TICKET_CONTRACT_ADDRESS || "0x6fB1BbF7929AF18Dbd6f4F15b03307d067E838db";
const CHAIN_ID = Number(process.env.TICKET_CHAIN_ID) || 421614; // Arbitrum Sepolia testnet
const VAULT_WALLET_ADDRESS = process.env.THIRDWEB_VAULT_WALLET_ADDRESS!;

// Get contract instance
const contract = getContract({
  client: thirdwebClient,
  chain: defineChain(CHAIN_ID),
  address: TICKET_CONTRACT_ADDRESS,
});

// Server wallet for minting
const serverWallet = Engine.serverWallet({
  client: thirdwebClient,
  address: VAULT_WALLET_ADDRESS,
  vaultAccessToken: process.env.THIRDWEB_VAULT_ACCESS_TOKEN!,
});

// Notification service instance
const notificationService = new NotificationService();

// Minting status types
export type MintingStatus = 'pending' | 'submitted' | 'confirmed' | 'failed';

export interface MintingResult {
  transactionId: string;
  status: MintingStatus;
  tokenId?: string;
  tier: TicketTier;
  supply: number;
  mintType: 'create' | 'additional';
  error?: string;
}

// Ticket tier types - only Basic and Premium
export type TicketTier = 'basic' | 'premium';

// Simplified ticket interface (stored on-chain)
export interface Ticket {
  tokenId: string;
  tier: TicketTier;
  price: number;
  supply: number;
  name: string;
  description: string;
  imageUri?: string;
  createdAt: string; // ISO date string stored in metadata
  contractAddress: string;
}

// Request to create a new ticket type (Basic or Premium)
export interface CreateTicketRequest {
  tier: TicketTier;
  price: number;
  supply: number;
}

// Request to mint additional supply
export interface MintAdditionalRequest {
  tokenId: string;
  quantity: number;
}

// Ticket purchase record (stored in Memgraph)
export interface TicketPurchase {
  id: string;
  buyerWallet: string;
  userId?: string; // Optional: link to User node if available
  tokenId: string;
  tier: TicketTier;
  quantity: number;
  pricePerTicket: number;
  totalPrice: number;
  transferTxId: string;
  paymentTxHash?: string; // From checkout widget
  purchaseDate: string;
  status: 'pending' | 'completed' | 'failed';
}

// Ticket transaction types for lesson bookings
export type TicketTransactionType = 'booking' | 'cancellation' | 'refund' | 'purchase' | 'admin_adjustment';

// Ticket transaction record for booking/refund tracking (stored in Memgraph)
export interface TicketTransaction {
  id: string;
  studentId: string;
  studentWallet: string;
  tutorId?: string;
  bookingId?: string;
  slotId?: string;
  tokenId: string;
  tier: TicketTier;
  quantity: number;
  type: TicketTransactionType;
  status: 'pending' | 'completed' | 'failed';
  transferTxId?: string;
  reason?: string;
  createdAt: string;
  completedAt?: string;
}

// Input for deducting ticket when booking
export interface DeductTicketInput {
  studentId: string;
  studentWallet: string;
  tutorId: string;
  bookingId: string;
  slotId: string;
  tier?: TicketTier; // Optional, defaults to 'basic'
}

// Input for recording ticket deduction (when transfer is done on frontend)
export interface RecordTicketDeductionInput {
  studentId: string;
  studentWallet: string;
  tutorId: string;
  bookingId: string;
  slotId: string;
  tier?: TicketTier;
  transferTxHash?: string; // Transaction hash from frontend transfer
}

// Input for refunding ticket on cancellation
export interface RefundTicketInput {
  studentId: string;
  studentWallet: string;
  bookingId: string;
  transactionId: string; // Original deduction transaction ID
  reason?: string;
}


export class TicketService {
  private assetsPath: string;

  constructor() {
    this.assetsPath = path.join(__dirname, '../../assets/ticket');
  }

  /**
   * Get the image path for a ticket tier
   */
  private getTicketImagePath(tier: TicketTier): string {
    return path.join(this.assetsPath, `${tier}_ticket.png`);
  }

  /**
   * Upload ticket image to IPFS
   */
  async uploadTicketImage(tier: TicketTier): Promise<string> {
    const imagePath = this.getTicketImagePath(tier);
    
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Ticket image not found: ${imagePath}`);
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const imageFile = new File([imageBuffer], `${tier}_ticket.png`, { type: "image/png" });

    const imageUri = await upload({
      client: thirdwebClient,
      files: [imageFile],
    });

    console.log(`Uploaded ${tier} ticket image to IPFS:`, imageUri);
    return imageUri;
  }

  /**
   * Send real-time notification to admin via socket
   */
  private async sendAdminNotification(
    type: 'minting_started' | 'minting_success' | 'minting_failed',
    title: string,
    message: string,
    data: Record<string, any>
  ) {
    const io = getIO();
    
    // Create notification in database
    const notification = await notificationService.createNotification({
      userId: 'admin', // Admin user ID - could be a list of admin IDs
      userType: 'admin',
      type,
      title,
      message,
      data,
    });

    // Send real-time notification via socket
    if (io) {
      // Broadcast to admin room
      io.to('notifications:admin').emit('notification:new', notification);
      // Also emit to a general admin channel for minting updates
      io.emit('minting:update', {
        type,
        ...data,
        timestamp: new Date().toISOString(),
      });
    }

    return notification;
  }

  /**
   * Poll for minting status and send notifications
   */
  async pollMintingStatus(
    transactionId: string,
    tier: TicketTier,
    supply: number,
    mintType: 'create' | 'additional',
    tokenId?: string
  ): Promise<MintingResult> {
    const maxAttempts = 60; // Poll for up to 5 minutes (60 * 5 seconds)
    const pollInterval = 5000; // 5 seconds

    let attempts = 0;
    let lastStatus: MintingStatus = 'pending';

    while (attempts < maxAttempts) {
      try {
        const statusResult = await this.getMintingStatus(transactionId);
        console.log(`Minting status for ${transactionId}: ${statusResult}`);

        if (statusResult === 'confirmed' || statusResult === 'CONFIRMED' || statusResult === 'mined') {
          // Success!
          const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
          await this.sendAdminNotification(
            'minting_success',
            `${tierName} Tickets Minted Successfully`,
            mintType === 'create'
              ? `Successfully minted ${supply} ${tierName} lesson tickets.`
              : `Successfully minted ${supply} additional ${tierName} tickets.`,
            {
              transactionId,
              tier,
              supply,
              mintType,
              tokenId,
            }
          );

          return {
            transactionId,
            status: 'confirmed',
            tokenId,
            tier,
            supply,
            mintType,
          };
        }

        if (statusResult === 'failed' || statusResult === 'FAILED' || statusResult === 'errored') {
          // Failed
          const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
          await this.sendAdminNotification(
            'minting_failed',
            `${tierName} Ticket Minting Failed`,
            `Failed to mint ${supply} ${tierName} tickets. Please try again.`,
            {
              transactionId,
              tier,
              supply,
              mintType,
              tokenId,
              errorMessage: 'Transaction failed on-chain',
            }
          );

          return {
            transactionId,
            status: 'failed',
            tier,
            supply,
            mintType,
            error: 'Transaction failed on-chain',
          };
        }

        // Still pending/submitted
        if (statusResult === 'submitted' && lastStatus === 'pending') {
          lastStatus = 'submitted';
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error(`Error polling minting status (attempt ${attempts}):`, error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    // Timeout - still pending after max attempts
    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
    await this.sendAdminNotification(
      'minting_failed',
      `${tierName} Ticket Minting Timeout`,
      `Minting of ${supply} ${tierName} tickets is taking longer than expected. Transaction ID: ${transactionId}`,
      {
        transactionId,
        tier,
        supply,
        mintType,
        tokenId,
        errorMessage: 'Minting timeout - check transaction status manually',
      }
    );

    return {
      transactionId,
      status: 'pending',
      tier,
      supply,
      mintType,
      error: 'Minting timeout',
    };
  }

  /**
   * Create a new ticket type (Basic or Premium) and mint initial NFTs
   * Only 2 ticket types should exist - one Basic, one Premium
   */
  async createTicket(request: CreateTicketRequest): Promise<{ ticket: Ticket; transactionId: string }> {
    const { tier, price, supply } = request;
    const createdAt = new Date().toISOString();

    // Check if this tier already exists on-chain
    const existingTickets = await this.getTickets();
    const existingTier = existingTickets.find(t => t.tier === tier);
    if (existingTier) {
      throw new Error(`${tier.charAt(0).toUpperCase() + tier.slice(1)} ticket already exists (Token ID: ${existingTier.tokenId}). Use mint additional supply instead.`);
    }

    // Upload image to IPFS
    console.log(`Uploading ${tier} ticket image to IPFS...`);
    const imageUri = await this.uploadTicketImage(tier);

    const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
    const name = `${tierName} Lesson Ticket`;
    const description = `FluentXverse ${tierName} Lesson Ticket - Redeem for one 25-minute lesson session. Never expires.`;

    // Create NFT metadata with simple attributes
    const nftMetadata = {
      name,
      description,
      image: imageUri,
      attributes: [
        { trait_type: "Tier", value: tierName },
        { trait_type: "Price", value: `$${price}` },
        { trait_type: "Created", value: createdAt },
      ],
    };

    // Mint NFTs to contract address
    console.log(`Minting ${supply} ${tier} ticket NFTs...`);
    const transaction = mintTo({
      contract,
      to: process.env.THIRDWEB_VAULT_WALLET_ADDRESS!,
      nft: nftMetadata,
      supply: BigInt(supply),
    });

    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
      simulate: false,
    });

    console.log("Transaction ID:", transactionId);

    // Send minting started notification
    await this.sendAdminNotification(
      'minting_started',
      `${tierName} Ticket Minting Started`,
      `Minting ${supply} ${tierName} lesson tickets...`,
      {
        transactionId,
        tier,
        supply,
        mintType: 'create',
      }
    );

    // Start polling for minting status in the background (non-blocking)
    this.pollMintingStatus(transactionId, tier, supply, 'create').catch(err => {
      console.error('Error in background minting status poll:', err);
    });

    // Return the ticket info immediately (don't wait for confirmation)
    const ticket: Ticket = {
      tokenId: transactionId, // Temporary - will be replaced when fetched from chain
      tier,
      price,
      supply,
      name,
      description,
      imageUri,
      createdAt,
      contractAddress: TICKET_CONTRACT_ADDRESS,
    };

    return { ticket, transactionId };
  }

  /**
   * Get all tickets from the contract (source of truth)
   * Filters out invalid NFTs that don't have proper ticket attributes
   */
  async getTickets(): Promise<Ticket[]> {
    try {
      const nfts = await getNFTs({
        contract,
        start: 0,
        count: 100,
      });

      const ticketPromises = nfts.map(async (nft) => {
        const metadata = nft.metadata;
        const attributes = metadata.attributes as Array<{ trait_type: string; value: string }> || [];
        
        // Extract tier attribute - this is required for valid tickets
        const tierAttr = attributes.find(a => a.trait_type === 'Tier');
        
        // Skip NFTs that don't have a valid Tier attribute (Basic or Premium)
        if (!tierAttr?.value) {
          console.log(`Skipping token ${nft.id}: No Tier attribute found`);
          return null;
        }
        
        const tierValue = tierAttr.value.toLowerCase();
        if (tierValue !== 'basic' && tierValue !== 'premium') {
          console.log(`Skipping token ${nft.id}: Invalid Tier value "${tierAttr.value}"`);
          return null;
        }

        // Note: Tickets never expire, no validity check needed

        // Get supply for this token
        let supply = 0n;
        try {
          supply = await totalSupply({ contract, id: nft.id });
        } catch (e) {
          console.warn(`Could not get supply for token ${nft.id}:`, e);
        }

        // Extract other attributes from metadata
        const priceAttr = attributes.find(a => a.trait_type === 'Price');
        const createdAttr = attributes.find(a => a.trait_type === 'Created');
        
        const tier = tierValue as TicketTier;
        const priceString = priceAttr?.value || (tier === 'basic' ? '$6' : '$9');
        const price = parseFloat(priceString.replace('$', '')) || (tier === 'basic' ? 6 : 9);
        const createdAt = createdAttr?.value || new Date().toISOString();

        return {
          tokenId: nft.id.toString(),
          tier,
          price,
          supply: Number(supply),
          name: metadata.name || `${tier.charAt(0).toUpperCase() + tier.slice(1)} Lesson Ticket`,
          description: metadata.description || '',
          imageUri: metadata.image || undefined,
          createdAt,
          contractAddress: TICKET_CONTRACT_ADDRESS,
        };
      });

      const results = await Promise.all(ticketPromises);
      
      // Filter out null values (invalid NFTs)
      return results.filter((ticket): ticket is NonNullable<typeof ticket> => ticket !== null);
    } catch (error) {
      console.error("Error fetching tickets from contract:", error);
      throw error;
    }
  }

  /**
   * Mint additional supply to an existing ticket NFT
   */
  async mintAdditional(request: MintAdditionalRequest): Promise<{ ticket: Ticket; transactionId: string }> {
    const { tokenId, quantity } = request;

    // Verify ticket exists
    const tickets = await this.getTickets();
    const ticket = tickets.find(t => t.tokenId === tokenId);
    
    if (!ticket) {
      throw new Error(`Ticket with token ID ${tokenId} not found`);
    }

    const tierName = ticket.tier.charAt(0).toUpperCase() + ticket.tier.slice(1);
    console.log(`Minting ${quantity} additional ${ticket.tier} tickets (Token ID: ${tokenId})...`);

    const transaction = mintAdditionalSupplyTo({
      contract,
      to: process.env.THIRDWEB_VAULT_WALLET_ADDRESS!,
      tokenId: BigInt(tokenId),
      supply: BigInt(quantity),
    });

    const { transactionId } = await serverWallet.enqueueTransaction({
      transaction,
      simulate: false,
    });

    console.log("Mint additional transaction ID:", transactionId);

    // Send minting started notification
    await this.sendAdminNotification(
      'minting_started',
      `Additional ${tierName} Tickets Minting Started`,
      `Minting ${quantity} additional ${tierName} tickets...`,
      {
        transactionId,
        tier: ticket.tier,
        supply: quantity,
        mintType: 'additional',
        tokenId,
      }
    );

    // Start polling for minting status in the background (non-blocking)
    this.pollMintingStatus(transactionId, ticket.tier, quantity, 'additional', tokenId).catch(err => {
      console.error('Error in background minting status poll:', err);
    });

    // Return updated ticket info immediately (don't wait for confirmation)
    const updatedTicket: Ticket = {
      ...ticket,
      supply: ticket.supply + quantity,
    };

    return { ticket: updatedTicket, transactionId };
  }

  /**
   * Get ticket statistics
   */
  async getTicketStats(): Promise<{
    totalTicketTypes: number;
    totalSupply: number;
    basicTicket: Ticket | null;
    premiumTicket: Ticket | null;
  }> {
    const tickets = await this.getTickets();
    
    const basicTicket = tickets.find(t => t.tier === 'basic') || null;
    const premiumTicket = tickets.find(t => t.tier === 'premium') || null;
    const totalSupply = tickets.reduce((sum, t) => sum + t.supply, 0);

    return {
      totalTicketTypes: tickets.length,
      totalSupply,
      basicTicket,
      premiumTicket,
    };
  }

  /**
   * Get minting transaction status from Thirdweb Engine
   */
  private async getMintingStatus(transactionId: string): Promise<string> {
    try {
      const status = await Engine.getTransactionStatus({
        client: thirdwebClient,
        transactionId,
      });

      return status.status;
    } catch (error) {
      console.error(`Error fetching transaction status for ${transactionId}:`, error);
      throw error;
    }
  }

  /**
   * Process a ticket purchase - transfers NFT to buyer
   * The NFT metadata is immutable on IPFS, so purchase date tracking
   * should be done in the database instead
   */
  async processPurchase(params: {
    buyerWallet: string;
    tier: TicketTier;
    quantity: number;
    mockTransactionHash?: string;
  }): Promise<{
    success: boolean;
    transactionId: string;
    tokenId: string;
    tier: TicketTier;
    quantity: number;
    purchaseDate: string;
    error?: string;
  }> {
    const { buyerWallet, tier, quantity, mockTransactionHash } = params;
    const purchaseDate = new Date().toISOString();

    console.log(`Processing ticket purchase: ${quantity} ${tier} ticket(s) for ${buyerWallet}`);

    // Get the token ID for this tier
    const tickets = await this.getTickets();
    const ticket = tickets.find(t => t.tier === tier);

    if (!ticket) {
      throw new Error(`${tier.charAt(0).toUpperCase() + tier.slice(1)} tickets not found. Please contact support.`);
    }

    const tokenId = BigInt(ticket.tokenId);

    // Check if we have enough supply
    if (ticket.supply < quantity) {
      throw new Error(`Insufficient ${tier} tickets. Available: ${ticket.supply}, Requested: ${quantity}`);
    }

    try {
      // Get current NFT metadata for logging
      console.log(`Getting NFT metadata for token ${ticket.tokenId}...`);
      const nft = await getNFT({
        contract,
        tokenId,
      });
      console.log('Current NFT metadata:', nft.metadata);

      // Transfer the NFT tickets from server wallet to buyer
      console.log(`Transferring ${quantity} ${tier} ticket(s) to ${buyerWallet}...`);
      
      const transferTransaction = safeTransferFrom({
        contract,
        from: process.env.THIRDWEB_VAULT_WALLET_ADDRESS!,
        to: buyerWallet as `0x${string}`,
        tokenId,
        value: BigInt(quantity),
        data: "0x",
      });

      const { transactionId: transferTxId } = await serverWallet.enqueueTransaction({
        transaction: transferTransaction,
        simulate: false,
      });

      console.log(`Transfer transaction ID: ${transferTxId}`);

      // Send notification about the purchase
      const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
      await this.sendAdminNotification(
        'minting_success',
        `${tierName} Ticket Purchased`,
        `${quantity} ${tierName} ticket(s) transferred to ${buyerWallet.slice(0, 6)}...${buyerWallet.slice(-4)}`,
        {
          transactionId: transferTxId,
          tier,
          quantity,
          buyerWallet,
          purchaseDate,
          mockTransactionHash,
          action: 'purchase',
          nftMetadata: nft.metadata,
        }
      );

      // Save purchase record to Memgraph
      const pricePerTicket = tier === 'basic' ? 6 : 9;
      try {
        await this.saveTicketPurchase({
          buyerWallet,
          tokenId: ticket.tokenId,
          tier,
          quantity,
          pricePerTicket,
          totalPrice: pricePerTicket * quantity,
          transferTxId,
          paymentTxHash: mockTransactionHash,
          purchaseDate,
          status: 'completed',
        });
        console.log(`✅ Purchase record saved to Memgraph`);
      } catch (dbError) {
        // Log but don't fail the purchase - blockchain transfer already succeeded
        console.error('⚠️ Failed to save purchase to Memgraph:', dbError);
      }

      return {
        success: true,
        transactionId: transferTxId,
        tokenId: ticket.tokenId,
        tier,
        quantity,
        purchaseDate,
      };
    } catch (error) {
      console.error('Error processing ticket purchase:', error);
      
      const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
      await this.sendAdminNotification(
        'minting_failed',
        `${tierName} Ticket Purchase Failed`,
        `Failed to transfer ${quantity} ${tierName} ticket(s) to ${buyerWallet.slice(0, 6)}...${buyerWallet.slice(-4)}`,
        {
          tier,
          quantity,
          buyerWallet,
          purchaseDate,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          action: 'purchase',
        }
      );

      return {
        success: false,
        transactionId: '',
        tokenId: ticket.tokenId,
        tier,
        quantity,
        purchaseDate,
        error: error instanceof Error ? error.message : 'Failed to process purchase',
      };
    }
  }

  /**
   * Get a user's ticket balance for both Basic and Premium tickets
   * Uses balanceOf from ERC1155 to check on-chain balance
   */
  async getWalletTicketBalance(walletAddress: string): Promise<{
    basic: number;
    premium: number;
    basicTokenId: string | null;
    premiumTokenId: string | null;
  }> {
    console.log(`Getting ticket balance for wallet: ${walletAddress}`);

    // Get all tickets to find token IDs for basic and premium
    const tickets = await this.getTickets();
    const basicTicket = tickets.find(t => t.tier === 'basic');
    const premiumTicket = tickets.find(t => t.tier === 'premium');

    let basicBalance = 0;
    let premiumBalance = 0;

    // Get basic ticket balance
    if (basicTicket) {
      try {
        const balance = await balanceOf({
          contract,
          owner: walletAddress as `0x${string}`,
          tokenId: BigInt(basicTicket.tokenId),
        });
        basicBalance = Number(balance);
        console.log(`Basic ticket balance for ${walletAddress}: ${basicBalance}`);
      } catch (error) {
        console.error('Error getting basic ticket balance:', error);
      }
    }

    // Get premium ticket balance
    if (premiumTicket) {
      try {
        const balance = await balanceOf({
          contract,
          owner: walletAddress as `0x${string}`,
          tokenId: BigInt(premiumTicket.tokenId),
        });
        premiumBalance = Number(balance);
        console.log(`Premium ticket balance for ${walletAddress}: ${premiumBalance}`);
      } catch (error) {
        console.error('Error getting premium ticket balance:', error);
      }
    }

    return {
      basic: basicBalance,
      premium: premiumBalance,
      basicTokenId: basicTicket?.tokenId || null,
      premiumTokenId: premiumTicket?.tokenId || null,
    };
  }

  /**
   * Save a ticket purchase record to Memgraph
   */
  async saveTicketPurchase(purchase: Omit<TicketPurchase, 'id'>): Promise<TicketPurchase> {
    const driver = getDriver();
    const session = driver.session();
    const purchaseId = uuidv4();

    try {
      // Create the TicketPurchase node
      await session.run(`
        CREATE (p:TicketPurchase {
          id: $id,
          buyerWallet: $buyerWallet,
          userId: $userId,
          tokenId: $tokenId,
          tier: $tier,
          quantity: $quantity,
          pricePerTicket: $pricePerTicket,
          totalPrice: $totalPrice,
          transferTxId: $transferTxId,
          paymentTxHash: $paymentTxHash,
          purchaseDate: $purchaseDate,
          status: $status
        })
      `, {
        id: purchaseId,
        buyerWallet: purchase.buyerWallet,
        userId: purchase.userId || null,
        tokenId: purchase.tokenId,
        tier: purchase.tier,
        quantity: purchase.quantity,
        pricePerTicket: purchase.pricePerTicket,
        totalPrice: purchase.totalPrice,
        transferTxId: purchase.transferTxId,
        paymentTxHash: purchase.paymentTxHash || null,
        purchaseDate: purchase.purchaseDate,
        status: purchase.status,
      });

      // If userId is provided, create relationship to User
      if (purchase.userId) {
        await session.run(`
          MATCH (p:TicketPurchase {id: $purchaseId})
          MATCH (u:User {id: $userId})
          MERGE (u)-[:PURCHASED]->(p)
        `, {
          purchaseId,
          userId: purchase.userId,
        });
      }

      console.log(`✅ Saved ticket purchase to Memgraph: ${purchaseId}`);

      return {
        id: purchaseId,
        ...purchase,
      };
    } catch (error) {
      console.error('Error saving ticket purchase to Memgraph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Get purchase history for a wallet address
   */
  async getPurchaseHistoryByWallet(walletAddress: string): Promise<TicketPurchase[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(`
        MATCH (p:TicketPurchase {buyerWallet: $walletAddress})
        RETURN p
        ORDER BY p.purchaseDate DESC
      `, { walletAddress });

      return result.records.map(record => {
        const p = record.get('p').properties;
        return {
          id: p.id,
          buyerWallet: p.buyerWallet,
          userId: p.userId,
          tokenId: p.tokenId,
          tier: p.tier as TicketTier,
          quantity: typeof p.quantity === 'object' ? p.quantity.toNumber() : p.quantity,
          pricePerTicket: typeof p.pricePerTicket === 'object' ? p.pricePerTicket.toNumber() : p.pricePerTicket,
          totalPrice: typeof p.totalPrice === 'object' ? p.totalPrice.toNumber() : p.totalPrice,
          transferTxId: p.transferTxId,
          paymentTxHash: p.paymentTxHash,
          purchaseDate: p.purchaseDate,
          status: p.status as TicketPurchase['status'],
        };
      });
    } catch (error) {
      console.error('Error fetching purchase history from Memgraph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Get purchase history for a user ID
   */
  async getPurchaseHistoryByUserId(userId: string): Promise<TicketPurchase[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(`
        MATCH (u:User {id: $userId})-[:PURCHASED]->(p:TicketPurchase)
        RETURN p
        ORDER BY p.purchaseDate DESC
      `, { userId });

      return result.records.map(record => {
        const p = record.get('p').properties;
        return {
          id: p.id,
          buyerWallet: p.buyerWallet,
          userId: p.userId,
          tokenId: p.tokenId,
          tier: p.tier as TicketTier,
          quantity: typeof p.quantity === 'object' ? p.quantity.toNumber() : p.quantity,
          pricePerTicket: typeof p.pricePerTicket === 'object' ? p.pricePerTicket.toNumber() : p.pricePerTicket,
          totalPrice: typeof p.totalPrice === 'object' ? p.totalPrice.toNumber() : p.totalPrice,
          transferTxId: p.transferTxId,
          paymentTxHash: p.paymentTxHash,
          purchaseDate: p.purchaseDate,
          status: p.status as TicketPurchase['status'],
        };
      });
    } catch (error) {
      console.error('Error fetching purchase history from Memgraph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Get all purchases (admin view) with optional filters
   */
  async getAllPurchases(options?: {
    tier?: TicketTier;
    limit?: number;
    offset?: number;
  }): Promise<{ purchases: TicketPurchase[]; total: number }> {
    const driver = getDriver();
    const session = driver.session();

    try {
      let whereClause = '';
      const params: Record<string, any> = {};

      if (options?.tier) {
        whereClause = 'WHERE p.tier = $tier';
        params.tier = options.tier;
      }

      // Get total count
      const countResult = await session.run(`
        MATCH (p:TicketPurchase)
        ${whereClause}
        RETURN count(p) as total
      `, params);
      const total = countResult.records[0]?.get('total')?.toNumber() || 0;

      // Get purchases with pagination
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      
      const result = await session.run(`
        MATCH (p:TicketPurchase)
        ${whereClause}
        RETURN p
        ORDER BY p.purchaseDate DESC
        SKIP $offset
        LIMIT $limit
      `, { ...params, offset, limit });

      const purchases = result.records.map(record => {
        const p = record.get('p').properties;
        return {
          id: p.id,
          buyerWallet: p.buyerWallet,
          userId: p.userId,
          tokenId: p.tokenId,
          tier: p.tier as TicketTier,
          quantity: typeof p.quantity === 'object' ? p.quantity.toNumber() : p.quantity,
          pricePerTicket: typeof p.pricePerTicket === 'object' ? p.pricePerTicket.toNumber() : p.pricePerTicket,
          totalPrice: typeof p.totalPrice === 'object' ? p.totalPrice.toNumber() : p.totalPrice,
          transferTxId: p.transferTxId,
          paymentTxHash: p.paymentTxHash,
          purchaseDate: p.purchaseDate,
          status: p.status as TicketPurchase['status'],
        };
      });

      return { purchases, total };
    } catch (error) {
      console.error('Error fetching all purchases from Memgraph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Get purchase statistics
   */
  async getPurchaseStats(): Promise<{
    totalPurchases: number;
    totalRevenue: number;
    basicSold: number;
    premiumSold: number;
    uniqueBuyers: number;
  }> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(`
        MATCH (p:TicketPurchase {status: 'completed'})
        RETURN 
          count(p) as totalPurchases,
          sum(p.totalPrice) as totalRevenue,
          sum(CASE WHEN p.tier = 'basic' THEN p.quantity ELSE 0 END) as basicSold,
          sum(CASE WHEN p.tier = 'premium' THEN p.quantity ELSE 0 END) as premiumSold,
          count(DISTINCT p.buyerWallet) as uniqueBuyers
      `);

      const record = result.records[0];
      return {
        totalPurchases: record?.get('totalPurchases')?.toNumber() || 0,
        totalRevenue: record?.get('totalRevenue')?.toNumber() || 0,
        basicSold: record?.get('basicSold')?.toNumber() || 0,
        premiumSold: record?.get('premiumSold')?.toNumber() || 0,
        uniqueBuyers: record?.get('uniqueBuyers')?.toNumber() || 0,
      };
    } catch (error) {
      console.error('Error fetching purchase stats from Memgraph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  // ==========================================
  // TICKET USAGE FOR LESSON BOOKINGS
  // ==========================================

  /**
   * Create a server wallet instance for a user (student) to execute transactions
   * Uses Thirdweb Engine server wallet with the user's wallet address
   */
  private getStudentServerWallet(studentWalletAddress: string) {
    return Engine.serverWallet({
      client: thirdwebClient,
      address: studentWalletAddress as `0x${string}`,
      vaultAccessToken: process.env.THIRDWEB_VAULT_ACCESS_TOKEN!,
    });
  }

  /**
   * Deduct a ticket from student when booking a lesson
   * Transfers the NFT ticket from student wallet to vault wallet ON-CHAIN
   */
  async deductTicketForBooking(input: DeductTicketInput): Promise<TicketTransaction> {
    const { studentId, studentWallet, tutorId, bookingId, slotId, tier = 'basic' } = input;
    const transactionId = uuidv4();
    const createdAt = new Date().toISOString();

    console.log(`[TicketService] Deducting ${TICKETS_PER_LESSON} ${tier} ticket(s) for booking ${bookingId}`);
    console.log(`[TicketService] Student wallet: ${studentWallet}`);

    // Get the token ID for this tier
    const tickets = await this.getTickets();
    const ticket = tickets.find(t => t.tier === tier);

    if (!ticket) {
      throw new Error(`${tier.charAt(0).toUpperCase() + tier.slice(1)} tickets not found. Please contact support.`);
    }

    // Check student's ticket balance
    const balance = await this.getWalletTicketBalance(studentWallet);
    const studentBalance = tier === 'basic' ? balance.basic : balance.premium;

    if (studentBalance < TICKETS_PER_LESSON) {
      throw new Error(`Insufficient ${tier} tickets. You have ${studentBalance} but need ${TICKETS_PER_LESSON} to book a lesson.`);
    }

    // Create pending transaction record in Memgraph first
    const driver = getDriver();
    const session = driver.session();

    try {
      await session.run(`
        CREATE (t:TicketTransaction {
          id: $id,
          studentId: $studentId,
          studentWallet: $studentWallet,
          tutorId: $tutorId,
          bookingId: $bookingId,
          slotId: $slotId,
          tokenId: $tokenId,
          tier: $tier,
          quantity: $quantity,
          type: 'booking',
          status: 'pending',
          reason: 'Lesson booking',
          createdAt: $createdAt
        })
      `, {
        id: transactionId,
        studentId,
        studentWallet,
        tutorId,
        bookingId,
        slotId,
        tokenId: ticket.tokenId,
        tier,
        quantity: TICKETS_PER_LESSON,
        createdAt,
      });

      // Link to Student and Booking nodes (booking may not exist yet, so use OPTIONAL)
      await session.run(`
        MATCH (t:TicketTransaction {id: $transactionId})
        MATCH (s:Student {id: $studentId})
        MERGE (s)-[:MADE_TRANSACTION]->(t)
      `, { transactionId, studentId });

      console.log(`[TicketService] Created pending transaction: ${transactionId}`);

      // Execute on-chain transfer from student wallet to vault wallet
      console.log(`[TicketService] Executing on-chain transfer...`);
      
      // Get the student's server wallet to execute the transfer
      const studentServerWallet = this.getStudentServerWallet(studentWallet);
      
      // Create the transfer transaction
      const transferTransaction = safeTransferFrom({
        contract,
        from: studentWallet as `0x${string}`,
        to: VAULT_WALLET_ADDRESS as `0x${string}`,
        tokenId: BigInt(ticket.tokenId),
        value: BigInt(TICKETS_PER_LESSON),
        data: "0x",
      });

      // Enqueue and execute the transaction
      const { transactionId: transferTxId } = await studentServerWallet.enqueueTransaction({
        transaction: transferTransaction,
        simulate: false,
      });

      console.log(`[TicketService] Transfer transaction enqueued: ${transferTxId}`);

      // Update transaction to completed with the real transfer tx ID
      await session.run(`
        MATCH (t:TicketTransaction {id: $transactionId})
        SET t.status = 'completed',
            t.transferTxId = $transferTxId,
            t.completedAt = $completedAt
      `, {
        transactionId,
        transferTxId,
        completedAt: new Date().toISOString(),
      });

      console.log(`[TicketService] ✅ Ticket deducted successfully for booking ${bookingId}`);
      console.log(`[TicketService] On-chain transfer TX: ${transferTxId}`);

      return {
        id: transactionId,
        studentId,
        studentWallet,
        tutorId,
        bookingId,
        slotId,
        tokenId: ticket.tokenId,
        tier,
        quantity: TICKETS_PER_LESSON,
        type: 'booking',
        status: 'completed',
        transferTxId,
        reason: 'Lesson booking',
        createdAt,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[TicketService] Error deducting ticket:', error);
      
      // Mark transaction as failed if it was created
      await session.run(`
        MATCH (t:TicketTransaction {id: $transactionId})
        SET t.status = 'failed', t.reason = $reason
      `, {
        transactionId,
        reason: error instanceof Error ? error.message : 'Unknown error',
      }).catch(() => {}); // Ignore error if transaction doesn't exist

      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Refund a ticket to student when cancelling a booking
   * Only refunds if cancellation is more than 1 hour before scheduled time
   */
  async refundTicketForCancellation(input: RefundTicketInput & { scheduledTime: Date }): Promise<TicketTransaction | null> {
    const { studentId, studentWallet, bookingId, transactionId: originalTxId, reason, scheduledTime } = input;
    const refundTxId = uuidv4();
    const now = new Date();
    const createdAt = now.toISOString();

    console.log(`[TicketService] Processing refund for booking ${bookingId}`);
    console.log(`[TicketService] Scheduled time: ${scheduledTime.toISOString()}`);
    console.log(`[TicketService] Current time: ${now.toISOString()}`);

    // Check if refund is allowed (more than 1 hour before scheduled time)
    const hoursUntilLesson = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilLesson < REFUND_POLICY.NO_REFUND_HOURS) {
      console.log(`[TicketService] ❌ No refund - only ${hoursUntilLesson.toFixed(2)} hours until lesson (minimum: ${REFUND_POLICY.NO_REFUND_HOURS})`);
      return null; // No refund allowed
    }

    console.log(`[TicketService] ✓ Refund allowed - ${hoursUntilLesson.toFixed(2)} hours until lesson`);

    const driver = getDriver();
    const session = driver.session();

    try {
      // Get original transaction details
      const originalTxResult = await session.run(`
        MATCH (t:TicketTransaction {id: $originalTxId, type: 'booking', status: 'completed'})
        RETURN t
      `, { originalTxId });

      if (originalTxResult.records.length === 0) {
        throw new Error(`Original booking transaction not found: ${originalTxId}`);
      }

      const originalTx = originalTxResult.records[0]?.get('t').properties;
      const quantity = typeof originalTx.quantity === 'object' ? originalTx.quantity.toNumber() : originalTx.quantity;

      // Create refund transaction record
      await session.run(`
        CREATE (t:TicketTransaction {
          id: $id,
          studentId: $studentId,
          studentWallet: $studentWallet,
          bookingId: $bookingId,
          tokenId: $tokenId,
          tier: $tier,
          quantity: $quantity,
          type: 'cancellation',
          status: 'pending',
          reason: $reason,
          originalTransactionId: $originalTxId,
          createdAt: $createdAt
        })
      `, {
        id: refundTxId,
        studentId,
        studentWallet,
        bookingId,
        tokenId: originalTx.tokenId,
        tier: originalTx.tier,
        quantity,
        reason: reason || 'Booking cancellation - refund',
        originalTxId,
        createdAt,
      });

      // Link refund transaction to original and student
      await session.run(`
        MATCH (refund:TicketTransaction {id: $refundTxId})
        MATCH (original:TicketTransaction {id: $originalTxId})
        MATCH (s:Student {id: $studentId})
        MERGE (refund)-[:REFUNDS]->(original)
        MERGE (s)-[:MADE_TRANSACTION]->(refund)
      `, { refundTxId, originalTxId, studentId });

      console.log(`[TicketService] Executing on-chain refund transfer...`);

      // Execute on-chain transfer from vault wallet back to student
      const transferTransaction = safeTransferFrom({
        contract,
        from: VAULT_WALLET_ADDRESS as `0x${string}`,
        to: studentWallet as `0x${string}`,
        tokenId: BigInt(originalTx.tokenId),
        value: BigInt(quantity),
        data: "0x",
      });

      // Use the vault server wallet to execute the refund
      const { transactionId: transferTxId } = await serverWallet.enqueueTransaction({
        transaction: transferTransaction,
        simulate: false,
      });

      console.log(`[TicketService] Refund transfer transaction enqueued: ${transferTxId}`);

      // Mark refund as completed with real tx ID
      await session.run(`
        MATCH (t:TicketTransaction {id: $refundTxId})
        SET t.status = 'completed',
            t.transferTxId = $transferTxId,
            t.completedAt = $completedAt
      `, {
        refundTxId,
        transferTxId,
        completedAt: new Date().toISOString(),
      });

      console.log(`[TicketService] ✅ Ticket refunded successfully for booking ${bookingId}`);
      console.log(`[TicketService] On-chain refund TX: ${transferTxId}`);

      return {
        id: refundTxId,
        studentId,
        studentWallet,
        bookingId,
        tokenId: originalTx.tokenId,
        tier: originalTx.tier as TicketTier,
        quantity,
        type: 'cancellation',
        status: 'completed',
        transferTxId,
        reason: reason || 'Booking cancellation - refund',
        createdAt,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[TicketService] Error refunding ticket:', error);
      
      // Mark transaction as failed if it was created
      await session.run(`
        MATCH (t:TicketTransaction {id: $refundTxId})
        SET t.status = 'failed', t.reason = $reason
      `, {
        refundTxId,
        reason: error instanceof Error ? error.message : 'Unknown error',
      }).catch(() => {});

      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Get ticket transaction history for a student
   */
  async getStudentTransactionHistory(studentId: string): Promise<TicketTransaction[]> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(`
        MATCH (s:Student {id: $studentId})-[:MADE_TRANSACTION]->(t:TicketTransaction)
        RETURN t
        ORDER BY t.createdAt DESC
      `, { studentId });

      return result.records.map(record => {
        const t = record.get('t').properties;
        return {
          id: t.id,
          studentId: t.studentId,
          studentWallet: t.studentWallet,
          tutorId: t.tutorId,
          bookingId: t.bookingId,
          slotId: t.slotId,
          tokenId: t.tokenId,
          tier: t.tier as TicketTier,
          quantity: typeof t.quantity === 'object' ? t.quantity.toNumber() : t.quantity,
          type: t.type as TicketTransactionType,
          status: t.status as TicketTransaction['status'],
          transferTxId: t.transferTxId,
          reason: t.reason,
          createdAt: t.createdAt,
          completedAt: t.completedAt,
        };
      });
    } catch (error) {
      console.error('Error fetching student transaction history:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Get the original booking transaction for a booking ID
   */
  async getBookingTransaction(bookingId: string): Promise<TicketTransaction | null> {
    const driver = getDriver();
    const session = driver.session();

    try {
      const result = await session.run(`
        MATCH (t:TicketTransaction {bookingId: $bookingId, type: 'booking'})
        RETURN t
        LIMIT 1
      `, { bookingId });

      if (result.records.length === 0) {
        return null;
      }

      const t = result.records[0]?.get('t').properties;
      return {
        id: t.id,
        studentId: t.studentId,
        studentWallet: t.studentWallet,
        tutorId: t.tutorId,
        bookingId: t.bookingId,
        slotId: t.slotId,
        tokenId: t.tokenId,
        tier: t.tier as TicketTier,
        quantity: typeof t.quantity === 'object' ? t.quantity.toNumber() : t.quantity,
        type: t.type as TicketTransactionType,
        status: t.status as TicketTransaction['status'],
        transferTxId: t.transferTxId,
        reason: t.reason,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
      };
    } catch (error) {
      console.error('Error fetching booking transaction:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Record a ticket deduction that was done on the frontend
   * This is called after the frontend successfully transfers the ticket to the vault
   * It only records the transaction in the database - no blockchain interaction
   */
  async recordTicketDeduction(input: RecordTicketDeductionInput): Promise<TicketTransaction> {
    const { studentId, studentWallet, tutorId, bookingId, slotId, tier = 'basic', transferTxHash } = input;
    const transactionId = uuidv4();
    const createdAt = new Date().toISOString();

    console.log(`[TicketService] Recording ticket deduction for booking ${bookingId}`);
    console.log(`[TicketService] Frontend TX hash: ${transferTxHash || 'not provided'}`);

    // Get the token ID for this tier (for record keeping)
    const tickets = await this.getTickets();
    const ticket = tickets.find(t => t.tier === tier);
    const tokenId = ticket?.tokenId || 'unknown';

    const driver = getDriver();
    const session = driver.session();

    try {
      // Create completed transaction record in Memgraph
      await session.run(`
        CREATE (t:TicketTransaction {
          id: $id,
          studentId: $studentId,
          studentWallet: $studentWallet,
          tutorId: $tutorId,
          bookingId: $bookingId,
          slotId: $slotId,
          tokenId: $tokenId,
          tier: $tier,
          quantity: $quantity,
          type: 'booking',
          status: 'completed',
          transferTxId: $transferTxId,
          reason: 'Lesson booking (frontend transfer)',
          createdAt: $createdAt,
          completedAt: $completedAt
        })
      `, {
        id: transactionId,
        studentId,
        studentWallet,
        tutorId,
        bookingId,
        slotId,
        tokenId,
        tier,
        quantity: TICKETS_PER_LESSON,
        transferTxId: transferTxHash || `frontend_${transactionId}`,
        createdAt,
        completedAt: createdAt,
      });

      // Link to Student node
      await session.run(`
        MATCH (t:TicketTransaction {id: $transactionId})
        MATCH (s:Student {id: $studentId})
        MERGE (s)-[:MADE_TRANSACTION]->(t)
      `, { transactionId, studentId });

      console.log(`[TicketService] ✅ Ticket deduction recorded: ${transactionId}`);

      return {
        id: transactionId,
        studentId,
        studentWallet,
        tutorId,
        bookingId,
        slotId,
        tokenId,
        tier,
        quantity: TICKETS_PER_LESSON,
        type: 'booking',
        status: 'completed',
        transferTxId: transferTxHash || `frontend_${transactionId}`,
        reason: 'Lesson booking (frontend transfer)',
        createdAt,
        completedAt: createdAt,
      };
    } catch (error) {
      console.error('[TicketService] Error recording ticket deduction:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
}

export const ticketService = new TicketService();
