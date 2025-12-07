import { useEffect } from 'preact/hooks';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import { useAuthContext } from '../context/AuthContext';
import { useNotifications, getNotificationIcon, formatRelativeTime } from '../hooks/useNotifications';
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

            {/* Notifications List */}
            <div className="notifications-list-container">
              {isLoading ? (
                <div className="notifications-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="notifications-empty">
                  <div className="empty-icon">
                    <i className="fas fa-bell-slash"></i>
                  </div>
                  <h3>No notifications yet</h3>
                  <p>We'll notify you when something important happens, like new bookings, session reminders, and more.</p>
                </div>
              ) : (
                <div className="notifications-list-full">
                  {notifications.map(notification => {
                    const { icon, color } = getNotificationIcon(notification.type);
                    return (
                      <div 
                        key={notification.id} 
                        className={`notification-card ${!notification.isRead ? 'unread' : ''}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div 
                          className="notification-card-icon" 
                          style={{ backgroundColor: `${color}20`, color }}
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
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotificationsPage;
