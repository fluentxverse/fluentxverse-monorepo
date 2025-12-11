import { useLocation } from "wouter";
import { useCallback, useEffect, useState } from "preact/hooks";
import { JSX } from "preact";
import { useThemeStore } from '../../context/ThemeContext';
import { useAuthContext } from '../../context/AuthContext';
import SettingsModal from '../Settings/SettingsModal';
import { getExamStatus, getSpeakingExamStatus } from '../../api/exam.api';

interface MenuItem {
  href: string;
  icon: string;
  requiresCertification?: boolean;
}

// Menu items for the static site
const menuItems: MenuItem[] = [
  { href: "/home", icon: "fi-sr-home" },
  { href: "/profile", icon: "fi-sr-user" },
  { href: "/schedule", icon: "fi-sr-calendar", requiresCertification: true },
  { href: "/materials", icon: "fi-sr-book-alt" },
  { href: "/metrics", icon: "fi-sr-chart-histogram" },
  { href: "/about", icon: "fi-sr-info" }
];

const SideBar = (): JSX.Element | null => {
  const [location, setLocation] = useLocation();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const { user } = useAuthContext();
  const [showSettings, setShowSettings] = useState(false);
  const [isCertified, setIsCertified] = useState<boolean | null>(null);

  // Test accounts that bypass certification requirements
  const TEST_ACCOUNTS = ['paulanthonyarriola@gmail.com'];
  const isTestAccount = user?.email && TEST_ACCOUNTS.includes(user.email);

  // Check certification status
  useEffect(() => {
    const checkCertification = async () => {
      if (!user?.userId) return;
      
      // Bypass for test accounts
      if (isTestAccount) {
        setIsCertified(true);
        return;
      }
      
      try {
        const [writtenRes, speakingRes] = await Promise.all([
          getExamStatus(user.userId),
          getSpeakingExamStatus(user.userId),
        ]);
        
        const writtenPassed = writtenRes.success && writtenRes.status?.passed === true;
        const speakingPassed = speakingRes.success && speakingRes.status?.passed === true;
        
        setIsCertified(writtenPassed && speakingPassed);
      } catch (err) {
        console.error('Failed to check certification:', err);
        setIsCertified(false);
      }
    };

    checkCertification();
  }, [user?.userId, isTestAccount]);

  // Don't render sidebar if user is not logged in
  if (!user) {
    return null;
  }

  // Filter menu items based on certification
  const visibleMenuItems = menuItems.filter(item => {
    if (item.requiresCertification && isCertified === false) {
      return false;
    }
    return true;
  });

  const handleClick = useCallback(
    (e: JSX.TargetedMouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      setLocation(href);
    },
    [setLocation]
  );

  // Menu items for the static site

  // Apply dark mode class to the root element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  return (
    <div className="sidebar hidden-on-mobile">
      <div className="sidebar-logo mb-25">
        <a href="/home">
          <img src="/assets/img/logo/icon_logo.png" alt="FluentXVerse Logo" />
        </a>
      </div>
      <div className="sidebar-icon">
        <ul>
          {visibleMenuItems.map((item) => (
            <li
              key={item.href}
              className={location === item.href ? "active" : ""}
            >
              <a
                href={item.href}
                onClick={(e) => handleClick(e, item.href)}
              >
                <i className={item.icon}></i>
              </a>
            </li>
          ))}
          
          {/* Settings Button as last menu item */}
          <li className={showSettings ? "active" : ""}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setShowSettings(true);
              }}
              title="Settings"
            >
              <i className="fi-sr-settings"></i>
            </a>
          </li>
        </ul>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      
      <style jsx>{`
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
    </div>
  );
};

export default SideBar;
