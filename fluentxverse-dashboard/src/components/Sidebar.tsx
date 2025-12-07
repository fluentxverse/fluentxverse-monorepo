import { useLocation } from 'preact-iso';
import { useState, useEffect } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { adminApi } from '../api/admin.api';
import './Sidebar.css';

interface NavItem {
  path: string;
  icon: string;
  label: string;
  badgeKey?: string;
  superadminOnly?: boolean;
}

const navItems: NavItem[] = [
  { path: '/', icon: 'ri-dashboard-3-line', label: 'Dashboard' },
  { path: '/interviews', icon: 'ri-calendar-schedule-line', label: 'Interviews' },
  { path: '/applications', icon: 'ri-file-user-line', label: 'Applications', badgeKey: 'pendingApplications' },
  { path: '/tutors', icon: 'ri-user-star-line', label: 'Tutors' },
  { path: '/students', icon: 'ri-graduation-cap-line', label: 'Students' },
  { path: '/sessions', icon: 'ri-video-chat-line', label: 'Sessions' },
  { path: '/analytics', icon: 'ri-bar-chart-box-line', label: 'Analytics' },
  { path: '/payments', icon: 'ri-money-dollar-circle-line', label: 'Payments' },
  { path: '/admins', icon: 'ri-admin-line', label: 'Admins', superadminOnly: true },
  { path: '/settings', icon: 'ri-settings-3-line', label: 'Settings' },
];

export function Sidebar() {
  const { path } = useLocation();
  const { user, logout } = useAuthContext();
  const [badges, setBadges] = useState<Record<string, number>>({});

  const isSuperAdmin = user?.role === 'superadmin';

  // Fetch badge counts
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const pendingTutors = await adminApi.getPendingTutors();
        setBadges({
          pendingApplications: pendingTutors.length,
        });
      } catch (error) {
        console.error('Failed to fetch badge counts:', error);
      }
    };

    fetchBadges();
    // Refresh every 60 seconds
    const interval = setInterval(fetchBadges, 60000);
    return () => clearInterval(interval);
  }, []);

  // Filter nav items based on role
  const mainNavItems = navItems.slice(0, 5);
  const managementNavItems = navItems.slice(5).filter(
    (item) => !item.superadminOnly || isSuperAdmin
  );

  const getInitials = () => {
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return 'AD';
  };

  const getDisplayName = () => {
    return user?.username || 'Admin';
  };

  const getRoleLabel = () => {
    return user?.role === 'superadmin' ? 'Super Admin' : 'Admin';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <i className="ri-book-open-line"></i>
          </div>
          <div className="logo-text">
            <span className="logo-title">FluentXVerse</span>
            <span className="logo-subtitle">Admin Dashboard</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <span className="nav-section-title">Main Menu</span>
          <ul className="nav-list">
            {mainNavItems.map((item) => {
              const badgeCount = item.badgeKey ? badges[item.badgeKey] : undefined;
              return (
                <li key={item.path}>
                  <a
                    href={item.path}
                    className={`nav-item ${path === item.path ? 'active' : ''}`}
                  >
                    <i className={item.icon}></i>
                    <span>{item.label}</span>
                    {badgeCount !== undefined && badgeCount > 0 && (
                      <span className="nav-badge">{badgeCount}</span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="nav-section">
          <span className="nav-section-title">Management</span>
          <ul className="nav-list">
            {managementNavItems.map((item) => {
              const badgeCount = item.badgeKey ? badges[item.badgeKey] : undefined;
              return (
                <li key={item.path}>
                  <a
                    href={item.path}
                    className={`nav-item ${path === item.path ? 'active' : ''}`}
                  >
                    <i className={item.icon}></i>
                    <span>{item.label}</span>
                    {badgeCount !== undefined && badgeCount > 0 && (
                      <span className="nav-badge">{badgeCount}</span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="admin-profile">
          <div className="avatar">
            <span>{getInitials()}</span>
          </div>
          <div className="admin-info">
            <span className="admin-name">{getDisplayName()}</span>
            <span className="admin-role">{getRoleLabel()}</span>
          </div>
          <button className="logout-btn" title="Logout" onClick={logout}>
            <i className="ri-logout-box-r-line"></i>
          </button>
        </div>
      </div>
    </aside>
  );
}
