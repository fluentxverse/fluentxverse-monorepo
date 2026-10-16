import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { useNotifications, getNotificationIcon, formatRelativeTime } from '../../hooks/useNotifications';
import { inboxApi } from '../../api/inbox.api';
import { useThemeStore } from '../../context/ThemeContext';
import { useAuthContext } from '../../context/AuthContext';
import ThemeSwitch from '../Common/ThemeSwitch';
import { notificationLink } from '../../utils/notificationLink';
import './DashboardHeader.css';
interface DashboardHeaderProps {
    user?: {
        name?: string;
        profilePicture?: string;
        email?: string;
    };
    title?: string;
}
const DashboardHeader = (_props0: DashboardHeaderProps) => {
    const resolvedTheme = createMemo(() => useThemeStore((state) => state.resolvedTheme));
    const _state1 = useAuthContext();
    const dropdownRef = { current: null } as {
        current: HTMLDivElement | null;
    };
    const autoReadCancellationIdsRef = { current: new Set() } as {
        current: Set<string> | null;
    };
    const [philippineTime, setPhilippineTime] = createSignal<string>('');
    const [philippineDate, setPhilippineDate] = createSignal<string>('');
    const [inboxUnreadCount, setInboxUnreadCount] = createSignal<number>(0);
    // Get user ID from localStorage
    const userId = createMemo(() => _state1.user?.userId || localStorage.getItem('fxv_user_id') || '');
    const _state2 = useNotifications();
    // Fetch inbox unread count
    createEffect(on(() => [userId()], () => {
        const _cleanup3 = untrack(() => {
            const fetchUnreadCount = async () => {
                if (!userId())
                    return;
                try {
                    const count = await inboxApi.getUnreadCount(userId());
                    setInboxUnreadCount(count);
                }
                catch (err) {
                    console.error('Failed to fetch inbox unread count:', err);
                }
            };
            fetchUnreadCount();
            // Refresh every 60 seconds
            const interval = setInterval(fetchUnreadCount, 60000);
            return () => clearInterval(interval);
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    // Philippine Time Clock
    createEffect(on(() => [], () => {
        const _cleanup4 = untrack(() => {
            const updatePhilippineTime = () => {
                const now = new Date();
                const options: Intl.DateTimeFormatOptions = {
                    timeZone: 'Asia/Manila',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                };
                const dateOptions: Intl.DateTimeFormatOptions = {
                    timeZone: 'Asia/Manila',
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                };
                setPhilippineTime(now.toLocaleTimeString('en-US', options));
                setPhilippineDate(now.toLocaleDateString('en-US', dateOptions));
            };
            updatePhilippineTime();
            const interval = setInterval(updatePhilippineTime, 1000);
            return () => clearInterval(interval);
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    // Close dropdown when clicking outside
    createEffect(on(() => [_state2.isDropdownOpen, _state2.setDropdownOpen], () => {
        const _cleanup5 = untrack(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                    _state2.setDropdownOpen(false);
                }
            };
            if (_state2.isDropdownOpen) {
                document.addEventListener('mousedown', handleClickOutside);
            }
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    createEffect(on(() => [_state2.isDropdownOpen, _state2.notifications, _state2.markAsRead, _state2.refreshNotifications], () => {
        const _cleanup6 = untrack(() => {
            if (!_state2.isDropdownOpen) {
                return;
            }
            const unreadCancellationIds = _state2.notifications.filter(notification => notification.type === 'booking_cancelled' && !notification.isRead)
                .map(notification => notification.id)
                .filter((notificationId): notificationId is string => Boolean(notificationId))
                .filter(notificationId => !autoReadCancellationIdsRef.current.has(notificationId));
            if (unreadCancellationIds.length === 0) {
                return;
            }
            unreadCancellationIds.forEach(notificationId => {
                autoReadCancellationIdsRef.current.add(notificationId);
            });
            void (async () => {
                await Promise.all(unreadCancellationIds.map(notificationId => _state2.markAsRead(notificationId)));
                await _state2.refreshNotifications();
            })();
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    const handleNotificationClick = async (notification: any) => {
        if (!notification.isRead) {
            await _state2.markAsRead(notification.id);
        }
        const link = notificationLink(notification);
        if (link) {
            window.location.href = link;
        }
        _state2.setDropdownOpen(false);
    };
    const handleMarkNotificationRead = async (event: MouseEvent, notificationId: string) => {
        event.stopPropagation();
        await _state2.markAsRead(notificationId);
    };
    return (<div class={`dashboard-header ${resolvedTheme()}`}>
      <div class="header-left">
        {_props0["title"] && (<h1 class="dashboard-page-title">{_props0["title"]}</h1>)}
        <div class="philippine-clock">
          <i class="fas fa-clock" aria-hidden="true"></i>
          <div class="clock-content">
            <span class="clock-time">{philippineTime()}</span>
            <span class="clock-date">{philippineDate()}</span>
          </div>
          <span class="clock-timezone">PHT</span>
        </div>
      </div>

      <div class="dashboard-header-actions">
        <ThemeSwitch size="sm"/>

        {/* Inbox Button */}
        <a href="/inbox" class="inbox-btn" aria-label="Inbox">
          <i class="fas fa-envelope" aria-hidden="true"></i>
          {inboxUnreadCount() > 0 && (<span class="inbox-badge">
              {inboxUnreadCount() > 9 ? '9+' : inboxUnreadCount()}
            </span>)}
        </a>

        {/* Notifications */}
        <div class="dashboard-notification-container" ref={_element => dropdownRef.current = _element}>
          <button class={`notification-btn ${_state2.isDropdownOpen ? 'active' : ''}`} onClick={_state2.toggleDropdown} aria-label="Notifications">
            <i class="fas fa-bell" aria-hidden="true"></i>
            {_state2.unreadCount > 0 && (<span class="notification-badge">
                {_state2.unreadCount > 9 ? '9+' : _state2.unreadCount}
              </span>)}
          </button>

          {_state2.isDropdownOpen && (<div class="notifications-dropdown">
              <div class="notifications-header">
                <h4>Notifications</h4>
                {_state2.unreadCount > 0 && (<button class="mark-all-read" onClick={_state2.markAllAsRead}>
                    Mark all as read
                  </button>)}
              </div>
              
              <div class="notifications-list">
                {_state2.isLoading ? (<div class="notification-loading">
                    <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                    <p>Loading notifications...</p>
                  </div>) : _state2.notifications.length === 0 ? (<div class="notification-empty">
                    <i class="fas fa-bell-slash" aria-hidden="true"></i>
                    <p>No notifications yet</p>
                    <span>We'll notify you when something happens</span>
                  </div>) : (_state2.notifications.slice(0, 10).map(notification => {
                const { icon, color } = getNotificationIcon(notification.type);
                return (<div class={`notification-item ${!notification.isRead ? 'unread' : ''}`} onClick={() => handleNotificationClick(notification)}>
                        <div class={`notification-icon type-${notification.type}`} style={cssStyle({ backgroundColor: `${color}20`, color })}>
                          <i class={`fas ${icon}`} aria-hidden="true"></i>
                        </div>
                        <div class="notification-content">
                          <p class="notification-title">{notification.title}</p>
                          <p class="notification-message">{notification.message}</p>
                          <span class="notification-time">
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                        </div>
                        <div class="notification-status-actions">
                          {!notification.isRead && (<>
                              <button type="button" class="notification-mark-read" title="Mark as read" aria-label="Mark notification as read" onClick={(event) => handleMarkNotificationRead(event, notification.id)}>
                                Read
                              </button>
                              <div class="notification-unread-dot"></div>
                            </>)}
                        </div>
                      </div>);
            }))}
              </div>
              
              {_state2.notifications.length > 0 && (<div class="notifications-footer">
                  <a href="/notifications" class="view-all-notifications">
                    View all notifications
                  </a>
                </div>)}
            </div>)}
        </div>
      </div>
    </div>);
};
export default DashboardHeader;
