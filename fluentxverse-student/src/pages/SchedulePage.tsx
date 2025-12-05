import { useState, useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { scheduleApi, type StudentBooking } from '../api/schedule.api';
import './SchedulePage.css';

interface Booking {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorAvatar?: string;
  date: Date;
  dateStr: string;
  time: string;
  timeDisplay: string;
  duration: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  originalStatus: string;
}

const SchedulePage = () => {
  useEffect(() => {
    document.title = 'My Schedule | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  // Convert 12-hour PHT time to 24-hour KST time
  const convertPHTtoKST = (dateStr: string, time12: string): { date: string; time: string; dateObj: Date } => {
    const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) {
      return { date: dateStr, time: '00:00', dateObj: new Date(dateStr) };
    }

    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const isPM = match[3].toUpperCase() === 'PM';

    if (hour === 12) {
      hour = isPM ? 12 : 0;
    } else if (isPM) {
      hour += 12;
    }

    let kstHour = hour + 1;
    let kstDate = dateStr;

    if (kstHour >= 24) {
      kstHour -= 24;
      const nextDay = new Date(dateStr);
      nextDay.setDate(nextDay.getDate() + 1);
      kstDate = nextDay.toISOString().split('T')[0];
    }

    const kstTime = `${String(kstHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const dateObj = new Date(`${kstDate}T${kstTime}:00`);

    return { date: kstDate, time: kstTime, dateObj };
  };

  useEffect(() => {
    const fetchBookings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await scheduleApi.getStudentBookings();

        const transformedBookings: Booking[] = data.map((booking: StudentBooking) => {
          const { date: kstDate, time: kstTime, dateObj } = convertPHTtoKST(booking.slotDate, booking.slotTime);

          let status: 'upcoming' | 'completed' | 'cancelled' = 'upcoming';
          if (booking.status === 'completed') {
            status = 'completed';
          } else if (booking.status === 'cancelled') {
            status = 'cancelled';
          } else if (dateObj < new Date()) {
            status = 'completed';
          }

          return {
            id: booking.bookingId,
            tutorId: booking.tutorId,
            tutorName: booking.tutorName,
            tutorAvatar: booking.tutorAvatar,
            date: dateObj,
            dateStr: kstDate,
            time: kstTime,
            timeDisplay: kstTime,
            duration: booking.durationMinutes,
            status,
            originalStatus: booking.status
          };
        });

        setBookings(transformedBookings);
      } catch (err) {
        console.error('Failed to fetch bookings:', err);
        setError('Failed to load your schedule. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [user]);

  const now = new Date();
  const upcomingLessons = bookings
    .filter(b => b.status === 'upcoming' && b.date > now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const pastLessons = bookings
    .filter(b => b.status === 'completed' || b.date <= now)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

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
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const getTimeUntil = (date: Date) => {
    const diff = date.getTime() - now.getTime();
    if (diff < 0) return 'Started';
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) {
      return `in ${minutes} min`;
    } else if (hours < 24) {
      return `in ${hours}h ${minutes % 60}m`;
    } else {
      return `in ${days} day${days > 1 ? 's' : ''}`;
    }
  };

  const getTimeSince = (date: Date) => {
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 30) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else {
      return `${minutes}m ago`;
    }
  };

  const displayedLessons = activeTab === 'upcoming' ? upcomingLessons : pastLessons;

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <main className="schedule-page">
          <div className="container">
            {/* Header Section */}
            <div className="schedule-header">
              <div className="schedule-header-left">
                <div className="schedule-icon">
                  <i className="fas fa-calendar-check"></i>
                </div>
                <div>
                  <h1 className="schedule-title">My Schedule</h1>
                  <p className="schedule-subtitle">
                    {upcomingLessons.length} upcoming lesson{upcomingLessons.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <a href="/browse-tutors" className="schedule-book-btn">
                <i className="fas fa-plus-circle"></i>
                Book a Lesson
              </a>
            </div>

            {/* Tabs */}
            <div className="schedule-tabs">
              <button
                className={`schedule-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
                onClick={() => setActiveTab('upcoming')}
              >
                <i className="fas fa-clock"></i>
                Upcoming
                {upcomingLessons.length > 0 && (
                  <span className="tab-count">{upcomingLessons.length}</span>
                )}
              </button>
              <button
                className={`schedule-tab ${activeTab === 'past' ? 'active' : ''}`}
                onClick={() => setActiveTab('past')}
              >
                <i className="fas fa-history"></i>
                Past Lessons
                {pastLessons.length > 0 && (
                  <span className="tab-count past">{pastLessons.length}</span>
                )}
              </button>
            </div>

            {/* Timezone Notice */}
            <div className="schedule-timezone">
              <i className="fas fa-globe-asia"></i>
              <span>All times shown in Seoul Time (KST)</span>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="schedule-loading">
                <div className="schedule-spinner"></div>
                <p>Loading your schedule...</p>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="schedule-error">
                <i className="fas fa-exclamation-circle"></i>
                <h3>Error Loading Schedule</h3>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className="retry-btn">
                  <i className="fas fa-redo"></i>
                  Try Again
                </button>
              </div>
            )}

            {/* Lessons List */}
            {!loading && !error && displayedLessons.length > 0 && (
              <div className="schedule-list">
                {displayedLessons.map((lesson) => (
                  <div key={lesson.id} className={`schedule-card ${activeTab}`}>
                    {/* Date Badge */}
                    <div className="schedule-card-date">
                      <span className="date-day">{lesson.date.getDate()}</span>
                      <span className="date-month">{lesson.date.toLocaleDateString('en-US', { month: 'short' })}</span>
                    </div>

                    {/* Tutor Avatar */}
                    <div className="schedule-card-avatar">
                      {lesson.tutorAvatar ? (
                        <img src={lesson.tutorAvatar} alt={lesson.tutorName} />
                      ) : (
                        <div className="avatar-placeholder">
                          <i className="fas fa-user"></i>
                        </div>
                      )}
                    </div>

                    {/* Lesson Info */}
                    <div className="schedule-card-info">
                      <h3 className="tutor-name">{lesson.tutorName}</h3>
                      <div className="lesson-details">
                        <div className="lesson-detail">
                          <i className="fas fa-calendar"></i>
                          <span>{formatLessonDate(lesson.date)}</span>
                        </div>
                        <div className="lesson-detail">
                          <i className="fas fa-clock"></i>
                          <span>{lesson.timeDisplay} KST ({lesson.duration} min)</span>
                        </div>
                        {activeTab === 'upcoming' && (
                          <div className="lesson-detail countdown">
                            <i className="fas fa-hourglass-half"></i>
                            <span>{getTimeUntil(lesson.date)}</span>
                          </div>
                        )}
                        {activeTab === 'past' && (
                          <div className="lesson-detail past-time">
                            <i className="fas fa-check-circle"></i>
                            <span>{getTimeSince(lesson.date)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="schedule-card-actions">
                      {activeTab === 'upcoming' ? (
                        <>
                          <a href={`/lesson/${lesson.id}`} className="action-btn primary">
                            <i className="fas fa-video"></i>
                            Join Lesson
                          </a>
                          <a href={`/tutor/${lesson.tutorId}`} className="action-btn secondary">
                            <i className="fas fa-user"></i>
                            View Tutor
                          </a>
                        </>
                      ) : (
                        <>
                          <a href={`/tutor/${lesson.tutorId}`} className="action-btn secondary">
                            <i className="fas fa-redo"></i>
                            Book Again
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && displayedLessons.length === 0 && (
              <div className="schedule-empty">
                <div className="empty-icon">
                  <i className={activeTab === 'upcoming' ? 'fas fa-calendar-plus' : 'fas fa-history'}></i>
                </div>
                <h3>{activeTab === 'upcoming' ? 'No Upcoming Lessons' : 'No Past Lessons'}</h3>
                <p>
                  {activeTab === 'upcoming'
                    ? "Ready to start learning? Browse our tutors and book your first lesson!"
                    : "You haven't completed any lessons yet. Book your first lesson to get started!"}
                </p>
                {activeTab === 'upcoming' && (
                  <a href="/browse-tutors" className="empty-cta">
                    <i className="fas fa-search"></i>
                    Browse Tutors
                  </a>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default SchedulePage;
