import { useState, useEffect, useCallback } from 'preact/hooks';
import { BridgePrepareResult, CheckoutWidget, CompletedStatusResult, lightTheme, useActiveAccount, useAutoConnect } from "thirdweb/react";
import { defineChain } from "thirdweb";
import { Bridge } from "thirdweb";
import { useAuthContext } from '../context/AuthContext';
import { useTicketNotifications } from '../hooks/useTicketNotifications';
import { useToastContext } from '../context/ToastContext';
import { toast } from '../Components/Common/Toast';

// Development mode flag - set to true to use mock checkout
const DEV_MODE = true;

// Type for checkout success callback
type CheckoutSuccessData = {
  quote: BridgePrepareResult;
  statuses: Array<CompletedStatusResult>;
};
import { thirdwebClient, appWallet } from '../config/wallet';
import { API_BASE_URL } from '../config/api';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import './TicketsPage.css';

// Get ticket image URL from local assets
const getTicketImageUrl = (tier: 'basic' | 'premium' | 'trial'): string => {
  if (tier === 'basic') return '/assets/img/icons/basic_ticket2.webp';
  if (tier === 'premium') return '/assets/img/icons/premium_ticket2.webp';
  return '/assets/img/icons/trial_ticket.webp';
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
  const { user } = useAuthContext();
  const { showSuccess, showInfo, showError } = useToastContext();
  const [selectedPackage, setSelectedPackage] = useState<TicketPackage | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [ticketBalance, setTicketBalance] = useState<TicketBalance>({ basic: 0, premium: 0, trial: 0, basicTokenId: null, premiumTokenId: null, trialTokenId: null });
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'all' | 'basic' | 'premium' | 'trial'>('all');
  const [adjustedAmount, setAdjustedAmount] = useState<string | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showQuantitySelector, setShowQuantitySelector] = useState(false);
  const [packageForQuantity, setPackageForQuantity] = useState<TicketPackage | null>(null);
  
  const activeAccount = useActiveAccount();
  
  // Check if wallet is still auto-connecting (loading state)
  const { isLoading: isWalletConnecting } = useAutoConnect({
    client: thirdwebClient,
    wallets: [appWallet],
  });

  // Get wallet address from connected wallet or from user's profile
  const walletAddress = activeAccount?.address || user?.walletAddress || user?.smartWalletAddress;

  // Handle balance update from socket notification
  const handleBalanceUpdate = useCallback((balance: { basic: number; premium: number; trial: number; total: number }) => {
    setTicketBalance(prev => ({
      ...prev,
      basic: balance.basic,
      premium: balance.premium,
      trial: balance.trial,
    }));
    showSuccess('Your ticket balance has been updated!', 3000);
  }, [showSuccess]);

  // Subscribe to real-time ticket notifications
  useTicketNotifications(user?.userId, handleBalanceUpdate);

  useEffect(() => {
    document.title = 'Buy Tickets | FluentXVerse';
  }, []);

  // Fetch user's ticket balance from blockchain
  const fetchTicketBalance = async (walletAddr: string) => {
    setIsLoadingBalance(true);
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/balance/${walletAddr}`);
      const result = await response.json();
      
      if (result.success) {
        setTicketBalance(result.data);
        return result.data; // Return balance for polling use
      } else {
        console.error('Failed to fetch ticket balance:', result.error);
        return null;
      }
    } catch (error) {
      console.error('Error fetching ticket balance:', error);
      return null;
    } finally {
      setIsLoadingBalance(false);
    }
  };

  // Fetch balance when wallet connects or user is authenticated with wallet address
  useEffect(() => {
    if (walletAddress) {
      fetchTicketBalance(walletAddress);
    }
  }, [walletAddress]);

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
      
      // currencyAmount is what the user will actually pay in fiat (ensure it's a number)
      const actualFiatCost = Number(quote.currencyAmount);
      const targetPrice = pkg.price;
      
      // Calculate the fee/markup
      const feeAmount = actualFiatCost - targetPrice;
      
      // Adjust: reduce the USDC amount so final fiat cost = target price
      // newAmount = targetAmount - (feeAmount in USDC terms)
      const adjustedUsdcAmount = targetPrice - feeAmount;
      
      
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
    setPackageForQuantity(pkg);
    setQuantity(1);
    setShowQuantitySelector(true);
  };

  const handleConfirmQuantity = () => {
    if (!packageForQuantity) return;
    
    // Create a modified package with multiplied quantity and price
    const multipliedPackage: TicketPackage = {
      ...packageForQuantity,
      tickets: packageForQuantity.tickets * quantity,
      price: packageForQuantity.price * quantity,
      originalPrice: packageForQuantity.originalPrice ? packageForQuantity.originalPrice * quantity : undefined,
    };
    
    setShowQuantitySelector(false);
    fetchQuoteAndAdjust(multipliedPackage);
  };

  const getTotalTickets = () => {
    if (!packageForQuantity) return 0;
    return packageForQuantity.tickets * quantity;
  };

  const getTotalPrice = () => {
    if (!packageForQuantity) return 0;
    return packageForQuantity.price * quantity;
  };

  const handleCheckoutSuccess = async (transactionData: CheckoutSuccessData) => {
    
    if (!selectedPackage) {
      console.error('Missing selectedPackage');
      setShowCheckout(false);
      setSelectedPackage(null);
      setAdjustedAmount(null);
      return;
    }

    // CRITICAL: Get the buyer's wallet address - use connected wallet first, then user profile wallet
    // NEVER fall back to a hardcoded address in production!
    const buyerWallet = activeAccount?.address || user?.walletAddress || user?.smartWalletAddress;
    
    if (!buyerWallet) {
      console.error('❌ CRITICAL: No wallet address available for purchase!');
      toast.error('No wallet address found. Please make sure you are logged in and have a wallet connected.');
      setShowCheckout(false);
      setSelectedPackage(null);
      setAdjustedAmount(null);
      return;
    }
    
    // Validate wallet address format
    if (!buyerWallet.startsWith('0x') || buyerWallet.length !== 42) {
      console.error('❌ CRITICAL: Invalid wallet address format:', buyerWallet);
      toast.error('Invalid wallet address. Please contact support.');
      setShowCheckout(false);
      setSelectedPackage(null);
      setAdjustedAmount(null);
      return;
    }
    

    try {
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
          // Include userId for activity tracking
          userId: user?.userId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        
        // The blockchain transaction is queued but not yet confirmed
        // We need to wait for it to be mined before the balance updates
        if (walletAddress) {
          // Store initial balance for comparison
          const initialBalance = {
            basic: ticketBalance.basic,
            premium: ticketBalance.premium,
            trial: ticketBalance.trial,
          };
          const expectedIncrease = selectedPackage.tickets;
          const expectedTier = selectedPackage.tier;
          
          // Function to invalidate cache and fetch balance, returning the fresh balance
          const invalidateAndFetch = async (): Promise<typeof initialBalance | null> => {
            try {
              // First invalidate the cache on backend
              await fetch(`${API_BASE_URL}/tickets/invalidate-cache/${walletAddress}`, {
                method: 'POST',
              });
            } catch (e) {
              console.warn('Cache invalidation failed, continuing anyway:', e);
            }
            return await fetchTicketBalance(walletAddress);
          };
          
          // Polling function to check for balance update
          const pollForBalanceUpdate = async () => {
            const maxAttempts = 10;
            const delays = [2000, 3000, 3000, 4000, 4000, 5000, 5000, 5000, 5000, 5000]; // ~40s total
            
            for (let i = 0; i < maxAttempts; i++) {
              await new Promise(resolve => setTimeout(resolve, delays[i]));
              
              const newBalance = await invalidateAndFetch();
              
              if (newBalance) {
                // Check if balance increased for the expected tier
                const currentBalance = newBalance[expectedTier];
                const expectedBalance = initialBalance[expectedTier] + expectedIncrease;
                
                
                if (currentBalance >= expectedBalance) {
                  return; // Balance updated, stop polling
                }
              }
            }
            
          };
          
          // Start polling in the background
          pollForBalanceUpdate();
          
          // Show success message using toast
          showSuccess(`🎉 Purchase successful! Your ${selectedPackage.tickets} ${selectedPackage.tier} ticket(s) are being transferred.`, 6000);
          showInfo('Your balance will update shortly once the blockchain confirms the transfer.', 5000);
        }
      } else {
        console.error('❌ Purchase failed:', result.error);
        showError(`Purchase failed: ${result.error}`, 5000);
        // Still refresh balance to show actual on-chain state
        if (walletAddress) {
          fetchTicketBalance(walletAddress);
        }
      }
    } catch (error) {
      console.error('Error calling purchase API:', error);
      showError('Purchase failed. Please try again.', 5000);
      // Still refresh balance to show actual on-chain state
      if (walletAddress) {
        fetchTicketBalance(walletAddress);
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

            {/* Hero Section - Your Ticket Balance */}
            <div className="tickets-hero">
              <div className="tickets-hero-content">
                <div className="tickets-hero-text">
                  <h1>Your Lesson Tickets</h1>
                  <p>Purchase tickets to book lessons with our verified tutors</p>
                </div>
                <div className="tickets-hero-balance">
                  {isLoadingBalance || isWalletConnecting ? (
                    <div className="balance-loading">
                      <div className="balance-loading-spinner"></div>
                      <span>{isWalletConnecting ? 'Connecting wallet...' : 'Loading...'}</span>
                    </div>
                  ) : (
                    <div className="balance-tickets-display">
                      <div className="balance-ticket-card basic">
                        <div className="balance-ticket-icon">
                          <img src={getTicketImageUrl('basic')} alt="Basic" />
                        </div>
                        <div className="balance-ticket-info">
                          <span className="balance-ticket-number">{ticketBalance?.basic || 0}</span>
                          <span className="balance-ticket-type">Basic</span>
                        </div>
                      </div>
                      <div className="balance-ticket-card premium">
                        <div className="balance-ticket-icon">
                          <img src={getTicketImageUrl('premium')} alt="Premium" />
                        </div>
                        <div className="balance-ticket-info">
                          <span className="balance-ticket-number">{ticketBalance?.premium || 0}</span>
                          <span className="balance-ticket-type">Premium</span>
                        </div>
                      </div>
                      {ticketBalance?.trial > 0 && (
                        <div className="balance-ticket-card trial">
                          <div className="balance-ticket-icon">
                            <img src={getTicketImageUrl('trial')} alt="Trial" />
                          </div>
                          <div className="balance-ticket-info">
                            <span className="balance-ticket-number">{ticketBalance?.trial || 0}</span>
                            <span className="balance-ticket-type">Trial</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <a href="/tutors" className="hero-book-btn">
                    <i className="ri-calendar-line"></i>
                    Book a Lesson
                  </a>
                </div>
              </div>
            </div>

            {/* Quick Steps */}
            <div className="how-it-works">
              <div className="steps-row">
                <div className="step-item">
                  <div className="step-icon-wrap"><span>1</span></div>
                  <div className="step-text">
                    <strong>Buy Tickets</strong>
                    <span>Choose a package below</span>
                  </div>
                </div>
                <div className="step-connector"><i className="ri-arrow-right-line"></i></div>
                <div className="step-item">
                  <div className="step-icon-wrap"><span>2</span></div>
                  <div className="step-text">
                    <strong>Find a Tutor</strong>
                    <span>Browse verified tutors</span>
                  </div>
                </div>
                <div className="step-connector"><i className="ri-arrow-right-line"></i></div>
                <div className="step-item">
                  <div className="step-icon-wrap"><span>3</span></div>
                  <div className="step-text">
                    <strong>Book & Learn</strong>
                    <span>Schedule your lesson</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Packages Grid */}
            <div className="packages-section">
              <div className="packages-header">
                <h2>Choose Your Package</h2>
                <div className="tier-tabs">
                  <button 
                    className={`tier-tab ${selectedTier === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedTier('all')}
                  >
                    All
                  </button>
                  <button 
                    className={`tier-tab basic ${selectedTier === 'basic' ? 'active' : ''}`}
                    onClick={() => setSelectedTier('basic')}
                  >
                    Basic
                  </button>
                  <button 
                    className={`tier-tab premium ${selectedTier === 'premium' ? 'active' : ''}`}
                    onClick={() => setSelectedTier('premium')}
                  >
                    Premium
                  </button>
                </div>
              </div>
              
              <div className="packages-grid">
                {filteredPackages.map(pkg => (
                  <div
                    key={pkg.id}
                    className={`package-card ${pkg.popular ? 'popular' : ''} ${selectedPackage?.id === pkg.id ? 'selected' : ''} ${pkg.tier}-tier`}
                  >
                    {pkg.discount && (
                      <div className="discount-ribbon">
                        <span>SAVE {pkg.discount}%</span>
                      </div>
                    )}
                    
                    <div className="package-card-header">
                      <span className={`tier-badge ${pkg.tier}`}>{pkg.tier === 'basic' ? 'Basic' : 'Premium'}</span>
                      {pkg.popular && <span className="popular-tag"><i className="ri-fire-fill"></i> Best Value</span>}
                    </div>
                    
                    <div className="package-visual">
                      <img src={getTicketImageUrl(pkg.tier)} alt={`${pkg.tier} ticket`} />
                      <div className="package-ticket-count">
                        <span className="count">{pkg.tickets}</span>
                        <span className="label">{pkg.tickets === 1 ? 'Ticket' : 'Tickets'}</span>
                      </div>
                    </div>
                    
                    <div className="package-pricing">
                      {pkg.originalPrice && (
                        <span className="original-price">${pkg.originalPrice}</span>
                      )}
                      <div className="price-main">
                        <span className="currency">$</span>
                        <span className="amount">{pkg.price}</span>
                      </div>
                      <span className="price-per-ticket">${(pkg.price / pkg.tickets).toFixed(2)} per ticket</span>
                    </div>
                    
                    <ul className="package-features">
                      {pkg.features.slice(0, 3).map((feature, index) => (
                        <li key={index}>
                          <i className="ri-check-line"></i>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <button
                      className={`purchase-btn ${pkg.tier}`}
                      onClick={() => handlePurchase(pkg)}
                      disabled={isLoadingQuote && selectedPackage?.id === pkg.id}
                    >
                      {isLoadingQuote && selectedPackage?.id === pkg.id ? (
                        <><i className="ri-loader-4-line ri-spin"></i> Loading...</>
                      ) : (
                        <><i className="ri-shopping-cart-2-line"></i> Buy Now</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quantity Selector Modal */}
      {showQuantitySelector && packageForQuantity && (
        <div className="checkout-modal-overlay" onClick={() => setShowQuantitySelector(false)}>
          <div className={`quantity-selector-modal ${packageForQuantity.tier === 'premium' ? 'premium' : ''}`} onClick={(e) => e.stopPropagation()}>
            <button className="checkout-close-btn" onClick={() => setShowQuantitySelector(false)}>
              <i className="fas fa-times"></i>
            </button>
            
            <div className={`quantity-header ${packageForQuantity.tier === 'premium' ? 'premium-header' : ''}`}>
              <div className="quantity-header-icon">
                <img src={getTicketImageUrl(packageForQuantity.tier)} alt={`${packageForQuantity.tier} ticket`} />
              </div>
              <h2>Select Quantity</h2>
              <p>How many <strong>{packageForQuantity.name}</strong> do you want?</p>
            </div>

            <div className="quantity-body">
              <div className="quantity-package-info">
                <div className="quantity-package-details">
                  <span className={`tier-badge ${packageForQuantity.tier}`}>
                    {packageForQuantity.tier === 'basic' ? 'Basic' : 'Premium'}
                  </span>
                  <span className="package-tickets-info">
                    {packageForQuantity.tickets} ticket{packageForQuantity.tickets > 1 ? 's' : ''} per pack
                  </span>
                  <span className="package-price-info">
                    ${packageForQuantity.price} per pack
                  </span>
                </div>
              </div>

              <div className="quantity-controls">
                <button 
                  className="quantity-btn minus"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  <i className="fas fa-minus"></i>
                </button>
                <input
                  type="number"
                  className="quantity-input"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt((e.target as HTMLInputElement).value) || 1;
                    setQuantity(Math.max(1, Math.min(100, val)));
                  }}
                  min="1"
                  max="100"
                />
                <button 
                  className="quantity-btn plus"
                  onClick={() => setQuantity(q => Math.min(100, q + 1))}
                  disabled={quantity >= 100}
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>

              <div className="quantity-summary">
                <div className="summary-row">
                  <span className="summary-label">Tickets per pack</span>
                  <span className="summary-value">{packageForQuantity.tickets}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Quantity</span>
                  <span className="summary-value">×{quantity}</span>
                </div>
                <div className="summary-divider"></div>
                <div className="summary-row total-tickets">
                  <span className="summary-label">
                    <i className="fas fa-ticket-alt"></i>
                    Total Tickets
                  </span>
                  <span className="summary-value highlight">{getTotalTickets()}</span>
                </div>
                <div className="summary-row total-price">
                  <span className="summary-label">
                    <i className="fas fa-dollar-sign"></i>
                    Total Price
                  </span>
                  <span className="summary-value highlight">${getTotalPrice().toFixed(2)}</span>
                </div>
                {quantity > 1 && (
                  <div className="summary-savings">
                    <i className="fas fa-info-circle"></i>
                    Buying {quantity} packs of {packageForQuantity.tickets} tickets each
                  </div>
                )}
              </div>

              <button 
                className={`quantity-confirm-btn ${packageForQuantity.tier === 'premium' ? 'premium' : ''}`}
                onClick={handleConfirmQuantity}
              >
                <i className="fas fa-shopping-cart"></i>
                Continue to Checkout - ${getTotalPrice().toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <p>You're buying: <strong>{packageForQuantity?.name}{quantity > 1 ? ` ×${quantity}` : ''}</strong></p>
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
