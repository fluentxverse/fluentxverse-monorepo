import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
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

// Cancel confirmation modal component
interface CancelModalProps {
  isOpen: boolean;
  booking: Booking | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  willGetRefund: boolean;
}

const CancelModal = ({ isOpen, booking, onConfirm, onCancel, isLoading, willGetRefund }: CancelModalProps) => {
  if (!isOpen || !booking) return null;

  return (
    <div className="cancel-modal-overlay" onClick={onCancel}>
      <div className="cancel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cancel-modal-header">
          <i className="fas fa-exclamation-triangle"></i>
          <h3>Cancel Lesson</h3>
        </div>
        <div className="cancel-modal-body">
          <p>Are you sure you want to cancel your lesson with <strong>{booking.tutorName}</strong>?</p>
          <div className="cancel-lesson-info">
            <div className="cancel-info-row">
              <i className="fas fa-calendar"></i>
              <span>{booking.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="cancel-info-row">
              <i className="fas fa-clock"></i>
              <span>{booking.timeDisplay} KST</span>
            </div>
          </div>
          <div className={`refund-notice ${willGetRefund ? 'refund-yes' : 'refund-no'}`}>
            <i className={willGetRefund ? 'fas fa-ticket-alt' : 'fas fa-info-circle'}></i>
            {willGetRefund ? (
              <span>You will receive a ticket refund for this cancellation.</span>
            ) : (
              <span>Cancellations less than 1 hour before the lesson are not eligible for refund.</span>
            )}
          </div>
        </div>
        <div className="cancel-modal-actions">
          <button className="cancel-modal-btn cancel-btn" onClick={onCancel} disabled={isLoading}>
            Keep Lesson
          </button>
          <button className="cancel-modal-btn confirm-btn" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Cancelling...
              </>
            ) : (
              <>
                <i className="fas fa-times"></i>
                Cancel Lesson
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const SchedulePage = () => {
  useEffect(() => {
    document.title = 'My Schedule | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  
  // Cancel modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState<{ message: string; refunded: boolean } | null>(null);

  // Check if cancellation is eligible for refund (more than 1 hour before lesson)
  const isRefundEligible = (lessonDate: Date): boolean => {
    const now = new Date();
    const oneHourBefore = new Date(lessonDate.getTime() - 60 * 60 * 1000);
    return now < oneHourBefore;
  };

  // Handle cancel button click
  const handleCancelClick = (booking: Booking) => {
    setBookingToCancel(booking);
    setCancelModalOpen(true);
  };

  // Handle cancel confirmation
  const handleConfirmCancel = async () => {
    if (!bookingToCancel) return;
    
    setCancelling(true);
    try {
      const result = await scheduleApi.cancelBooking(bookingToCancel.id);
      
      // Remove the cancelled booking from the list
      setBookings(prev => prev.filter(b => b.id !== bookingToCancel.id));
      
      // Show success message
      setCancelSuccess({
        message: result.message || 'Lesson cancelled successfully',
        refunded: result.refundEligible
      });
      
      // Close modal
      setCancelModalOpen(false);
      setBookingToCancel(null);
      
      // Clear success message after 5 seconds
      setTimeout(() => setCancelSuccess(null), 5000);
    } catch (err: any) {
      console.error('Failed to cancel booking:', err);
      setError(typeof err === 'string' ? err : err.message || 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  // Handle modal close
  const handleCancelModalClose = () => {
    if (!cancelling) {
      setCancelModalOpen(false);
      setBookingToCancel(null);
    }
  };

  // Convert 12-hour or 24-hour PHT time to 24-hour KST time
  const convertPHTtoKST = (dateStr: string, timeStr: string): { date: string; time: string; dateObj: Date } => {
    let hour: number;
    let minute: number;
    
    // Try 12-hour format first (e.g., "11:30 PM")
    const match12 = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match12) {
      hour = parseInt(match12[1], 10);
      minute = parseInt(match12[2], 10);
      const isPM = match12[3].toUpperCase() === 'PM';

      if (hour === 12) {
        hour = isPM ? 12 : 0;
      } else if (isPM) {
        hour += 12;
      }
    } else {
      // Try 24-hour format (e.g., "23:30")
      const match24 = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (match24) {
        hour = parseInt(match24[1], 10);
        minute = parseInt(match24[2], 10);
      } else {
        return { date: dateStr, time: '00:00', dateObj: new Date(dateStr) };
      }
    }

    let kstHour = hour + 1;
    let kstDate = dateStr;

    if (kstHour >= 24) {
      kstHour -= 24;
      // Calculate next day without using toISOString (which converts to UTC)
      const [year, month, day] = dateStr.split('-').map(Number);
      const nextDay = new Date(year, month - 1, day + 1);
      kstDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    }

    const kstTime = `${String(kstHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    // Explicitly specify KST timezone (UTC+9) so JavaScript doesn't interpret as local time
    const dateObj = new Date(`${kstDate}T${kstTime}:00+09:00`);

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

        const LESSON_DURATION_MS = 25 * 60 * 1000; // 25 minutes
        
        const transformedBookings: Booking[] = data.map((booking: StudentBooking) => {
          const { date: kstDate, time: kstTime, dateObj } = convertPHTtoKST(booking.slotDate, booking.slotTime);
          const now = new Date();
          const lessonEndTime = new Date(dateObj.getTime() + LESSON_DURATION_MS);

          let status: 'upcoming' | 'completed' | 'cancelled' = 'upcoming';
          if (booking.status === 'completed') {
            status = 'completed';
          } else if (booking.status === 'cancelled') {
            status = 'cancelled';
          } else if (now >= lessonEndTime) {
            // Only mark as completed after the full 25-minute lesson duration
            status = 'completed';
          }
          // If lesson has started but not ended, keep status as 'upcoming' (ongoing)

          return {
            id: booking.bookingId,
            tutorId: booking.tutorId,
            tutorName: booking.tutorName?.trim() || 'Tutor',
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
  const LESSON_DURATION_MS = 25 * 60 * 1000; // 25 minutes in milliseconds
  
  // Helper to check if lesson is still ongoing (within 25 minutes of start)
  const isLessonOngoing = useCallback((lessonDate: Date): boolean => {
    const currentTime = Date.now();
    const lessonEnd = lessonDate.getTime() + LESSON_DURATION_MS;
    return currentTime >= lessonDate.getTime() && currentTime < lessonEnd;
  }, []);
  
  // Helper to check if lesson end time has passed
  const isLessonEnded = useCallback((lessonDate: Date): boolean => {
    const lessonEnd = lessonDate.getTime() + LESSON_DURATION_MS;
    return Date.now() >= lessonEnd;
  }, []);
  
  // Memoize filtered and sorted lesson lists
  const { upcomingLessons, pastLessons } = useMemo(() => {
    const currentTime = Date.now();
    
    const upcoming = bookings
      .filter(b => {
        if (b.status !== 'upcoming') return false;
        const lessonEnd = b.date.getTime() + LESSON_DURATION_MS;
        return b.date.getTime() > currentTime || currentTime < lessonEnd;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const past = bookings
      .filter(b => {
        if (b.status === 'completed') return true;
        const lessonEnd = b.date.getTime() + LESSON_DURATION_MS;
        return currentTime >= lessonEnd;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return { upcomingLessons: upcoming, pastLessons: past };
  }, [bookings]);

  // Create KST formatter once (memoized)
  const kstFormatter = useMemo(() => new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }), []);

  const kstDateFormatter = useMemo(() => new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }), []);

  // Pre-compute today and tomorrow in KST (memoized)
  const { todayKST, tomorrowKST } = useMemo(() => {
    const now = new Date();
    const todayParts = kstFormatter.formatToParts(now);
    const todayYear = parseInt(todayParts.find(p => p.type === 'year')?.value || '0');
    const todayMonth = parseInt(todayParts.find(p => p.type === 'month')?.value || '0');
    const todayDay = parseInt(todayParts.find(p => p.type === 'day')?.value || '0');

    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowParts = kstFormatter.formatToParts(tomorrow);
    const tomorrowYear = parseInt(tomorrowParts.find(p => p.type === 'year')?.value || '0');
    const tomorrowMonth = parseInt(tomorrowParts.find(p => p.type === 'month')?.value || '0');
    const tomorrowDay = parseInt(tomorrowParts.find(p => p.type === 'day')?.value || '0');

    return {
      todayKST: `${todayYear}-${todayMonth}-${todayDay}`,
      tomorrowKST: `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`
    };
  }, [kstFormatter]);

  // Format date for display - optimized with memoized formatters
  const formatLessonDate = useCallback((date: Date) => {
    const kstParts = kstFormatter.formatToParts(date);
    const kstYear = parseInt(kstParts.find(p => p.type === 'year')?.value || '0');
    const kstMonth = parseInt(kstParts.find(p => p.type === 'month')?.value || '0');
    const kstDay = parseInt(kstParts.find(p => p.type === 'day')?.value || '0');
    const dateKey = `${kstYear}-${kstMonth}-${kstDay}`;

    if (dateKey === todayKST) return 'Today';
    if (dateKey === tomorrowKST) return 'Tomorrow';

    return kstDateFormatter.format(date);
  }, [kstFormatter, kstDateFormatter, todayKST, tomorrowKST]);

  const getTimeUntil = useCallback((date: Date) => {
    const currentTime = Date.now();
    const diff = date.getTime() - currentTime;
    
    // If lesson has started, check if it's still ongoing
    if (diff < 0) {
      const lessonEnd = date.getTime() + LESSON_DURATION_MS;
      const timeLeft = lessonEnd - currentTime;
      if (timeLeft > 0) {
        const minsLeft = Math.floor(timeLeft / 60000);
        return `Ongoing • ${minsLeft}m left`;
      }
      return 'Ended';
    }
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) {
      return `in ${minutes} min`;
    } else if (hours < 24) {
      return `in ${hours}h ${minutes % 60}m`;
    } else {
      return `in ${days} day${days > 1 ? 's' : ''}`;
    }
  }, []);

  const getTimeSince = useCallback((date: Date) => {
    const currentTime = Date.now();
    const diff = currentTime - date.getTime();
    const minutes = Math.floor(diff / 60000);
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
  }, []);

  const displayedLessons = useMemo(() => 
    activeTab === 'upcoming' ? upcomingLessons : pastLessons
  , [activeTab, upcomingLessons, pastLessons]);

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

            {/* Loading State - Skeleton Loader */}
            {loading && (
              <div className="schedule-skeleton">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-date"></div>
                    <div className="skeleton-avatar"></div>
                    <div className="skeleton-info">
                      <div className="skeleton-title"></div>
                      <div className="skeleton-detail"></div>
                      <div className="skeleton-detail" style={{ width: '150px' }}></div>
                    </div>
                    <div className="skeleton-actions">
                      <div className="skeleton-btn"></div>
                      <div className="skeleton-btn" style={{ width: '80px' }}></div>
                    </div>
                  </div>
                ))}
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
                      <h3 className="schedule-card-tutor-name">{lesson.tutorName}</h3>
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
                          <div className={`lesson-detail countdown ${isLessonOngoing(lesson.date) ? 'ongoing' : ''}`}>
                            <i className={isLessonOngoing(lesson.date) ? 'fas fa-play-circle' : 'fas fa-hourglass-half'}></i>
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
                          <button 
                            className="action-btn cancel"
                            onClick={() => handleCancelClick(lesson)}
                          >
                            <i className="fas fa-times-circle"></i>
                            Cancel
                          </button>
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

            {/* Cancel Success Notification */}
            {cancelSuccess && (
              <div className={`cancel-notification ${cancelSuccess.refunded ? 'refunded' : ''}`}>
                <i className={`fas ${cancelSuccess.refunded ? 'fa-check-circle' : 'fa-info-circle'}`}></i>
                <span>{cancelSuccess.message}</span>
                {cancelSuccess.refunded && (
                  <span className="refund-badge">Ticket Refunded</span>
                )}
                <button className="notification-close" onClick={() => setCancelSuccess(null)}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelModalOpen && bookingToCancel && (
        <div className="cancel-modal-overlay" onClick={handleCancelModalClose}>
          <div className="cancel-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cancel-modal-header">
              <h3>Cancel Lesson</h3>
              <button 
                className="modal-close-btn" 
                onClick={handleCancelModalClose}
                disabled={cancelling}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="cancel-modal-body">
              <div className="cancel-lesson-info">
                <div className="cancel-tutor-avatar">
                  {bookingToCancel.tutorAvatar ? (
                    <img src={bookingToCancel.tutorAvatar} alt={bookingToCancel.tutorName} />
                  ) : (
                    <div className="avatar-placeholder">
                      <i className="fas fa-user"></i>
                    </div>
                  )}
                </div>
                <div className="cancel-lesson-details">
                  <h4>{bookingToCancel.tutorName}</h4>
                  <p>
                    <i className="fas fa-calendar"></i>
                    {formatLessonDate(bookingToCancel.date)} at {bookingToCancel.timeDisplay} KST
                  </p>
                  <p>
                    <i className="fas fa-clock"></i>
                    {bookingToCancel.duration} minutes
                  </p>
                </div>
              </div>

              <div className={`refund-notice ${isRefundEligible(bookingToCancel.date) ? 'eligible' : 'not-eligible'}`}>
                {isRefundEligible(bookingToCancel.date) ? (
                  <>
                    <i className="fas fa-check-circle"></i>
                    <div>
                      <strong>Refund Eligible</strong>
                      <p>Your ticket will be refunded since you're cancelling more than 1 hour before the lesson.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <i className="fas fa-exclamation-triangle"></i>
                    <div>
                      <strong>No Refund</strong>
                      <p>Cancellations less than 1 hour before the lesson are not eligible for a refund.</p>
                    </div>
                  </>
                )}
              </div>

              <p className="cancel-warning">
                Are you sure you want to cancel this lesson? This action cannot be undone.
              </p>
            </div>

            <div className="cancel-modal-footer">
              <button 
                className="cancel-modal-btn secondary" 
                onClick={handleCancelModalClose}
                disabled={cancelling}
              >
                Keep Lesson
              </button>
              <button 
                className="cancel-modal-btn danger" 
                onClick={handleConfirmCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <>
                    <span className="btn-spinner"></span>
                    Cancelling...
                  </>
                ) : (
                  <>
                    <i className="fas fa-times-circle"></i>
                    Cancel Lesson
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SchedulePage;
