import { useState } from 'preact/hooks';
import { useNotifications, formatRelativeTime } from '../hooks/useNotifications';
import './NotificationsPage.css';

const NotificationsPage = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  const [filterUnread, setFilterUnread] = useState(false);

  const displayedNotifications = filterUnread
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    if (notification.data?.link) {
      window.location.href = notification.data.link;
    }
  };

  const handleDelete = async (e: Event, notificationId: string) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  return (
    <div className="notifications-page">
      <div className="container">
        {/* Page Header */}
        <div className="notifications-page-header">
          <div className="notifications-page-title">
            <div className="notifications-icon-wrapper">
              <i className="ri-notification-line"></i>
            </div>
            <div>
              <h1>Notifications</h1>
              <p>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button className="btn-mark-all" onClick={markAllAsRead}>
              <i className="ri-check-double-line"></i>
              Mark all as read
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="notifications-filters">
          <button
            className={`btn-filter ${filterUnread ? 'active' : ''}`}
            onClick={() => setFilterUnread(!filterUnread)}
          >
            <i className="ri-filter-line"></i>
            {filterUnread ? 'Showing Unread' : 'Show Unread'}
          </button>
        </div>

        {/* Notifications List */}
        <div className="notifications-list-container">
          {isLoading ? (
            <div className="notifications-loading">
              <div className="skeleton-card">
                <div className="skeleton-icon"></div>
                <div className="skeleton-title"></div>
                <div className="skeleton-text"></div>
              </div>
              <div className="skeleton-card">
                <div className="skeleton-icon"></div>
                <div className="skeleton-title"></div>
                <div className="skeleton-text"></div>
              </div>
            </div>
          ) : filterUnread && displayedNotifications.length === 0 ? (
            <div className="notifications-empty-unread">
              <div className="empty-unread-icon">
                <i className="ri-checkbox-circle-line"></i>
              </div>
              <h3>No unread notifications</h3>
              <p>You're all caught up! All your notifications have been read.</p>
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div className="notifications-empty">
              <div className="empty-icon">
                <i className="ri-notification-off-line"></i>
              </div>
              <h3>No notifications yet</h3>
              <p>We'll notify you when something important happens, like booking confirmations, session reminders, and more.</p>
            </div>
          ) : (
            <div className="notifications-list-full">
              {displayedNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-card ${!notification.isRead ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className={`notification-card-icon type-${notification.type}`}>
                    <i className="ri-bell-line"></i>
                  </div>
                  <div className="notification-card-content">
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <span className="notification-card-time">
                      <i className="ri-time-line"></i>
                      {formatRelativeTime(notification.timestamp)}
                    </span>
                  </div>
                  <div className="notification-card-actions">
                    {!notification.isRead && <span className="unread-indicator"></span>}
                    <button
                      className="btn-delete-notification"
                      onClick={(e) => handleDelete(e as any, notification.id)}
                      title="Delete notification"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
