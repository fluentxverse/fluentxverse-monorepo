import { thirdwebClient } from "../utils.services/utils";
import { defineChain, Engine, getContract } from "thirdweb";
import { mintTo, mintAdditionalSupplyTo, getNFTs, getNFT, totalSupply, safeTransferFrom } from "thirdweb/extensions/erc1155";
import { upload } from "thirdweb/storage";
import * as fs from "fs";
import * as path from "path";
import { getIO } from "../../socket/socket.server";
import { NotificationService } from "../notification.services/notification.service";

// Contract configuration
const TICKET_CONTRACT_ADDRESS = process.env.TICKET_CONTRACT_ADDRESS || "0x6fB1BbF7929AF18Dbd6f4F15b03307d067E838db";
const CHAIN_ID = Number(process.env.TICKET_CHAIN_ID) || 421614; // Arbitrum Sepolia testnet

// Get contract instance
const contract = getContract({
  client: thirdwebClient,
  chain: defineChain(CHAIN_ID),
  address: TICKET_CONTRACT_ADDRESS,
});

// Server wallet for minting
const serverWallet = Engine.serverWallet({
  client: thirdwebClient,
  address: process.env.THIRDWEB_VAULT_WALLET_ADDRESS!,
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

      // TODO: Store purchase record in database with:
      // - buyerWallet
      // - tokenId
      // - tier
      // - quantity
      // - purchaseDate
      // - transferTxId
      // This allows tracking individual purchases and calculating expiry dates

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
}

export const ticketService = new TicketService();
