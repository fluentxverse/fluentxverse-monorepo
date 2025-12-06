import { useLocation } from 'preact-iso';
import './Sidebar.css';

interface NavItem {
  path: string;
  icon: string;
  label: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { path: '/', icon: 'ri-dashboard-3-line', label: 'Dashboard' },
  { path: '/interviews', icon: 'ri-calendar-schedule-line', label: 'Interviews' },
  { path: '/applications', icon: 'ri-file-user-line', label: 'Applications', badge: 12 },
  { path: '/tutors', icon: 'ri-user-star-line', label: 'Tutors' },
  { path: '/students', icon: 'ri-graduation-cap-line', label: 'Students' },
  { path: '/sessions', icon: 'ri-video-chat-line', label: 'Sessions' },
  { path: '/analytics', icon: 'ri-bar-chart-box-line', label: 'Analytics' },
  { path: '/payments', icon: 'ri-money-dollar-circle-line', label: 'Payments' },
  { path: '/settings', icon: 'ri-settings-3-line', label: 'Settings' },
];

export function Sidebar() {
  const { path } = useLocation();

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
            {navItems.slice(0, 5).map((item) => (
              <li key={item.path}>
                <a
                  href={item.path}
                  className={`nav-item ${path === item.path ? 'active' : ''}`}
                >
                  <i className={item.icon}></i>
                  <span>{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="nav-section">
          <span className="nav-section-title">Management</span>
          <ul className="nav-list">
            {navItems.slice(5).map((item) => (
              <li key={item.path}>
                <a
                  href={item.path}
                  className={`nav-item ${path === item.path ? 'active' : ''}`}
                >
                  <i className={item.icon}></i>
                  <span>{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="admin-profile">
          <div className="avatar">
            <span>AD</span>
          </div>
          <div className="admin-info">
            <span className="admin-name">Admin User</span>
            <span className="admin-role">Super Admin</span>
          </div>
          <button className="logout-btn" title="Logout">
            <i className="ri-logout-box-r-line"></i>
          </button>
        </div>
      </div>
    </aside>
  );
}
