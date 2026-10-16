import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorIcon from "../Common/TutorIcon";
import { useThemeStore } from '../../context/ThemeContext';
import './DashboardSidebar.css';
interface DashboardSidebarProps {
    activeSection: string;
    setActiveSection: (section: string) => void;
    logout?: () => void;
}
const DashboardSidebar = (_props0: DashboardSidebarProps) => {
    const _state1 = useThemeStore();
    const navItems = [
        { id: 'overview', label: 'Overview', icon: 'fa-home' },
        { id: 'farm', label: 'Farm Management', icon: 'fa-seedling' },
        { id: 'data', label: 'Farm Data', icon: 'fa-chart-line' },
        { id: 'market', label: 'Marketplace', icon: 'fa-store' },
        { id: 'finance', label: 'Financial Services', icon: 'fa-dollar-sign' },
        { id: 'community', label: 'Community', icon: 'fa-users' },
        { id: 'settings', label: 'Settings', icon: 'fa-cog' },
    ];
    const handleLogout = () => {
        if (_props0["logout"]) {
            _props0["logout"]();
        }
    };
    return (<div class={`dashboard-sidebar ${_state1.isDarkMode ? 'dark' : 'light'}`}>
      <div class="dashboard-sidebar-header">
        <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse Logo" class="dashboard-logo"/>
        <h3>FluentXVerse</h3>
      </div>

      <div class="dashboard-nav">
        {navItems.map((item) => (<div class={`dashboard-nav-item ${_props0["activeSection"] === item.id ? 'active' : ''}`} onClick={() => _props0["setActiveSection"](item.id)}>
            <TutorIcon name={`fas ${item.icon}`}/>
            <span>{item.label}</span>
          </div>))}
      </div>

      <div class="dashboard-sidebar-footer">
        <button class="dashboard-logout-btn" onClick={handleLogout}>
          <TutorIcon name="fas fa-sign-out-alt"/>
          <span>Logout</span>
        </button>
      </div>
    </div>);
};
export default DashboardSidebar;
