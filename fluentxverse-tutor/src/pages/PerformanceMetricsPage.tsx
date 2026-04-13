import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'wouter';
import { useAuthContext } from '../context/AuthContext';
import { useThemeStore } from '../context/ThemeContext';
import { client } from '../api/utils';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import './PerformanceMetricsPage.css';

interface PerformanceData {
  totalSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  noShowSessions: number;
  rating: number;
  totalReviews: number;
  reliabilityScore: number;
}

export const PerformanceMetricsPage = () => {
  const { user } = useAuthContext();
  const isDarkMode = useThemeStore((state) => state.resolvedTheme === 'dark');
  const [location] = useLocation();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'lessons' | 'rating' | 'reliability' | 'formula'>('lessons');
  const [performanceData, setPerformanceData] = useState<PerformanceData>({
    totalSessions: 0,
    completedSessions: 0,
    cancelledSessions: 0,
    noShowSessions: 0,
    rating: 0,
    totalReviews: 0,
    reliabilityScore: 100
  });

  useEffect(() => {
    document.title = 'Performance Metrics | FluentXVerse';
    
    // Check URL hash for initial tab
    const hash = window.location.hash.replace('#', '');
    if (['lessons', 'rating', 'reliability', 'formula'].includes(hash)) {
      setActiveTab(hash as typeof activeTab);
    }
    
    loadPerformanceData();
  }, []);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      const response = await client.get('/tutor/profile');
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        setPerformanceData({
          totalSessions: data.totalSessions || 0,
          completedSessions: data.completedSessions || 0,
          cancelledSessions: data.cancelledSessions || 0,
          noShowSessions: data.noShowSessions || 0,
          rating: data.rating || 0,
          totalReviews: data.totalReviews || 0,
          reliabilityScore: data.reliabilityScore || 100
        });
      }
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, '', `#${tab}`);
  };

  const getPenaltyAppearance = (
    tone: 'critical' | 'high' | 'medium' | 'low-purple' | 'low-violet' | 'low-cyan' | 'critical-dark',
    severity: 'critical' | 'high' | 'medium' | 'low'
  ) => {
    const lightToneMap = {
      critical: {
        background: '#fef2f2',
        border: 'rgba(220, 38, 38, 0.2)',
        codeBg: '#fff5f5',
        code: '#dc2626',
        severityColor: '#dc2626',
        title: '#0f172a',
        body: '#64748b'
      },
      'critical-dark': {
        background: '#fef2f2',
        border: 'rgba(153, 27, 27, 0.2)',
        codeBg: '#fff5f5',
        code: '#991b1b',
        severityColor: '#dc2626',
        title: '#0f172a',
        body: '#64748b'
      },
      high: {
        background: '#fff7ed',
        border: 'rgba(234, 88, 12, 0.2)',
        codeBg: '#fff1e6',
        code: '#ea580c',
        severityColor: '#ea580c',
        title: '#0f172a',
        body: '#64748b'
      },
      medium: {
        background: '#fffbeb',
        border: 'rgba(245, 158, 11, 0.2)',
        codeBg: '#fff7db',
        code: '#f59e0b',
        severityColor: '#f59e0b',
        title: '#0f172a',
        body: '#64748b'
      },
      'low-purple': {
        background: '#eef2ff',
        border: 'rgba(99, 102, 241, 0.2)',
        codeBg: '#e5e7ff',
        code: '#6366f1',
        severityColor: '#6366f1',
        title: '#0f172a',
        body: '#64748b'
      },
      'low-violet': {
        background: '#f5f3ff',
        border: 'rgba(139, 92, 246, 0.2)',
        codeBg: '#efe8ff',
        code: '#8b5cf6',
        severityColor: '#8b5cf6',
        title: '#0f172a',
        body: '#64748b'
      },
      'low-cyan': {
        background: '#ecfeff',
        border: 'rgba(6, 182, 212, 0.2)',
        codeBg: '#ddfbff',
        code: '#06b6d4',
        severityColor: '#06b6d4',
        title: '#0f172a',
        body: '#64748b'
      }
    } as const;

    const darkToneMap = {
      critical: {
        background: 'var(--fxv-surface-muted)',
        border: 'var(--fxv-border)',
        codeBg: 'rgba(255, 255, 255, 0.06)',
        code: '#fca5a5'
      },
      'critical-dark': {
        background: 'var(--fxv-surface-muted)',
        border: 'var(--fxv-border)',
        codeBg: 'rgba(255, 255, 255, 0.06)',
        code: '#fca5a5'
      },
      high: {
        background: 'var(--fxv-surface-muted)',
        border: 'var(--fxv-border)',
        codeBg: 'rgba(255, 255, 255, 0.06)',
        code: '#fdba74'
      },
      medium: {
        background: 'var(--fxv-surface-muted)',
        border: 'var(--fxv-border)',
        codeBg: 'rgba(255, 255, 255, 0.06)',
        code: '#fde68a'
      },
      'low-purple': {
        background: 'var(--fxv-surface-muted)',
        border: 'var(--fxv-border)',
        codeBg: 'rgba(255, 255, 255, 0.06)',
        code: '#c4b5fd'
      },
      'low-violet': {
        background: 'var(--fxv-surface-muted)',
        border: 'var(--fxv-border)',
        codeBg: 'rgba(255, 255, 255, 0.06)',
        code: '#d8b4fe'
      },
      'low-cyan': {
        background: 'var(--fxv-surface-muted)',
        border: 'var(--fxv-border)',
        codeBg: 'rgba(255, 255, 255, 0.06)',
        code: '#67e8f9'
      }
    } as const;

    const severityMap = {
      critical: '#fda4af',
      high: '#fdba74',
      medium: '#fde68a',
      low: '#93c5fd'
    } as const;

    const lightConfig = lightToneMap[tone];
    const darkConfig = darkToneMap[tone];
    const config = isDarkMode ? darkConfig : lightConfig;

    return {
      rowStyle: {
        background: config.background,
        borderColor: config.border,
        boxShadow: isDarkMode ? 'inset 0 1px 0 rgba(255, 255, 255, 0.02)' : undefined
      } as h.JSX.CSSProperties,
      codeStyle: {
        background: config.codeBg,
        color: config.code,
        boxShadow: isDarkMode ? 'inset 0 1px 0 rgba(255, 255, 255, 0.04)' : undefined
      } as h.JSX.CSSProperties,
      severityStyle: {
        color: isDarkMode ? severityMap[severity] : lightConfig.severityColor
      } as h.JSX.CSSProperties,
      titleStyle: {
        color: isDarkMode ? '#f8fafc' : lightConfig.title
      } as h.JSX.CSSProperties,
      bodyStyle: {
        color: isDarkMode ? '#cbd5e1' : lightConfig.body
      } as h.JSX.CSSProperties
    };
  };

  const penaltyReferenceItems = [
    {
      code: 'TA-301',
      severity: 'critical' as const,
      tone: 'critical' as const,
      title: 'Tutor Absence (Booked)',
      description:
        'Tutor failed to attend a booked lesson slot. Includes short-notice cancellations (less than 48 hours), failure to confirm attendance, or technical issues not properly reported.'
    },
    {
      code: 'TA-302',
      severity: 'high' as const,
      tone: 'high' as const,
      title: 'Tutor Absence (Unbooked)',
      description:
        'Tutor failed to attend an unbooked (open) lesson slot or failed to confirm attendance for an open slot.'
    },
    {
      code: 'TA-303',
      severity: 'medium' as const,
      tone: 'medium' as const,
      title: 'Short Notice Cancellation',
      description:
        'Open slot cancelled on short notice (within 48 hours of lesson time). Multiple occurrences may lead to slot restrictions.'
    },
    {
      code: 'SUB-401',
      severity: 'low' as const,
      tone: 'low-purple' as const,
      title: 'Substitution',
      description:
        'Slot temporarily closed for potential substitution. Becomes available again 30 minutes before lesson if no transfer occurs.'
    },
    {
      code: 'SYS-501',
      severity: 'low' as const,
      tone: 'low-violet' as const,
      title: 'System Issue',
      description:
        'Lesson terminated or not conducted due to system or student-side issues. Tutor is compensated.'
    },
    {
      code: 'STU-502',
      severity: 'low' as const,
      tone: 'low-cyan' as const,
      title: 'Student Absent',
      description:
        'Student failed to attend the booked lesson. Tutor is compensated.'
    },
    {
      code: 'BLK-601',
      severity: 'critical' as const,
      tone: 'critical-dark' as const,
      title: 'Penalty Block',
      description:
        'Temporary block on future unbooked slots due to repeated absences (3+ TA-301 codes in 30 days).'
    }
  ];

  if (loading) {
    return (
      <>
        <SideBar />
        <div className="main-content">
          <DashboardHeader />
          <div className="performance-loading">
            <div className="spinner"></div>
            <p>Loading performance data...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SideBar />
      <div className="main-content">
        <DashboardHeader />
        <div className="performance-metrics-page">
          <div className="performance-container">
            {/* Header */}
            <div className="performance-header">
              <a href="/profile" className="back-link">
                <i className="fi-sr-angle-left"></i>
                Back to Profile
              </a>
              <div className="page-title-row">
                <div className="page-title-icon">
                  <i className="fi-sr-chart-histogram"></i>
                </div>
                <h1 className="page-title-gradient">Performance Metrics</h1>
              </div>
              <p className="performance-subtitle">
                Track your teaching performance and understand how your metrics are calculated
              </p>
            </div>

            {/* Summary Cards */}
            <div className="performance-summary">
              <div 
                className={`summary-card ${activeTab === 'lessons' ? 'active' : ''}`}
                onClick={() => handleTabChange('lessons')}
              >
                <div className="summary-icon">
                  <i className="fi-sr-book-alt"></i>
                </div>
                <div className="summary-value">{performanceData.totalSessions}</div>
                <div className="summary-label">Total Lessons</div>
              </div>
              <div 
                className={`summary-card ${activeTab === 'rating' ? 'active' : ''}`}
                onClick={() => handleTabChange('rating')}
              >
                <div className="summary-icon">
                  <i className="fi-sr-star"></i>
                </div>
                <div className="summary-value">{performanceData.rating ? performanceData.rating.toFixed(1) : '-'}</div>
                <div className="summary-label">Average Rating</div>
              </div>
              <div 
                className={`summary-card ${activeTab === 'reliability' ? 'active' : ''}`}
                onClick={() => handleTabChange('reliability')}
              >
                <div className="summary-icon">
                  <i className="fi-sr-shield-check"></i>
                </div>
                <div className="summary-value">{performanceData.reliabilityScore}%</div>
                <div className="summary-label">Reliability</div>
              </div>
              <div 
                className={`summary-card ${activeTab === 'formula' ? 'active' : ''}`}
                onClick={() => handleTabChange('formula')}
              >
                <div className="summary-icon">
                  <i className="fi-sr-calculator"></i>
                </div>
                <div className="summary-value">
                  <i className="fi-sr-interrogation"></i>
                </div>
                <div className="summary-label">How It Works</div>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="performance-tabs">
              <button 
                className={`tab-btn ${activeTab === 'lessons' ? 'active' : ''}`}
                onClick={() => handleTabChange('lessons')}
              >
                <i className="fi-sr-book-alt"></i>
                Lessons
              </button>
              <button 
                className={`tab-btn ${activeTab === 'rating' ? 'active' : ''}`}
                onClick={() => handleTabChange('rating')}
              >
                <i className="fi-sr-star"></i>
                Rating
              </button>
              <button 
                className={`tab-btn ${activeTab === 'reliability' ? 'active' : ''}`}
                onClick={() => handleTabChange('reliability')}
              >
                <i className="fi-sr-shield-check"></i>
                Reliability
              </button>
              <button 
                className={`tab-btn ${activeTab === 'formula' ? 'active' : ''}`}
                onClick={() => handleTabChange('formula')}
              >
                <i className="fi-sr-calculator"></i>
                Formula
              </button>
            </div>

            {/* Tab Content */}
            <div className="performance-content">
              {activeTab === 'lessons' && (
                <div className="tab-content">
                  <div className="content-card">
                    <h2 className="card-title">
                      <i className="fi-sr-book-alt"></i>
                      Lesson Statistics
                    </h2>
                    <div className="lessons-grid">
                      <div className="lesson-stat">
                        <div className="lesson-stat-icon completed">
                          <i className="fi-sr-check"></i>
                        </div>
                        <div className="lesson-stat-info">
                          <span className="lesson-stat-value">{performanceData.completedSessions}</span>
                          <span className="lesson-stat-label">Completed</span>
                        </div>
                      </div>
                      <div className="lesson-stat">
                        <div className="lesson-stat-icon cancelled">
                          <i className="fi-sr-cross-circle"></i>
                        </div>
                        <div className="lesson-stat-info">
                          <span className="lesson-stat-value">{performanceData.cancelledSessions}</span>
                          <span className="lesson-stat-label">Cancelled</span>
                        </div>
                      </div>
                      <div className="lesson-stat">
                        <div className="lesson-stat-icon noshow">
                          <i className="fi-sr-ban"></i>
                        </div>
                        <div className="lesson-stat-info">
                          <span className="lesson-stat-value">{performanceData.noShowSessions}</span>
                          <span className="lesson-stat-label">No-shows</span>
                        </div>
                      </div>
                      <div className="lesson-stat">
                        <div className="lesson-stat-icon total">
                          <i className="fi-sr-list"></i>
                        </div>
                        <div className="lesson-stat-info">
                          <span className="lesson-stat-value">{performanceData.totalSessions}</span>
                          <span className="lesson-stat-label">Total Booked</span>
                        </div>
                      </div>
                    </div>

                    <div className="info-box">
                      <i className="fi-sr-info"></i>
                      <p>Your lesson count includes all sessions that have been booked with you. Completed lessons contribute positively to your reliability score.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'rating' && (
                <div className="tab-content">
                  <div className="content-card">
                    <h2 className="card-title">
                      <i className="fi-sr-star"></i>
                      Rating Breakdown
                    </h2>
                    
                    <div className="rating-overview">
                      <div className="rating-big-display">
                        <span className="rating-number">{performanceData.rating ? performanceData.rating.toFixed(1) : '-'}</span>
                        <div className="rating-stars">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <i 
                              key={star}
                              className={`fi-sr-star ${star <= Math.round(performanceData.rating) ? 'filled' : ''}`}
                            ></i>
                          ))}
                        </div>
                        <span className="rating-count">Based on {performanceData.totalReviews} reviews</span>
                      </div>
                    </div>

                    <div className="rating-breakdown">
                      {[5, 4, 3, 2, 1].map((stars) => (
                        <div key={stars} className="rating-bar-row">
                          <span className="rating-bar-label">{stars} stars</span>
                          <div className="rating-bar-track">
                            <div 
                              className="rating-bar-fill"
                              style={{ width: performanceData.totalReviews > 0 ? '0%' : '0%' }}
                            ></div>
                          </div>
                          <span className="rating-bar-count">0</span>
                        </div>
                      ))}
                    </div>

                    <div className="info-box">
                      <i className="fi-sr-info"></i>
                      <p>Your rating is calculated as the average of all student reviews. Higher ratings increase your visibility to potential students.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'reliability' && (
                <div className="tab-content">
                  <div className="content-card">
                    <h2 className="card-title">
                      <i className="fi-sr-shield-check"></i>
                      Reliability Score
                    </h2>
                    
                    <div className="reliability-display">
                      <div className="reliability-circle">
                        <svg viewBox="0 0 100 100">
                          <circle 
                            className="reliability-bg" 
                            cx="50" cy="50" r="45" 
                            fill="none" 
                            stroke="#e2e8f0" 
                            strokeWidth="8"
                          />
                          <circle 
                            className="reliability-fill" 
                            cx="50" cy="50" r="45" 
                            fill="none" 
                            stroke="#10b981" 
                            strokeWidth="8"
                            strokeDasharray={`${performanceData.reliabilityScore * 2.83} 283`}
                            strokeLinecap="round"
                            transform="rotate(-90 50 50)"
                          />
                        </svg>
                        <div className="reliability-value">
                          <span className="reliability-number">{performanceData.reliabilityScore}%</span>
                          <span className="reliability-label">Reliable</span>
                        </div>
                      </div>
                    </div>

                    <div className="reliability-factors">
                      <h3>Factors Affecting Your Score</h3>
                      <div className="factor-list">
                        <div className="factor-item positive">
                          <i className="fi-sr-check"></i>
                          <span>Completed lessons on time</span>
                        </div>
                        <div className="factor-item negative">
                          <i className="fi-sr-cross-small"></i>
                          <span>Cancelled lessons (within 24h)</span>
                        </div>
                        <div className="factor-item negative">
                          <i className="fi-sr-cross-small"></i>
                          <span>No-show incidents</span>
                        </div>
                        <div className="factor-item positive">
                          <i className="fi-sr-check"></i>
                          <span>Consistent availability</span>
                        </div>
                      </div>
                    </div>

                    <div className="info-box warning">
                      <i className="fi-sr-triangle-warning"></i>
                      <p>A reliability score below 80% may result in reduced visibility in search results. Maintain good attendance to keep your score high!</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'formula' && (
                <div className="tab-content">
                  {/* Reliability Formula Section */}
                  <div className="content-card formula-section">
                    <div className="formula-header">
                      <div className="formula-header-icon">
                        <i className="fi-sr-calculator"></i>
                      </div>
                      <div>
                        <h2 className="card-title" style={{ marginBottom: '4px' }}>Reliability Formula</h2>
                        <p className="formula-header-subtitle">How your reliability score is calculated</p>
                      </div>
                    </div>

                    <div className="formula-display">
                      <div className="formula-equation">
                        <div className="formula-fraction-block">
                          <div className="fraction-numerator">(Booked Slots + Unbooked Slots) − Penalty Points</div>
                          <div className="fraction-line"></div>
                          <div className="fraction-denominator">Booked Slots + Unbooked Slots</div>
                        </div>
                        <span className="formula-operator">×</span>
                        <span className="formula-100">100</span>
                        <span className="formula-operator">=</span>
                        <span className="formula-result">Reliability %</span>
                      </div>
                    </div>

                    <div className="slot-definitions">
                      <h3 className="weights-title">Slot Types</h3>
                      <div className="slot-grid">
                        <div className="slot-item booked">
                          <div className="slot-icon">
                            <i className="fi-sr-book-alt"></i>
                          </div>
                          <div className="slot-info">
                            <span className="slot-label">Booked Slots</span>
                            <span className="slot-desc">Slots with a confirmed student booking</span>
                          </div>
                        </div>
                        <div className="slot-item unbooked">
                          <div className="slot-icon">
                            <i className="fi-sr-calendar"></i>
                          </div>
                          <div className="slot-info">
                            <span className="slot-label">Unbooked Slots</span>
                            <span className="slot-desc">Open slots available for student booking</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="penalty-weights">
                      <h3 className="weights-title">Penalty Point Weights</h3>
                      <div className="weights-grid">
                        <div className="weight-item critical">
                          <span className="weight-code">TA-301</span>
                          <span className="weight-value">−3 pts</span>
                        </div>
                        <div className="weight-item high">
                          <span className="weight-code">TA-302</span>
                          <span className="weight-value">−2 pts</span>
                        </div>
                        <div className="weight-item medium">
                          <span className="weight-code">TA-303</span>
                          <span className="weight-value">−1 pt</span>
                        </div>
                        <div className="weight-item neutral">
                          <span className="weight-code">SUB-401</span>
                          <span className="weight-value">0 pts</span>
                        </div>
                        <div className="weight-item neutral">
                          <span className="weight-code">SYS-501</span>
                          <span className="weight-value">0 pts</span>
                        </div>
                        <div className="weight-item neutral">
                          <span className="weight-code">STU-502</span>
                          <span className="weight-value">0 pts</span>
                        </div>
                      </div>
                    </div>

                    <div className="formula-example">
                      <h3 className="example-title">Example Calculation</h3>
                      <div className="example-box">
                        <p><strong>Scenario:</strong> A tutor has 60 booked slots and 40 unbooked slots this month, with 1× TA-301 and 2× TA-303</p>
                        <div className="example-calc">
                          <span>Total Slots = 60 + 40 = <strong>100 slots</strong></span>
                        </div>
                        <div className="example-calc">
                          <span>Penalty Points = (1 × 3) + (2 × 1) = <strong>5 pts</strong></span>
                        </div>
                        <div className="example-calc">
                          <span>Reliability = (100 − 5) ÷ 100 × 100 = <strong>95%</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Penalty Code Reference Section */}
                  <div className="content-card">
                    <div className="penalty-reference-header">
                      <div className="penalty-header-icon">
                        <i className="fi-sr-info"></i>
                      </div>
                      <div>
                        <h2 className="card-title" style={{ marginBottom: '4px' }}>Penalty Code Reference</h2>
                        <p className="penalty-header-subtitle">Applied to schedule slots for attendance and compliance tracking</p>
                      </div>
                    </div>

                    {penaltyReferenceItems.map((item) => {
                      const appearance = getPenaltyAppearance(item.tone, item.severity);
                      return (
                        <div key={item.code} className={`metric-item ${item.tone}`} style={appearance.rowStyle}>
                          <div className="metric-code">
                            <span className="code-label" style={appearance.codeStyle}>{item.code}</span>
                            <span className={`severity-label ${item.severity}`} style={appearance.severityStyle}>
                              {item.severity.toUpperCase()}
                            </span>
                          </div>
                          <div className="metric-info">
                            <h4 style={appearance.titleStyle}>{item.title}</h4>
                            <p style={appearance.bodyStyle}>{item.description}</p>
                          </div>
                        </div>
                      );
                    })}

                    <div className="info-box">
                      <i className="fi-sr-lightbulb-on"></i>
                      <p>Tip: Maintain good attendance and always confirm your slots on time to avoid penalty codes and keep your reliability score high!</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PerformanceMetricsPage;
