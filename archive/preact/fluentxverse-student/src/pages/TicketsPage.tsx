import { useState, useEffect, useCallback } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { useTicketNotifications } from '../hooks/useTicketNotifications';
import { useToastContext } from '../context/ToastContext';

// Type for checkout success callback
type CheckoutSuccessData = {
  statuses: Array<{ originTxHash?: string }>;
};

type CheckoutResult = {
  success: boolean;
  error?: string;
};
import { appWallet, autoConnectWallet, type WalletAccount } from '../config/wallet';
import { API_BASE_URL } from '../config/api';
import { getMe } from '../api/auth.api';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { ArrowRight, CalendarDays, History, ShoppingCart, Check, X, Plus, Minus, CreditCard, Wallet, Info, Lock, Code, CircleAlert, Ticket, DollarSign } from 'lucide-preact';
import './TicketsPage.css';

function TicketArtwork({ tier }: { tier: 'basic' | 'premium' | 'trial' }) {
  return <img className="tickets-art" src={tier === 'trial' ? '/assets/img/icons/trial_ticket.webp' : `/assets/img/home-icons/${tier}-ticket-v2.png`} width={96} height={54} alt="" aria-hidden="true" />;
}

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
  onSuccess: (data: CheckoutSuccessData) => Promise<CheckoutResult>;
  onCancel: () => void;
}

function MockCheckoutWidget({ pkg, onSuccess, onCancel }: MockCheckoutWidgetProps) {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'crypto'>('card');
  const [step, setStep] = useState<'select' | 'processing' | 'success' | 'error'>('select');
  const [paymentError, setPaymentError] = useState('');
  const isPremium = pkg.tier === 'premium';

  const simulatePayment = async () => {
    setStep('processing');
    setPaymentError('');

    await new Promise(resolve => setTimeout(resolve, 1200));
    const result = await onSuccess({
      statuses: [{ originTxHash: `mock-payment-${Date.now().toString(16)}` }],
    });

    if (!result.success) {
      setPaymentError(result.error || 'The purchase could not be completed.');
      setStep('error');
      return;
    }

    setStep('success');
    setTimeout(onCancel, 1500);
  };

  return (
    <div className={`mock-checkout ${isPremium ? 'mock-checkout-premium' : ''}`}>
      {step === 'select' && (
        <>
          <div className="mock-checkout-summary">
            <div className="mock-checkout-product">
              <TicketArtwork tier={pkg.tier} />
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
                <CreditCard size={16} />
                Credit Card
              </button>
              <button 
                className={`mock-payment-option ${paymentMethod === 'crypto' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('crypto')}
              >
                <Wallet size={16} />
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
                <Wallet size={16} />
                <span>Connected Wallet</span>
              </div>
              <p className="mock-crypto-note">
                <Info size={16} />
                Payment will be simulated using mock USDC
              </p>
            </div>
          )}

          <button 
            className={`mock-pay-button ${isPremium ? 'premium' : ''}`}
            onClick={simulatePayment}
          >
            <Lock size={16} />
            Pay ${pkg.price.toFixed(2)}
          </button>

          <div className="mock-checkout-footer">
            <span className="mock-dev-badge">
              <Code size={16} />
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
            <Check size={16} />
          </div>
          <h3>Payment Successful!</h3>
          <p>You've purchased {pkg.tickets} {pkg.tier} ticket{pkg.tickets > 1 ? 's' : ''}</p>
        </div>
      )}

      {step === 'error' && (
        <div className="mock-error">
          <div className="mock-error-icon"><CircleAlert size={16} /></div>
          <h3>Purchase Not Completed</h3>
          <p>{paymentError}</p>
          <button className="mock-retry-button" onClick={() => setStep('select')}>
            Try Again
          </button>
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
  const { showSuccess, showError } = useToastContext();
  const [selectedPackage, setSelectedPackage] = useState<TicketPackage | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [ticketBalance, setTicketBalance] = useState<TicketBalance>({ basic: 0, premium: 0, trial: 0, basicTokenId: null, premiumTokenId: null, trialTokenId: null });
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<'all' | 'basic' | 'premium' | 'trial'>('all');
  const [adjustedAmount, setAdjustedAmount] = useState<string | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [showQuantitySelector, setShowQuantitySelector] = useState(false);
  const [packageForQuantity, setPackageForQuantity] = useState<TicketPackage | null>(null);
  
  const [activeAccount, setActiveAccount] = useState<WalletAccount | null>(appWallet.getAccount());
  const [profileWalletAddress, setProfileWalletAddress] = useState<string | null>(null);
  const [isWalletConnecting, setIsWalletConnecting] = useState(true);

  // Get wallet address from connected wallet or from user's profile
  const walletAddress = user?.walletAddress || user?.smartWalletAddress || profileWalletAddress || activeAccount?.address;

  useEffect(() => {
    if (walletAddress) return;

    getMe()
      .then((response) => setProfileWalletAddress(response?.user?.walletAddress || null))
      .catch(() => setProfileWalletAddress(null));
  }, [walletAddress]);

  // Handle balance update from socket notification
  const handleBalanceUpdate = useCallback((balance: { basic: number; premium: number; trial: number; total: number }) => {
    setBalanceError(null);
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
    document.title = 'My Tickets | FluentXVerse';
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsWalletConnecting(true);
    autoConnectWallet()
      .then((account) => {
        if (!cancelled && account) setActiveAccount(account);
      })
      .finally(() => {
        if (!cancelled) setIsWalletConnecting(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch user's ticket balance from blockchain
  const fetchTicketBalance = async (walletAddr: string) => {
    setIsLoadingBalance(true);
    setBalanceError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/tickets/balance/${walletAddr}`);
      const result = await response.json();
      
      if (response.ok && result.success) {
        setTicketBalance(result.data);
        return result.data; // Return balance for polling use
      } else {
        setBalanceError('Your ticket balance could not be loaded.');
        console.error('Failed to fetch ticket balance:', result.error);
        return null;
      }
    } catch (error) {
      setBalanceError('Your ticket balance could not be loaded.');
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

  const fetchQuoteAndAdjust = async (pkg: TicketPackage) => {
    setIsLoadingQuote(true);
    setSelectedPackage(pkg);
    setAdjustedAmount(pkg.price.toString());
    setShowCheckout(true);
    setIsLoadingQuote(false);
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

  const handleCheckoutSuccess = async (transactionData: CheckoutSuccessData): Promise<CheckoutResult> => {
    
    if (!selectedPackage) {
      console.error('Missing selectedPackage');
      return { success: false, error: 'No ticket package was selected.' };
    }

    // CRITICAL: Get the buyer's wallet address - use connected wallet first, then user profile wallet
    // NEVER fall back to a hardcoded address in production!
    let buyerWallet = user?.walletAddress || user?.smartWalletAddress || profileWalletAddress || activeAccount?.address;

    if (!buyerWallet) {
      try {
        const response = await getMe();
        buyerWallet = response?.user?.walletAddress;
        if (buyerWallet) setProfileWalletAddress(buyerWallet);
      } catch {
        // The error state below provides the actionable message.
      }
    }
    
    if (!buyerWallet) {
      console.error('❌ CRITICAL: No wallet address available for purchase!');
      return { success: false, error: 'No wallet address was found for your account.' };
    }
    
    // Validate wallet address format
    if (!buyerWallet.startsWith('0x') || buyerWallet.length !== 42) {
      console.error('❌ CRITICAL: Invalid wallet address format:', buyerWallet);
      return { success: false, error: 'Your wallet address is invalid. Please contact support.' };
    }
    

    try {
      // Call backend to process the purchase and transfer NFT tickets
      const response = await fetch(`${API_BASE_URL}/tickets/purchase`, {
        method: 'POST',
        credentials: 'include',
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
        if (walletAddress) {
          await fetchTicketBalance(walletAddress);
        }
        showSuccess(`Purchase successful. ${selectedPackage.tickets} ${selectedPackage.tier} ticket(s) were added.`, 5000);
        return { success: true };
      } else {
        console.error('❌ Purchase failed:', result.error);
        showError(`Purchase failed: ${result.error}`, 5000);
        return { success: false, error: result.error || 'The server rejected the purchase.' };
      }
    } catch (error) {
      console.error('Error calling purchase API:', error);
      showError('Purchase failed. Please try again.', 5000);
      return { success: false, error: 'The purchase service is unavailable. Please try again.' };
    }
  };

  const handleCheckoutCancel = () => {
    setShowCheckout(false);
    setSelectedPackage(null);
    setAdjustedAmount(null);
  };

  useEffect(() => {
    if (!showQuantitySelector && !showCheckout) return;
    const dialog = document.querySelector<HTMLElement>('.student-tickets [role="dialog"]');
    if (!dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]'));
    controls()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showQuantitySelector) setShowQuantitySelector(false);
        else handleCheckoutCancel();
      } else if (event.key === 'Tab') {
        const items = controls(), first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      dialog.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [showQuantitySelector, showCheckout]);

  return (
    <>
      <SideBar />
      <div className="student-tickets">
        <Header />
        <main className="tickets-page">
          <div className="tickets-container">
            <header className="tickets-heading">
              <img className="tickets-section-art" src="/assets/img/home-icons/pay-v1.webp" width={64} height={64} alt="" />
              <div><span className="tickets-eyebrow">Your learning essentials</span><h1>My tickets</h1></div>
              <a href="/browse-tutors" className="tickets-button"><CalendarDays size={16} />Book a Lesson</a>
            </header>

            <section className="tickets-balance-section" aria-label="Your ticket balance">
              <div className="tickets-balance-heading"><h2>Available tickets</h2><a className="tickets-link" href="/purchase-history"><History size={16} />Purchase history<ArrowRight size={14} /></a></div>
              {balanceError ? <div className="tickets-balance-error" role="alert"><CircleAlert size={18} /><span>{balanceError}</span><button className="tickets-link" onClick={() => walletAddress && fetchTicketBalance(walletAddress)}>Try again</button></div>
                : !walletAddress ? <p className="tickets-muted" role="status">{isWalletConnecting ? 'Loading your account...' : 'Your account wallet is not available. Please sign in again.'}</p>
                : <div className="tickets-balance-grid">
                  {(['basic', 'premium', 'trial'] as const).filter(tier => tier !== 'trial' || ticketBalance.trial > 0).map(tier => <div className="tickets-balance-item" key={tier}>
                    <TicketArtwork tier={tier} /><div><span>{tier[0].toUpperCase() + tier.slice(1)} tickets</span><strong aria-label={`${tier} ticket balance`}>{isLoadingBalance ? '—' : ticketBalance[tier]}</strong></div>
                  </div>)}
                </div>}
            </section>

            <section className="packages-section" aria-labelledby="ticket-packages-title">
              <div className="packages-header">
                <img className="tickets-section-art" src="/assets/img/home-icons/training-v1.webp" width={40} height={40} alt="" />
                <h2 id="ticket-packages-title">Ticket packages</h2>
                <div className="tier-tabs" aria-label="Ticket package tier">
                  {(['all', 'basic', 'premium'] as const).map(tier => <button className={`tier-tab ${selectedTier === tier ? 'active' : ''}`} aria-pressed={selectedTier === tier} onClick={() => setSelectedTier(tier)} key={tier}>{tier === 'all' ? 'All' : tier[0].toUpperCase() + tier.slice(1)}</button>)}
                </div>
              </div>
              <div className="packages-grid">
                {filteredPackages.map(pkg => <article key={pkg.id} className={`package-card ${pkg.tier}-tier`}>
                  <div className="package-card-header"><span className={`tickets-tier-badge ${pkg.tier}`}>{pkg.tier === 'basic' ? 'Basic' : 'Premium'}</span>{pkg.originalPrice && <span className="package-savings">Save ${pkg.originalPrice - pkg.price}</span>}</div>
                  <div className="package-visual"><TicketArtwork tier={pkg.tier} /></div>
                  <h3>{pkg.name}</h3>
                  <p className="package-ticket-count">{pkg.tickets} lesson ticket{pkg.tickets !== 1 ? 's' : ''}</p>
                  <div className="package-pricing"><div className="price-main"><strong>${pkg.price}</strong><span>USD</span></div>{pkg.originalPrice && <s className="original-price">${pkg.originalPrice}</s>}<span className="price-per-ticket">${(pkg.price / pkg.tickets).toFixed(2)} per ticket</span></div>
                  <ul className="package-features">{pkg.features.filter(feature => !feature.includes('ticket') && !feature.startsWith('Save')).map(feature => <li key={feature}><Check size={15} /><span>{feature}</span></li>)}</ul>
                  <button className="purchase-btn tickets-button" onClick={() => handlePurchase(pkg)} disabled={isLoadingQuote && selectedPackage?.id === pkg.id} aria-label={`Buy ${pkg.name}`}><ShoppingCart size={16} />Choose package<ArrowRight size={16} /></button>
                </article>)}
              </div>
            </section>
          </div>
        </main>

      {/* Quantity Selector Modal */}
      {showQuantitySelector && packageForQuantity && (
        <div className="checkout-modal-overlay" onClick={() => setShowQuantitySelector(false)}>
          <div className={`quantity-selector-modal ${packageForQuantity.tier === 'premium' ? 'premium' : ''}`} role="dialog" aria-modal="true" aria-label="Select quantity" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
            <button className="checkout-close-btn" aria-label="Close quantity dialog" onClick={() => setShowQuantitySelector(false)}>
              <X size={16} />
            </button>
            
            <div className={`quantity-header ${packageForQuantity.tier === 'premium' ? 'premium-header' : ''}`}>
              <div className="quantity-header-icon">
                <TicketArtwork tier={packageForQuantity.tier} />
              </div>
              <h2>Select Quantity</h2>
              <p>How many <strong>{packageForQuantity.name}</strong> do you want?</p>
            </div>

            <div className="quantity-body">
              <div className="quantity-package-info">
                <div className="quantity-package-details">
                  <span className={`tickets-tier-badge ${packageForQuantity.tier}`}>
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
                  className="quantity-btn minus" aria-label="Decrease quantity"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus size={16} />
                </button>
                <input
                  type="number"
                  className="quantity-input" aria-label="Package quantity"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt((e.target as HTMLInputElement).value) || 1;
                    setQuantity(Math.max(1, Math.min(100, val)));
                  }}
                  min="1"
                  max="100"
                />
                <button 
                  className="quantity-btn plus" aria-label="Increase quantity"
                  onClick={() => setQuantity(q => Math.min(100, q + 1))}
                  disabled={quantity >= 100}
                >
                  <Plus size={16} />
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
                    <Ticket size={16} />
                    Total Tickets
                  </span>
                  <span className="summary-value highlight">{getTotalTickets()}</span>
                </div>
                <div className="summary-row total-price">
                  <span className="summary-label">
                    <DollarSign size={16} />
                    Total Price
                  </span>
                  <span className="summary-value highlight">${getTotalPrice().toFixed(2)}</span>
                </div>
                {quantity > 1 && (
                  <div className="summary-savings">
                    <Info size={16} />
                    Buying {quantity} packs of {packageForQuantity.tickets} tickets each
                  </div>
                )}
              </div>

              <button 
                className={`quantity-confirm-btn ${packageForQuantity.tier === 'premium' ? 'premium' : ''}`}
                onClick={handleConfirmQuantity}
              >
                <ShoppingCart size={16} />
                Continue - ${getTotalPrice().toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && selectedPackage && (
        <div className="checkout-modal-overlay" onClick={handleCheckoutCancel}>
          <div className={`checkout-modal-content ${selectedPackage.tier === 'premium' ? 'premium-checkout' : ''}`} role="dialog" aria-modal="true" aria-label="Complete your purchase" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
            <button className="checkout-close-btn" aria-label="Close checkout" onClick={handleCheckoutCancel}>
              <X size={16} />
            </button>
            <div className={`checkout-header ${selectedPackage.tier === 'premium' ? 'premium-header' : ''}`}>
              <div className="checkout-header-icon">
                <TicketArtwork tier={selectedPackage.tier} />
              </div>
              <h2>Complete Your Purchase</h2>
              <p>You're buying: <strong>{packageForQuantity?.name}{quantity > 1 ? ` ×${quantity}` : ''}</strong></p>
            </div>
            <div className="checkout-body">
              <MockCheckoutWidget
                pkg={selectedPackage}
                onSuccess={handleCheckoutSuccess}
                onCancel={handleCheckoutCancel}
              />
            </div>
          </div>
        </div>
      )}

      </div>
    </>
  );
}
