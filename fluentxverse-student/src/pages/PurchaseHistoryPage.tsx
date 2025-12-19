import { useState, useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { getMyPurchaseHistory, TicketPurchase } from '../api/ticket.api';
import './PurchaseHistoryPage.css';

const PurchaseHistoryPage = () => {
  const { user, initialLoading: authLoading } = useAuthContext();
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
  }, [user, authLoading]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'basic':
        return 'fas fa-ticket-alt';
      case 'premium':
        return 'fas fa-crown';
      case 'trial':
        return 'fas fa-gift';
      default:
        return 'fas fa-ticket-alt';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="status-badge completed"><i className="fas fa-check-circle"></i> Completed</span>;
      case 'pending':
        return <span className="status-badge pending"><i className="fas fa-clock"></i> Pending</span>;
      case 'failed':
        return <span className="status-badge failed"><i className="fas fa-times-circle"></i> Failed</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const shortenTxHash = (hash: string) => {
    if (!hash) return 'N/A';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  // Calculate totals
  const totalSpent = purchases.reduce((sum, p) => sum + (p.totalPrice || 0), 0);
  const totalTickets = purchases.reduce((sum, p) => sum + (p.quantity || 0), 0);

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <main className="purchase-history-page">
          <div className="container">
            {/* Header */}
            <div className="purchase-history-header">
              <div className="purchase-history-header-left">
                <div className="purchase-history-icon">
                  <i className="fas fa-receipt"></i>
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
                <i className="fas fa-shopping-cart"></i>
                Buy More Tickets
              </a>
            </div>

            {/* Stats */}
            <div className="purchase-history-stats">
              <div className="purchase-stat-card">
                <div className="purchase-stat-icon blue">
                  <i className="fas fa-shopping-bag"></i>
                </div>
                <div className="purchase-stat-info">
                  <span className="purchase-stat-value">{purchases.length}</span>
                  <span className="purchase-stat-label">Total Purchases</span>
                </div>
              </div>
              <div className="purchase-stat-card">
                <div className="purchase-stat-icon green">
                  <i className="fas fa-ticket-alt"></i>
                </div>
                <div className="purchase-stat-info">
                  <span className="purchase-stat-value">{totalTickets}</span>
                  <span className="purchase-stat-label">Tickets Bought</span>
                </div>
              </div>
              <div className="purchase-stat-card">
                <div className="purchase-stat-icon orange">
                  <i className="fas fa-dollar-sign"></i>
                </div>
                <div className="purchase-stat-info">
                  <span className="purchase-stat-value">${totalSpent.toFixed(2)}</span>
                  <span className="purchase-stat-label">Total Spent</span>
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
                <div className="purchase-history-error">
                  <i className="fas fa-exclamation-circle"></i>
                  <p>{error}</p>
                  <button onClick={() => window.location.reload()}>Try Again</button>
                </div>
              ) : purchases.length === 0 ? (
                <div className="purchase-history-empty">
                  <div className="empty-icon">
                    <i className="fas fa-receipt"></i>
                  </div>
                  <h3>No Purchases Yet</h3>
                  <p>You haven't purchased any tickets yet. Buy tickets to book lessons with tutors!</p>
                  <a 
                    href="/tickets"
                    className="empty-action-btn"
                  >
                    <i className="fas fa-shopping-cart"></i>
                    Buy Tickets
                  </a>
                </div>
              ) : (
                <div className="purchase-list">
                  {purchases.map((purchase) => (
                    <div key={purchase.id} className={`purchase-card ${purchase.tier}`}>
                      <div className="purchase-card-icon">
                        <i className={getTierIcon(purchase.tier)}></i>
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
                                <i className="fas fa-external-link-alt"></i>
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
