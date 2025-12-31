import { useState, useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { scheduleApi, StudentStats, RecentActivity } from '../api/schedule.api';
import { getTicketBalance, TicketBalance } from '../services/ticket.service';
import { favoritesApi, FavoriteTutor } from '../api/favorites.api';
import './HomePage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8765';

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
  const [activityPage, setActivityPage] = useState(1);
  const [ticketBalance, setTicketBalance] = useState<TicketBalance | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [favoriteTutors, setFavoriteTutors] = useState<FavoriteTutor[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const ACTIVITY_PER_PAGE = 5;

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
        console.log('Fetching recent activity...');
        const data = await scheduleApi.getStudentActivity(50); // Get more items for pagination
        console.log('Recent activity received:', data.length, 'items');
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

  // Fetch ticket balance
  useEffect(() => {
    const fetchTickets = async () => {
      if (!user?.walletAddress) {
        setTicketLoading(false);
        return;
      }
      
      try {
        setTicketLoading(true);
        const balance = await getTicketBalance(user.walletAddress);
        setTicketBalance(balance);
      } catch (err: any) {
        console.error('Failed to fetch ticket balance:', err);
        setTicketBalance(null);
      } finally {
        setTicketLoading(false);
      }
    };

    fetchTickets();
  }, [user?.walletAddress]);

  // Fetch favorite tutors
  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) {
        setFavoritesLoading(false);
        return;
      }
      
      try {
        setFavoritesLoading(true);
        // Fetch first page of favorites (limit 4 for homepage display)
        const result = await favoritesApi.getFavorites(1, 4);
        setFavoriteTutors(result.favorites);
      } catch (err: any) {
        console.error('Failed to fetch favorite tutors:', err);
        setFavoriteTutors([]);
      } finally {
        setFavoritesLoading(false);
      }
    };

    fetchFavorites();
  }, [user]);

  // Parse slot time (12-hour format) and create Date in Philippine time, then convert to Korean time (+1 hour)
  const parseSlotDateTime = (slotDate: string, slotTime: string): Date => {
    // slotTime is in format "6:00 PM" (Philippine time UTC+8)
    const timeMatch = slotTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!timeMatch) {
      console.error('Invalid time format:', slotTime);
      return new Date(); // fallback
    }
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const meridiem = timeMatch[3].toUpperCase();
    
    // Convert to 24-hour format
    if (meridiem === 'PM' && hours !== 12) {
      hours += 12;
    } else if (meridiem === 'AM' && hours === 12) {
      hours = 0;
    }
    
    // Create date in Philippine time
    const phTime = new Date(`${slotDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+08:00`);
    
    // Convert to Korean time (+1 hour from Philippine time)
    const koreanTime = new Date(phTime.getTime() + (60 * 60 * 1000));
    
    return koreanTime;
  };

  // Convert Philippine time string to Korean time display
  const convertToKoreanTime = (slotTime: string): string => {
    // slotTime is in format "6:00 PM" (Philippine time)
    const timeMatch = slotTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!timeMatch) {
      return slotTime; // fallback to original
    }
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const meridiem = timeMatch[3].toUpperCase();
    
    // Convert to 24-hour format
    if (meridiem === 'PM' && hours !== 12) {
      hours += 12;
    } else if (meridiem === 'AM' && hours === 12) {
      hours = 0;
    }
    
    // Add 1 hour for Korean timezone
    hours += 1;
    
    // Handle day rollover
    if (hours >= 24) {
      hours -= 24;
    }
    
    // Convert back to 12-hour format
    const koreanMeridiem = hours >= 12 ? 'PM' : 'AM';
    const koreanHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
    
    return `${koreanHours}:${String(minutes).padStart(2, '0')} ${koreanMeridiem}`;
  };

  const getTimeUntil = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
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
                </div>

                {/* Ticket Balance Section */}
                <div className="home-tickets-section">
                  <div className="home-tickets-header">
                    <h3 className="home-tickets-title">
                      <i className="fas fa-ticket-alt"></i>
                      My Tickets
                    </h3>
                    <a href="/tickets" className="home-tickets-link">
                      Buy More <i className="fas fa-arrow-right"></i>
                    </a>
                  </div>
                  <div className={`home-tickets-grid ${ticketBalance?.trial ? 'has-trial' : ''}`}>
                    <div className="home-ticket-card basic">
                      <div className="home-ticket-icon">
                        <picture>
                          <source srcSet="/assets/img/icons/basic_ticket2.webp" type="image/webp" />
                          <img src="/assets/img/icons/basic_ticket2.png" alt="Basic Ticket" loading="lazy" />
                        </picture>
                      </div>
                      <div className="home-ticket-info">
                        <div className="home-ticket-count">
                          {ticketLoading ? '...' : (ticketBalance?.basic || 0)}
                        </div>
                        <div className="home-ticket-label">Basic</div>
                      </div>
                    </div>
                    <div className="home-ticket-card premium">
                      <div className="home-ticket-icon">
                        <picture>
                          <source srcSet="/assets/img/icons/premium_ticket2.webp" type="image/webp" />
                          <img src="/assets/img/icons/premium_ticket2.png" alt="Premium Ticket" loading="lazy" />
                        </picture>
                      </div>
                      <div className="home-ticket-info">
                        <div className="home-ticket-count">
                          {ticketLoading ? '...' : (ticketBalance?.premium || 0)}
                        </div>
                        <div className="home-ticket-label">Premium</div>
                      </div>
                    </div>
                    {ticketBalance?.trial ? (
                      <div className="home-ticket-card trial">
                        <div className="home-ticket-icon">
                          <picture>
                            <source srcSet="/assets/img/icons/trial_ticket.webp" type="image/webp" />
                            <img src="/assets/img/icons/trial_ticket.png" alt="Trial Ticket" loading="lazy" />
                          </picture>
                        </div>
                        <div className="home-ticket-info">
                          <div className="home-ticket-count">
                            {ticketLoading ? '...' : (ticketBalance?.trial || 0)}
                          </div>
                          <div className="home-ticket-label">Trial</div>
                        </div>
                      </div>
                    ) : null}
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
                              in {getTimeUntil(parseSlotDateTime(stats.nextLesson.slotDate, stats.nextLesson.slotTime))}
                            </div>
                          )}
                        </div>

                        {stats?.nextLesson ? (
                          <>
                            {console.log('Rendering next lesson:', {
                              tutorName: stats.nextLesson.tutorName,
                              tutorAvatar: stats.nextLesson.tutorAvatar,
                              slotDate: stats.nextLesson.slotDate,
                              slotTime: stats.nextLesson.slotTime,
                              bookingId: stats.nextLesson.bookingId
                            })}
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
                                    <span>{formatDate(parseSlotDateTime(stats.nextLesson.slotDate, stats.nextLesson.slotTime))}</span>
                                  </div>
                                  <div className="home-lesson-detail">
                                    <i className="fas fa-clock"></i>
                                    <span>{convertToKoreanTime(stats.nextLesson.slotTime)} KST</span>
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
                          </>
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

                  {/* My Favorite Tutors */}
                  <div className="home-card">
                    <h3 className="home-card-title">
                      <i className="fas fa-star"></i>
                      My Favorite Tutors
                    </h3>
                    {favoritesLoading ? (
                      <div className="home-loading-state">
                        <i className="fas fa-spinner fa-spin"></i>
                        <p>Loading favorites...</p>
                      </div>
                    ) : favoriteTutors.length === 0 ? (
                      <div className="home-empty-state">
                        <div className="home-empty-icon">
                          <i className="fas fa-star"></i>
                        </div>
                        <p className="home-empty-text">
                          No favorite tutors yet
                        </p>
                        <p className="home-empty-subtext">
                          Browse tutors and add them to your favorites
                        </p>
                        <button
                          onClick={() => window.location.href = '/browse-tutors'}
                          className="home-btn-book"
                        >
                          Find a Tutor
                        </button>
                      </div>
                    ) : (
                      <div className="home-tutors-list">
                        {favoriteTutors.slice(0, 4).map((tutor) => (
                          <a 
                            key={tutor.id} 
                            href={`/tutor/${tutor.tutorId}`}
                            className="home-tutor-item"
                          >
                            <div 
                              className={tutor.tutorAvatar ? "home-tutor-avatar small" : "home-tutor-avatar small placeholder"}
                              style={tutor.tutorAvatar ? { backgroundImage: `url(${tutor.tutorAvatar})` } : undefined}
                            >
                              {!tutor.tutorAvatar && <i className="fas fa-user"></i>}
                            </div>
                            <div className="home-tutor-name">{tutor.tutorName}</div>
                          </a>
                        ))}
                        {favoriteTutors.length > 4 && (
                          <a href="/browse-tutors" className="home-tutors-more">
                            +{favoriteTutors.length - 4} more
                          </a>
                        )}
                      </div>
                    )}
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
                    <>
                      <div className="home-activity-list">
                        {recentActivity
                          .slice((activityPage - 1) * ACTIVITY_PER_PAGE, activityPage * ACTIVITY_PER_PAGE)
                          .map((activity, idx) => {
                            // Determine icon class based on activity type and ticket tier
                            const getIconClass = () => {
                              if (activity.type === 'lesson_completed') return 'lesson';
                              if (activity.type === 'lesson_booked') return 'booking';
                              if (activity.type === 'ticket_purchased') {
                                // Use tier-specific colors for purchases
                                if (activity.ticketTier === 'premium') return 'purchase-premium';
                                if (activity.ticketTier === 'trial') return 'purchase-trial';
                                return 'purchase-basic'; // default blue for basic
                              }
                              return 'booking';
                            };
                            
                            return (
                              <div
                                key={idx}
                                className="home-activity-item"
                              >
                                <div className={`home-activity-icon ${getIconClass()}`}>
                                  <i className={`fas fa-${
                                    activity.type === 'lesson_completed' ? 'check-circle' : 
                                    activity.type === 'ticket_purchased' ? 'ticket-alt' : 'calendar-plus'
                                  }`}></i>
                                </div>
                                <div className="home-activity-content">
                                  <div className="home-activity-action">
                                    {activity.action}
                                  </div>
                                  {activity.tutorName && (
                                    <div className="home-activity-tutor">
                                      with {activity.tutorName}
                                    </div>
                                  )}
                                </div>
                                <div className="home-activity-date">
                                  {activity.date}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      {/* Pagination */}
                      {recentActivity.length > ACTIVITY_PER_PAGE && (
                        <div className="home-activity-pagination">
                          <button
                            className="home-activity-page-btn"
                            onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                            disabled={activityPage === 1}
                          >
                            <i className="fas fa-chevron-left"></i>
                          </button>
                          <span className="home-activity-page-info">
                            {activityPage} / {Math.ceil(recentActivity.length / ACTIVITY_PER_PAGE)}
                          </span>
                          <button
                            className="home-activity-page-btn"
                            onClick={() => setActivityPage(p => Math.min(Math.ceil(recentActivity.length / ACTIVITY_PER_PAGE), p + 1))}
                            disabled={activityPage >= Math.ceil(recentActivity.length / ACTIVITY_PER_PAGE)}
                          >
                            <i className="fas fa-chevron-right"></i>
                          </button>
                        </div>
                      )}
                    </>
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
      </div>
    </>
  );
};

export default HomePage;
