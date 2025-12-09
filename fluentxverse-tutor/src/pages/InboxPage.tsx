import { useState, useEffect } from 'preact/hooks';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SideBar from '../Components/IndexOne/SideBar';
import { inboxApi, SystemMessage, MessageCategory } from '../api/inbox.api';
import './InboxPage.css';

const categoryInfo = {
  announcement: { icon: 'fa-bullhorn', color: '#0245ae', label: 'Announcement' },
  update: { icon: 'fa-rocket', color: '#10b981', label: 'Update' },
  alert: { icon: 'fa-exclamation-triangle', color: '#f59e0b', label: 'Alert' },
  news: { icon: 'fa-newspaper', color: '#8b5cf6', label: 'News' },
  promotion: { icon: 'fa-gift', color: '#ec4899', label: 'Promotion' },
};

export default function InboxPage() {
  // Set page title for browser tab
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Inbox | FluentXVerse';
    return () => {
      document.title = prevTitle;
    };
  }, []);
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<SystemMessage | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'pinned'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get user ID from localStorage
  const userId = localStorage.getItem('fxv_user_id') || '';

  useEffect(() => {
    loadMessages();
  }, [filter]);

  const loadMessages = async () => {
    if (!userId) {
      setError('Please log in to view your inbox');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const params: any = { userId };
      if (filter === 'unread') params.isRead = false;
      if (filter === 'pinned') params.isPinned = true;
      
      const response = await inboxApi.getMessages(params);
      setMessages(response.messages);
    } catch (err: any) {
      console.error('Failed to load messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const markAsRead = async (messageId: string) => {
    try {
      await inboxApi.markAsRead(messageId, userId);
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, isRead: true } : msg
      ));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await inboxApi.markAllAsRead(userId);
      setMessages(prev => prev.map(msg => ({ ...msg, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const togglePin = async (messageId: string) => {
    try {
      const isPinned = await inboxApi.togglePin(messageId, userId);
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, isPinned } : msg
      ));
      if (selectedMessage?.id === messageId) {
        setSelectedMessage({ ...selectedMessage, isPinned });
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const handleMessageClick = (message: SystemMessage) => {
    setSelectedMessage(message);
    if (!message.isRead) {
      markAsRead(message.id);
    }
  };

  // Sort messages: pinned first, then by date
  const sortedMessages = [...messages].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const unreadCount = messages.filter(m => !m.isRead).length;

  return (
    <>
      <SideBar />
      <div className="inbox-page main-content">
        <DashboardHeader title='Inbox' />
        
        <div className="inbox-container">
        <div className="inbox-header">
          <div className="inbox-header-content">
            <div className="inbox-icon-wrapper">
              <i className="fas fa-envelope"></i>
            </div>
            <div>
              <h1>Inbox</h1>
              <p>Messages from FluentXVerse</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button className="mark-all-read-btn" onClick={markAllAsRead}>
              <i className="fas fa-check-double"></i>
              Mark all as read
            </button>
          )}
        </div>

        {error && (
          <div className="inbox-error">
            <i className="fas fa-exclamation-circle"></i>
            <p>{error}</p>
            <button onClick={loadMessages}>Try Again</button>
          </div>
        )}

        <div className="inbox-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <i className="fas fa-inbox"></i>
            All Messages
            <span className="filter-count">{messages.length}</span>
          </button>
          <button 
            className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            <i className="fas fa-envelope"></i>
            Unread
            {unreadCount > 0 && <span className="filter-count unread">{unreadCount}</span>}
          </button>
          <button 
            className={`filter-btn ${filter === 'pinned' ? 'active' : ''}`}
            onClick={() => setFilter('pinned')}
          >
            <i className="fas fa-thumbtack"></i>
            Pinned
          </button>
        </div>

        <div className="inbox-content">
          <div className="messages-list">
            {isLoading ? (
              <div className="inbox-loading">
                <i className="fas fa-spinner fa-spin"></i>
                <p>Loading messages...</p>
              </div>
            ) : sortedMessages.length === 0 ? (
              <div className="inbox-empty">
                <i className="fas fa-inbox"></i>
                <p>No messages</p>
                <span>
                  {filter === 'unread' ? 'All caught up!' : 
                   filter === 'pinned' ? 'No pinned messages' : 
                   'Your inbox is empty'}
                </span>
              </div>
            ) : (
              sortedMessages.map(message => {
                const catInfo = categoryInfo[message.category];
                return (
                  <div 
                    key={message.id}
                    className={`message-item ${!message.isRead ? 'unread' : ''} ${selectedMessage?.id === message.id ? 'selected' : ''}`}
                    onClick={() => handleMessageClick(message)}
                  >
                    <div className="message-icon" style={{ backgroundColor: `${catInfo.color}15`, color: catInfo.color }}>
                      <i className={`fas ${catInfo.icon}`}></i>
                    </div>
                    <div className="message-preview">
                      <div className="message-header">
                        <h4 className="message-title">{message.title}</h4>
                        <span className="message-time">{formatDate(message.createdAt)}</span>
                      </div>
                      <p className="message-snippet">{message.content}</p>
                      <div className="message-meta">
                        <span className="message-category" style={{ backgroundColor: `${catInfo.color}15`, color: catInfo.color }}>
                          {catInfo.label}
                        </span>
                        {message.isPinned && (
                          <span className="message-pinned">
                            <i className="fas fa-thumbtack"></i>
                          </span>
                        )}
                      </div>
                    </div>
                    {!message.isRead && <div className="unread-dot"></div>}
                  </div>
                );
              })
            )}
          </div>

          <div className={`message-detail ${selectedMessage ? 'visible' : ''}`}>
            {selectedMessage ? (
              <>
                <div className="detail-header">
                  <button className="back-btn" onClick={() => setSelectedMessage(null)}>
                    <i className="fas fa-arrow-left"></i>
                  </button>
                  <div className="detail-actions">
                    <button 
                      className={`inbox-action-btn ${selectedMessage.isPinned ? 'active' : ''}`}
                      onClick={() => togglePin(selectedMessage.id)}
                      title={selectedMessage.isPinned ? 'Unpin' : 'Pin'}
                    >
                      <i className="fas fa-thumbtack"></i>
                    </button>
                  </div>
                </div>
                <div className="detail-content">
                  <div className="detail-category" style={{ backgroundColor: `${categoryInfo[selectedMessage.category].color}15`, color: categoryInfo[selectedMessage.category].color }}>
                    <i className={`fas ${categoryInfo[selectedMessage.category].icon}`}></i>
                    {categoryInfo[selectedMessage.category].label}
                  </div>
                  <h2 className="detail-title">{selectedMessage.title}</h2>
                  <span className="detail-date">
                    {new Date(selectedMessage.createdAt).toLocaleDateString('en-US', { 
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  <div className="detail-body">
                    <p>{selectedMessage.content}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="no-message-selected">
                <i className="fas fa-envelope-open-text"></i>
                <p>Select a message to read</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
