import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { useLocation } from "../../routing";
import { inboxApi } from '../../api/inbox.api';
import { useThemeStore } from '../../context/ThemeContext';
import './DashboardHeader.css';
interface DashboardHeaderProps {
    title?: string;
    user?: {
        name?: string;
        profilePicture?: string;
        email?: string;
    };
}
const DashboardHeader = (_props0: DashboardHeaderProps) => {
    const _state1 = useLocation();
    const [philippineTime, setPhilippineTime] = createSignal<string>('');
    const [philippineDate, setPhilippineDate] = createSignal<string>('');
    const [inboxUnreadCount, setInboxUnreadCount] = createSignal<number>(0);
    const _state2 = useThemeStore();
    // Get user ID from localStorage
    const userId = localStorage.getItem('fxv_user_id') || '';
    // Fetch unread inbox count
    createEffect(on(() => [userId], () => {
        const _cleanup3 = untrack(() => {
            const fetchUnreadCount = async () => {
                if (!userId)
                    return;
                try {
                    const count = await inboxApi.getUnreadCount(userId);
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
    return (<div class={`dashboard-header ${_state2.isDarkMode ? 'dark' : 'light'}`}>
      <div class="header-left">
        <div class="philippine-clock">
          <i class="fas fa-clock"></i>
          <div class="clock-content">
            <span class="clock-time">{philippineTime()}</span>
            <span class="clock-date">{philippineDate()}</span>
          </div>
          <span class="clock-timezone">PHT</span>
        </div>
      </div>

      <div class="dashboard-header-actions">
        <button type="button" class="dashboard-theme-btn" aria-label={_state2.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={_state2.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'} onClick={_state2.toggleTheme}>
          <i class={`fas ${_state2.isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
        </button>

        {/* Inbox Button */}
        <a href="/inbox" class="inbox-btn" aria-label="Inbox" onClick={(e) => {
            e.preventDefault();
            _state1.route('/inbox');
        }}>
          <i class="fas fa-envelope"></i>
          {inboxUnreadCount() > 0 && (<span class="inbox-badge">
              {inboxUnreadCount() > 9 ? '9+' : inboxUnreadCount()}
            </span>)}
        </a>

        {/* Notifications Button */}
        <a href="/notifications" class="notification-btn" aria-label="Notifications" onClick={(e) => {
            e.preventDefault();
            _state1.route('/notifications');
        }}>
          <i class="fas fa-bell"></i>
        </a>
      </div>
    </div>);
};
export default DashboardHeader;
