import { useState, useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { scheduleApi, StudentStats, RecentActivity } from '../api/schedule.api';
import { getTicketBalance, TicketBalance } from '../services/ticket.service';
import { favoritesApi, FavoriteTutor } from '../api/favorites.api';
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
        const data = await scheduleApi.getStudentActivity(50); // Get more items for pagination
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

  // Parse slot time (12-hour or 24-hour format) and convert to KST for accurate countdown
  // Parse slot time and return the actual moment in time (for comparisons)
  // Slot times are stored in PHT (UTC+8) - the Date object handles timezone conversion internally
  const parseSlotDateTime = (slotDate: string, slotTime: string): Date => {
    let hours: number;
    let minutes: number;
    
    // Try 12-hour format first (e.g., "6:00 PM")
    const time12Match = slotTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (time12Match) {
      hours = parseInt(time12Match[1]);
      minutes = parseInt(time12Match[2]);
      const meridiem = time12Match[3].toUpperCase();
      
      // Convert to 24-hour format
      if (meridiem === 'PM' && hours !== 12) {
        hours += 12;
      } else if (meridiem === 'AM' && hours === 12) {
        hours = 0;
      }
    } else {
      // Try 24-hour format (e.g., "23:30")
      const time24Match = slotTime.match(/^(\d{1,2}):(\d{2})$/);
      if (time24Match) {
        hours = parseInt(time24Match[1]);
        minutes = parseInt(time24Match[2]);
      } else {
        console.error('Invalid time format:', slotTime);
        return new Date(); // fallback
      }
    }
    
    // Create date in PHT (UTC+8) - JavaScript Date stores UTC internally
    // so comparisons will work correctly regardless of user's timezone
    return new Date(`${slotDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+08:00`);
  };

  // Convert Philippine time string to Korean time display
  const convertToKoreanTime = (slotTime: string): string => {
    let hours: number;
    let minutes: number;
    
    // Try 12-hour format first (e.g., "6:00 PM")
    const time12Match = slotTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (time12Match) {
      hours = parseInt(time12Match[1]);
      minutes = parseInt(time12Match[2]);
      const meridiem = time12Match[3].toUpperCase();
      
      // Convert to 24-hour format
      if (meridiem === 'PM' && hours !== 12) {
        hours += 12;
      } else if (meridiem === 'AM' && hours === 12) {
        hours = 0;
      }
    } else {
      // Try 24-hour format (e.g., "23:30")
      const time24Match = slotTime.match(/^(\d{1,2}):(\d{2})$/);
      if (time24Match) {
        hours = parseInt(time24Match[1]);
        minutes = parseInt(time24Match[2]);
      } else {
        return slotTime; // fallback to original
      }
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

  const LESSON_DURATION_MS = 25 * 60 * 1000; // 25 minutes
  
  // Helper to check if a lesson is ongoing
  const isLessonOngoing = (date: Date): boolean => {
    const now = new Date();
    const lessonEnd = new Date(date.getTime() + LESSON_DURATION_MS);
    return now >= date && now < lessonEnd;
  };
  
  const getTimeUntil = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    // If lesson has started, check if it's still ongoing
    if (diff < 0) {
      const lessonEnd = new Date(date.getTime() + LESSON_DURATION_MS);
      const timeLeft = lessonEnd.getTime() - now.getTime();
      if (timeLeft > 0) {
        const minsLeft = Math.floor(timeLeft / (1000 * 60));
        return `Ongoing • ${minsLeft}m left`;
      }
      return 'Ended';
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours < 1) {
      return `${minutes} min${minutes !== 1 ? 's' : ''}`;
    } else if (hours < 24) {
      // Show hours and minutes for better accuracy
      if (minutes > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (remainingHours > 0) {
        return `${days}d ${remainingHours}h`;
      }
      return `${days} day${days > 1 ? 's' : ''}`;
    }
  };

  // Format date for display in KST timezone
  const formatDate = (date: Date) => {
    // Get the date components in KST (UTC+9)
    const kstFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const kstParts = kstFormatter.formatToParts(date);
    const kstYear = parseInt(kstParts.find(p => p.type === 'year')?.value || '0');
    const kstMonth = parseInt(kstParts.find(p => p.type === 'month')?.value || '0') - 1;
    const kstDay = parseInt(kstParts.find(p => p.type === 'day')?.value || '0');
    
    // Get today in KST
    const now = new Date();
    const todayParts = kstFormatter.formatToParts(now);
    const todayYear = parseInt(todayParts.find(p => p.type === 'year')?.value || '0');
    const todayMonth = parseInt(todayParts.find(p => p.type === 'month')?.value || '0') - 1;
    const todayDay = parseInt(todayParts.find(p => p.type === 'day')?.value || '0');
    
    // Check if same day in KST
    if (kstYear === todayYear && kstMonth === todayMonth && kstDay === todayDay) {
      return 'Today';
    }
    
    // Check if tomorrow in KST
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowParts = kstFormatter.formatToParts(tomorrow);
    const tomorrowYear = parseInt(tomorrowParts.find(p => p.type === 'year')?.value || '0');
    const tomorrowMonth = parseInt(tomorrowParts.find(p => p.type === 'month')?.value || '0') - 1;
    const tomorrowDay = parseInt(tomorrowParts.find(p => p.type === 'day')?.value || '0');
    
    if (kstYear === tomorrowYear && kstMonth === tomorrowMonth && kstDay === tomorrowDay) {
      return 'Tomorrow';
    }
    
    // Format as readable date in KST
    return date.toLocaleDateString('en-US', { 
      timeZone: 'Asia/Seoul',
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <main className="home-page-main">
          <div className="home-container">
            {user ? (
              /* Logged-in: Dashboard View */
              <>
                {/* Hero Section with Welcome + Stats */}
                <div className="home-hero">
                  <div className="home-hero-content">
                    <div className="home-hero-text">
                      <h1>Welcome back, {user.givenName || user.familyName || 'Student'}! </h1>
                      <p>Track your progress and continue your English learning journey</p>
                    </div>
                    <div className="home-hero-stats">
                      <div className="hero-stat-card">
                        <div className="hero-stat-icon blue">
                          <i className="fas fa-book-open"></i>
                        </div>
                        <div className="hero-stat-info">
                          <span className="hero-stat-value">{loading ? '...' : (stats?.lessonsCompleted || 0)}</span>
                          <span className="hero-stat-label">Lessons Done</span>
                        </div>
                      </div>
                      <div className="hero-stat-card">
                        <div className="hero-stat-icon green">
                          <i className="fas fa-calendar-check"></i>
                        </div>
                        <div className="hero-stat-info">
                          <span className="hero-stat-value">{loading ? '...' : (stats?.upcomingLessons || 0)}</span>
                          <span className="hero-stat-label">Upcoming</span>
                        </div>
                      </div>
                      <div className="hero-stat-card">
                        <div className="hero-stat-icon orange">
                          <i className="fas fa-clock"></i>
                        </div>
                        <div className="hero-stat-info">
                          <span className="hero-stat-value">{loading ? '...' : (stats?.totalHours || 0)}</span>
                          <span className="hero-stat-label">Total Hours</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions Row */}
                <div className="home-quick-actions">
                  <a href="/browse-tutors" className="quick-action-card browse">
                    <div className="quick-action-icon">
                      <i className="fas fa-search"></i>
                    </div>
                    <div className="quick-action-text">
                      <span className="quick-action-title">Find a Tutor</span>
                      <span className="quick-action-desc">Browse & book lessons</span>
                    </div>
                    <i className="fas fa-arrow-right quick-action-arrow"></i>
                  </a>
                  <a href="/tickets" className="quick-action-card tickets">
                    <div className="quick-action-icon">
                      <i className="fas fa-ticket-alt"></i>
                    </div>
                    <div className="quick-action-text">
                      <span className="quick-action-title">Buy Tickets</span>
                      <span className="quick-action-desc">Get lesson credits</span>
                    </div>
                    <i className="fas fa-arrow-right quick-action-arrow"></i>
                  </a>
                  <a href="/my-lessons" className="quick-action-card lessons">
                    <div className="quick-action-icon">
                      <i className="fas fa-calendar-alt"></i>
                    </div>
                    <div className="quick-action-text">
                      <span className="quick-action-title">My Schedule</span>
                      <span className="quick-action-desc">View upcoming lessons</span>
                    </div>
                    <i className="fas fa-arrow-right quick-action-arrow"></i>
                  </a>
                </div>

                {/* Main Grid: Next Lesson + Tickets */}
                <div className="home-main-grid">
                  {/* Next Lesson Card */}
                  <div className="home-card next-lesson-card">
                    <div className="home-card-header">
                      <h3 className="home-card-title">
                        <i className="fas fa-video"></i>
                        Next Lesson
                      </h3>
                      {stats?.nextLesson && (() => {
                        const lessonDate = parseSlotDateTime(stats.nextLesson.slotDate, stats.nextLesson.slotTime);
                        const ongoing = isLessonOngoing(lessonDate);
                        return (
                          <div className={`home-time-badge ${ongoing ? 'ongoing' : ''}`}>
                            <i className={ongoing ? 'fas fa-play-circle' : 'fas fa-clock'}></i>
                            {ongoing ? '' : 'in '}{getTimeUntil(lessonDate)}
                          </div>
                        );
                      })()}
                    </div>

                    {loading ? (
                      <div className="home-loading-state">
                        <div className="loading-spinner"></div>
                        <p>Loading your schedule...</p>
                      </div>
                    ) : error ? (
                      <div className="home-error-state">
                        <i className="fas fa-exclamation-circle"></i>
                        <p>{error}</p>
                      </div>
                    ) : stats?.nextLesson ? (
                      <div className="next-lesson-content">
                        <div 
                          className={stats.nextLesson.tutorAvatar ? "next-lesson-avatar" : "next-lesson-avatar placeholder"}
                          style={stats.nextLesson.tutorAvatar ? { backgroundImage: `url(${stats.nextLesson.tutorAvatar})` } : undefined}
                        >
                          {!stats.nextLesson.tutorAvatar && <i className="fas fa-user"></i>}
                        </div>
                        <div className="next-lesson-info">
                          <div className="next-lesson-tutor">{stats.nextLesson.tutorName}</div>
                          <div className="next-lesson-details">
                            <span className="next-lesson-detail">
                              <i className="fas fa-calendar"></i>
                              {formatDate(parseSlotDateTime(stats.nextLesson.slotDate, stats.nextLesson.slotTime))}
                            </span>
                            <span className="next-lesson-detail">
                              <i className="fas fa-clock"></i>
                              {convertToKoreanTime(stats.nextLesson.slotTime)} KST
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => window.open(`/lesson/${stats.nextLesson!.bookingId}`, '_blank')}
                          className="join-lesson-btn"
                        >
                          <i className="fas fa-video"></i>
                          Join Now
                        </button>
                      </div>
                    ) : (
                      <div className="home-empty-state">
                        <div className="empty-icon-wrap">
                          <i className="fas fa-calendar-plus"></i>
                        </div>
                        <p className="empty-title">No upcoming lessons</p>
                        <p className="empty-subtitle">Book a lesson with your favorite tutor</p>
                        <a href="/browse-tutors" className="empty-action-btn">
                          <i className="fas fa-search"></i>
                          Find a Tutor
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Ticket Balance Card */}
                  <div className="home-card tickets-card">
                    <div className="home-card-header">
                      <h3 className="home-card-title">
                        <i className="fas fa-ticket-alt"></i>
                        My Tickets
                      </h3>
                      <a href="/tickets" className="card-link">
                        Buy More <i className="fas fa-chevron-right"></i>
                      </a>
                    </div>
                    
                    {ticketLoading ? (
                      <div className="home-loading-state compact">
                        <div className="loading-spinner"></div>
                      </div>
                    ) : (
                      <div className="ticket-balance-grid">
                        <div className="ticket-balance-item basic">
                          <div className="ticket-balance-icon">
                            <picture>
                              <source srcSet="/assets/img/icons/basic_ticket2.webp" type="image/webp" />
                              <img src="/assets/img/icons/basic_ticket2.png" alt="Basic" loading="lazy" />
                            </picture>
                          </div>
                          <div className="ticket-balance-count">{ticketBalance?.basic || 0}</div>
                          <div className="ticket-balance-label">Basic</div>
                        </div>
                        <div className="ticket-balance-item premium">
                          <div className="ticket-balance-icon">
                            <picture>
                              <source srcSet="/assets/img/icons/premium_ticket2.webp" type="image/webp" />
                              <img src="/assets/img/icons/premium_ticket2.png" alt="Premium" loading="lazy" />
                            </picture>
                          </div>
                          <div className="ticket-balance-count">{ticketBalance?.premium || 0}</div>
                          <div className="ticket-balance-label">Premium</div>
                        </div>
                        {ticketBalance?.trial ? (
                          <div className="ticket-balance-item trial">
                            <div className="ticket-balance-icon">
                              <picture>
                                <source srcSet="/assets/img/icons/trial_ticket.webp" type="image/webp" />
                                <img src="/assets/img/icons/trial_ticket.png" alt="Trial" loading="lazy" />
                              </picture>
                            </div>
                            <div className="ticket-balance-count">{ticketBalance?.trial || 0}</div>
                            <div className="ticket-balance-label">Trial</div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {/* Secondary Grid: Favorites + Activity */}
                <div className="home-secondary-grid">
                  {/* Favorite Tutors */}
                  <div className="home-card favorites-card">
                    <div className="home-card-header">
                      <h3 className="home-card-title">
                        <i className="fas fa-heart"></i>
                        Favorite Tutors
                      </h3>
                      <a href="/browse-tutors" className="card-link">
                        Browse All <i className="fas fa-chevron-right"></i>
                      </a>
                    </div>

                    {favoritesLoading ? (
                      <div className="home-loading-state compact">
                        <div className="loading-spinner"></div>
                      </div>
                    ) : favoriteTutors.length === 0 ? (
                      <div className="home-empty-state compact">
                        <div className="empty-icon-wrap small">
                          <i className="fas fa-heart"></i>
                        </div>
                        <p className="empty-title">No favorites yet</p>
                        <p className="empty-subtitle">Save tutors to quickly book again</p>
                      </div>
                    ) : (
                      <div className="favorites-list">
                        {favoriteTutors.slice(0, 4).map((tutor) => (
                          <a 
                            key={tutor.id} 
                            href={`/tutor/${tutor.tutorId}`}
                            className="favorite-tutor-item"
                          >
                            <div 
                              className={tutor.tutorAvatar ? "favorite-tutor-avatar" : "favorite-tutor-avatar placeholder"}
                              style={tutor.tutorAvatar ? { backgroundImage: `url(${tutor.tutorAvatar})` } : undefined}
                            >
                              {!tutor.tutorAvatar && <i className="fas fa-user"></i>}
                            </div>
                            <span className="favorite-tutor-name">{tutor.tutorName}</span>
                            <i className="fas fa-chevron-right"></i>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Activity */}
                  <div className="home-card activity-card">
                    <div className="home-card-header">
                      <h3 className="home-card-title">
                        <i className="fas fa-history"></i>
                        Recent Activity
                      </h3>
                    </div>

                    {activityLoading ? (
                      <div className="home-loading-state compact">
                        <div className="loading-spinner"></div>
                      </div>
                    ) : recentActivity.length === 0 ? (
                      <div className="home-empty-state compact">
                        <div className="empty-icon-wrap small">
                          <i className="fas fa-inbox"></i>
                        </div>
                        <p className="empty-title">No activity yet</p>
                        <p className="empty-subtitle">Your lesson history will appear here</p>
                      </div>
                    ) : (
                      <>
                        <div className="activity-list">
                          {recentActivity
                            .slice((activityPage - 1) * ACTIVITY_PER_PAGE, activityPage * ACTIVITY_PER_PAGE)
                            .map((activity, idx) => {
                              const getIconClass = () => {
                                if (activity.type === 'lesson_completed') return 'completed';
                                if (activity.type === 'lesson_booked') return 'booked';
                                if (activity.type === 'ticket_purchased') {
                                  if (activity.ticketTier === 'premium') return 'purchase-premium';
                                  if (activity.ticketTier === 'trial') return 'purchase-trial';
                                  return 'purchase-basic';
                                }
                                return 'booked';
                              };
                              
                              const getIcon = () => {
                                if (activity.type === 'lesson_completed') return 'fas fa-check-circle';
                                if (activity.type === 'ticket_purchased') return 'fas fa-ticket-alt';
                                return 'fas fa-calendar-check';
                              };
                              
                              return (
                                <div key={idx} className="activity-item">
                                  <div className={`activity-icon ${getIconClass()}`}>
                                    <i className={getIcon()}></i>
                                  </div>
                                  <div className="activity-content">
                                    <span className="activity-action">{activity.action}</span>
                                    {activity.tutorName && (
                                      <span className="activity-tutor">with {activity.tutorName}</span>
                                    )}
                                  </div>
                                  <span className="activity-date">{activity.date}</span>
                                </div>
                              );
                            })}
                        </div>
                        {recentActivity.length > ACTIVITY_PER_PAGE && (
                          <div className="activity-pagination">
                            <button
                              className="pagination-btn"
                              onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                              disabled={activityPage === 1}
                            >
                              <i className="fas fa-chevron-left"></i>
                            </button>
                            <span className="pagination-info">
                              {activityPage} / {Math.ceil(recentActivity.length / ACTIVITY_PER_PAGE)}
                            </span>
                            <button
                              className="pagination-btn"
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
                </div>
              </>
            ) : (
              /* Not logged in: Landing Page */
              <>
                <div className="landing-hero">
                  <div className="landing-hero-content">
                    <h1 className="landing-hero-title">
                      Learn English with <span className="gradient-text">Expert Tutors</span>
                    </h1>
                    <p className="landing-hero-description">
                      Personalized lessons for Korean students. Improve your conversation skills, ace your exams, and gain confidence speaking English.
                    </p>
                    <div className="landing-hero-buttons">
                      <a href="/register" className="landing-btn-primary">
                        <i className="fas fa-rocket"></i>
                        Start Free Trial
                      </a>
                      <a href="/browse-tutors" className="landing-btn-secondary">
                        <i className="fas fa-search"></i>
                        Browse Tutors
                      </a>
                    </div>
                  </div>
                  <div className="landing-hero-image">
                    <div className="landing-hero-image-wrapper">
                      <img 
                        src="/assets/img/banner/banner_woman.webp" 
                        alt="Happy student learning English" 
                      />
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="landing-features">
                  {[
                    { icon: 'fas fa-comments', title: 'Real Conversation Practice', desc: 'Focus on speaking naturally and building confidence' },
                    { icon: 'fas fa-user-graduate', title: 'Expert Native Tutors', desc: 'Learn from experienced teachers who understand Korean learners' },
                    { icon: 'fas fa-clock', title: 'Flexible Scheduling', desc: 'Book lessons that fit your school and family schedule' }
                  ].map((f, i) => (
                    <div key={i} className="landing-feature-card">
                      <div className="landing-feature-icon">
                        <i className={f.icon}></i>
                      </div>
                      <h4 className="landing-feature-title">{f.title}</h4>
                      <p className="landing-feature-desc">{f.desc}</p>
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
