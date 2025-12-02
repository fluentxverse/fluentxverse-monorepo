import { useState, useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import Footer from '../Components/Footer/Footer';
import { useAuthContext } from '../context/AuthContext';
import './HomePage.css';

const HomePage = () => {
  useEffect(() => {
    document.title = 'Home | FluentXVerse';
  }, []);

  const { user } = useAuthContext();

  // Mock data - TODO: fetch from API
  const nextLesson = {
    tutorName: 'Sarah Kim',
    tutorAvatar: 'https://i.pravatar.cc/150?img=5',
    date: new Date(2025, 11, 3, 19, 0), // Dec 3, 2025, 7:00 PM
    time: '7:00 PM',
    lessonId: 'b1'
  };

  const stats = {
    lessonsCompleted: 12,
    upcomingLessons: 2,
    learningStreak: 5, // days
    credits: 450
  };

  const recentActivity = [
    { type: 'lesson', tutor: 'James Park', date: 'Nov 28', action: 'Completed lesson' },
    { type: 'booking', tutor: 'Sarah Kim', date: 'Nov 27', action: 'Booked lesson for Dec 3' },
    { type: 'lesson', tutor: 'James Park', date: 'Nov 25', action: 'Completed lesson' }
  ];

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
                      <div className="home-stat-value">{stats.lessonsCompleted}</div>
                    </div>
                    <div className="home-stat-label">Lessons Completed</div>
                  </div>
                  
                  <div className="home-stat-card green">
                    <div className="home-stat-card-content">
                      <div className="home-stat-icon green">
                        <i className="fas fa-calendar-check"></i>
                      </div>
                      <div className="home-stat-value">{stats.upcomingLessons}</div>
                    </div>
                    <div className="home-stat-label">Upcoming Lessons</div>
                  </div>
                  
                  <div className="home-stat-card orange">
                    <div className="home-stat-card-content">
                      <div className="home-stat-icon orange">
                        <i className="fas fa-fire"></i>
                      </div>
                      <div className="home-stat-value">{stats.learningStreak}</div>
                    </div>
                    <div className="home-stat-label">Day Streak</div>
                  </div>
                  
                  <div className="home-stat-card purple">
                    <div className="home-stat-card-content">
                      <div className="home-stat-icon purple">
                        <i className="fas fa-coins"></i>
                      </div>
                      <div className="home-stat-value">{stats.credits}</div>
                    </div>
                    <div className="home-stat-label">Credits Available</div>
                  </div>
                </div>

                {/* Main Content Grid */}
                <div className="home-content-grid">
                  {/* Next Lesson Card */}
                  <div className="home-card">
                    <div className="home-card-header">
                      <h3 className="home-card-title">
                        <i className="fas fa-calendar-check"></i>
                        Next Lesson
                      </h3>
                      {nextLesson && (
                        <div className="home-badge-time">
                          in {getTimeUntil(nextLesson.date)}
                        </div>
                      )}
                    </div>

                    {nextLesson ? (
                      <div className="home-next-lesson">
                        <div 
                          className={nextLesson.tutorAvatar ? "home-tutor-avatar" : "home-tutor-avatar placeholder"}
                          style={nextLesson.tutorAvatar ? { backgroundImage: `url(${nextLesson.tutorAvatar})` } : undefined}
                        >
                          {!nextLesson.tutorAvatar && (
                            <i className="fas fa-user"></i>
                          )}
                        </div>
                        
                        <div className="home-lesson-info">
                          <div className="home-lesson-tutor">
                            {nextLesson.tutorName}
                          </div>
                          <div className="home-lesson-details">
                            <div className="home-lesson-detail">
                              <i className="fas fa-calendar"></i>
                              <span>{formatDate(nextLesson.date)}</span>
                            </div>
                            <div className="home-lesson-detail">
                              <i className="fas fa-clock"></i>
                              <span>{nextLesson.time}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => window.open(`/lesson/${nextLesson.lessonId}`, '_blank')}
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
                  <div className="home-activity-list">
                    {recentActivity.map((activity, idx) => (
                      <div
                        key={idx}
                        className="home-activity-item"
                      >
                        <div className={`home-activity-icon ${activity.type}`}>
                          <i className={`fas fa-${activity.type === 'lesson' ? 'check-circle' : 'calendar-plus'}`}></i>
                        </div>
                        <div className="home-activity-content">
                          <div className="home-activity-action">
                            {activity.action}
                          </div>
                          <div className="home-activity-tutor">
                            with {activity.tutor}
                          </div>
                        </div>
                        <div className="home-activity-date">
                          {activity.date}
                        </div>
                      </div>
                    ))}
                  </div>
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
