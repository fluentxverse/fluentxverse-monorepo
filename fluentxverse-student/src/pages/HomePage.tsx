import { useState, useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import Footer from '../Components/Footer/Footer';
import { useAuthContext } from '../context/AuthContext';
import { scheduleApi, StudentStats, RecentActivity } from '../api/schedule.api';
import './HomePage.css';

const HomePage = () => {
  useEffect(() => {
    document.title = 'Home | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Fetch student stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const data = await scheduleApi.getStudentStats();
        setStats(data);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch student stats:', err);
        setError(err.message || 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  // Fetch recent activity
  useEffect(() => {
    const fetchActivity = async () => {
      if (!user) {
        setActivityLoading(false);
        return;
      }
      
      try {
        setActivityLoading(true);
        const data = await scheduleApi.getStudentActivity(10);
        setRecentActivity(data);
      } catch (err: any) {
        console.error('Failed to fetch recent activity:', err);
        setRecentActivity([]);
      } finally {
        setActivityLoading(false);
      }
    };

    fetchActivity();
  }, [user]);

  const getTimeUntil = (date: Date) => {
    const now = new Date();
    const diff = new Date(date).getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours < 1) {
      return `${minutes} minutes`;
    } else if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''}`;
    }
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    
    if (dateOnly.getTime() === todayOnly.getTime()) {
      return 'Today';
    } else if (dateOnly.getTime() === tomorrowOnly.getTime()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <main className="home-page-main">
          <div className="container">
            {user ? (
              /* Logged-in: Dashboard View */
              <>
                {/* Welcome Header */}
                <div className="home-welcome-header">
                  <h1 className="home-welcome-title">
                    Welcome back, {user.givenName || user.familyName || 'Student'}! 👋
                  </h1>
                  <p className="home-welcome-subtitle">
                    Here's what's happening with your learning today
                  </p>
                </div>

                {/* Stats Cards */}
                <div className="home-stats-grid">
                  <div className="home-stat-card blue">
                    <div className="home-stat-card-content">
                      <div className="home-stat-icon blue">
                        <i className="fas fa-book-open"></i>
                      </div>
                      <div className="home-stat-value">
                        {loading ? '...' : (stats?.lessonsCompleted || 0)}
                      </div>
                    </div>
                    <div className="home-stat-label">Lessons Completed</div>
                  </div>
                  
                  <div className="home-stat-card green">
                    <div className="home-stat-card-content">
                      <div className="home-stat-icon green">
                        <i className="fas fa-calendar-check"></i>
                      </div>
                      <div className="home-stat-value">
                        {loading ? '...' : (stats?.upcomingLessons || 0)}
                      </div>
                    </div>
                    <div className="home-stat-label">Upcoming Lessons</div>
                  </div>
                  
                  <div className="home-stat-card orange">
                    <div className="home-stat-card-content">
                      <div className="home-stat-icon orange">
                        <i className="fas fa-clock"></i>
                      </div>
                      <div className="home-stat-value">
                        {loading ? '...' : (stats?.totalHours || 0)}
                      </div>
                    </div>
                    <div className="home-stat-label">Total Hours</div>
                  </div>
                  
                  <div className="home-stat-card purple">
                    <div className="home-stat-card-content">
                      <div className="home-stat-icon purple">
                        <i className="fas fa-coins"></i>
                      </div>
                      <div className="home-stat-value">
                        {loading ? '...' : 0}
                      </div>
                    </div>
                    <div className="home-stat-label">Credits Available</div>
                  </div>
                </div>

                {/* Main Content Grid */}
                <div className="home-content-grid">
                  {/* Next Lesson Card */}
                  <div className="home-card">
                    {loading ? (
                      <div className="home-loading-state">
                        <i className="fas fa-spinner fa-spin"></i>
                        <p>Loading your schedule...</p>
                      </div>
                    ) : error ? (
                      <div className="home-error-state">
                        <i className="fas fa-exclamation-circle"></i>
                        <p>{error}</p>
                      </div>
                    ) : (
                      <>
                        <div className="home-card-header">
                          <h3 className="home-card-title">
                            <i className="fas fa-calendar-check"></i>
                            Next Lesson
                          </h3>
                          {stats?.nextLesson && (
                            <div className="home-badge-time">
                              in {getTimeUntil(new Date(`${stats.nextLesson.slotDate}T${stats.nextLesson.slotTime}`))}
                            </div>
                          )}
                        </div>

                        {stats?.nextLesson ? (
                          <div className="home-next-lesson">
                            <div 
                              className={stats.nextLesson.tutorAvatar ? "home-tutor-avatar" : "home-tutor-avatar placeholder"}
                              style={stats.nextLesson.tutorAvatar ? { backgroundImage: `url(${stats.nextLesson.tutorAvatar})` } : undefined}
                            >
                              {!stats.nextLesson.tutorAvatar && (
                                <i className="fas fa-user"></i>
                              )}
                            </div>
                            
                            <div className="home-lesson-info">
                              <div className="home-lesson-tutor">
                                {stats.nextLesson.tutorName}
                              </div>
                              <div className="home-lesson-details">
                                <div className="home-lesson-detail">
                                  <i className="fas fa-calendar"></i>
                                  <span>{formatDate(new Date(stats.nextLesson.slotDate))}</span>
                                </div>
                                <div className="home-lesson-detail">
                                  <i className="fas fa-clock"></i>
                                  <span>{stats.nextLesson.slotTime}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => window.open(`/lesson/${stats.nextLesson!.bookingId}`, '_blank')}
                              className="home-btn-join"
                            >
                              <i className="fas fa-video"></i>
                              <span>Join Now</span>
                            </button>
                          </div>
                        ) : (
                          <div className="home-empty-state">
                            <div className="home-empty-icon">
                              <i className="fas fa-calendar-plus"></i>
                            </div>
                            <p className="home-empty-text">
                              No upcoming lessons scheduled
                            </p>
                            <button
                              onClick={() => window.location.href = '/browse-tutors'}
                              className="home-btn-book"
                            >
                              Book a Lesson
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="home-card">
                    <h3 className="home-card-title">
                      Quick Actions
                    </h3>
                    <div className="home-actions-list">
                      <button
                        onClick={() => window.location.href = '/browse-tutors'}
                        className="home-action-btn primary"
                      >
                        <i className="fas fa-search"></i>
                        <span>Browse Tutors</span>
                      </button>

                      <button
                        onClick={() => window.location.href = '/schedule'}
                        className="home-action-btn secondary"
                      >
                        <i className="fas fa-calendar-check"></i>
                        <span>My Schedule</span>
                      </button>

                      <button
                        onClick={() => window.location.href = '/dashboard'}
                        className="home-action-btn secondary"
                      >
                        <i className="fas fa-chart-line"></i>
                        <span>Dashboard</span>
                      </button>

                      <button
                        onClick={() => window.location.href = '/settings'}
                        className="home-action-btn tertiary"
                      >
                        <i className="fas fa-cog"></i>
                        <span>Settings</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="home-card">
                  <h3 className="home-card-title">
                    <i className="fas fa-history"></i>
                    Recent Activity
                  </h3>
                  {activityLoading ? (
                    <div className="home-loading-state">
                      <i className="fas fa-spinner fa-spin"></i>
                      <p>Loading activity...</p>
                    </div>
                  ) : recentActivity.length === 0 ? (
                    <div className="home-empty-state">
                      <div className="home-empty-icon">
                        <i className="fas fa-history"></i>
                      </div>
                      <p className="home-empty-text">
                        No recent activity yet
                      </p>
                      <button
                        onClick={() => window.location.href = '/browse-tutors'}
                        className="home-btn-book"
                      >
                        Book Your First Lesson
                      </button>
                    </div>
                  ) : (
                    <div className="home-activity-list">
                      {recentActivity.map((activity, idx) => (
                        <div
                          key={idx}
                          className="home-activity-item"
                        >
                          <div className={`home-activity-icon ${activity.type === 'lesson_completed' ? 'lesson' : 'booking'}`}>
                            <i className={`fas fa-${activity.type === 'lesson_completed' ? 'check-circle' : 'calendar-plus'}`}></i>
                          </div>
                          <div className="home-activity-content">
                            <div className="home-activity-action">
                              {activity.action}
                            </div>
                            <div className="home-activity-tutor">
                              with {activity.tutorName}
                            </div>
                          </div>
                          <div className="home-activity-date">
                            {activity.date}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Not logged in: Simple Landing */
              <>
                <div className="home-hero">
                  <div className="home-hero-content">
                    <h1 className="home-hero-title">
                      Learn English with Expert Tutors
                    </h1>
                    <p className="home-hero-description">
                      Personalized lessons for Korean students. Improve your conversation skills, ace your exams, and gain confidence speaking English.
                    </p>

                    <div className="home-hero-buttons">
                      <button
                        onClick={() => window.location.href = '/register'}
                        className="home-btn-cta"
                      >
                        Start Free Trial
                      </button>
                      <button
                        onClick={() => window.location.href = '/browse-tutors'}
                        className="home-btn-secondary"
                      >
                        Browse Tutors
                      </button>
                    </div>
                  </div>

                  <div className="home-hero-image">
                    <div className="home-hero-image-wrapper">
                      <img 
                        src="/assets/img/banner/banner_woman_register.png" 
                        alt="Happy student learning English" 
                      />
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="home-features-grid">
                  {[
                    { icon: 'comments', title: 'Real Conversation Practice', desc: 'Focus on speaking naturally and building confidence' },
                    { icon: 'user-graduate', title: 'Expert Native Tutors', desc: 'Learn from experienced teachers who understand Korean learners' },
                    { icon: 'clock', title: 'Flexible Scheduling', desc: 'Book lessons that fit your school and family schedule' }
                  ].map((f, i) => (
                    <div key={i} className="home-feature-card">
                      <div className="home-feature-icon">
                        <i className={`fas fa-${f.icon}`}></i>
                      </div>
                      <h4 className="home-feature-title">{f.title}</h4>
                      <p className="home-feature-description">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default HomePage;
