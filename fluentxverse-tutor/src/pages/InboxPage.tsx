import { useState, useEffect } from 'preact/hooks';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import './InboxPage.css';

interface SystemMessage {
  id: string;
  title: string;
  message: string;
  category: 'announcement' | 'update' | 'alert' | 'news' | 'promotion';
  isRead: boolean;
  isPinned: boolean;
  timestamp: Date;
  expiresAt?: Date;
}

// Mock data - would be fetched from API in production
const mockMessages: SystemMessage[] = [
  {
    id: '1',
    title: 'Welcome to FluentXVerse!',
    message: 'Thank you for joining our community of English tutors. We\'re excited to have you on board! Please complete your profile and certification exams to start accepting students.',
    category: 'announcement',
    isRead: false,
    isPinned: true,
    timestamp: new Date('2024-12-09T08:00:00'),
  },
  {
    id: '2',
    title: 'New Feature: Real-time Schedule Updates',
    message: 'We\'ve added real-time notifications for when students book your time slots. You\'ll now receive instant updates without needing to refresh the page.',
    category: 'update',
    isRead: false,
    isPinned: false,
    timestamp: new Date('2024-12-08T14:30:00'),
  },
  {
    id: '3',
    title: 'Holiday Schedule Reminder',
    message: 'Please update your availability for the upcoming holiday season. Remember that students may have different schedules during this time.',
    category: 'alert',
    isRead: true,
    isPinned: false,
    timestamp: new Date('2024-12-07T10:00:00'),
  },
  {
    id: '4',
    title: 'Platform Maintenance - December 15',
    message: 'We will be performing scheduled maintenance on December 15, 2024, from 2:00 AM to 4:00 AM PHT. The platform may be temporarily unavailable during this time.',
    category: 'alert',
    isRead: true,
    isPinned: false,
    timestamp: new Date('2024-12-05T09:00:00'),
  },
  {
    id: '5',
    title: 'Teaching Tips: Engaging Online Students',
    message: 'Check out our latest blog post with tips on how to keep your online students engaged during lessons. From interactive activities to effective use of visual aids.',
    category: 'news',
    isRead: true,
    isPinned: false,
    timestamp: new Date('2024-12-03T16:00:00'),
  },
];

const categoryInfo = {
  announcement: { icon: 'fa-bullhorn', color: '#0245ae', label: 'Announcement' },
  update: { icon: 'fa-rocket', color: '#10b981', label: 'Update' },
  alert: { icon: 'fa-exclamation-triangle', color: '#f59e0b', label: 'Alert' },
  news: { icon: 'fa-newspaper', color: '#8b5cf6', label: 'News' },
  promotion: { icon: 'fa-gift', color: '#ec4899', label: 'Promotion' },
};

export default function InboxPage() {
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<SystemMessage | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'pinned'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      setMessages(mockMessages);
      setIsLoading(false);
    }, 500);
  }, []);

  const formatDate = (date: Date) => {
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

  const markAsRead = (messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, isRead: true } : msg
    ));
  };

  const markAllAsRead = () => {
    setMessages(prev => prev.map(msg => ({ ...msg, isRead: true })));
  };

  const togglePin = (messageId: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, isPinned: !msg.isPinned } : msg
    ));
  };

  const handleMessageClick = (message: SystemMessage) => {
    setSelectedMessage(message);
    if (!message.isRead) {
      markAsRead(message.id);
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (filter === 'unread') return !msg.isRead;
    if (filter === 'pinned') return msg.isPinned;
    return true;
  }).sort((a, b) => {
    // Pinned messages first, then by date
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  const unreadCount = messages.filter(m => !m.isRead).length;

  return (
    <div className="inbox-page">
      <DashboardHeader />
      
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
            ) : filteredMessages.length === 0 ? (
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
              filteredMessages.map(message => {
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
                        <span className="message-time">{formatDate(message.timestamp)}</span>
                      </div>
                      <p className="message-snippet">{message.message}</p>
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
                      className={`action-btn ${selectedMessage.isPinned ? 'active' : ''}`}
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
                    {selectedMessage.timestamp.toLocaleDateString('en-US', { 
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                  <div className="detail-body">
                    <p>{selectedMessage.message}</p>
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
  );
}
