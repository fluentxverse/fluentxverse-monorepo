import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { CircleCheck, Clock, CircleX, Receipt, ShoppingCart, ShoppingBag, Ticket, DollarSign, CircleAlert, ExternalLink } from "lucide-solid";
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { getMyPurchaseHistory, TicketPurchase } from '../api/ticket.api';
import './PurchaseHistoryPage.css';
const PurchaseHistoryPage = () => {
    const _state0 = useAuthContext();
    const [revision, setRevision] = createSignal(0);
    const [purchases, setPurchases] = createSignal<TicketPurchase[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            document.title = 'Purchase History | FluentXVerse';
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [_state0.user, _state0.initialLoading, revision()], () => {
        const _cleanup2 = untrack(() => {
            const fetchPurchases = async () => {
                // Wait for auth to complete before fetching
                if (_state0.initialLoading) {
                    return;
                }
                if (!_state0.user) {
                    setLoading(false);
                    return;
                }
                try {
                    setLoading(true);
                    const data = await getMyPurchaseHistory();
                    setPurchases(data);
                    setError(null);
                }
                catch (err: any) {
                    console.error('Failed to fetch purchase history:', err);
                    setError(err.message || 'Failed to load purchase history');
                }
                finally {
                    setLoading(false);
                }
            };
            fetchPurchases();
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            timeZone: 'Asia/Tokyo',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) + ' JST';
    };
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <span class="status-badge completed"><CircleCheck size={18} aria-hidden="true"/> Completed</span>;
            case 'pending':
                return <span class="status-badge pending"><Clock size={18} aria-hidden="true"/> Pending</span>;
            case 'failed':
                return <span class="status-badge failed"><CircleX size={18} aria-hidden="true"/> Failed</span>;
            default:
                return <span class="status-badge">{status}</span>;
        }
    };
    const shortenTxHash = (hash: string) => {
        if (!hash)
            return 'N/A';
        return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
    };
    // Calculate totals
    const totalSpent = createMemo(() => purchases().filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.totalPrice || 0), 0));
    const totalTickets = createMemo(() => purchases().filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.quantity || 0), 0));
    return (<>
      <SideBar />
      <div class="student-history-shell">
        <Header />
        <main class="purchase-history-page">
          <div class="container">
            {/* Header */}
            <div class="purchase-history-header">
              <div class="purchase-history-header-left">
                <div class="purchase-history-icon">
                  <img src="/assets/img/home-icons/pay-v1.webp" alt="" width="48" height="48"/>
                </div>
                <div>
                  <h1 class="purchase-history-title">Purchase History</h1>
                  <p class="purchase-history-subtitle">View all your ticket purchases</p>
                </div>
              </div>
              <a href="/tickets" class="purchase-history-action-btn">
                <ShoppingCart size={18} aria-hidden="true"/>
                Buy More Tickets
              </a>
            </div>

            {/* Stats */}
            <div class="purchase-history-stats">
              <div class="purchase-stat-card">
                <div class="purchase-stat-icon blue">
                  <ShoppingBag size={18} aria-hidden="true"/>
                </div>
                <div class="purchase-stat-info">
                  <span class="purchase-stat-value">{purchases().length}</span>
                  <span class="purchase-stat-label">Total Purchases</span>
                </div>
              </div>
              <div class="purchase-stat-card">
                <div class="purchase-stat-icon green">
                  <Ticket size={18} aria-hidden="true"/>
                </div>
                <div class="purchase-stat-info">
                  <span class="purchase-stat-value">{totalTickets()}</span>
                  <span class="purchase-stat-label">Tickets purchased</span>
                </div>
              </div>
              <div class="purchase-stat-card">
                <div class="purchase-stat-icon orange">
                  <DollarSign size={18} aria-hidden="true"/>
                </div>
                <div class="purchase-stat-info">
                  <span class="purchase-stat-value">${totalSpent().toFixed(2)}</span>
                  <span class="purchase-stat-label">Completed spending</span>
                </div>
              </div>
            </div>

            {/* Purchase List */}
            <div class="purchase-history-content">
              {loading() ? (<div class="purchase-history-loading">
                  <div class="purchase-history-spinner"></div>
                  <p>Loading purchase history...</p>
                </div>) : error() ? (<div class="purchase-history-error" role="alert">
                  <CircleAlert size={18} aria-hidden="true"/>
                  <p>{error()}</p>
                  <button onClick={() => setRevision(value => value + 1)}>Try Again</button>
                </div>) : purchases().length === 0 ? (<div class="purchase-history-empty">
                  <div class="empty-icon">
                    <img src="/assets/img/home-icons/pay-v1.webp" alt="" width="64" height="64"/>
                  </div>
                  <h3>No Purchases Yet</h3>
                  <p>You haven't purchased any tickets yet. Buy tickets to book lessons with tutors!</p>
                  <a href="/tickets" class="empty-action-btn">
                    <ShoppingCart size={18} aria-hidden="true"/>
                    Buy Tickets
                  </a>
                </div>) : (<div class="purchase-list">
                  {purchases().map((purchase) => (<div class={`purchase-card ${purchase.tier}`}>
                      <div class="purchase-card-icon">
                        <img src={`/assets/img/home-icons/${purchase.tier === 'premium' ? 'premium' : 'basic'}-ticket-v2.png`} alt="" width="80" height="45"/>
                      </div>
                      <div class="purchase-card-content">
                        <div class="purchase-card-header">
                          <div class="purchase-card-title">
                            <span class={`tier-badge ${purchase.tier}`}>
                              {purchase.tier.charAt(0).toUpperCase() + purchase.tier.slice(1)}
                            </span>
                            <span class="purchase-quantity">
                              {purchase.quantity} ticket{purchase.quantity > 1 ? 's' : ''}
                            </span>
                          </div>
                          {getStatusBadge(purchase.status)}
                        </div>
                        <div class="purchase-card-details">
                          <div class="purchase-detail">
                            <span class="detail-label">Date</span>
                            <span class="detail-value">{formatDate(purchase.purchaseDate)}</span>
                          </div>
                          <div class="purchase-detail">
                            <span class="detail-label">Price per ticket</span>
                            <span class="detail-value">${purchase.pricePerTicket?.toFixed(2) || '0.00'}</span>
                          </div>
                          <div class="purchase-detail">
                            <span class="detail-label">Total</span>
                            <span class="detail-value total">${purchase.totalPrice?.toFixed(2) || '0.00'}</span>
                          </div>
                          {purchase.transferTxId && (<div class="purchase-detail">
                              <span class="detail-label">Transaction</span>
                              <a href={`https://arbiscan.io/tx/${purchase.transferTxId}`} target="_blank" rel="noopener noreferrer" class="detail-value tx-link">
                                {shortenTxHash(purchase.transferTxId)}
                                <ExternalLink size={18} aria-hidden="true"/>
                              </a>
                            </div>)}
                        </div>
                      </div>
                    </div>))}
                </div>)}
            </div>
          </div>
        </main>
      </div>
    </>);
};
export default PurchaseHistoryPage;
