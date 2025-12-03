import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { scheduleApi } from '../api/schedule.api';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import Footer from '../Components/Footer/Footer';
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

    // Add 1 hour for Korean timezone
    hours += 1;
    if (hours >= 24) hours -= 24;

    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  };

  const fetchLessonDetails = async () => {
    setLoading(true);
    setError(null);
    
    console.log('\n=== LESSON PAGE: Fetching lesson details ===');
    console.log('bookingId from URL:', bookingId);
    
    try {
      const details = await scheduleApi.getLessonDetails(bookingId);
      console.log('Lesson details received in component:', JSON.stringify(details, null, 2));
      setLesson(details);
    } catch (err: any) {
      console.error('=== ERROR in LessonPage ===');
      console.error('Error message:', err.message);
      console.error('Full error:', err);
      setError(err.message || 'Failed to load lesson details');
    } finally {
      setLoading(false);
      console.log('=== END LESSON PAGE ===\n');
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

  if (loading) {
    return (
      <>
        <Header />
        <div className="lesson-page">
          <SideBar />
          <div className="lesson-main-content">
            <div className="lesson-container">
              <div className="lesson-loading">
                <i className="fas fa-spinner fa-spin"></i>
                <p>Loading lesson details...</p>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (error || !lesson) {
    return (
      <>
        <Header />
        <div className="lesson-page">
          <SideBar />
          <div className="lesson-main-content">
            <div className="lesson-container">
              <div className="lesson-error">
                <i className="fas fa-exclamation-circle"></i>
                <h2>Unable to Load Lesson</h2>
                <p>{error || 'Lesson not found'}</p>
                <button onClick={() => window.location.href = '/schedule'} className="btn-back">
                  Back to Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="lesson-page">
        <SideBar />
        <div className="lesson-main-content">
          <div className="lesson-container">
          {/* Back Button */}
          <button onClick={() => window.history.back()} className="lesson-back-btn">
            <i className="fas fa-arrow-left"></i>
            <span>Back</span>
          </button>

          {/* Lesson Header */}
          <div className="lesson-header">
            <div className="lesson-status-badge" data-status={lesson.status}>
              {lesson.status === 'confirmed' && <i className="fas fa-check-circle"></i>}
              {lesson.status === 'completed' && <i className="fas fa-check-double"></i>}
              {lesson.status === 'cancelled' && <i className="fas fa-times-circle"></i>}
              <span>{lesson.status.charAt(0).toUpperCase() + lesson.status.slice(1)}</span>
            </div>
            <h1 className="lesson-title">Lesson Details</h1>
            {lesson.status === 'confirmed' && (
              <div className="lesson-countdown">
                <i className="fas fa-clock"></i>
                <span>{getTimeUntil()}</span>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="lesson-content">
            {/* Tutor Card */}
            <div className="lesson-card lesson-tutor-card">
              <h2 className="lesson-card-title">
                <i className="fas fa-user-graduate"></i>
                Your Tutor
              </h2>
              <div className="lesson-tutor-info">
                <div 
                  className={lesson.tutorAvatar ? "lesson-tutor-avatar" : "lesson-tutor-avatar placeholder"}
                  style={lesson.tutorAvatar ? { backgroundImage: `url(${lesson.tutorAvatar})` } : undefined}
                >
                  {!lesson.tutorAvatar && <i className="fas fa-user"></i>}
                </div>
                <div className="lesson-tutor-details">
                  <h3 className="lesson-tutor-name">{lesson.tutorName}</h3>
                  {lesson.tutorBio && (
                    <p className="lesson-tutor-bio">{lesson.tutorBio}</p>
                  )}
                  {lesson.hourlyRate && (
                    <div className="lesson-tutor-rate">
                      <i className="fas fa-tag"></i>
                      <span>₱{lesson.hourlyRate}/hour</span>
                    </div>
                  )}
                  <button onClick={handleViewTutorProfile} className="btn-view-profile">
                    <i className="fas fa-id-card"></i>
                    <span>View Profile</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Schedule Card */}
            <div className="lesson-card lesson-schedule-card">
              <h2 className="lesson-card-title">
                <i className="fas fa-calendar-alt"></i>
                Schedule
              </h2>
              <div className="lesson-schedule-details">
                <div className="lesson-detail-row">
                  <div className="lesson-detail-label">
                    <i className="fas fa-calendar"></i>
                    <span>Date</span>
                  </div>
                  <div className="lesson-detail-value">
                    {formatDate(lesson.slotDate)}
                  </div>
                </div>
                <div className="lesson-detail-row">
                  <div className="lesson-detail-label">
                    <i className="fas fa-clock"></i>
                    <span>Time</span>
                  </div>
                  <div className="lesson-detail-value">
                    {formatTime(lesson.slotTime)}
                  </div>
                </div>
                <div className="lesson-detail-row">
                  <div className="lesson-detail-label">
                    <i className="fas fa-hourglass-half"></i>
                    <span>Duration</span>
                  </div>
                  <div className="lesson-detail-value">
                    {lesson.durationMinutes} minutes
                  </div>
                </div>
                <div className="lesson-detail-row">
                  <div className="lesson-detail-label">
                    <i className="fas fa-check"></i>
                    <span>Booked</span>
                  </div>
                  <div className="lesson-detail-value">
                    {new Date(lesson.bookedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Card */}
            <div className="lesson-card lesson-action-card">
              <h2 className="lesson-card-title">
                <i className="fas fa-video"></i>
                Join Classroom
              </h2>
              
              {lesson.status === 'confirmed' ? (
                <>
                  {canJoin ? (
                    <div className="lesson-join-ready">
                      <div className="lesson-join-icon">
                        <i className="fas fa-check-circle"></i>
                      </div>
                      <p className="lesson-join-message">
                        Your classroom is ready! Click the button below to join your lesson.
                      </p>
                      <button onClick={handleJoinClassroom} className="btn-join-classroom">
                        <i className="fas fa-video"></i>
                        <span>Enter Classroom</span>
                      </button>
                      <p className="lesson-join-note">
                        <i className="fas fa-info-circle"></i>
                        Make sure your camera and microphone are ready
                      </p>
                    </div>
                  ) : (
                    <div className="lesson-join-pending">
                      <div className="lesson-join-icon pending">
                        <i className="fas fa-clock"></i>
                      </div>
                      <p className="lesson-join-message">
                        The classroom will be available 15 minutes before your scheduled lesson time.
                      </p>
                      <p className="lesson-join-countdown">
                        {getTimeUntil()}
                      </p>
                    </div>
                  )}
                </>
              ) : lesson.status === 'completed' ? (
                <div className="lesson-join-completed">
                  <div className="lesson-join-icon completed">
                    <i className="fas fa-check-double"></i>
                  </div>
                  <p className="lesson-join-message">
                    This lesson has been completed.
                  </p>
                  <button onClick={() => window.location.href = '/browse-tutors'} className="btn-book-another">
                    <i className="fas fa-calendar-plus"></i>
                    <span>Book Another Lesson</span>
                  </button>
                </div>
              ) : (
                <div className="lesson-join-unavailable">
                  <div className="lesson-join-icon unavailable">
                    <i className="fas fa-times-circle"></i>
                  </div>
                  <p className="lesson-join-message">
                    This lesson is not available.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Tips Section */}
          <div className="lesson-tips">
            <h3 className="lesson-tips-title">
              <i className="fas fa-lightbulb"></i>
              Tips for a Great Lesson
            </h3>
            <div className="lesson-tips-grid">
              <div className="lesson-tip">
                <i className="fas fa-wifi"></i>
                <p>Ensure stable internet connection</p>
              </div>
              <div className="lesson-tip">
                <i className="fas fa-microphone"></i>
                <p>Test your microphone beforehand</p>
              </div>
              <div className="lesson-tip">
                <i className="fas fa-video"></i>
                <p>Check your camera is working</p>
              </div>
              <div className="lesson-tip">
                <i className="fas fa-headphones"></i>
                <p>Use headphones for better audio</p>
              </div>
              <div className="lesson-tip">
                <i className="fas fa-book"></i>
                <p>Have materials ready</p>
              </div>
              <div className="lesson-tip">
                <i className="fas fa-smile"></i>
                <p>Be on time and ready to learn</p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default LessonPage;
