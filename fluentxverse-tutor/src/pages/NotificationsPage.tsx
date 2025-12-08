import { useEffect, useRef, useState } from 'preact/hooks';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import { useAuthContext } from '../context/AuthContext';
import { useNotifications, getNotificationIcon, formatRelativeTime } from '../hooks/useNotifications';
import { useNotificationStore } from '../context/NotificationContext';
import './NotificationsPage.css';

const NotificationsPage = () => {
  useEffect(() => {
    document.title = 'Notifications | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  // Local UI state for filters and pagination
  const [filterUnread, setFilterUnread] = useState(false);
  const pageOffsetRef = useRef(0);
  const pageLimit = 20;
  const setStoreState = useNotificationStore.setState;

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    
    // Navigate if there's a link
    if (notification.data?.link) {
      window.location.href = notification.data.link;
    }
  };

  const handleDelete = async (e: Event, notificationId: string) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <DashboardHeader user={user || undefined} />
        <div className="notifications-page">
          <div className="container">
            {/* Page Header */}
            <div className="notifications-page-header">
              <div className="notifications-page-title">
                <div className="notifications-icon-wrapper">
                  <i className="fas fa-bell"></i>
                </div>
                <div>
                  <h1>Notifications</h1>
                  <p>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}</p>
                </div>
              </div>
              {unreadCount > 0 && (
                <button className="btn-mark-all" onClick={markAllAsRead}>
                  <i className="fas fa-check-double"></i>
                  Mark all as read
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="notifications-filters">
              <button
                className={`btn-filter ${filterUnread ? 'active' : ''}`}
                onClick={() => {
                  const next = !filterUnread;
                  setFilterUnread(next);
                  const params = new URLSearchParams();
                  params.set('limit', String(pageLimit));
                  params.set('offset', '0');
                  if (next) params.set('isRead', 'false');
                  fetch(`/notifications?${params.toString()}`, { credentials: 'include' })
                    .then(r => r.json())
                    .then(({ data }) => {
                      setStoreState({
                        notifications: data.notifications,
                        unreadCount: data.unreadCount
                      });
                      pageOffsetRef.current = 0;
                    });
                }}
              >
                <i className="fas fa-filter"></i>
                {filterUnread ? 'Showing Unread' : 'Show Unread'}
              </button>
            </div>

            {/* Notifications List */}
            <div className="notifications-list-container">
              {isLoading ? (
                <div className="notifications-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading notifications...</p>
                </div>
              ) : filterUnread && notifications.length === 0 ? (
                <div className="notifications-empty-unread">
                  <div className="empty-unread-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <h3>No unread notifications</h3>
                  <p>You're all caught up! All your notifications have been read.</p>
                </div>
              ) : !filterUnread && notifications.length === 0 ? (
                <div className="notifications-empty">
                  <div className="empty-icon">
                    <i className="fas fa-bell-slash"></i>
                  </div>
                  <h3>No notifications yet</h3>
                  <p>We'll notify you when something important happens, like new bookings, session reminders, and more.</p>
                </div>
              ) : (
                <>
                <div className="notifications-list-full">
                  {notifications.map(notification => {
                    const { icon, color } = getNotificationIcon(notification.type);
                    const isInterviewType = (notification.type || '').startsWith('interview');
                    return (
                      <div 
                        key={notification.id} 
                        className={`notification-card ${!notification.isRead ? 'unread' : ''}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div 
                          className={`notification-card-icon type-${notification.type}`} 
                          style={{ 
                            backgroundColor: isInterviewType ? color : `${color}20`, 
                            color: isInterviewType ? '#ffffff' : color 
                          }}
                        >
                          <i className={`fas ${icon}`}></i>
                        </div>
                        <div className="notification-card-content">
                          <h4>{notification.title}</h4>
                          <p>{notification.message}</p>
                          <span className="notification-card-time">
                            <i className="fas fa-clock"></i>
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                        </div>
                        <div className="notification-card-actions">
                          {!notification.isRead && (
                            <span className="unread-indicator"></span>
                          )}
                          <button 
                            className="btn-delete-notification"
                            onClick={(e) => handleDelete(e, notification.id)}
                            title="Delete notification"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Pagination */}
                <div className="notifications-pagination">
                  <button
                    className="btn-load-more"
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set('limit', String(pageLimit));
                      pageOffsetRef.current += pageLimit;
                      params.set('offset', String(pageOffsetRef.current));
                      if (filterUnread) params.set('isRead', 'false');
                      fetch(`/notifications?${params.toString()}`, { credentials: 'include' })
                        .then(r => r.json())
                        .then(({ data }) => {
                          setStoreState((state: any) => ({
                            notifications: [...state.notifications, ...data.notifications],
                            unreadCount: data.unreadCount
                          }));
                        });
                    }}
                  >
                    <i className="fas fa-chevron-down"></i>
                    Load more
                  </button>
                </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotificationsPage;
