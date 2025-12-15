import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { io, type Socket } from 'socket.io-client';
import './TicketsPage.css';
import {
  getTickets,
  getTicketStats,
  createTicket,
  mintAdditional,
  type Ticket,
  type TicketStats,
  type CreateTicketRequest,
  type TicketTier,
  type MintingUpdate,
} from '../api/ticket.api';

// Get ticket image URL from local server
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8765';
const getTicketImageUrl = (tier: TicketTier): string => {
  return `${API_BASE_URL}/tickets/image/${tier}`;
};

// Toast notification component
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

const TicketsPage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [selectedTicketForMint, setSelectedTicketForMint] = useState<Ticket | null>(null);
  const [mintQuantity, setMintQuantity] = useState(10);
  
  // API state
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [minting, setMinting] = useState(false);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Form state for creating new ticket
  const [newTicket, setNewTicket] = useState<{
    tier: TicketTier;
    price: number;
    supply: number;
  }>({
    tier: 'basic',
    price: 6,
    supply: 100,
  });

  // Add toast notification
  const addToast = (type: Toast['type'], title: string, message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title, message }]);
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Remove toast
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Setup socket connection for minting updates
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:8767', {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket for minting updates');
      socket.emit('notification:subscribe');
    });

    // Listen for minting updates
    socket.on('minting:update', (data: MintingUpdate) => {
      console.log('Minting update received:', data);
      
      const tierName = data.tier.charAt(0).toUpperCase() + data.tier.slice(1);
      
      if (data.type === 'minting_success') {
        addToast(
          'success',
          `${tierName} Tickets Minted!`,
          data.mintType === 'create'
            ? `Successfully minted ${data.supply} ${tierName} tickets.`
            : `Successfully minted ${data.supply} additional ${tierName} tickets.`
        );
        // Refresh data to show updated tickets
        fetchData();
      } else if (data.type === 'minting_failed') {
        addToast(
          'error',
          `${tierName} Minting Failed`,
          data.errorMessage || `Failed to mint ${data.supply} ${tierName} tickets.`
        );
      } else if (data.type === 'minting_started') {
        addToast(
          'info',
          `${tierName} Minting Started`,
          `Minting ${data.supply} ${tierName} tickets...`
        );
      }
    });

    // Also listen for notification:new for admin notifications
    socket.on('notification:new', (notification: any) => {
      if (notification.type?.startsWith('minting_')) {
        const tierName = notification.data?.tier 
          ? notification.data.tier.charAt(0).toUpperCase() + notification.data.tier.slice(1)
          : 'Ticket';
        
        if (notification.type === 'minting_success') {
          addToast('success', notification.title, notification.message);
          fetchData();
        } else if (notification.type === 'minting_failed') {
          addToast('error', notification.title, notification.message);
        }
      }
    });

    return () => {
      socket.off('minting:update');
      socket.off('notification:new');
      socket.off('connect');
      socket.disconnect();
    };
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketData, ticketStats] = await Promise.all([
        getTickets(),
        getTicketStats(),
      ]);
      setTickets(ticketData);
      setStats(ticketStats);
    } catch (err) {
      console.error('Error fetching ticket data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ticket data');
    } finally {
      setLoading(false);
    }
  };

  // Check which tiers already exist
  const basicExists = tickets.some(t => t.tier === 'basic');
  const premiumExists = tickets.some(t => t.tier === 'premium');
  const canCreateMore = !basicExists || !premiumExists;

  const handleCreateTicket = async () => {
    setCreating(true);
    try {
      const requestData: CreateTicketRequest = {
        tier: newTicket.tier,
        price: newTicket.price,
        supply: newTicket.supply,
      };

      const { transactionId } = await createTicket(requestData);
      
      // Show pending toast
      const tierName = newTicket.tier.charAt(0).toUpperCase() + newTicket.tier.slice(1);
      addToast('info', 'Minting Started', `${tierName} ticket minting in progress. Transaction ID: ${transactionId.slice(0, 8)}...`);
      
      setShowCreateModal(false);
      // Reset form
      setNewTicket({
        tier: basicExists ? 'premium' : 'basic',
        price: basicExists ? 9 : 6,
        supply: 100,
      });
    } catch (err) {
      console.error('Error creating ticket:', err);
      addToast('error', 'Creation Failed', err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const handleMintMore = (ticket: Ticket) => {
    setSelectedTicketForMint(ticket);
    setMintQuantity(10);
    setShowMintModal(true);
  };

  const handleConfirmMint = async () => {
    if (!selectedTicketForMint) return;

    setMinting(true);
    try {
      const { transactionId } = await mintAdditional(selectedTicketForMint.tokenId, mintQuantity);
      
      // Show pending toast
      const tierName = selectedTicketForMint.tier.charAt(0).toUpperCase() + selectedTicketForMint.tier.slice(1);
      addToast('info', 'Minting Started', `Minting ${mintQuantity} additional ${tierName} tickets. Transaction ID: ${transactionId.slice(0, 8)}...`);
      
      setShowMintModal(false);
      setSelectedTicketForMint(null);
    } catch (err) {
      console.error('Error minting:', err);
      addToast('error', 'Minting Failed', err instanceof Error ? err.message : 'Failed to mint additional supply');
    } finally {
      setMinting(false);
    }
  };

  const openCreateModal = () => {
    // Set default tier to one that doesn't exist yet
    const defaultTier: TicketTier = !basicExists ? 'basic' : 'premium';
    setNewTicket({
      tier: defaultTier,
      price: defaultTier === 'basic' ? 6 : 9,
      supply: 100,
    });
    setShowCreateModal(true);
  };

  return (
    <div className="tickets-admin-page">
      <div className="page-header">
        <div className="header-content">
          <h1>
            <i className="ri-ticket-2-line"></i>
            Lesson Tickets
          </h1>
          <p>Manage Basic and Premium lesson ticket NFTs</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={fetchData} disabled={loading}>
            <i className={`ri-refresh-line ${loading ? 'spin' : ''}`}></i> Refresh
          </button>
          {canCreateMore && (
            <button className="btn-primary" onClick={openCreateModal}>
              <i className="ri-add-line"></i> Create Ticket
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <i className="ri-error-warning-line"></i>
          {error}
          <button onClick={fetchData}>Retry</button>
        </div>
      )}

      {loading && !stats ? (
        <div className="loading-state">
          <i className="ri-loader-4-line spin"></i>
          <p>Loading ticket data...</p>
        </div>
      ) : (
        <>
          {/* Stats Overview */}
          <div className="stats-overview">
            <div className="stat-card">
              <div className="stat-icon blue">
                <i className="ri-ticket-2-line"></i>
              </div>
              <div className="stat-content">
                <span className="stat-value">{stats?.totalTicketTypes || 0}/2</span>
                <span className="stat-label">Ticket Types</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple">
                <i className="ri-coin-line"></i>
              </div>
              <div className="stat-content">
                <span className="stat-value">{(stats?.totalSupply || 0).toLocaleString()}</span>
                <span className="stat-label">Total Supply</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">
                <i className="ri-check-double-line"></i>
              </div>
              <div className="stat-content">
                <span className="stat-value">{stats?.basicTicket?.supply?.toLocaleString() || 0}</span>
                <span className="stat-label">Basic Supply</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon yellow">
                <i className="ri-vip-crown-line"></i>
              </div>
              <div className="stat-content">
                <span className="stat-value">{stats?.premiumTicket?.supply?.toLocaleString() || 0}</span>
                <span className="stat-label">Premium Supply</span>
              </div>
            </div>
          </div>

          {/* Ticket Cards */}
          <div className="tickets-grid two-column">
            {/* Basic Ticket Card */}
            <div className={`ticket-type-card basic ${!basicExists ? 'empty' : ''}`}>
              {stats?.basicTicket ? (
                <>
                  <div className="ticket-header">
                    <span className="tier-badge basic">Basic</span>
                    <span className="token-id">Token #{stats.basicTicket.tokenId}</span>
                  </div>
                  <div className="ticket-image">
                    <img 
                      src={getTicketImageUrl('basic')}
                      alt="Basic Lesson Ticket"
                    />
                  </div>
                  <h3 className="ticket-name">{stats.basicTicket.name}</h3>
                  <p className="ticket-description">{stats.basicTicket.description}</p>
                  <div className="ticket-price">
                    <span className="price-value">${stats.basicTicket.price}</span>
                    <span className="price-label">per ticket</span>
                  </div>
                  <div className="ticket-info">
                    <div className="info-item">
                      <i className="ri-stack-line"></i>
                      <span>{stats.basicTicket.supply.toLocaleString()} supply</span>
                    </div>
                    <div className="info-item">
                      <i className="ri-calendar-line"></i>
                      <span>Valid for 1 year</span>
                    </div>
                    <div className="info-item">
                      <i className="ri-time-line"></i>
                      <span>Created: {new Date(stats.basicTicket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button className="btn-mint" onClick={() => handleMintMore(stats.basicTicket!)}>
                    <i className="ri-add-circle-line"></i> Mint More
                  </button>
                </>
              ) : (
                <div className="empty-ticket-slot">
                  <div className="empty-icon">🎫</div>
                  <h3>Basic Ticket</h3>
                  <p>No Basic ticket created yet</p>
                  <button className="btn-create" onClick={() => {
                    setNewTicket({ tier: 'basic', price: 6, supply: 100 });
                    setShowCreateModal(true);
                  }}>
                    <i className="ri-add-line"></i> Create Basic Ticket
                  </button>
                </div>
              )}
            </div>

            {/* Premium Ticket Card */}
            <div className={`ticket-type-card premium ${!premiumExists ? 'empty' : ''}`}>
              {stats?.premiumTicket ? (
                <>
                  <div className="ticket-header">
                    <span className="tier-badge premium">Premium</span>
                    <span className="token-id">Token #{stats.premiumTicket.tokenId}</span>
                  </div>
                  <div className="ticket-image">
                    <img 
                      src={getTicketImageUrl('premium')}
                      alt="Premium Lesson Ticket"
                    />
                  </div>
                  <h3 className="ticket-name">{stats.premiumTicket.name}</h3>
                  <p className="ticket-description">{stats.premiumTicket.description}</p>
                  <div className="ticket-price">
                    <span className="price-value">${stats.premiumTicket.price}</span>
                    <span className="price-label">per ticket</span>
                  </div>
                  <div className="ticket-info">
                    <div className="info-item">
                      <i className="ri-stack-line"></i>
                      <span>{stats.premiumTicket.supply.toLocaleString()} supply</span>
                    </div>
                    <div className="info-item">
                      <i className="ri-calendar-line"></i>
                      <span>Valid for 1 year</span>
                    </div>
                    <div className="info-item">
                      <i className="ri-time-line"></i>
                      <span>Created: {new Date(stats.premiumTicket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button className="btn-mint" onClick={() => handleMintMore(stats.premiumTicket!)}>
                    <i className="ri-add-circle-line"></i> Mint More
                  </button>
                </>
              ) : (
                <div className="empty-ticket-slot">
                  <div className="empty-icon">🎫✨</div>
                  <h3>Premium Ticket</h3>
                  <p>No Premium ticket created yet</p>
                  <button className="btn-create" onClick={() => {
                    setNewTicket({ tier: 'premium', price: 9, supply: 100 });
                    setShowCreateModal(true);
                  }}>
                    <i className="ri-add-line"></i> Create Premium Ticket
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Info Section */}
          <div className="info-section">
            <h3><i className="ri-information-line"></i> About Lesson Tickets</h3>
            <ul>
              <li><strong>Basic Tickets:</strong> Standard 25-minute lesson sessions at $6 per ticket</li>
              <li><strong>Premium Tickets:</strong> 25-minute sessions for premium courses or premium learning materials with priority booking at $9 per ticket</li>
              <li><strong>Validity:</strong> All tickets are valid for 1 year from the date of purchase</li>
              <li><strong>On-Chain:</strong> Tickets are ERC-1155 NFTs stored on Arbitrum</li>
            </ul>
          </div>
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="ri-add-circle-line"></i>
                Create {newTicket.tier.charAt(0).toUpperCase() + newTicket.tier.slice(1)} Ticket
              </h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Ticket Tier</label>
                <div className="tier-selector">
                  {!basicExists && (
                    <button 
                      className={`tier-option ${newTicket.tier === 'basic' ? 'selected' : ''}`}
                      onClick={() => setNewTicket(prev => ({ ...prev, tier: 'basic', price: 6 }))}
                    >
                      <span className="tier-badge basic">Basic</span>
                      <span className="tier-price">$6/ticket</span>
                    </button>
                  )}
                  {!premiumExists && (
                    <button 
                      className={`tier-option ${newTicket.tier === 'premium' ? 'selected' : ''}`}
                      onClick={() => setNewTicket(prev => ({ ...prev, tier: 'premium', price: 9 }))}
                    >
                      <span className="tier-badge premium">Premium</span>
                      <span className="tier-price">$9/ticket</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Price per Ticket ($)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={newTicket.price}
                    onInput={(e) => setNewTicket(prev => ({ ...prev, price: parseFloat((e.target as HTMLInputElement).value) || 1 }))}
                  />
                </div>
                <div className="form-group">
                  <label>Initial Supply</label>
                  <input
                    type="number"
                    min="1"
                    value={newTicket.supply}
                    onInput={(e) => setNewTicket(prev => ({ ...prev, supply: parseInt((e.target as HTMLInputElement).value) || 1 }))}
                  />
                </div>
              </div>

              <div className="create-preview">
                <h4>NFT Metadata Preview</h4>
                <div className="preview-item">
                  <span>Name:</span>
                  <span>{newTicket.tier.charAt(0).toUpperCase() + newTicket.tier.slice(1)} Lesson Ticket</span>
                </div>
                <div className="preview-item">
                  <span>Tier:</span>
                  <span className={`tier-badge ${newTicket.tier}`}>{newTicket.tier}</span>
                </div>
                <div className="preview-item">
                  <span>Price:</span>
                  <span>${newTicket.price}</span>
                </div>
                <div className="preview-item">
                  <span>Validity:</span>
                  <span>1 Year</span>
                </div>
                <div className="preview-item">
                  <span>Initial Supply:</span>
                  <span>{newTicket.supply} NFTs</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)} disabled={creating}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreateTicket} disabled={creating}>
                {creating ? (
                  <>
                    <i className="ri-loader-4-line spin"></i> Creating...
                  </>
                ) : (
                  <>
                    <i className="ri-nft-line"></i> Create & Mint NFT
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mint More Modal */}
      {showMintModal && selectedTicketForMint && (
        <div className="modal-overlay" onClick={() => setShowMintModal(false)}>
          <div className="modal-content mint-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <i className="ri-add-circle-line"></i>
                Mint Additional Supply
              </h2>
              <button className="modal-close" onClick={() => setShowMintModal(false)}>
                <i className="ri-close-line"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="mint-ticket-info">
                <div className={`tier-badge ${selectedTicketForMint.tier}`}>
                  {selectedTicketForMint.tier}
                </div>
                <h3>{selectedTicketForMint.name}</h3>
                <p>Token ID: #{selectedTicketForMint.tokenId}</p>
                <p>Current Supply: {selectedTicketForMint.supply.toLocaleString()}</p>
              </div>

              <div className="form-group">
                <label>Quantity to Mint</label>
                <input
                  type="number"
                  min="1"
                  value={mintQuantity}
                  onInput={(e) => setMintQuantity(parseInt((e.target as HTMLInputElement).value) || 1)}
                />
              </div>

              <div className="mint-preview">
                <p>New Total Supply: <strong>{(selectedTicketForMint.supply + mintQuantity).toLocaleString()}</strong></p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowMintModal(false)} disabled={minting}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleConfirmMint} disabled={minting}>
                {minting ? (
                  <>
                    <i className="ri-loader-4-line spin"></i> Minting...
                  </>
                ) : (
                  <>
                    <i className="ri-nft-line"></i> Mint {mintQuantity} NFTs
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <div className="toast-icon">
              {toast.type === 'success' && <i className="ri-checkbox-circle-fill"></i>}
              {toast.type === 'error' && <i className="ri-error-warning-fill"></i>}
              {toast.type === 'info' && <i className="ri-information-fill"></i>}
            </div>
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>
              <i className="ri-close-line"></i>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TicketsPage;
