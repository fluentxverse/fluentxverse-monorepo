import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { useLocation } from "../../routing";
import { JSX } from "solid-js";
import { BookOpen, CalendarDays, House, Settings, Ticket, UserRound, ShieldCheck } from "lucide-solid";
import { useAuthContext } from '../../context/AuthContext';
import SettingsModal from '../Settings/SettingsModal';
import { TICKETING_VISIBLE } from '../../config/launch';
interface MenuItem {
    href: string;
    label: string;
    icon: typeof House;
}
// Menu items for the static site
const menuItems: MenuItem[] = [
    { href: "/home", label: "Home", icon: House },
    { href: "/schedule", label: "Schedule", icon: CalendarDays },
    ...(TICKETING_VISIBLE ? [{ href: "/tickets", label: "Tickets", icon: Ticket }] : []),
    { href: "/materials", label: "Materials", icon: BookOpen },
    { href: "/reviews", label: "Feedback", icon: ShieldCheck },
    { href: "/profile", label: "Profile", icon: UserRound }
];
const SideBar = (): JSX.Element | null => {
    const _state0 = useLocation();
    const _state1 = useAuthContext();
    const [showSettings, setShowSettings] = createSignal(false);
    return createMemo(() => {
        // Don't render sidebar if user is not logged in
        if (!_state1.isAuthenticated) {
            return null;
        }
        const handleClick = createMemo(on(() => [_state0.route], () => (e: MouseEvent & {
            currentTarget: HTMLAnchorElement;
        }, href: string) => {
            e.preventDefault();
            _state0.route(href);
        }));
        return (<div class="sidebar hidden-on-mobile">
      <div class="sidebar-logo mb-25">
        <a href="/home" onClick={(e) => {
                e.preventDefault();
                _state0.route('/home');
            }}>
          <img src="/assets/img/logo/icon_logo.webp" alt="FluentXVerse Logo"/>
        </a>
      </div>
      <div class="sidebar-icon">
        <ul>
          {menuItems.map((item) => {
                const Icon = item.icon;
                return (<li class={_state0.path === item.href ? "active" : ""}>
              <a href={item.href} onClick={(e) => handleClick()(e, item.href)} aria-label={item.label} title={item.label}>
                <Icon size={26} strokeWidth={2.5} aria-hidden="true"/>
              </a>
            </li>);
            })}
          
          {/* Settings Button as last menu item */}
          <li class={showSettings() ? "active" : ""}>
            <a href="#" onClick={(e) => {
                e.preventDefault();
                setShowSettings(true);
            }} title="Settings" aria-label="Account settings">
              <Settings size={26} strokeWidth={2.5} aria-hidden="true"/>
            </a>
          </li>
        </ul>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings()} onClose={() => setShowSettings(false)}/>
      
      <style>{`
        /* Glow effect for active menu item */
        .sidebar-icon ul li.active a {
          background: linear-gradient(135deg, #0245ae 0%, #4a9eff 100%);
          box-shadow: 0 0 20px rgba(2, 69, 174, 0.6), 0 0 40px rgba(74, 158, 255, 0.4);
          transform: scale(1.05);
        }
        
        .sidebar-icon ul li.active a svg {
          color: #fff;
          filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.5));
        }

        .sidebar-icon ul li a {
          transition: all 0.3s ease;
        }

        .sidebar-icon ul li a:hover {
          background: linear-gradient(135deg, #0245ae 0%, #4a9eff 100%);
          box-shadow: 0 0 15px rgba(2, 69, 174, 0.4);
          transform: scale(1.02);
        }

        /* Hide sidebar on mobile for non-logged-in users */
        @media (max-width: 991px) {
          .sidebar.hidden-on-mobile {
            display: none;
          }
          /* Adjust main content when sidebar is hidden */
          .main-content {
            margin-left: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>);
    }) as unknown as JSX.Element;
};
export default SideBar;
