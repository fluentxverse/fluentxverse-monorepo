import { useState, useEffect } from 'preact/hooks';
import { BridgePrepareResult, CheckoutWidget, CompletedStatusResult, lightTheme, useActiveAccount, useAutoConnect } from "thirdweb/react";
import { defineChain } from "thirdweb";
import { Bridge } from "thirdweb";

// Development mode flag - set to true to use mock checkout
const DEV_MODE = true;

// Type for checkout success callback
type CheckoutSuccessData = {
  quote: BridgePrepareResult;
  statuses: Array<CompletedStatusResult>;
};
import { thirdwebClient, appWallet } from '../config/wallet';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import './TicketsPage.css';

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8765';

// Get ticket image URL from local assets
const getTicketImageUrl = (tier: 'basic' | 'premium' | 'trial'): string => {
  if (tier === 'basic') return '/assets/img/icons/basic_ticket2.png';
  if (tier === 'premium') return '/assets/img/icons/premium_ticket2.png';
  return '/assets/img/icons/trial_ticket.png';
};

// Arbitrum chain
const CHAIN = defineChain(42161);

// Seller wallet address - replace with your actual seller wallet
const SELLER_ADDRESS = "0x0000000000000000000000000000000000000000";

// USDC token address on Arbitrum
const USDC_ADDRESS = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";

// Custom theme matching FluentXVerse style - Basic (blue)
const fluentXVerseTheme = lightTheme({
  colors: {
    accentText: "#0245ae",
    accentButtonBg: "#0245ae",
    accentButtonText: "#ffffff",
    primaryButtonBg: "#0245ae",
    primaryButtonText: "#ffffff",
    primaryText: "#1e293b",
    secondaryText: "#64748b",
    modalBg: "#ffffff",
    borderColor: "#e2e8f0",
    separatorLine: "#f1f5f9",
    tertiaryBg: "#f8fafc",
    secondaryButtonBg: "#f1f5f9",
    secondaryButtonHoverBg: "#e2e8f0",
    secondaryButtonText: "#475569",
    success: "#10b981",
    danger: "#ef4444",
  },
});

// Premium theme with gold colors
const premiumTheme = lightTheme({
  colors: {
    accentText: "#d97706",
    accentButtonBg: "#f59e0b",
    accentButtonText: "#ffffff",
    primaryButtonBg: "#f59e0b",
    primaryButtonText: "#ffffff",
    primaryText: "#1e293b",
    secondaryText: "#64748b",
    modalBg: "#ffffff",
    borderColor: "#fcd34d",
    separatorLine: "#fef3c7",
    tertiaryBg: "#fffbeb",
    secondaryButtonBg: "#fef3c7",
    secondaryButtonHoverBg: "#fde68a",
    secondaryButtonText: "#92400e",
    success: "#10b981",
    danger: "#ef4444",
  },
});

interface TicketPackage {
  id: string;
  name: string;
  tickets: number;
  price: number;
  originalPrice?: number;
  discount?: number;
  popular?: boolean;
  description: string;
  features: string[];
  icon: string;
  tier: 'basic' | 'premium' | 'trial';
}

const ticketPackages: TicketPackage[] = [
  // Basic Tier - $6 per ticket
  {
    id: 'basic-1',
    name: 'Basic Single',
    tickets: 1,
    price: 6,
    tier: 'basic',
    description: 'Try a single basic lesson',
    features: [
      '1 Basic ticket',
      'Never expires',
      'Book any tutor',
      '25-minute lesson'
    ],
    icon: '🎫'
  },
  {
    id: 'basic-30',
    name: 'Basic 30-Pack',
    tickets: 30,
    price: 150,
    originalPrice: 180,
    discount: 17,
    tier: 'basic',
    description: 'Best value for basic lessons',
    features: [
      '30 Basic tickets',
      'Never expires',
      'Book any tutor',
      '25-minute lessons',
      'Save $30'
    ],
    icon: '🎟️'
  },
  // Premium Tier - $9 per ticket
  {
    id: 'premium-1',
    name: 'Premium Single',
    tickets: 1,
    price: 9,
    tier: 'premium',
    description: 'Try a single premium lesson',
    features: [
      '1 Premium ticket',
      'Never expires',
      'Premium tutors only',
      '25-minute premium lesson'
    ],
    icon: '🎫✨'
  },
  {
    id: 'premium-30',
    name: 'Premium 30-Pack',
    tickets: 30,
    price: 225,
    originalPrice: 270,
    discount: 17,
    tier: 'premium',
    description: 'Ultimate premium experience',
    features: [
      '30 Premium tickets',
      'Never expires',
      'Premium tutors only',
      '25-minute premium lessons',
      'Save $45'
    ],
    icon: '🎟️✨'
  }
];

// Mock Checkout Widget for Development Testing
interface MockCheckoutWidgetProps {
  pkg: TicketPackage;
  onSuccess: (data: CheckoutSuccessData) => void;
  onCancel: () => void;
  imageUrl: string;
}

function MockCheckoutWidget({ pkg, onSuccess, onCancel, imageUrl }: MockCheckoutWidgetProps) {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'crypto'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'select' | 'processing' | 'success'>('select');
  const isPremium = pkg.tier === 'premium';

  const simulatePayment = () => {
    setIsProcessing(true);
    setStep('processing');
    
    // Simulate payment processing (2-3 seconds)
    setTimeout(() => {
      setStep('success');
      
      // After showing success for 1.5 seconds, call onSuccess
      setTimeout(() => {
        // Create mock success data - cast through unknown to bypass strict type checking
        const mockSuccessData = {
          quote: {} as BridgePrepareResult,
          statuses: [{
            type: 'transfer',
            status: 'COMPLETED',
            paymentId: `mock_payment_${Date.now()}`,
            originAmount: BigInt(pkg.price * 1_000_000),
            destinationAmount: BigInt(pkg.price * 1_000_000),
            originChainId: 42161,
            destinationChainId: 42161,
            originTokenAddress: '0x0',
            destinationTokenAddress: '0x0',
            sender: '0x0',
            receiver: '0x0',
            originTxHash: `0xmock_${Date.now().toString(16)}`,
            destinationTxHash: `0xmock_${Date.now().toString(16)}`,
            originToken: { chainId: 42161, address: '0x0', decimals: 6, symbol: 'USDC', name: 'USD Coin' },
            destinationToken: { chainId: 42161, address: '0x0', decimals: 6, symbol: 'USDC', name: 'USD Coin' },
            transactions: [],
          }],
        } as unknown as CheckoutSuccessData;
        onSuccess(mockSuccessData);
      }, 1500);
    }, 2000 + Math.random() * 1000); // 2-3 second random delay
  };

  return (
    <div className={`mock-checkout ${isPremium ? 'mock-checkout-premium' : ''}`}>
      {step === 'select' && (
        <>
          <div className="mock-checkout-summary">
            <div className="mock-checkout-product">
              <img src={imageUrl} alt={pkg.name} className="mock-checkout-image" />
              <div className="mock-checkout-details">
                <span className="mock-checkout-name">{pkg.name}</span>
                <span className="mock-checkout-desc">{pkg.tickets} {pkg.tier} ticket{pkg.tickets > 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="mock-checkout-price">${pkg.price.toFixed(2)}</div>
          </div>

          <div className="mock-payment-methods">
            <p className="mock-payment-label">Payment Method</p>
            <div className="mock-payment-options">
              <button 
                className={`mock-payment-option ${paymentMethod === 'card' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('card')}
              >
                <i className="fas fa-credit-card"></i>
                Credit Card
              </button>
              <button 
                className={`mock-payment-option ${paymentMethod === 'crypto' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('crypto')}
              >
                <i className="fab fa-ethereum"></i>
                Crypto
              </button>
            </div>
          </div>

          {paymentMethod === 'card' && (
            <div className="mock-card-form">
              <div className="mock-input-group">
                <label>Card Number</label>
                <input type="text" placeholder="4242 4242 4242 4242" disabled value="4242 4242 4242 4242" />
              </div>
              <div className="mock-input-row">
                <div className="mock-input-group">
                  <label>Expiry</label>
                  <input type="text" placeholder="MM/YY" disabled value="12/28" />
                </div>
                <div className="mock-input-group">
                  <label>CVC</label>
                  <input type="text" placeholder="123" disabled value="123" />
                </div>
              </div>
            </div>
          )}

          {paymentMethod === 'crypto' && (
            <div className="mock-crypto-info">
              <div className="mock-crypto-badge">
                <i className="fas fa-wallet"></i>
                <span>Connected Wallet</span>
              </div>
              <p className="mock-crypto-note">
                <i className="fas fa-info-circle"></i>
                Payment will be simulated using mock USDC
              </p>
            </div>
          )}

          <button 
            className={`mock-pay-button ${isPremium ? 'premium' : ''}`}
            onClick={simulatePayment}
          >
            <i className="fas fa-lock"></i>
            Pay ${pkg.price.toFixed(2)}
          </button>

          <div className="mock-checkout-footer">
            <span className="mock-dev-badge">
              <i className="fas fa-code"></i>
              DEV MODE - No real payment
            </span>
          </div>
        </>
      )}

      {step === 'processing' && (
        <div className="mock-processing">
          <div className={`mock-spinner ${isPremium ? 'premium' : ''}`}></div>
          <h3>Processing Payment...</h3>
          <p>Please wait while we simulate your payment</p>
        </div>
      )}

      {step === 'success' && (
        <div className="mock-success">
          <div className={`mock-success-icon ${isPremium ? 'premium' : ''}`}>
            <i className="fas fa-check"></i>
          </div>
          <h3>Payment Successful!</h3>
          <p>You've purchased {pkg.tickets} {pkg.tier} ticket{pkg.tickets > 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  );
}

// Ticket balance type
interface TicketBalance {
  basic: number;
  premium: number;
  trial: number;
  basicTokenId: string | null;
  premiumTokenId: string | null;
  trialTokenId: string | null;
}

export default function TicketsPage() {
  const [selectedPackage, setSelectedPackage] = useState<TicketPackage | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [ticketBalance, setTicketBalance] = useState<TicketBalance>({ basic: 0, premium: 0, trial: 0, basicTokenId: null, premiumTokenId: null, trialTokenId: null });
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'all' | 'basic' | 'premium' | 'trial'>('all');
  const [adjustedAmount, setAdjustedAmount] = useState<string | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  
  const activeAccount = useActiveAccount();
  
  // Check if wallet is still auto-connecting (loading state)
  const { isLoading: isWalletConnecting } = useAutoConnect({
    client: thirdwebClient,
    wallets: [appWallet],
  });

  useEffect(() => {
    document.title = 'Buy Tickets | FluentXVerse';
  }, []);

  // Fetch user's ticket balance from blockchain
  const fetchTicketBalance = async (walletAddress: string) => {
    setIsLoadingBalance(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/balance/${walletAddress}`);
      const result = await response.json();
      
      if (result.success) {
        setTicketBalance(result.data);
        console.log('Ticket balance:', result.data);
      } else {
        console.error('Failed to fetch ticket balance:', result.error);
      }
    } catch (error) {
      console.error('Error fetching ticket balance:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  // Fetch balance when wallet connects
  useEffect(() => {
    if (activeAccount?.address) {
      fetchTicketBalance(activeAccount.address);
    }
  }, [activeAccount?.address]);

  const filteredPackages = selectedTier === 'all' 
    ? ticketPackages 
    : ticketPackages.filter(pkg => pkg.tier === selectedTier);

  // Fetch quote and calculate adjusted amount to compensate for fees
  const fetchQuoteAndAdjust = async (pkg: TicketPackage) => {
    setIsLoadingQuote(true);
    setSelectedPackage(pkg);
    
    try {
      // Convert USD price to USDC amount (6 decimals)
      const targetAmountWei = BigInt(Math.floor(pkg.price * 1_000_000));
      const receiverAddress = activeAccount?.address || SELLER_ADDRESS;
      
      // Get quote from Stripe onramp
      const quote = await Bridge.Onramp.prepare({
        client: thirdwebClient,
        onramp: "stripe",
        chainId: 42161, // Arbitrum chain
        tokenAddress: USDC_ADDRESS as `0x${string}`,
        receiver: receiverAddress as `0x${string}`,
        amount: targetAmountWei,
        currency: "USD",
      });
      
      // Debug: log the full quote response
      console.log('Full quote response:', quote);
      
      // currencyAmount is what the user will actually pay in fiat (ensure it's a number)
      const actualFiatCost = Number(quote.currencyAmount);
      const targetPrice = pkg.price;
      
      // Calculate the fee/markup
      const feeAmount = actualFiatCost - targetPrice;
      
      // Adjust: reduce the USDC amount so final fiat cost = target price
      // newAmount = targetAmount - (feeAmount in USDC terms)
      const adjustedUsdcAmount = targetPrice - feeAmount;
      
      console.log('=== Price Adjustment Details ===');
      console.log(`Package: ${pkg.name}`);
      console.log(`Displayed Price: $${targetPrice.toFixed(2)}`);
      console.log(`Provider Quoted Price: $${actualFiatCost.toFixed(2)}`);
      console.log(`Fee Added by Provider: $${feeAmount.toFixed(2)} (${((feeAmount / targetPrice) * 100).toFixed(2)}%)`);
      console.log(`Amount Deducted to Compensate: $${feeAmount.toFixed(2)}`);
      console.log(`Adjusted USDC Amount: $${adjustedUsdcAmount.toFixed(2)}`);
      console.log(`Expected Final Price for Customer: ~$${targetPrice.toFixed(2)}`);
      console.log('================================');
      
      setAdjustedAmount(adjustedUsdcAmount.toFixed(2));
      setShowCheckout(true);
    } catch (error) {
      console.error('Error fetching quote:', error);
      // Fallback to original price if quote fails
      setAdjustedAmount(pkg.price.toString());
      setShowCheckout(true);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handlePurchase = (pkg: TicketPackage) => {
    fetchQuoteAndAdjust(pkg);
  };

  const handleCheckoutSuccess = async (transactionData: CheckoutSuccessData) => {
    console.log('=== Payment Success ===');
    console.log('Transaction Data:', transactionData);
    console.log('Active Account:', activeAccount?.address);
    console.log('Selected Package:', selectedPackage);
    console.log('=======================');
    
    if (!selectedPackage) {
      console.error('Missing selectedPackage');
      setShowCheckout(false);
      setSelectedPackage(null);
      setAdjustedAmount(null);
      return;
    }

    // For DEV MODE: Use a test wallet if no wallet is connected
    const buyerWallet = activeAccount?.address || '0xa2a3D233b95fCB94409555B12444399d4b72E239';
    
    if (!activeAccount?.address) {
      console.warn('⚠️ No wallet connected - using test wallet for DEV MODE:', buyerWallet);
    }

    try {
      console.log('📤 Calling /tickets/purchase API...');
      console.log('Request body:', {
        buyerWallet,
        tier: selectedPackage.tier,
        quantity: selectedPackage.tickets,
      });

      // Call backend to process the purchase and transfer NFT tickets
      const response = await fetch(`${API_BASE_URL}/tickets/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerWallet,
          tier: selectedPackage.tier,
          quantity: selectedPackage.tickets,
          // Include mock transaction hash for reference (DEV MODE)
          mockTransactionHash: (transactionData.statuses?.[0] as any)?.originTxHash || `mock_${Date.now()}`,
        }),
      });

      const result = await response.json();
      console.log('=== Purchase API Response ===');
      console.log(result);
      console.log('==============================');

      if (result.success) {
        console.log(`✅ Successfully purchased ${selectedPackage.tickets} ${selectedPackage.tier} ticket(s)!`);
        console.log(`Transfer Transaction ID: ${result.data.transactionId}`);
        // Refresh on-chain balance after successful purchase
        if (activeAccount?.address) {
          fetchTicketBalance(activeAccount.address);
        }
      } else {
        console.error('❌ Purchase failed:', result.error);
        // Still refresh balance to show actual on-chain state
        if (activeAccount?.address) {
          fetchTicketBalance(activeAccount.address);
        }
      }
    } catch (error) {
      console.error('Error calling purchase API:', error);
      // Still refresh balance to show actual on-chain state
      if (activeAccount?.address) {
        fetchTicketBalance(activeAccount.address);
      }
    }
    
    setShowCheckout(false);
    setSelectedPackage(null);
    setAdjustedAmount(null);
  };

  const handleCheckoutCancel = () => {
    setShowCheckout(false);
    setSelectedPackage(null);
    setAdjustedAmount(null);
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <div className="tickets-page">
          <div className="tickets-container">
            {/* Header */}
            <div className="tickets-header">
              <div className="tickets-header-left">
                <div className="tickets-page-icon">
                  <i className="fas fa-ticket-alt"></i>
                </div>
                <div>
                  <h1 className="tickets-page-title">Buy Lesson Tickets</h1>
                  <p className="tickets-page-subtitle">Purchase tickets to book lessons with our expert tutors</p>
                </div>
              </div>
            </div>

            {/* Current Balance */}
            <div className="tickets-balance">
              <div className="balance-card">
                <div className="balance-header">
                  <span className="balance-label">Your Ticket Balance</span>
                </div>
                {isLoadingBalance || isWalletConnecting ? (
                  <div className="balance-loading">
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>{isWalletConnecting ? 'Connecting wallet...' : 'Loading balance...'}</span>
                  </div>
                ) : (
                  <div className="balance-tickets-row">
                    <div className="balance-ticket-item">
                      <img 
                        src={getTicketImageUrl('basic')} 
                        alt="Basic Ticket" 
                        className="balance-ticket-img"
                      />
                      <span className="balance-ticket-count">{ticketBalance?.basic || 0}</span>
                    </div>
                    <div className="balance-ticket-item">
                      <img 
                        src={getTicketImageUrl('premium')} 
                        alt="Premium Ticket" 
                        className="balance-ticket-img"
                      />
                      <span className="balance-ticket-count premium">{ticketBalance?.premium || 0}</span>
                    </div>
                    {ticketBalance?.trial > 0 && (
                      <div className="balance-ticket-item">
                        <img 
                          src={getTicketImageUrl('trial')} 
                          alt="Trial Ticket" 
                          className="balance-ticket-img"
                        />
                        <span className="balance-ticket-count trial">{ticketBalance?.trial || 0}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* How it Works */}
            <div className="how-it-works">
              <h2>How it Works</h2>
              <div className="steps-grid">
                <div className="step-card">
                  <div className="step-number">1</div>
                  <div className="step-icon">🎫</div>
                  <h3>Buy Tickets</h3>
                  <p>Choose a package that fits your learning goals</p>
                </div>
                <div className="step-card">
                  <div className="step-number">2</div>
                  <div className="step-icon">👨‍🏫</div>
                  <h3>Find a Tutor</h3>
                  <p>Browse our verified tutors and pick your favorite</p>
                </div>
                <div className="step-card">
                  <div className="step-number">3</div>
                  <div className="step-icon">📅</div>
                  <h3>Book a Lesson</h3>
                  <p>Use your tickets to schedule lessons at your convenience</p>
                </div>
                <div className="step-card">
                  <div className="step-number">4</div>
                  <div className="step-icon">🚀</div>
                  <h3>Learn & Grow</h3>
                  <p>Improve your English skills with personalized lessons</p>
                </div>
              </div>
            </div>

            {/* Packages Grid */}
            <div className="packages-section">
              <h2>Choose Your Package</h2>
              
              {/* Tier Comparison */}
              <div className="tier-comparison">
                <div className="tier-info basic-tier">
                  <div className="tier-header">
                    <span className="tier-badge basic">Basic</span>
                    <span className="tier-price">$6/ticket</span>
                  </div>
                  <p>25-minute lessons with any available tutor</p>
                </div>
                <div className="tier-info premium-tier">
                  <div className="tier-header">
                    <span className="tier-badge premium">Premium</span>
                    <span className="tier-price">$9/ticket</span>
                  </div>
                  <p>25-minute premium lessons with premium tutors</p>
                </div>
              </div>
              
              {/* Tier Tabs */}
              <div className="tier-tabs">
                <button 
                  className={`tier-tab ${selectedTier === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedTier('all')}
                >
                  All Packages
                </button>
                <button 
                  className={`tier-tab ${selectedTier === 'basic' ? 'active' : ''}`}
                  onClick={() => setSelectedTier('basic')}
                >
                  <span className="tier-badge basic small">Basic</span>
                  $6/ticket
                </button>
                <button 
                  className={`tier-tab ${selectedTier === 'premium' ? 'active' : ''}`}
                  onClick={() => setSelectedTier('premium')}
                >
                  <span className="tier-badge premium small">Premium</span>
                  $9/ticket
                </button>
              </div>
              
              <div className="packages-grid">
                {filteredPackages.map(pkg => (
                  <div
                    key={pkg.id}
                    className={`package-card ${pkg.popular ? 'popular' : ''} ${selectedPackage?.id === pkg.id ? 'selected' : ''} ${pkg.tier}-tier`}
                  >
                    {pkg.popular && (
                      <div className="popular-badge">
                        <i className="fas fa-fire"></i>
                        Most Popular
                      </div>
                    )}
                    {pkg.discount && (
                      <div className="discount-badge">
                        <i className="fas fa-bolt"></i>
                        {pkg.discount}% OFF
                      </div>
                    )}
                    
                    <span className={`tier-badge ${pkg.tier}`}>{pkg.tier === 'basic' ? 'Basic' : 'Premium'}</span>
                    <div className="package-icon">
                      <img src={getTicketImageUrl(pkg.tier)} alt={`${pkg.tier} ticket`} />
                    </div>
                    <h3 className="package-name">{pkg.name}</h3>
                    <p className="package-description">{pkg.description}</p>
                    
                    <div className="package-tickets">
                      <span className="ticket-count">{pkg.tickets}</span>
                      <span className="ticket-label">Ticket{pkg.tickets > 1 ? 's' : ''}</span>
                    </div>
                    
                    <div className="package-price">
                      {pkg.originalPrice && (
                        <span className="original-price">${pkg.originalPrice}</span>
                      )}
                      <span className="current-price">${pkg.price}</span>
                      <span className="price-per-ticket">
                        ${(pkg.price / pkg.tickets).toFixed(2)}/ticket
                      </span>
                    </div>
                    
                    <ul className="package-features">
                      {pkg.features.map((feature, index) => (
                        <li key={index}>
                          <i className="fas fa-check"></i>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    
                    <button
                      className={`purchase-btn ${pkg.tier === 'premium' ? 'premium-btn' : ''} ${pkg.popular ? 'popular-btn' : ''}`}
                      onClick={() => handlePurchase(pkg)}
                      disabled={isLoadingQuote && selectedPackage?.id === pkg.id}
                    >
                      {isLoadingQuote && selectedPackage?.id === pkg.id ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          Loading...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-shopping-cart"></i>
                          Buy Now
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && selectedPackage && (
        <div className="checkout-modal-overlay" onClick={handleCheckoutCancel}>
          <div className={`checkout-modal-content ${selectedPackage.tier === 'premium' ? 'premium-checkout' : ''}`} onClick={(e) => e.stopPropagation()}>
            <button className="checkout-close-btn" onClick={handleCheckoutCancel}>
              <i className="fas fa-times"></i>
            </button>
            <div className={`checkout-header ${selectedPackage.tier === 'premium' ? 'premium-header' : ''}`}>
              <div className="checkout-header-icon">
                <img src={getTicketImageUrl(selectedPackage.tier)} alt={`${selectedPackage.tier} ticket`} />
              </div>
              <h2>Complete Your Purchase</h2>
              <p>You're buying: <strong>{selectedPackage.name}</strong></p>
            </div>
            <div className="checkout-body">
              {DEV_MODE ? (
                <MockCheckoutWidget
                  pkg={selectedPackage}
                  onSuccess={handleCheckoutSuccess}
                  onCancel={handleCheckoutCancel}
                  imageUrl={getTicketImageUrl(selectedPackage.tier)}
                />
              ) : (
                <CheckoutWidget
                  client={thirdwebClient}
                  
                  chain={CHAIN}
                  amount={adjustedAmount || selectedPackage.price.toString()}
                  currency="USD"
                  tokenAddress={USDC_ADDRESS}
                  feePayer='seller'
                  seller={SELLER_ADDRESS}
                  name={selectedPackage.name}
                  description={`${selectedPackage.tickets} ${selectedPackage.tier} ticket${selectedPackage.tickets > 1 ? 's' : ''} for FluentXVerse lessons`}
                  image={getTicketImageUrl(selectedPackage.tier)}
                  theme={selectedPackage.tier === 'premium' ? premiumTheme : fluentXVerseTheme}
                  buttonLabel={`Pay $${selectedPackage.price}`}
                  onSuccess={handleCheckoutSuccess}
                  onCancel={handleCheckoutCancel}
                  showThirdwebBranding={false}
                  paymentMethods={["crypto", "card"]}
                  connectOptions={{
                    connectModal: {
                      size: "compact",
                    },
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
