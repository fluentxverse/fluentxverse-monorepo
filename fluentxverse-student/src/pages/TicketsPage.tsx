import { useState, useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import './TicketsPage.css';

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
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userTickets, setUserTickets] = useState(3); // Mock current tickets
  const [selectedTier, setSelectedTier] = useState<'all' | 'basic' | 'premium'>('all');

  useEffect(() => {
    document.title = 'Buy Tickets | FluentXVerse';
  }, []);

  const filteredPackages = selectedTier === 'all' 
    ? ticketPackages 
    : ticketPackages.filter(pkg => pkg.tier === selectedTier);

  const handlePurchase = async (pkg: TicketPackage) => {
    setSelectedPackage(pkg.id);
    setIsProcessing(true);
    
    // Simulate purchase process
    setTimeout(() => {
      setIsProcessing(false);
      setSelectedPackage(null);
      // In real app, integrate with payment gateway
      alert(`Purchase successful! You bought ${pkg.tickets} ticket(s).`);
      setUserTickets(prev => prev + pkg.tickets);
    }, 2000);
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
                <a href="/schedule" className="use-tickets-btn">
                  <i className="fas fa-calendar-plus"></i>
                  Book a Lesson
                </a>
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
                    className={`package-card ${pkg.popular ? 'popular' : ''} ${selectedPackage === pkg.id ? 'selected' : ''} ${pkg.tier}-tier`}
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
                      disabled={isProcessing && selectedPackage === pkg.id}
                    >
                      {isProcessing && selectedPackage === pkg.id ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          Processing...
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
    </>
  );
}
