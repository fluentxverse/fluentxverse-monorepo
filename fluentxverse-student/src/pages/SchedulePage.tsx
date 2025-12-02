import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';

interface Booking {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorAvatar?: string;
  date: Date;
  time: string;
  duration: number; // in minutes
  status: 'upcoming' | 'completed' | 'cancelled';
}

const SchedulePage = () => {
  useEffect(() => {
    document.title = 'Schedule | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  
  // Student bookings - TODO: fetch from API
  const [bookings, setBookings] = useState<Booking[]>([
    {
      id: 'b1',
      tutorId: 't001',
      tutorName: 'Sarah Kim',
      tutorAvatar: 'https://i.pravatar.cc/150?img=5',
      date: new Date(2025, 11, 3, 19, 0), // Dec 3, 2025, 7:00 PM
      time: '7:00 PM',
      duration: 30,
      status: 'upcoming'
    },
    {
      id: 'b2',
      tutorId: 't002',
      tutorName: 'James Park',
      tutorAvatar: 'https://i.pravatar.cc/150?img=12',
      date: new Date(2025, 11, 5, 20, 30), // Dec 5, 2025, 8:30 PM
      time: '8:30 PM',
      duration: 30,
      status: 'upcoming'
    }
  ]);

  // Filter and sort upcoming lessons
  const upcomingLessons = bookings
    .filter(b => b.status === 'upcoming' && new Date(b.date) > new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const formatLessonDate = (date: Date) => {
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
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }
  };

  const getTimeUntil = (date: Date) => {
    const now = new Date();
    const diff = new Date(date).getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours < 1) {
      return `in ${minutes} minutes`;
    } else if (hours < 24) {
      return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(hours / 24);
      return `in ${days} day${days > 1 ? 's' : ''}`;
    }
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <main style={{ padding: '40px 0', background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)', minHeight: '100vh' }}>
          <div className="container">
            {/* Header Section */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '32px',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(2, 69, 174, 0.3)'
                }}>
                  <i className="fas fa-calendar-check" style={{ color: '#fff', fontSize: '22px' }}></i>
                </div>
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '32px', 
                  fontWeight: 800, 
                  background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '0.5px'
                }}>
                  My Lessons
                </h2>
              </div>

              <button 
                onClick={() => window.location.href = '/browse-tutors'}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  letterSpacing: '0.5px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                }}
              >
                <i className="fas fa-plus-circle"></i>
                Book a Lesson
              </button>
            </div>

            {/* Lessons List */}
            {upcomingLessons.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {upcomingLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '16px',
                      padding: '24px',
                      boxShadow: '0 4px 20px rgba(2, 69, 174, 0.08)',
                      border: '1px solid rgba(2, 69, 174, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      flexWrap: 'wrap',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 6px 24px rgba(2, 69, 174, 0.12)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(2, 69, 174, 0.08)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Tutor Avatar */}
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '12px',
                      background: lesson.tutorAvatar ? `url(${lesson.tutorAvatar})` : 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(2, 69, 174, 0.2)',
                      flexShrink: 0
                    }}>
                      {!lesson.tutorAvatar && (
                        <i className="fas fa-user" style={{ color: '#fff', fontSize: '24px' }}></i>
                      )}
                    </div>

                    {/* Lesson Info */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <h3 style={{ 
                        margin: '0 0 8px 0', 
                        fontSize: '18px', 
                        fontWeight: 800, 
                        color: '#0f172a'
                      }}>
                        {lesson.tutorName}
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
                          <i className="fas fa-calendar" style={{ color: '#0245ae' }}></i>
                          <span>{formatLessonDate(lesson.date)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
                          <i className="fas fa-clock" style={{ color: '#0245ae' }}></i>
                          <span>{lesson.time} ({lesson.duration} min)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '13px', fontWeight: 700 }}>
                          <i className="fas fa-hourglass-half"></i>
                          <span>{getTimeUntil(lesson.date)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => window.open(`/lesson/${lesson.id}`, '_blank')}
                      style={{
                        background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                        color: '#fff',
                        border: 'none',
                        padding: '14px 28px',
                        borderRadius: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(2, 69, 174, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        letterSpacing: '0.5px',
                        transition: 'all 0.2s ease',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(2, 69, 174, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 69, 174, 0.3)';
                      }}
                    >
                      <i className="fas fa-video"></i>
                      Join Lesson
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              /* Empty State */
              <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '24px',
                padding: '60px 40px',
                textAlign: 'center',
                boxShadow: '0 8px 32px rgba(2, 69, 174, 0.08)',
                border: '1px solid rgba(2, 69, 174, 0.06)'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '20px',
                  background: 'rgba(2, 69, 174, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}>
                  <i className="fas fa-calendar-plus" style={{ color: '#0245ae', fontSize: '36px' }}></i>
                </div>
                <h3 style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: '24px', 
                  fontWeight: 800, 
                  color: '#0f172a'
                }}>
                  No Upcoming Lessons
                </h3>
                <p style={{ 
                  margin: '0 0 32px 0', 
                  fontSize: '15px', 
                  color: '#64748b', 
                  lineHeight: '1.6',
                  maxWidth: '400px',
                  marginLeft: 'auto',
                  marginRight: 'auto'
                }}>
                  Ready to start learning? Browse our tutors and book your first lesson today!
                </p>
                <button
                  onClick={() => window.location.href = '/browse-tutors'}
                  style={{
                    background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '16px 32px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(2, 69, 174, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '15px',
                    letterSpacing: '0.5px',
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
                  <i className="fas fa-search"></i>
                  Browse Tutors
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default SchedulePage;
