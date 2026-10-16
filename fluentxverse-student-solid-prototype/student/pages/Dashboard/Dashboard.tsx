import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { useThemeStore } from '../../context/ThemeContext';
import { useAuthContext } from '../../context/AuthContext';
import DashboardHeader from '../../Components/Common/DashboardHeader';
import SideBar from '@/Components/IndexOne/SideBar';
import LoadingSpinner from '@/Components/LoadingSpinner';
import './Dashboard.css';
const Dashboard = () => {
    const _state0 = useAuthContext();
    const _state1 = useThemeStore();
    createEffect(on(() => [_state0.isAuthenticated, _state0.initialLoading, _state0.user], () => {
        const _cleanup2 = untrack(() => {
            if (!_state0.initialLoading && !_state0.isAuthenticated) {
                window.location.href = '/';
            }
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    return createMemo(() => {
        if (_state0.initialLoading) {
            return <LoadingSpinner />;
        }
        if (!_state0.isAuthenticated) {
            return null;
        }
        return (<div class="main-wrapper">
      <SideBar />
      <div class={`dashboard-container ${_state1.isDarkMode ? 'dark-mode' : ''}`}>
        <DashboardHeader user={_state0.user || undefined}/>
        <div class="dashboard-content">
          <div class="dashboard-welcome">
            <h1>Welcome back, {_state0.user?.givenName || 'Student'}!</h1>
            <p>Ready to continue your language learning journey?</p>
            <div class="dashboard-quick-actions">
              <a href="/tutors" class="quick-action-btn">Find a Tutor</a>
              <a href="/schedule" class="quick-action-btn">View Schedule</a>
              <a href="/materials" class="quick-action-btn">Learning Materials</a>
            </div>
          </div>
        </div>
      </div>
    </div>);
    }) as unknown as JSX.Element;
};
export default Dashboard;
