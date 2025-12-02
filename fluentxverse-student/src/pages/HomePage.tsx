import { useState, useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import Footer from '../Components/Footer/Footer';
import { useAuthContext } from '../context/AuthContext';

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
        <main style={{ padding: '40px 0', background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)', minHeight: '100vh' }}>
          <div className="container">
            {user ? (
              /* Logged-in: Dashboard View */
              <>
                {/* Welcome Header */}
                <div style={{ marginBottom: '32px' }}>
                  <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                    Welcome back, {user.givenName || user.familyName || 'Student'}! 👋
                  </h1>
                  <p style={{ marginTop: '8px', color: '#64748b', fontSize: '15px' }}>
                    Here's what's happening with your learning today
                  </p>
                </div>

                {/* Stats Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                    padding: '20px',
                    borderRadius: '16px',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(2, 69, 174, 0.3)'
                  }}>
                    <div style={{ fontSize: '32px', fontWeight: 900, marginBottom: '4px' }}>{stats.lessonsCompleted}</div>
                    <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: 600 }}>Lessons Completed</div>
                  </div>
                  
                  <div style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    padding: '20px',
                    borderRadius: '16px',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                  }}>
                    <div style={{ fontSize: '32px', fontWeight: 900, marginBottom: '4px' }}>{stats.upcomingLessons}</div>
                    <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: 600 }}>Upcoming Lessons</div>
                  </div>
                  
                  <div style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    padding: '20px',
                    borderRadius: '16px',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '32px', fontWeight: 900 }}>{stats.learningStreak}</span>
                      <i className="fas fa-fire" style={{ fontSize: '24px' }}></i>
                    </div>
                    <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: 600 }}>Day Streak</div>
                  </div>
                  
                  <div style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    padding: '20px',
                    borderRadius: '16px',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                  }}>
                    <div style={{ fontSize: '32px', fontWeight: 900, marginBottom: '4px' }}>{stats.credits}</div>
                    <div style={{ fontSize: '13px', opacity: 0.9, fontWeight: 600 }}>Credits Available</div>
                  </div>
                </div>

                {/* Main Content Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
                  {/* Next Lesson Card */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '20px',
                    padding: '28px',
                    boxShadow: '0 8px 32px rgba(2, 69, 174, 0.12)',
                    border: '1px solid rgba(2, 69, 174, 0.08)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                        <i className="fas fa-calendar-check" style={{ marginRight: '10px', color: '#0245ae' }}></i>
                        Next Lesson
                      </h3>
                      {nextLesson && (
                        <div style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#fff',
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 700
                        }}>
                          in {getTimeUntil(nextLesson.date)}
                        </div>
                      )}
                    </div>

                    {nextLesson ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '16px',
                          background: nextLesson.tutorAvatar ? `url(${nextLesson.tutorAvatar})` : 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          boxShadow: '0 4px 12px rgba(2, 69, 174, 0.2)',
                          flexShrink: 0
                        }}>
                          {!nextLesson.tutorAvatar && (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <i className="fas fa-user" style={{ color: '#fff', fontSize: '32px' }}></i>
                            </div>
                          )}
                        </div>
                        
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                            {nextLesson.tutorName}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
                              <i className="fas fa-calendar" style={{ color: '#0245ae', width: '16px' }}></i>
                              <span>{formatDate(nextLesson.date)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
                              <i className="fas fa-clock" style={{ color: '#0245ae', width: '16px' }}></i>
                              <span>{nextLesson.time}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => window.open(`/lesson/${nextLesson.lessonId}`, '_blank')}
                          style={{
                            background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                            color: '#fff',
                            border: 'none',
                            padding: '16px 24px',
                            borderRadius: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(2, 69, 174, 0.3)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '14px',
                            transition: 'all 0.2s ease',
                            flexShrink: 0
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(2, 69, 174, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 69, 174, 0.3)';
                          }}
                        >
                          <i className="fas fa-video" style={{ fontSize: '20px' }}></i>
                          <span>Join Now</span>
                        </button>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '12px',
                          background: 'rgba(2, 69, 174, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 16px'
                        }}>
                          <i className="fas fa-calendar-plus" style={{ color: '#0245ae', fontSize: '24px' }}></i>
                        </div>
                        <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '14px' }}>
                          No upcoming lessons scheduled
                        </p>
                        <button
                          onClick={() => window.location.href = '/browse-tutors'}
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '13px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          Book a Lesson
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '20px',
                    padding: '28px',
                    boxShadow: '0 8px 32px rgba(2, 69, 174, 0.12)',
                    border: '1px solid rgba(2, 69, 174, 0.08)'
                  }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      Quick Actions
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button
                        onClick={() => window.location.href = '/browse-tutors'}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#fff',
                          border: 'none',
                          padding: '16px 20px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <i className="fas fa-search" style={{ fontSize: '18px' }}></i>
                        <span>Browse Tutors</span>
                      </button>

                      <button
                        onClick={() => window.location.href = '/schedule'}
                        style={{
                          background: '#fff',
                          color: '#0245ae',
                          border: '2px solid rgba(2, 69, 174, 0.1)',
                          padding: '16px 20px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateX(4px)';
                          e.currentTarget.style.borderColor = 'rgba(2, 69, 174, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.borderColor = 'rgba(2, 69, 174, 0.1)';
                        }}
                      >
                        <i className="fas fa-calendar-check" style={{ fontSize: '18px' }}></i>
                        <span>My Schedule</span>
                      </button>

                      <button
                        onClick={() => window.location.href = '/dashboard'}
                        style={{
                          background: '#fff',
                          color: '#0245ae',
                          border: '2px solid rgba(2, 69, 174, 0.1)',
                          padding: '16px 20px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateX(4px)';
                          e.currentTarget.style.borderColor = 'rgba(2, 69, 174, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.borderColor = 'rgba(2, 69, 174, 0.1)';
                        }}
                      >
                        <i className="fas fa-chart-line" style={{ fontSize: '18px' }}></i>
                        <span>Dashboard</span>
                      </button>

                      <button
                        onClick={() => window.location.href = '/settings'}
                        style={{
                          background: '#fff',
                          color: '#64748b',
                          border: '2px solid rgba(100, 116, 139, 0.1)',
                          padding: '16px 20px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateX(4px)';
                          e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.1)';
                        }}
                      >
                        <i className="fas fa-cog" style={{ fontSize: '18px' }}></i>
                        <span>Settings</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '20px',
                  padding: '28px',
                  boxShadow: '0 8px 32px rgba(2, 69, 174, 0.12)',
                  border: '1px solid rgba(2, 69, 174, 0.08)'
                }}>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                    <i className="fas fa-history" style={{ marginRight: '10px', color: '#0245ae' }}></i>
                    Recent Activity
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {recentActivity.map((activity, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px',
                          background: 'rgba(248, 250, 252, 0.8)',
                          borderRadius: '12px',
                          border: '1px solid rgba(2, 69, 174, 0.04)'
                        }}
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: activity.type === 'lesson' 
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                            : 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          flexShrink: 0
                        }}>
                          <i className={`fas fa-${activity.type === 'lesson' ? 'check-circle' : 'calendar-plus'}`} style={{ fontSize: '16px' }}></i>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                            {activity.action}
                          </div>
                          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                            with {activity.tutor}
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>
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
                <div style={{ display: 'flex', gap: '36px', alignItems: 'center', marginBottom: '48px' }}>
                  <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, fontSize: '42px', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                      Learn English with Expert Tutors
                    </h1>
                    <p style={{ marginTop: '16px', color: '#64748b', fontSize: '17px', lineHeight: 1.6, maxWidth: '600px' }}>
                      Personalized lessons for Korean students. Improve your conversation skills, ace your exams, and gain confidence speaking English.
                    </p>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
                      <button
                        onClick={() => window.location.href = '/register'}
                        style={{
                          background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                          color: '#fff',
                          border: 'none',
                          padding: '16px 32px',
                          borderRadius: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          fontSize: '15px',
                          boxShadow: '0 4px 16px rgba(2, 69, 174, 0.3)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 69, 174, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 16px rgba(2, 69, 174, 0.3)';
                        }}
                      >
                        Start Free Trial
                      </button>
                      <button
                        onClick={() => window.location.href = '/browse-tutors'}
                        style={{
                          background: '#fff',
                          color: '#0245ae',
                          border: '2px solid rgba(2, 69, 174, 0.1)',
                          padding: '16px 32px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '15px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(2, 69, 174, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(2, 69, 174, 0.1)';
                        }}
                      >
                        Browse Tutors
                      </button>
                    </div>
                  </div>

                  <div style={{ width: '460px', flexShrink: 0 }}>
                    <div style={{ borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 60px rgba(2, 69, 174, 0.2)' }}>
                      <img 
                        src="/assets/img/banner/banner_woman_register.png" 
                        alt="Happy student learning English" 
                        style={{ width: '100%', display: 'block', objectFit: 'cover' }} 
                      />
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                  {[
                    { icon: 'comments', title: 'Real Conversation Practice', desc: 'Focus on speaking naturally and building confidence' },
                    { icon: 'user-graduate', title: 'Expert Native Tutors', desc: 'Learn from experienced teachers who understand Korean learners' },
                    { icon: 'clock', title: 'Flexible Scheduling', desc: 'Book lessons that fit your school and family schedule' }
                  ].map((f, i) => (
                    <div key={i} style={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      padding: '24px',
                      borderRadius: '16px',
                      border: '1px solid rgba(2, 69, 174, 0.06)',
                      textAlign: 'center',
                      transition: 'all 0.2s ease'
                    }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        boxShadow: '0 4px 12px rgba(2, 69, 174, 0.2)'
                      }}>
                        <i className={`fas fa-${f.icon}`} style={{ color: '#fff', fontSize: '24px' }}></i>
                      </div>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{f.title}</h4>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '14px', lineHeight: 1.5 }}>{f.desc}</p>
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
