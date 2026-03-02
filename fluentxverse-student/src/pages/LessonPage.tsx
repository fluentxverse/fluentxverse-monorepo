import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { scheduleApi } from '../api/schedule.api';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import './LessonPage.css';

interface LessonDetails {
  bookingId: string;
  tutorId: string;
  tutorName: string;
  tutorAvatar?: string;
  tutorBio?: string;
  hourlyRate?: number;
  slotDate: string;
  slotTime: string;
  durationMinutes: number;
  status: string;
  bookedAt: Date;
  sessionId?: string;
}

interface LessonPageProps {
  bookingId?: string;
}

export const LessonPage = ({ bookingId: propBookingId }: LessonPageProps) => {
  // Get bookingId from URL path
  const bookingId = propBookingId || window.location.pathname.split('/lesson/')[1]?.split('?')[0];
  
  const [lesson, setLesson] = useState<LessonDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canJoin, setCanJoin] = useState(false);
  
  // Cancel modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState<{ message: string; refunded: boolean } | null>(null);

  useEffect(() => {
    document.title = 'Lesson Details | FluentXVerse';
  }, []);

  useEffect(() => {
    if (bookingId) {
      fetchLessonDetails();
    }
  }, [bookingId]);

  // Check if lesson can be joined (within time window)
  useEffect(() => {
    if (!lesson) return;

    const checkJoinability = () => {
      const lessonDateTime = parseDateTime(lesson.slotDate, lesson.slotTime);
      const now = new Date();
      const diffMinutes = (lessonDateTime.getTime() - now.getTime()) / (1000 * 60);
      
      // Can join 15 minutes before and up to 30 minutes after scheduled time
      setCanJoin(diffMinutes >= -30 && diffMinutes <= lesson.durationMinutes + 15);
    };

    checkJoinability();
    const interval = setInterval(checkJoinability, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [lesson]);

  const parseDateTime = (date: string, time: string) => {
    const timeMatch = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!timeMatch) return new Date(date);

    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    // Time is in PHT (UTC+8), convert to KST (UTC+9) by adding 1 hour
    let kstHours = hours + 1;
    let kstDate = date;
    
    if (kstHours >= 24) {
      kstHours -= 24;
      // Calculate next day
      const [year, month, day] = date.split('-').map(Number);
      const nextDay = new Date(year, month - 1, day + 1);
      kstDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    }

    // Create Date with explicit KST timezone (UTC+9)
    return new Date(`${kstDate}T${String(kstHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+09:00`);
  };

  const fetchLessonDetails = async () => {
    setLoading(true);
    setError(null);
    
    
    try {
      const details = await scheduleApi.getLessonDetails(bookingId);
      setLesson(details);
    } catch (err: any) {
      console.error('=== ERROR in LessonPage ===');
      console.error('Error message:', err.message);
      console.error('Full error:', err);
      setError(err.message || 'Failed to load lesson details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    const timeMatch = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!timeMatch) return timeString;

    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2];
    const period = timeMatch[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    hours += 1;
    if (hours >= 24) hours -= 24;

    const koreanPeriod = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

    return `${displayHours}:${minutes} ${koreanPeriod} KST`;
  };

  const getTimeUntil = () => {
    if (!lesson) return '';
    
    const lessonDateTime = parseDateTime(lesson.slotDate, lesson.slotTime);
    const now = new Date();
    const diff = lessonDateTime.getTime() - now.getTime();
    
    if (diff < 0) return 'Started';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`;
    return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  const handleJoinClassroom = () => {
    if (lesson?.sessionId) {
      window.location.href = `/classroom/${lesson.sessionId}`;
    } else {
      // Fallback: use bookingId as sessionId
      window.location.href = `/classroom/${bookingId}`;
    }
  };

  const handleViewTutorProfile = () => {
    if (lesson?.tutorId) {
      window.location.href = `/tutor/${lesson.tutorId}`;
    }
  };

  // Check if cancellation is eligible for refund (more than 1 hour before lesson)
  const isRefundEligible = (): boolean => {
    if (!lesson) return false;
    const lessonDateTime = parseDateTime(lesson.slotDate, lesson.slotTime);
    const now = new Date();
    const oneHourBefore = new Date(lessonDateTime.getTime() - 60 * 60 * 1000);
    return now < oneHourBefore;
  };

  // Handle cancel confirmation
  const handleConfirmCancel = async () => {
    if (!lesson) return;
    
    setCancelling(true);
    try {
      const result = await scheduleApi.cancelBooking(lesson.bookingId);
      
      // Show success message
      setCancelSuccess({
        message: result.message || 'Lesson cancelled successfully',
        refunded: result.refundEligible
      });
      
      // Close modal and redirect after delay
      setCancelModalOpen(false);
      setTimeout(() => {
        window.location.href = '/schedule';
      }, 2000);
    } catch (err: any) {
      console.error('Failed to cancel booking:', err);
      setError(typeof err === 'string' ? err : err.message || 'Failed to cancel booking');
      setCancelModalOpen(false);
    } finally {
      setCancelling(false);
    }
  };

  // Handle modal close
  const handleCancelModalClose = () => {
    if (!cancelling) {
      setCancelModalOpen(false);
    }
  };

  if (loading) {
    return (
      <>
        <SideBar />
        <div className="main-content">
          <Header />
          <main className="lesson-page">
            <div className="container">
              <div className="lesson-loading">
                <div className="lesson-spinner"></div>
                <p>Loading lesson details...</p>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  if (error || !lesson) {
    return (
      <>
        <SideBar />
        <div className="main-content">
          <Header />
          <main className="lesson-page">
            <div className="container">
              <div className="lesson-error">
                <i className="fas fa-exclamation-circle"></i>
                <h2>Unable to Load Lesson</h2>
                <p>{error || 'Lesson not found'}</p>
                <button onClick={() => window.location.href = '/schedule'} className="btn-back">
                  <i className="fas fa-arrow-left"></i>
                  Back to Schedule
                </button>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <main className="lesson-page">
          <div className="container">
            {/* Page Header */}
            <div className="lesson-page-header">
              <div className="lesson-page-header-left">
                <div className="lesson-page-icon">
                  <i className="fas fa-chalkboard-teacher"></i>
                </div>
                <div>
                  <h1 className="lesson-page-title">Lesson Details</h1>
                  <p className="lesson-page-subtitle">
                    <span className={`status-dot ${lesson.status}`}></span>
                    <span className="status-text">
                      {lesson.status.charAt(0).toUpperCase() + lesson.status.slice(1)}
                      {lesson.status === 'confirmed' && ` • ${getTimeUntil()}`}
                    </span>
                  </p>
                </div>
              </div>
              
              <a href="/schedule" className="lesson-back-btn-header">
                <i className="fas fa-arrow-left"></i>
                Back to Schedule
              </a>
            </div>

            {/* Success Notification */}
            {cancelSuccess && (
              <div className={`lesson-notification ${cancelSuccess.refunded ? 'refunded' : ''}`}>
                <i className={`fas ${cancelSuccess.refunded ? 'fa-check-circle' : 'fa-info-circle'}`}></i>
                <span>{cancelSuccess.message}</span>
                {cancelSuccess.refunded && (
                  <span className="refund-badge">Ticket Refunded</span>
                )}
              </div>
            )}

            {/* Main Content Grid */}
            <div className="lesson-grid">
              {/* Left Column - Tutor & Schedule */}
              <div className="lesson-left-column">
                {/* Tutor Card */}
                <div className="lesson-card tutor-card">
                  <div className="lesson-card-header">
                    <i className="fas fa-user-graduate"></i>
                    <h2>Your Tutor</h2>
                  </div>
                  <div className="tutor-profile">
                    <div 
                      className={lesson.tutorAvatar ? "tutor-avatar" : "tutor-avatar placeholder"}
                      style={lesson.tutorAvatar ? { backgroundImage: `url(${lesson.tutorAvatar})` } : undefined}
                    >
                      {!lesson.tutorAvatar && <i className="fas fa-user"></i>}
                    </div>
                    <div className="tutor-info">
                      <h3 className="tutor-name">{lesson.tutorName}</h3>
                      {lesson.tutorBio && (
                        <p className="tutor-bio">{lesson.tutorBio}</p>
                      )}
                      <button onClick={handleViewTutorProfile} className="btn-view-tutor">
                        <i className="fas fa-id-card"></i>
                        View Profile
                      </button>
                    </div>
                  </div>
                </div>

                {/* Schedule Card */}
                <div className="lesson-card schedule-card">
                  <div className="lesson-card-header">
                    <i className="fas fa-calendar-alt"></i>
                    <h2>Schedule</h2>
                  </div>
                  <div className="schedule-details">
                    <div className="schedule-row">
                      <span className="schedule-label">
                        <i className="fas fa-calendar-day"></i>
                        <span>Date</span>
                      </span>
                      <span className="schedule-value">{formatDate(lesson.slotDate)}</span>
                    </div>
                    <div className="schedule-row">
                      <span className="schedule-label">
                        <i className="fas fa-clock"></i>
                        <span>Time</span>
                      </span>
                      <span className="schedule-value">{formatTime(lesson.slotTime)}</span>
                    </div>
                    <div className="schedule-row">
                      <span className="schedule-label">
                        <i className="fas fa-hourglass-half"></i>
                        <span>Duration</span>
                      </span>
                      <span className="schedule-value">{lesson.durationMinutes} min</span>
                    </div>
                    <div className="schedule-row">
                      <span className="schedule-label">
                        <i className="fas fa-bookmark"></i>
                        <span>Booked</span>
                      </span>
                      <span className="schedule-value">
                        {new Date(lesson.bookedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  
                  {lesson.status === 'confirmed' && (
                    <button 
                      className="lesson-cancel-btn-card"
                      onClick={() => setCancelModalOpen(true)}
                    >
                      <i className="fas fa-times-circle"></i>
                      Cancel Lesson
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column - Join Classroom */}
              <div className="lesson-right-column">
                <div className="lesson-card classroom-card">
                  <div className="lesson-card-header">
                    <i className="fas fa-video"></i>
                    <h2>Classroom</h2>
                  </div>
                  
                  {lesson.status === 'confirmed' ? (
                    <div className="classroom-content">
                      {canJoin ? (
                        <>
                          <div className="classroom-icon ready">
                            <i className="fas fa-check-circle"></i>
                          </div>
                          <h3 className="classroom-status">Ready to Join!</h3>
                          <p className="classroom-message">
                            Your classroom is ready. Click below to start your lesson.
                          </p>
                          <button onClick={handleJoinClassroom} className="btn-join-classroom">
                            <i className="fas fa-video"></i>
                            Enter Classroom
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="classroom-icon pending">
                            <i className="fas fa-clock"></i>
                          </div>
                          <h3 className="classroom-status">Not Yet Available</h3>
                          <p className="classroom-message">
                            The classroom will be available 15 minutes before your scheduled lesson time.
                          </p>
                          <div className="classroom-countdown">
                            <span className="countdown-label">Starts</span>
                            <span className="countdown-value">{getTimeUntil()}</span>
                          </div>
                          <button onClick={handleJoinClassroom} className="btn-join-classroom debug">
                            <i className="fas fa-bug"></i>
                            Test Enter (Debug)
                          </button>
                        </>
                      )}
                    </div>
                  ) : lesson.status === 'completed' ? (
                    <div className="classroom-content">
                      <div className="classroom-icon completed">
                        <i className="fas fa-check-double"></i>
                      </div>
                      <h3 className="classroom-status">Lesson Completed</h3>
                      <p className="classroom-message">
                        Great job! You've completed this lesson.
                      </p>
                      <button onClick={() => window.location.href = '/browse-tutors'} className="btn-book-again">
                        <i className="fas fa-calendar-plus"></i>
                        Book Another Lesson
                      </button>
                    </div>
                  ) : (
                    <div className="classroom-content">
                      <div className="classroom-icon cancelled">
                        <i className="fas fa-times-circle"></i>
                      </div>
                      <h3 className="classroom-status">Lesson Cancelled</h3>
                      <p className="classroom-message">
                        This lesson has been cancelled.
                      </p>
                      <button onClick={() => window.location.href = '/schedule'} className="btn-back-schedule">
                        <i className="fas fa-calendar"></i>
                        Back to Schedule
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelModalOpen && lesson && (
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
                  {lesson.tutorAvatar ? (
                    <img src={lesson.tutorAvatar} alt={lesson.tutorName} />
                  ) : (
                    <div className="avatar-placeholder">
                      <i className="fas fa-user"></i>
                    </div>
                  )}
                </div>
                <div className="cancel-lesson-details">
                  <h4>{lesson.tutorName}</h4>
                  <p>
                    <i className="fas fa-calendar"></i>
                    {formatDate(lesson.slotDate)} at {formatTime(lesson.slotTime)}
                  </p>
                  <p>
                    <i className="fas fa-clock"></i>
                    {lesson.durationMinutes} minutes
                  </p>
                </div>
              </div>

              <div className={`refund-notice ${isRefundEligible() ? 'eligible' : 'not-eligible'}`}>
                {isRefundEligible() ? (
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

export default LessonPage;
