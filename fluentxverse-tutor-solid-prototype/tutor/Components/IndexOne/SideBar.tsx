import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { useLocation } from "../../routing";
import { JSX } from "solid-js";
import { useAuthContext } from '../../context/AuthContext';
import SettingsModal from '../Settings/SettingsModal';
import { LibraryBig } from 'lucide-solid';
interface MenuItem {
    href: string;
    icon: string;
    label?: string;
}
// Menu items for the static site
const menuItems: MenuItem[] = [
    { href: "/home", icon: "fi-sr-home" },
    { href: "/schedule", icon: "fi-sr-calendar" },
    { href: "/materials", icon: "fi-sr-book-alt" },
    { href: "/profile", icon: "fi-sr-user" },
    { href: "/performance-metrics", icon: "fi-sr-chart-histogram" },
    { href: "/knowledge-base", icon: "knowledge-base", label: "Knowledge Base" },
];
const SideBar = (): JSX.Element | null => {
    const _state0 = useLocation();
    const _state1 = useAuthContext();
    const [showSettings, setShowSettings] = createSignal(false);
    return createMemo(() => {
        // Don't render sidebar if user is not logged in
        if (!_state1.user) {
            return null;
        }
        // Menu items for the static site
        return (<div class="sidebar hidden-on-mobile">
      <div class="sidebar-logo mb-25">
        <a href="/home">
          <img src="/assets/img/logo/icon_logo.webp" alt="FluentXVerse Logo"/>
        </a>
      </div>
      <div class="sidebar-icon">
        <ul>
          {menuItems.map((item) => (<li class={_state0.path === item.href || _state0.path.startsWith(`${item.href}/`) ? "active" : ""}>
              <a href={item.href} aria-label={item.label || item.href.slice(1).replaceAll("-", " ")} title={item.label || item.href.slice(1).replaceAll("-", " ")} aria-current={_state0.path === item.href || _state0.path.startsWith(`${item.href}/`) ? "page" : undefined}>
                {item.icon === 'knowledge-base' ? <LibraryBig size={24} class="sidebar-knowledge-icon" aria-hidden="true"/> : <i class={item.icon} aria-hidden="true"></i>}
              </a>
            </li>))}
          
          {/* Settings Button as last menu item */}
          <li class={showSettings() ? "active" : ""}>
            <a href="#" onClick={(e) => {
                e.preventDefault();
                setShowSettings(true);
            }} title="Settings">
              <i class="fi-sr-settings" aria-hidden="true"></i>
            </a>
          </li>
        </ul>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings()} onClose={() => setShowSettings(false)}/>
      
      <style>{`
        .sidebar-knowledge-icon { color: #9c9c9c; }
        .sidebar-icon ul li.active a .sidebar-knowledge-icon { color: #fff; }
        /* Glow effect for active menu item */
        .sidebar-icon ul li.active a {
          background: linear-gradient(135deg, #0245ae 0%, #4a9eff 100%);
          box-shadow: 0 0 20px rgba(2, 69, 174, 0.6), 0 0 40px rgba(74, 158, 255, 0.4);
          transform: scale(1.05);
        }
        
        .sidebar-icon ul li.active a i {
          color: #fff;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
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
