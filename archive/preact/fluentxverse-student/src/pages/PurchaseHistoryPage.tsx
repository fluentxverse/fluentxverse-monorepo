import { CircleCheck, Clock, CircleX, Receipt, ShoppingCart, ShoppingBag, Ticket, DollarSign, CircleAlert, ExternalLink } from 'lucide-preact';
import { useState, useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { getMyPurchaseHistory, TicketPurchase } from '../api/ticket.api';
import './PurchaseHistoryPage.css';

const PurchaseHistoryPage = () => {
  const { user, initialLoading: authLoading } = useAuthContext();
  const [revision, setRevision] = useState(0);
  const [purchases, setPurchases] = useState<TicketPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Purchase History | FluentXVerse';
  }, []);

  useEffect(() => {
    const fetchPurchases = async () => {
      // Wait for auth to complete before fetching
      if (authLoading) {
        return;
      }
      
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await getMyPurchaseHistory();
        setPurchases(data);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch purchase history:', err);
        setError(err.message || 'Failed to load purchase history');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, [user, authLoading, revision]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' JST';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="status-badge completed"><CircleCheck size={18} aria-hidden="true" /> Completed</span>;
      case 'pending':
        return <span className="status-badge pending"><Clock size={18} aria-hidden="true" /> Pending</span>;
      case 'failed':
        return <span className="status-badge failed"><CircleX size={18} aria-hidden="true" /> Failed</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const shortenTxHash = (hash: string) => {
    if (!hash) return 'N/A';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  // Calculate totals
  const totalSpent = purchases.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.totalPrice || 0), 0);
  const totalTickets = purchases.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.quantity || 0), 0);

  return (
    <>
      <SideBar />
      <div className="student-history-shell">
        <Header />
        <main className="purchase-history-page">
          <div className="container">
            {/* Header */}
            <div className="purchase-history-header">
              <div className="purchase-history-header-left">
                <div className="purchase-history-icon">
                  <img src="/assets/img/home-icons/pay-v1.webp" alt="" width="48" height="48" />
                </div>
                <div>
                  <h1 className="purchase-history-title">Purchase History</h1>
                  <p className="purchase-history-subtitle">View all your ticket purchases</p>
                </div>
              </div>
              <a 
                href="/tickets"
                className="purchase-history-action-btn"
              >
                <ShoppingCart size={18} aria-hidden="true" />
                Buy More Tickets
              </a>
            </div>

            {/* Stats */}
            <div className="purchase-history-stats">
              <div className="purchase-stat-card">
                <div className="purchase-stat-icon blue">
                  <ShoppingBag size={18} aria-hidden="true" />
                </div>
                <div className="purchase-stat-info">
                  <span className="purchase-stat-value">{purchases.length}</span>
                  <span className="purchase-stat-label">Total Purchases</span>
                </div>
              </div>
              <div className="purchase-stat-card">
                <div className="purchase-stat-icon green">
                  <Ticket size={18} aria-hidden="true" />
                </div>
                <div className="purchase-stat-info">
                  <span className="purchase-stat-value">{totalTickets}</span>
                  <span className="purchase-stat-label">Tickets purchased</span>
                </div>
              </div>
              <div className="purchase-stat-card">
                <div className="purchase-stat-icon orange">
                  <DollarSign size={18} aria-hidden="true" />
                </div>
                <div className="purchase-stat-info">
                  <span className="purchase-stat-value">${totalSpent.toFixed(2)}</span>
                  <span className="purchase-stat-label">Completed spending</span>
                </div>
              </div>
            </div>

            {/* Purchase List */}
            <div className="purchase-history-content">
              {loading ? (
                <div className="purchase-history-loading">
                  <div className="purchase-history-spinner"></div>
                  <p>Loading purchase history...</p>
                </div>
              ) : error ? (
                <div className="purchase-history-error" role="alert">
                  <CircleAlert size={18} aria-hidden="true" />
                  <p>{error}</p>
                  <button onClick={() => setRevision(value => value + 1)}>Try Again</button>
                </div>
              ) : purchases.length === 0 ? (
                <div className="purchase-history-empty">
                  <div className="empty-icon">
                    <img src="/assets/img/home-icons/pay-v1.webp" alt="" width="64" height="64" />
                  </div>
                  <h3>No Purchases Yet</h3>
                  <p>You haven't purchased any tickets yet. Buy tickets to book lessons with tutors!</p>
                  <a 
                    href="/tickets"
                    className="empty-action-btn"
                  >
                    <ShoppingCart size={18} aria-hidden="true" />
                    Buy Tickets
                  </a>
                </div>
              ) : (
                <div className="purchase-list">
                  {purchases.map((purchase) => (
                    <div key={purchase.id} className={`purchase-card ${purchase.tier}`}>
                      <div className="purchase-card-icon">
                        <img src={`/assets/img/home-icons/${purchase.tier === 'premium' ? 'premium' : 'basic'}-ticket-v2.png`} alt="" width="80" height="45" />
                      </div>
                      <div className="purchase-card-content">
                        <div className="purchase-card-header">
                          <div className="purchase-card-title">
                            <span className={`tier-badge ${purchase.tier}`}>
                              {purchase.tier.charAt(0).toUpperCase() + purchase.tier.slice(1)}
                            </span>
                            <span className="purchase-quantity">
                              {purchase.quantity} ticket{purchase.quantity > 1 ? 's' : ''}
                            </span>
                          </div>
                          {getStatusBadge(purchase.status)}
                        </div>
                        <div className="purchase-card-details">
                          <div className="purchase-detail">
                            <span className="detail-label">Date</span>
                            <span className="detail-value">{formatDate(purchase.purchaseDate)}</span>
                          </div>
                          <div className="purchase-detail">
                            <span className="detail-label">Price per ticket</span>
                            <span className="detail-value">${purchase.pricePerTicket?.toFixed(2) || '0.00'}</span>
                          </div>
                          <div className="purchase-detail">
                            <span className="detail-label">Total</span>
                            <span className="detail-value total">${purchase.totalPrice?.toFixed(2) || '0.00'}</span>
                          </div>
                          {purchase.transferTxId && (
                            <div className="purchase-detail">
                              <span className="detail-label">Transaction</span>
                              <a 
                                href={`https://arbiscan.io/tx/${purchase.transferTxId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="detail-value tx-link"
                              >
                                {shortenTxHash(purchase.transferTxId)}
                                <ExternalLink size={18} aria-hidden="true" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default PurchaseHistoryPage;
