import Elysia, { t } from 'elysia';
import { ticketService, type TicketTier } from '@/services/ticket.services/ticket.service';
import * as fs from 'fs';
import * as path from 'path';

const Ticket = new Elysia({ prefix: '/tickets' })
  /**
   * Get all tickets from contract (source of truth)
   * GET /tickets
   */
  .get('/', async () => {
    try {
      const tickets = await ticketService.getTickets();
      return {
        success: true,
        data: tickets
      };
    } catch (error) {
      console.error('Error in GET /tickets:', error);
      return {
        success: false,
        error: 'Failed to get tickets'
      };
    }
  })

  /**
   * Get ticket statistics
   * GET /tickets/stats
   */
  .get('/stats', async () => {
    try {
      const stats = await ticketService.getTicketStats();
      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error in GET /tickets/stats:', error);
      return {
        success: false,
        error: 'Failed to get ticket statistics'
      };
    }
  })

  /**
   * Create a new ticket type (Basic or Premium) - Admin only
   * Only 2 ticket types should exist on contract
   * POST /tickets
   */
  .post('/', async ({ body }) => {
    try {
      const { tier, price, supply } = body;

      // Validate tier
      if (tier !== 'basic' && tier !== 'premium') {
        return {
          success: false,
          error: 'Invalid tier. Must be "basic" or "premium"'
        };
      }

      const { ticket, transactionId } = await ticketService.createTicket({
        tier,
        price: Number(price),
        supply: Number(supply),
      });

      return {
        success: true,
        data: {
          ticket,
          transactionId,
        },
        message: `${tier.charAt(0).toUpperCase() + tier.slice(1)} ticket minting started. You will be notified when complete.`
      };
    } catch (error) {
      console.error('Error in POST /tickets:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create ticket'
      };
    }
  }, {
    body: t.Object({
      tier: t.Union([t.Literal('basic'), t.Literal('premium')]),
      price: t.Number(),
      supply: t.Number(),
    })
  })

  /**
   * Mint additional supply for existing ticket (Admin only)
   * POST /tickets/:tokenId/mint
   */
  .post('/:tokenId/mint', async ({ params, body }) => {
    try {
      const { quantity } = body;

      if (!quantity || quantity < 1) {
        return {
          success: false,
          error: 'Quantity must be at least 1'
        };
      }

      const { ticket, transactionId } = await ticketService.mintAdditional({
        tokenId: params.tokenId,
        quantity: Number(quantity),
      });

      return {
        success: true,
        data: {
          ticket,
          transactionId,
        },
        message: `Minting ${quantity} additional ${ticket.tier} tickets started. You will be notified when complete.`
      };
    } catch (error) {
      console.error('Error in POST /tickets/:tokenId/mint:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mint additional supply'
      };
    }
  }, {
    body: t.Object({
      quantity: t.Number()
    })
  })

  /**
   * Get ticket image file
   * GET /tickets/image/:tier
   */
  .get('/image/:tier', async ({ params, set }) => {
    try {
      const tier = params.tier as TicketTier;
      
      if (tier !== 'basic' && tier !== 'premium') {
        set.status = 400;
        return { error: 'Invalid tier' };
      }

      const imagePath = path.join(__dirname, '../assets/ticket', `${tier}_ticket.png`);
      
      if (!fs.existsSync(imagePath)) {
        set.status = 404;
        return { error: 'Image not found' };
      }

      // Return the image file
      set.headers['Content-Type'] = 'image/png';
      set.headers['Cache-Control'] = 'public, max-age=31536000'; // Cache for 1 year
      return Bun.file(imagePath);
    } catch (error) {
      console.error('Error in GET /tickets/image/:tier:', error);
      set.status = 500;
      return { error: 'Failed to get ticket image' };
    }
  })

  /**
   * Process ticket purchase (DEV MODE - simulates purchase after mock checkout success)
   * In production, this would verify the payment transaction before transferring tickets
   * POST /tickets/purchase
   */
  .post('/purchase', async ({ body }) => {
    console.log('=== POST /tickets/purchase called ===');
    console.log('Request body:', body);
    
    try {
      const { buyerWallet, tier, quantity, mockTransactionHash } = body;

      // Validate input
      if (!buyerWallet || !buyerWallet.startsWith('0x')) {
        console.log('❌ Invalid buyer wallet address');
        return {
          success: false,
          error: 'Invalid buyer wallet address'
        };
      }

      if (tier !== 'basic' && tier !== 'premium') {
        console.log('❌ Invalid tier:', tier);
        return {
          success: false,
          error: 'Invalid tier. Must be "basic" or "premium"'
        };
      }

      if (!quantity || quantity < 1) {
        console.log('❌ Invalid quantity:', quantity);
        return {
          success: false,
          error: 'Quantity must be at least 1'
        };
      }

      console.log(`✅ Validation passed. Processing purchase: ${quantity} ${tier} ticket(s) for ${buyerWallet}`);

      // Process the purchase - transfer NFT to buyer
      const result = await ticketService.processPurchase({
        buyerWallet,
        tier,
        quantity: Number(quantity),
        mockTransactionHash,
      });

      console.log('Purchase result:', result);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to process purchase'
        };
      }

      return {
        success: true,
        data: {
          transactionId: result.transactionId,
          tokenId: result.tokenId,
          tier: result.tier,
          quantity: result.quantity,
          purchaseDate: result.purchaseDate,
        },
        message: `Successfully processed purchase of ${quantity} ${tier} ticket(s). Transfer initiated.`
      };
    } catch (error) {
      console.error('Error in POST /tickets/purchase:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process purchase'
      };
    }
  }, {
    body: t.Object({
      buyerWallet: t.String(),
      tier: t.Union([t.Literal('basic'), t.Literal('premium')]),
      quantity: t.Number(),
      mockTransactionHash: t.Optional(t.String()),
    })
  })

  /**
   * Get wallet's ticket balance (Basic and Premium)
   * GET /tickets/balance/:walletAddress
   */
  .get('/balance/:walletAddress', async ({ params }) => {
    try {
      const { walletAddress } = params;

      if (!walletAddress || !walletAddress.startsWith('0x')) {
        return {
          success: false,
          error: 'Invalid wallet address'
        };
      }

      const balance = await ticketService.getWalletTicketBalance(walletAddress);

      return {
        success: true,
        data: balance
      };
    } catch (error) {
      console.error('Error in GET /tickets/balance/:walletAddress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get ticket balance'
      };
    }
  })

  /**
   * Get purchase history for a wallet address
   * GET /tickets/purchases/:walletAddress
   */
  .get('/purchases/:walletAddress', async ({ params }) => {
    try {
      const { walletAddress } = params;

      if (!walletAddress || !walletAddress.startsWith('0x')) {
        return {
          success: false,
          error: 'Invalid wallet address'
        };
      }

      const purchases = await ticketService.getPurchaseHistoryByWallet(walletAddress);

      return {
        success: true,
        data: purchases
      };
    } catch (error) {
      console.error('Error in GET /tickets/purchases/:walletAddress:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get purchase history'
      };
    }
  })

  /**
   * Get all purchases (admin view) with optional filters
   * GET /tickets/purchases
   */
  .get('/purchases', async ({ query }) => {
    try {
      const tier = query.tier as 'basic' | 'premium' | undefined;
      const limit = query.limit ? parseInt(query.limit as string) : undefined;
      const offset = query.offset ? parseInt(query.offset as string) : undefined;

      const result = await ticketService.getAllPurchases({ tier, limit, offset });

      return {
        success: true,
        data: result.purchases,
        total: result.total
      };
    } catch (error) {
      console.error('Error in GET /tickets/purchases:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get purchases'
      };
    }
  })

  /**
   * Get purchase statistics (admin view)
   * GET /tickets/purchases/stats
   */
  .get('/purchases/stats', async () => {
    try {
      const stats = await ticketService.getPurchaseStats();

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error in GET /tickets/purchases/stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get purchase stats'
      };
    }
  });

export default Ticket;
