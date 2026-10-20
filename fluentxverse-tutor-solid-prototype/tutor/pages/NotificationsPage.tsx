import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorArt from "../Components/Common/TutorArt";
import TutorIcon from "../Components/Common/TutorIcon";
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import { useAuthContext } from '../context/AuthContext';
import { useNotifications, getNotificationIcon, formatRelativeTime } from '../hooks/useNotifications';
import { useNotificationStore } from '../context/NotificationContext';
import { notificationLink } from '../utils/notificationLink';
import { notificationApi } from '../api/notification.api';
import './NotificationsPage.css';
const NotificationsPage = () => {
    createEffect(on(() => [], () => {
        const _cleanup2 = untrack(() => {
            document.title = 'Notifications | FluentXVerse';
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const _state0 = useAuthContext();
    const _state1 = useNotifications();
    // Local UI state for filters and pagination
    const [filterUnread, setFilterUnread] = createSignal(false);
    const pageOffsetRef = { current: 0 } as {
        current: any;
    };
    const pageLimit = 20;
    const setStoreState = useNotificationStore.setState;
    const handleNotificationClick = async (notification: any) => {
        if (!notification.isRead) {
            await _state1.markAsRead(notification.id);
        }
        const link = notificationLink(notification);
        if (link) {
            window.location.href = link;
        }
    };
    const handleDelete = async (e: Event, notificationId: string) => {
        e.stopPropagation();
        await _state1.deleteNotification(notificationId);
    };
    return (<>
      <SideBar />
      <div class="main-content">
        <DashboardHeader user={_state0.user || undefined}/>
        <div class="notifications-page">
          <div class="container">
            {/* Page Header */}
            <div class="notifications-page-header">
              <div class="notifications-page-title">
                <div class="notifications-icon-wrapper">
                  <TutorArt name="notifications" size={48}/>
                </div>
                <div>
                  <h1>Notifications</h1>
                  <p>{_state1.unreadCount > 0 ? `${_state1.unreadCount} unread` : 'All caught up!'}</p>
                </div>
              </div>
              {_state1.unreadCount > 0 && (<button class="btn-mark-all" onClick={_state1.markAllAsRead}>
                  <TutorIcon name="fas fa-check-double"/>
                  Mark all as read
                </button>)}
            </div>

            {/* Filters */}
            <div class="notifications-filters">
              <button class={`btn-filter ${filterUnread() ? 'active' : ''}`} onClick={() => {
            const next = !filterUnread();
            setFilterUnread(next);
            notificationApi.getNotifications(pageLimit, 0, next ? false : undefined)
                .then(data => {
                setStoreState({
                    notifications: data.notifications,
                    unreadCount: data.unreadCount
                });
                pageOffsetRef.current = 0;
            }).catch(() => setStoreState({ error: 'Could not load notifications.' }));
        }}>
                <TutorIcon name="fas fa-filter"/>
                {filterUnread() ? 'Showing Unread' : 'Show Unread'}
              </button>
            </div>

            {/* Notifications List */}
            <div class="notifications-list-container">
              {_state1.isLoading ? (<div class="notifications-loading">
                  <div class="loading-spinner"></div>
                  <p>Loading notifications...</p>
                </div>) : filterUnread() && _state1.notifications.length === 0 ? (<div class="notifications-empty-unread">
                  <div class="empty-unread-icon">
                    <TutorIcon name="fas fa-check-circle"/>
                  </div>
                  <h3>No unread notifications</h3>
                  <p>You're all caught up! All your notifications have been read.</p>
                </div>) : !filterUnread() && _state1.notifications.length === 0 ? (<div class="notifications-empty">
                  <div class="empty-icon">
                    <TutorIcon name="fas fa-bell-slash"/>
                  </div>
                  <h3>No notifications yet</h3>
                  <p>We'll notify you when something important happens, like new bookings, session reminders, and more.</p>
                </div>) : (<>
                <div class="notifications-list-full">
                  {_state1.notifications.map(notification => {
                const { icon, color } = getNotificationIcon(notification.type);
                const isInterviewType = (notification.type || '').startsWith('interview');
                return (<div class={`notification-card ${!notification.isRead ? 'unread' : ''}`} onClick={() => handleNotificationClick(notification)}>
                        <div class={`notification-card-icon type-${notification.type}`} style={cssStyle({
                        backgroundColor: isInterviewType ? color : `${color}20`,
                        color: isInterviewType ? '#ffffff' : color
                    })}>
                          <TutorIcon name={`fas ${icon}`}/>
                        </div>
                        <div class="notification-card-content">
                          <h4>{notification.title}</h4>
                          <p>{notification.message}</p>
                          <span class="notification-card-time">
                            <TutorIcon name="fas fa-clock"/>
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                        </div>
                        <div class="notification-card-actions">
                          {!notification.isRead && (<span class="unread-indicator"></span>)}
                          <button class="btn-delete-notification" onClick={(e) => handleDelete(e, notification.id)} title="Delete notification">
                            <TutorIcon name="fas fa-trash-alt"/>
                          </button>
                        </div>
                      </div>);
            })}
                </div>
                {/* Pagination */}
                <div class="notifications-pagination">
                  <button class="btn-load-more" onClick={() => {
                const nextOffset = pageOffsetRef.current + pageLimit;
                notificationApi.getNotifications(pageLimit, nextOffset, filterUnread() ? false : undefined)
                    .then(data => {
                    pageOffsetRef.current = nextOffset;
                    setStoreState((state: any) => ({
                        notifications: [...state.notifications, ...data.notifications],
                        unreadCount: data.unreadCount
                    }));
                }).catch(() => setStoreState({ error: 'Could not load notifications.' }));
            }}>
                    <TutorIcon name="fas fa-chevron-down"/>
                    Load more
                  </button>
                </div>
                </>)}
            </div>
          </div>
        </div>
      </div>
    </>);
};
export default NotificationsPage;
