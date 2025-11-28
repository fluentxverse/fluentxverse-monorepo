import { useCallback } from 'preact/hooks';
import { useLocation } from 'wouter';
import { useThemeStore } from '../../context/ThemeContext';

const NotFound = () => {
  const [_, setLocation] = useLocation();
  const { isDarkMode } = useThemeStore();

  const handleGoHome = useCallback((e: Event) => {
    e.preventDefault();
    setLocation('/');
    window.location.reload();
  }, [setLocation]);

  const handleGoBack = useCallback(() => {
    window.history.back();
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: isDarkMode 
        ? 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)'
        : 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background elements */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '10%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(2, 69, 174, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        animation: 'float 6s ease-in-out infinite'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '15%',
        right: '15%',
        width: '250px',
        height: '250px',
        background: 'radial-gradient(circle, rgba(74, 158, 255, 0.15) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        animation: 'float 8s ease-in-out infinite reverse'
      }}></div>

      <div style={{
        maxWidth: '700px',
        width: '100%',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Logo */}
        <div style={{
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: isDarkMode
              ? 'rgba(255, 255, 255, 0.05)'
              : 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxShadow: isDarkMode
              ? '0 8px 32px rgba(0, 0, 0, 0.3)'
              : '0 8px 32px rgba(2, 69, 174, 0.1)',
            border: isDarkMode
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(2, 69, 174, 0.1)'
          }}>
            <img 
              src="/assets/img/logo/icon_logo.png" 
              alt="FluentXVerse Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        </div>

        {/* 404 with animated gradient */}
        <div style={{
          fontSize: '120px',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 50%, #0245ae 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          backgroundSize: '200% auto',
          animation: 'shimmer 3s linear infinite',
          marginBottom: '24px',
          lineHeight: 1,
          letterSpacing: '-4px'
        }}>
          404
        </div>

        {/* Main card */}
        <div style={{
          background: isDarkMode
            ? 'rgba(255, 255, 255, 0.05)'
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '24px',
          padding: '48px 40px',
          boxShadow: isDarkMode
            ? '0 8px 32px rgba(0, 0, 0, 0.3)'
            : '0 8px 32px rgba(2, 69, 174, 0.12)',
          border: isDarkMode
            ? '1px solid rgba(255, 255, 255, 0.1)'
            : '1px solid rgba(2, 69, 174, 0.08)',
          marginBottom: '32px'
        }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 800,
            color: isDarkMode ? '#fff' : '#0f172a',
            marginBottom: '16px',
            letterSpacing: '0.5px'
          }}>
            Page Not Found
          </h1>
          
          <p style={{
            fontSize: '16px',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : '#64748b',
            lineHeight: '1.6',
            marginBottom: '32px',
            maxWidth: '500px',
            margin: '0 auto 32px'
          }}>
            The page you're looking for doesn't exist or has been moved. Let's get you back on track!
          </p>

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button 
              onClick={handleGoBack}
              style={{
                background: isDarkMode
                  ? 'rgba(255, 255, 255, 0.1)'
                  : '#e2e8f0',
                color: isDarkMode ? '#fff' : '#0f172a',
                border: 'none',
                padding: '14px 32px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
              }}
            >
              <i className="fas fa-arrow-left"></i>
              Go Back
            </button>

            <button 
              onClick={handleGoHome}
              style={{
                background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                color: '#fff',
                border: 'none',
                padding: '14px 32px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 20px rgba(2, 69, 174, 0.4)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(2, 69, 174, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(2, 69, 174, 0.4)';
              }}
            >
              <i className="fas fa-home"></i>
              Return Home
            </button>
          </div>
        </div>

        {/* Helpful links */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          flexWrap: 'wrap'
        }}>
          {[
            { label: 'About', icon: 'info-circle', href: '/about' },
            { label: 'Contact', icon: 'envelope', href: '/contact' },
            { label: 'Login', icon: 'sign-in-alt', href: '/login' }
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => {
                e.preventDefault();
                setLocation(link.href);
              }}
              style={{
                color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : '#64748b',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'color 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#0245ae';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : '#64748b';
              }}
            >
              <i className={`fas fa-${link.icon}`}></i>
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(20px, 20px);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: 0% center;
          }
          100% {
            background-position: 200% center;
          }
        }

        @media (max-width: 768px) {
          div[style*="fontSize: '120px'"] {
            font-size: 80px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default NotFound;
