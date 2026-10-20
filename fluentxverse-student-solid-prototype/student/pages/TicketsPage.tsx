import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { useAuthContext } from '../context/AuthContext';
import { useTicketNotifications } from '../hooks/useTicketNotifications';
import { useToastContext } from '../context/ToastContext';
// Type for checkout success callback
type CheckoutSuccessData = {
    statuses: Array<{
        originTxHash?: string;
    }>;
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
import { ArrowRight, CalendarDays, History, ShoppingCart, Check, X, Plus, Minus, CreditCard, Wallet, Info, Lock, Code, CircleAlert, Ticket, DollarSign, RefreshCw } from "lucide-solid";
import './TicketsPage.css';
import { Show } from 'solid-js';
import { lessonPassApi } from '../api/lessonPasses.api';
import type { PassMode } from '../shared/lessonPasses';
import PrivatePassWallet from './PrivatePassWallet';
function TicketArtwork(_props0: {
    tier: 'basic' | 'premium' | 'trial';
}) {
    return <img class="tickets-art" src={_props0["tier"] === 'trial' ? '/assets/img/icons/trial_ticket.webp' : `/assets/img/home-icons/${_props0["tier"]}-ticket-v2.png`} width={96} height={54} alt="" aria-hidden="true"/>;
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
function MockCheckoutWidget(_props1: MockCheckoutWidgetProps) {
    const [paymentMethod, setPaymentMethod] = createSignal<'card' | 'crypto'>('card');
    const [step, setStep] = createSignal<'select' | 'processing' | 'success' | 'error'>('select');
    const [paymentError, setPaymentError] = createSignal('');
    const isPremium = createMemo(() => _props1["pkg"].tier === 'premium');
    const simulatePayment = async () => {
        setStep('processing');
        setPaymentError('');
        await new Promise(resolve => setTimeout(resolve, 1200));
        const result = await _props1["onSuccess"]({
            statuses: [{ originTxHash: `mock-payment-${Date.now().toString(16)}` }]
        });
        if (!result.success) {
            setPaymentError(result.error || 'The purchase could not be completed.');
            setStep('error');
            return;
        }
        setStep('success');
        setTimeout(_props1["onCancel"], 1500);
    };
    return (<div class={`mock-checkout ${isPremium() ? 'mock-checkout-premium' : ''}`}>
      {step() === 'select' && (<>
          <div class="mock-checkout-summary">
            <div class="mock-checkout-product">
              <TicketArtwork tier={_props1["pkg"].tier}/>
              <div class="mock-checkout-details">
                <span class="mock-checkout-name">{_props1["pkg"].name}</span>
                <span class="mock-checkout-desc">{_props1["pkg"].tickets} {_props1["pkg"].tier} ticket{_props1["pkg"].tickets > 1 ? 's' : ''}</span>
              </div>
            </div>
            <div class="mock-checkout-price">${_props1["pkg"].price.toFixed(2)}</div>
          </div>

          <div class="mock-payment-methods">
            <p class="mock-payment-label">Payment Method</p>
            <div class="mock-payment-options">
              <button class={`mock-payment-option ${paymentMethod() === 'card' ? 'selected' : ''}`} onClick={() => setPaymentMethod('card')}>
                <CreditCard size={16}/>
                Credit Card
              </button>
              <button class={`mock-payment-option ${paymentMethod() === 'crypto' ? 'selected' : ''}`} onClick={() => setPaymentMethod('crypto')}>
                <Wallet size={16}/>
                Crypto
              </button>
            </div>
          </div>

          {paymentMethod() === 'card' && (<div class="mock-card-form">
              <div class="mock-input-group">
                <label>Card Number</label>
                <input type="text" placeholder="4242 4242 4242 4242" disabled value="4242 4242 4242 4242"/>
              </div>
              <div class="mock-input-row">
                <div class="mock-input-group">
                  <label>Expiry</label>
                  <input type="text" placeholder="MM/YY" disabled value="12/28"/>
                </div>
                <div class="mock-input-group">
                  <label>CVC</label>
                  <input type="text" placeholder="123" disabled value="123"/>
                </div>
              </div>
            </div>)}

          {paymentMethod() === 'crypto' && (<div class="mock-crypto-info">
              <div class="mock-crypto-badge">
                <Wallet size={16}/>
                <span>Connected Wallet</span>
              </div>
              <p class="mock-crypto-note">
                <Info size={16}/>
                Payment will be simulated using mock USDC
              </p>
            </div>)}

          <button class={`mock-pay-button ${isPremium() ? 'premium' : ''}`} onClick={simulatePayment}>
            <Lock size={16}/>
            Pay ${_props1["pkg"].price.toFixed(2)}
          </button>

          <div class="mock-checkout-footer">
            <span class="mock-dev-badge">
              <Code size={16}/>
              DEV MODE - No real payment
            </span>
          </div>
        </>)}

      {step() === 'processing' && (<div class="mock-processing">
          <div class={`mock-spinner ${isPremium() ? 'premium' : ''}`}></div>
          <h3>Processing Payment...</h3>
          <p>Please wait while we simulate your payment</p>
        </div>)}

      {step() === 'success' && (<div class="mock-success">
          <div class={`mock-success-icon ${isPremium() ? 'premium' : ''}`}>
            <Check size={16}/>
          </div>
          <h3>Payment Successful!</h3>
          <p>You've purchased {_props1["pkg"].tickets} {_props1["pkg"].tier} ticket{_props1["pkg"].tickets > 1 ? 's' : ''}</p>
        </div>)}

      {step() === 'error' && (<div class="mock-error">
          <div class="mock-error-icon"><CircleAlert size={16}/></div>
          <h3>Purchase Not Completed</h3>
          <p>{paymentError()}</p>
          <button class="mock-retry-button" onClick={() => setStep('select')}>
            Try Again
          </button>
        </div>)}
    </div>);
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
    const [mode, setMode] = createSignal<PassMode>();
    const [error, setError] = createSignal('');
    const load = async () => { setError(''); try { setMode(await lessonPassApi.mode()); } catch (e) { setError((e as Error).message); } };
    void load();
    return <Show when={mode()} fallback={<><SideBar/><div class="student-tickets"><Header/><main class="lesson-pass-wallet"><h1>Lesson credits</h1>{error() ? <><p role="alert">{error()}</p><button onClick={load}><RefreshCw size={16}/>Retry</button></> : <p role="status">Loading lesson credits...</p>}</main></div></>}>
      <Show when={mode()?.mode === 'private_passes'} fallback={<LegacyTicketsPage/>}><PrivatePassWallet mode={mode()!}/></Show>
    </Show>;
}
function LegacyTicketsPage() {
    const _state2 = useAuthContext();
    const _state3 = useToastContext();
    const [selectedPackage, setSelectedPackage] = createSignal<TicketPackage | null>(null);
    const [showCheckout, setShowCheckout] = createSignal(false);
    const [ticketBalance, setTicketBalance] = createSignal<TicketBalance>({ basic: 0, premium: 0, trial: 0, basicTokenId: null, premiumTokenId: null, trialTokenId: null });
    const [isLoadingBalance, setIsLoadingBalance] = createSignal(true);
    const [balanceError, setBalanceError] = createSignal<string | null>(null);
    const [selectedTier, setSelectedTier] = createSignal<'all' | 'basic' | 'premium' | 'trial'>('all');
    const [adjustedAmount, setAdjustedAmount] = createSignal<string | null>(null);
    const [isLoadingQuote, setIsLoadingQuote] = createSignal(false);
    const [quantity, setQuantity] = createSignal(1);
    const [showQuantitySelector, setShowQuantitySelector] = createSignal(false);
    const [packageForQuantity, setPackageForQuantity] = createSignal<TicketPackage | null>(null);
    const [activeAccount, setActiveAccount] = createSignal<WalletAccount | null>(appWallet.getAccount());
    const [profileWalletAddress, setProfileWalletAddress] = createSignal<string | null>(null);
    const [isWalletConnecting, setIsWalletConnecting] = createSignal(true);
    // Get wallet address from connected wallet or from user's profile
    const walletAddress = createMemo(() => _state2.user?.walletAddress || _state2.user?.smartWalletAddress || profileWalletAddress() || activeAccount()?.address);
    createEffect(on(() => [walletAddress()], () => {
        const _cleanup4 = untrack(() => {
            if (walletAddress())
                return;
            getMe()
                .then((response) => setProfileWalletAddress(response?.user?.walletAddress || null))
                .catch(() => setProfileWalletAddress(null));
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    // Handle balance update from socket notification
    const handleBalanceUpdate = createMemo(on(() => [_state3.showSuccess], () => (balance: {
        basic: number;
        premium: number;
        trial: number;
        total: number;
    }) => {
        setBalanceError(null);
        setTicketBalance(prev => ({
            ...prev,
            basic: balance.basic,
            premium: balance.premium,
            trial: balance.trial
        }));
        _state3.showSuccess('Your ticket balance has been updated!', 3000);
    }));
    // Subscribe to real-time ticket notifications
    useTicketNotifications(() => _state2.user?.userId, handleBalanceUpdate());
    createEffect(on(() => [], () => {
        const _cleanup5 = untrack(() => {
            document.title = 'My Tickets | FluentXVerse';
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    createEffect(on(() => [], () => {
        const _cleanup6 = untrack(() => {
            let cancelled = false;
            setIsWalletConnecting(true);
            autoConnectWallet()
                .then((account) => {
                if (!cancelled && account)
                    setActiveAccount(account);
            })
                .finally(() => {
                if (!cancelled)
                    setIsWalletConnecting(false);
            });
            return () => {
                cancelled = true;
            };
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
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
            }
            else {
                setBalanceError('Your ticket balance could not be loaded.');
                console.error('Failed to fetch ticket balance:', result.error);
                return null;
            }
        }
        catch (error) {
            setBalanceError('Your ticket balance could not be loaded.');
            console.error('Error fetching ticket balance:', error);
            return null;
        }
        finally {
            setIsLoadingBalance(false);
        }
    };
    // Fetch balance when wallet connects or user is authenticated with wallet address
    createEffect(on(() => [walletAddress()], () => {
        const _cleanup7 = untrack(() => {
            if (walletAddress()) {
                fetchTicketBalance(walletAddress());
            }
        });
        if (typeof _cleanup7 === "function")
            onCleanup(_cleanup7);
    }));
    const filteredPackages = createMemo(() => selectedTier() === 'all'
        ? ticketPackages
        : ticketPackages.filter(pkg => pkg.tier === selectedTier()));
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
        if (!packageForQuantity())
            return;
        // Create a modified package with multiplied quantity and price
        const pkg = packageForQuantity();
        const multipliedPackage: TicketPackage = {
            ...pkg,
            tickets: pkg.tickets * quantity(),
            price: pkg.price * quantity(),
            originalPrice: pkg.originalPrice ? pkg.originalPrice * quantity() : undefined,
        };
        setShowQuantitySelector(false);
        fetchQuoteAndAdjust(multipliedPackage);
    };
    const getTotalTickets = () => {
        if (!packageForQuantity())
            return 0;
        return packageForQuantity().tickets * quantity();
    };
    const getTotalPrice = () => {
        if (!packageForQuantity())
            return 0;
        return packageForQuantity().price * quantity();
    };
    const handleCheckoutSuccess = async (transactionData: CheckoutSuccessData): Promise<CheckoutResult> => {
        if (!selectedPackage()) {
            console.error('Missing selectedPackage');
            return { success: false, error: 'No ticket package was selected.' };
        }
        // CRITICAL: Get the buyer's wallet address - use connected wallet first, then user profile wallet
        // NEVER fall back to a hardcoded address in production!
        let buyerWallet = _state2.user?.walletAddress || _state2.user?.smartWalletAddress || profileWalletAddress() || activeAccount()?.address;
        if (!buyerWallet) {
            try {
                const response = await getMe();
                buyerWallet = response?.user?.walletAddress;
                if (buyerWallet)
                    setProfileWalletAddress(buyerWallet);
            }
            catch {
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
                get body() {
                    return JSON.stringify({
                        buyerWallet,
                        get tier() {
                            return selectedPackage().tier;
                        },
                        get quantity() {
                            return selectedPackage().tickets;
                        },
                        // Include mock transaction hash for reference (DEV MODE)
                        mockTransactionHash: (transactionData.statuses?.[0] as any)?.originTxHash || `mock_${Date.now()}`,
                        get 
                        // Include userId for activity tracking
                        userId() {
                            return _state2.user?.userId;
                        }
                    });
                }
            });
            const result = await response.json();
            if (result.success) {
                if (walletAddress()) {
                    await fetchTicketBalance(walletAddress());
                }
                _state3.showSuccess(`Purchase successful. ${selectedPackage().tickets} ${selectedPackage().tier} ticket(s) were added.`, 5000);
                return { success: true };
            }
            else {
                console.error('❌ Purchase failed:', result.error);
                _state3.showError(`Purchase failed: ${result.error}`, 5000);
                return { success: false, error: result.error || 'The server rejected the purchase.' };
            }
        }
        catch (error) {
            console.error('Error calling purchase API:', error);
            _state3.showError('Purchase failed. Please try again.', 5000);
            return { success: false, error: 'The purchase service is unavailable. Please try again.' };
        }
    };
    const handleCheckoutCancel = () => {
        setShowCheckout(false);
        setSelectedPackage(null);
        setAdjustedAmount(null);
    };
    createEffect(on(() => [showQuantitySelector(), showCheckout()], () => {
        const _cleanup8 = untrack(() => {
            if (!showQuantitySelector() && !showCheckout())
                return;
            const dialog = document.querySelector<HTMLElement>('.student-tickets [role="dialog"]');
            if (!dialog)
                return;
            const previousFocus = document.activeElement as HTMLElement | null;
            const previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            const controls = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]'));
            controls()[0]?.focus();
            const onKeyDown = (event: KeyboardEvent) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    if (showQuantitySelector())
                        setShowQuantitySelector(false);
                    else
                        handleCheckoutCancel();
                }
                else if (event.key === 'Tab') {
                    const items = controls(), first = items[0], last = items.at(-1);
                    if (event.shiftKey && document.activeElement === first) {
                        event.preventDefault();
                        last?.focus();
                    }
                    else if (!event.shiftKey && document.activeElement === last) {
                        event.preventDefault();
                        first?.focus();
                    }
                }
            };
            dialog.addEventListener('keydown', onKeyDown);
            return () => {
                document.body.style.overflow = previousOverflow;
                dialog.removeEventListener('keydown', onKeyDown);
                if (previousFocus?.isConnected)
                    previousFocus.focus();
            };
        });
        if (typeof _cleanup8 === "function")
            onCleanup(_cleanup8);
    }));
    return (<>
      <SideBar />
      <div class="student-tickets">
        <Header />
        <main class="tickets-page">
          <div class="tickets-container">
            <header class="tickets-heading">
              <img class="tickets-section-art" src="/assets/img/home-icons/pay-v1.webp" width={64} height={64} alt=""/>
              <div><span class="tickets-eyebrow">Your learning essentials</span><h1>My tickets</h1></div>
              <a href="/browse-tutors" class="tickets-button"><CalendarDays size={16}/>Book a Lesson</a>
            </header>

            <section class="tickets-balance-section" aria-label="Your ticket balance">
              <div class="tickets-balance-heading"><h2>Available tickets</h2><a class="tickets-link" href="/purchase-history"><History size={16}/>Purchase history<ArrowRight size={14}/></a></div>
              {balanceError() ? <div class="tickets-balance-error" role="alert"><CircleAlert size={18}/><span>{balanceError()}</span><button class="tickets-link" onClick={() => walletAddress() && fetchTicketBalance(walletAddress())}>Try again</button></div>
            : !walletAddress() ? <p class="tickets-muted" role="status">{isWalletConnecting() ? 'Loading your account...' : 'Your account wallet is not available. Please sign in again.'}</p>
                : <div class="tickets-balance-grid">
                  {(['basic', 'premium', 'trial'] as const).filter(tier => tier !== 'trial' || ticketBalance().trial > 0).map(tier => <div class="tickets-balance-item">
                    <TicketArtwork tier={tier}/><div><span>{tier[0].toUpperCase() + tier.slice(1)} tickets</span><strong aria-label={`${tier} ticket balance`}>{isLoadingBalance() ? '—' : ticketBalance()[tier]}</strong></div>
                  </div>)}
                </div>}
            </section>

            <section class="packages-section" aria-labelledby="ticket-packages-title">
              <div class="packages-header">
                <img class="tickets-section-art" src="/assets/img/home-icons/pay-v1.webp" width={40} height={40} alt=""/>
                <h2 id="ticket-packages-title">Ticket packages</h2>
                <div class="tier-tabs" aria-label="Ticket package tier">
                  {(['all', 'basic', 'premium'] as const).map(tier => <button class={`tier-tab ${selectedTier() === tier ? 'active' : ''}`} aria-pressed={selectedTier() === tier} onClick={() => setSelectedTier(tier)}>{tier === 'all' ? 'All' : tier[0].toUpperCase() + tier.slice(1)}</button>)}
                </div>
              </div>
              <div class="packages-grid">
                {filteredPackages().map(pkg => <article class={`package-card ${pkg.tier}-tier`}>
                  <div class="package-card-header"><span class={`tickets-tier-badge ${pkg.tier}`}>{pkg.tier === 'basic' ? 'Basic' : 'Premium'}</span>{pkg.originalPrice && <span class="package-savings">Save ${pkg.originalPrice - pkg.price}</span>}</div>
                  <div class="package-visual"><TicketArtwork tier={pkg.tier}/></div>
                  <h3>{pkg.name}</h3>
                  <p class="package-ticket-count">{pkg.tickets} lesson ticket{pkg.tickets !== 1 ? 's' : ''}</p>
                  <div class="package-pricing"><div class="price-main"><strong>${pkg.price}</strong><span>USD</span></div>{pkg.originalPrice && <s class="original-price">${pkg.originalPrice}</s>}<span class="price-per-ticket">${(pkg.price / pkg.tickets).toFixed(2)} per ticket</span></div>
                  <ul class="package-features">{pkg.features.filter(feature => !feature.includes('ticket') && !feature.startsWith('Save')).map(feature => <li><Check size={15}/><span>{feature}</span></li>)}</ul>
                  <button class="purchase-btn tickets-button" onClick={() => handlePurchase(pkg)} disabled={isLoadingQuote() && selectedPackage()?.id === pkg.id} aria-label={`Buy ${pkg.name}`}><ShoppingCart size={16}/>Choose package<ArrowRight size={16}/></button>
                </article>)}
              </div>
            </section>
          </div>
        </main>

      {/* Quantity Selector Modal */}
      {showQuantitySelector() && packageForQuantity() && (<div class="checkout-modal-overlay" onClick={() => setShowQuantitySelector(false)}>
          <div class={`quantity-selector-modal ${packageForQuantity().tier === 'premium' ? 'premium' : ''}`} role="dialog" aria-modal="true" aria-label="Select quantity" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
            <button class="checkout-close-btn" aria-label="Close quantity dialog" onClick={() => setShowQuantitySelector(false)}>
              <X size={16}/>
            </button>
            
            <div class={`quantity-header ${packageForQuantity().tier === 'premium' ? 'premium-header' : ''}`}>
              <div class="quantity-header-icon">
                <TicketArtwork tier={packageForQuantity().tier}/>
              </div>
              <h2>Select Quantity</h2>
              <p>How many <strong>{packageForQuantity().name}</strong> do you want?</p>
            </div>

            <div class="quantity-body">
              <div class="quantity-package-info">
                <div class="quantity-package-details">
                  <span class={`tickets-tier-badge ${packageForQuantity().tier}`}>
                    {packageForQuantity().tier === 'basic' ? 'Basic' : 'Premium'}
                  </span>
                  <span class="package-tickets-info">
                    {packageForQuantity().tickets} ticket{packageForQuantity().tickets > 1 ? 's' : ''} per pack
                  </span>
                  <span class="package-price-info">
                    ${packageForQuantity().price} per pack
                  </span>
                </div>
              </div>

              <div class="quantity-controls">
                <button class="quantity-btn minus" aria-label="Decrease quantity" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity() <= 1}>
                  <Minus size={16}/>
                </button>
                <input type="number" class="quantity-input" aria-label="Package quantity" value={quantity()} onInput={(e) => {
                const val = parseInt((e.target as HTMLInputElement).value) || 1;
                setQuantity(Math.max(1, Math.min(100, val)));
            }} min="1" max="100"/>
                <button class="quantity-btn plus" aria-label="Increase quantity" onClick={() => setQuantity(q => Math.min(100, q + 1))} disabled={quantity() >= 100}>
                  <Plus size={16}/>
                </button>
              </div>

              <div class="quantity-summary">
                <div class="summary-row">
                  <span class="summary-label">Tickets per pack</span>
                  <span class="summary-value">{packageForQuantity().tickets}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Quantity</span>
                  <span class="summary-value">×{quantity()}</span>
                </div>
                <div class="summary-divider"></div>
                <div class="summary-row total-tickets">
                  <span class="summary-label">
                    <Ticket size={16}/>
                    Total Tickets
                  </span>
                  <span class="summary-value highlight">{getTotalTickets()}</span>
                </div>
                <div class="summary-row total-price">
                  <span class="summary-label">
                    <DollarSign size={16}/>
                    Total Price
                  </span>
                  <span class="summary-value highlight">${getTotalPrice().toFixed(2)}</span>
                </div>
                {quantity() > 1 && (<div class="summary-savings">
                    <Info size={16}/>
                    Buying {quantity()} packs of {packageForQuantity().tickets} tickets each
                  </div>)}
              </div>

              <button class={`quantity-confirm-btn ${packageForQuantity().tier === 'premium' ? 'premium' : ''}`} onClick={handleConfirmQuantity}>
                <ShoppingCart size={16}/>
                Continue - ${getTotalPrice().toFixed(2)}
              </button>
            </div>
          </div>
        </div>)}

      {/* Checkout Modal */}
      {showCheckout() && selectedPackage() && (<div class="checkout-modal-overlay" onClick={handleCheckoutCancel}>
          <div class={`checkout-modal-content ${selectedPackage().tier === 'premium' ? 'premium-checkout' : ''}`} role="dialog" aria-modal="true" aria-label="Complete your purchase" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
            <button class="checkout-close-btn" aria-label="Close checkout" onClick={handleCheckoutCancel}>
              <X size={16}/>
            </button>
            <div class={`checkout-header ${selectedPackage().tier === 'premium' ? 'premium-header' : ''}`}>
              <div class="checkout-header-icon">
                <TicketArtwork tier={selectedPackage().tier}/>
              </div>
              <h2>Complete Your Purchase</h2>
              <p>You're buying: <strong>{packageForQuantity()?.name}{quantity() > 1 ? ` ×${quantity()}` : ''}</strong></p>
            </div>
            <div class="checkout-body">
              <MockCheckoutWidget pkg={selectedPackage()} onSuccess={handleCheckoutSuccess} onCancel={handleCheckoutCancel}/>
            </div>
          </div>
        </div>)}

      </div>
    </>);
}
