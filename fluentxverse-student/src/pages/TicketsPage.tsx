import { useState, useEffect } from 'preact/hooks';
import { CheckoutWidget, BuyWidget, lightTheme, useActiveAccount } from "thirdweb/react";
import { defineChain } from "thirdweb";
import { Bridge } from "thirdweb";
import { thirdwebClient } from '../index';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import './TicketsPage.css';

// Arbitrum chain
const arbitrumChain = defineChain(8453);

// Seller wallet address - replace with your actual seller wallet
const SELLER_ADDRESS = "0x0000000000000000000000000000000000000000";

// USDC token address on Arbitrum
const USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

// Custom theme matching FluentXVerse style
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
  tier: 'basic' | 'premium';
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
      'Valid for 1 year',
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
      'Valid for 1 year',
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
      'Valid for 1 year',
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
      'Valid for 1 year',
      'Premium tutors only',
      '25-minute premium lessons',
      'Save $45'
    ],
    icon: '🎟️✨'
  }
];

export default function TicketsPage() {
  const [selectedPackage, setSelectedPackage] = useState<TicketPackage | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showBuyWidget, setShowBuyWidget] = useState(false);
  const [userTickets, setUserTickets] = useState(3); // Mock current tickets
  const [selectedTier, setSelectedTier] = useState<'all' | 'basic' | 'premium'>('all');
  const [adjustedAmount, setAdjustedAmount] = useState<string | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  
  const activeAccount = useActiveAccount();

  useEffect(() => {
    document.title = 'Buy Tickets | FluentXVerse';
  }, []);

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
        chainId: 8453, // Base chain
        tokenAddress: USDC_ADDRESS as `0x${string}`,
        receiver: receiverAddress as `0x${string}`,
        amount: targetAmountWei,
        currency: "USD",
      });
      
      // currencyAmount is what the user will actually pay in fiat
      const actualFiatCost = quote.currencyAmount;
      const targetPrice = pkg.price;
      
      // Calculate the fee/markup
      const feeAmount = actualFiatCost - targetPrice;
      
      // Adjust: reduce the USDC amount so final fiat cost = target price
      // newAmount = targetAmount - (feeAmount in USDC terms)
      const adjustedUsdcAmount = targetPrice - feeAmount;
      
      console.log(`Target: $${targetPrice}, Quoted: $${actualFiatCost}, Fee: $${feeAmount.toFixed(2)}, Adjusted: $${adjustedUsdcAmount.toFixed(2)}`);
      
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

  const handleCheckoutSuccess = () => {
    if (selectedPackage) {
      setUserTickets(prev => prev + selectedPackage.tickets);
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

  const handleBuyWidgetClose = () => {
    setShowBuyWidget(false);
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
              <a href="/home" className="back-link">
                <i className="fas fa-arrow-left"></i>
                Back to Dashboard
              </a>
              <div className="tickets-header-content">
                <h1>
                  <i className="fas fa-ticket-alt"></i>
                  Buy Lesson Tickets
                </h1>
                <p>Purchase tickets to book lessons with our expert tutors</p>
              </div>
            </div>

            {/* Current Balance */}
            <div className="tickets-balance">
              <div className="balance-card">
                <div className="balance-icon">
                  <i className="fas fa-wallet"></i>
                </div>
                <div className="balance-info">
                  <span className="balance-label">Your Current Balance</span>
                  <span className="balance-value">
                    <i className="fas fa-ticket-alt"></i>
                    {userTickets} Ticket{userTickets !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="balance-actions">
                  <button className="buy-usdc-btn" onClick={() => setShowBuyWidget(true)}>
                    <i className="fas fa-coins"></i>
                    Buy USDC
                  </button>
                  <a href="/schedule" className="use-tickets-btn">
                    <i className="fas fa-calendar-plus"></i>
                    Book a Lesson
                  </a>
                </div>
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
                    <div className="package-icon">{pkg.icon}</div>
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

            {/* FAQ Section */}
            <div className="tickets-faq">
              <h2>Frequently Asked Questions</h2>
              <div className="faq-grid">
                <div className="faq-item">
                  <h4>
                    <i className="fas fa-question-circle"></i>
                    How long are tickets valid?
                  </h4>
                  <p>All tickets are valid for 1 year from the date of purchase.</p>
                </div>
                <div className="faq-item">
                  <h4>
                    <i className="fas fa-question-circle"></i>
                    Can I book any tutor?
                  </h4>
                  <p>Yes! All tickets can be used to book lessons with any available tutor on our platform.</p>
                </div>
                <div className="faq-item">
                  <h4>
                    <i className="fas fa-question-circle"></i>
                    What if I need to cancel?
                  </h4>
                  <p>Cancellations made 24+ hours before a lesson will refund your ticket. Last-minute cancellations may forfeit the ticket.</p>
                </div>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="trust-section">
              <div className="trust-badges">
                <div className="trust-badge">
                  <i className="fas fa-shield-alt"></i>
                  <span>Secure Payment</span>
                </div>
                <div className="trust-badge">
                  <i className="fas fa-calendar-check"></i>
                  <span>Valid for 1 Year</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && selectedPackage && (
        <div className="checkout-modal-overlay" onClick={handleCheckoutCancel}>
          <div className="checkout-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="checkout-close-btn" onClick={handleCheckoutCancel}>
              <i className="fas fa-times"></i>
            </button>
            <div className="checkout-header">
              <div className="checkout-header-icon">
                <i className={`fi fi-sr-ticket ${selectedPackage.tier === 'premium' ? 'premium-ticket' : ''}`}></i>
              </div>
              <h2>Complete Your Purchase</h2>
              <p>You're buying: <strong>{selectedPackage.name}</strong></p>
            </div>
            <div className="checkout-body">
              <CheckoutWidget
                client={thirdwebClient}
                chain={arbitrumChain}
                amount={adjustedAmount || selectedPackage.price.toString()}
                currency="USD"
                tokenAddress={USDC_ADDRESS}
                feePayer='seller'
                seller={SELLER_ADDRESS}
                name={selectedPackage.name}
                description={`${selectedPackage.tickets} ${selectedPackage.tier} ticket${selectedPackage.tickets > 1 ? 's' : ''} for FluentXVerse lessons`}
                image="/assets/img/logo/icon_logo.png"
                theme={fluentXVerseTheme}
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
            </div>
          </div>
        </div>
      )}

      {/* Buy USDC Modal */}
      {showBuyWidget && (
        <div className="checkout-modal-overlay" onClick={handleBuyWidgetClose}>
          <div className="checkout-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="checkout-close-btn" onClick={handleBuyWidgetClose}>
              <i className="fas fa-times"></i>
            </button>
            <div className="checkout-header">
              <div className="checkout-header-icon">
                <i className="fi fi-sr-usd-circle"></i>
              </div>
              <h2>Buy USDC</h2>
              <p>Purchase USDC to pay for lesson tickets</p>
            </div>
            <div className="checkout-body">
              <BuyWidget
                client={thirdwebClient}
                chain={arbitrumChain}
                tokenAddress={USDC_ADDRESS}
                theme={fluentXVerseTheme}
                title=""
                showThirdwebBranding={false}
                connectOptions={{
                  connectModal: {
                    size: "compact",
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
