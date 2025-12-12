import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { tutorApi } from '../api/tutor.api';
import type { TutorProfile } from '../types/tutor.types';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { BookingModal } from '../Components/Booking/BookingModal';
import { useAuthContext } from '../context/AuthContext';
import VideoPlayer from '../Components/Common/VideoPlayer';
import './TutorProfilePage.css';

export const TutorProfilePage = () => {
  const { user } = useAuthContext();
  
  useEffect(() => {
    document.title = 'Tutor Profile | FluentXVerse';
  }, []);

  const { params } = useRoute();
  const tutorId = params.tutorId;

  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'about' | 'schedule' | 'reviews'>('about');
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [availability, setAvailability] = useState<Array<{ date: string; time: string; status: 'AVAIL' | 'TAKEN' | 'BOOKED'; studentId?: string }>>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [preSelectedSlot, setPreSelectedSlot] = useState<{ date: string; time: string } | null>(null);

  // Generate 30-minute interval time slots for Asia/Seoul based on selected period
  // Tutor opens Philippine time 05:00 - 23:30; student sees equivalent in Asia/Seoul (+1 hour).
  // PHT 05:00-23:30 => KST 06:00-00:30 (next day)
  const getPeriodTimeSlots = (period: 'morning' | 'afternoon' | 'evening') => {
    let slots: string[] = [];
    if (period === 'morning') {
      // KST 06:00 - 11:30
      for (let h = 6; h < 12; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        slots.push(`${String(h).padStart(2, '0')}:30`);
      }
    } else if (period === 'afternoon') {
      // KST 12:00 - 17:30
      for (let h = 12; h < 18; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        slots.push(`${String(h).padStart(2, '0')}:30`);
      }
    } else if (period === 'evening') {
      // KST 18:00 - 00:30 (next day shown as 24:00, 24:30)
      for (let h = 18; h < 24; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        slots.push(`${String(h).padStart(2, '0')}:30`);
      }
      // Add next day times (00:00, 00:30 displayed as 24:00, 24:30 for continuity)
      slots.push('00:00');
      slots.push('00:30');
    }
    return slots;
  };

  const timeSlots = getPeriodTimeSlots(selectedPeriod);

  // Helper to format next 7 days with weekday and month abbreviation in Asia/Seoul time
  const getNextSevenDays = () => {
    const days: { key: string; label: string }[] = [];
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const parts = fmt.formatToParts(date);
      const weekday = parts.find(p => p.type === 'weekday')?.value || '';
      const month = parts.find(p => p.type === 'month')?.value || '';
      const day = parts.find(p => p.type === 'day')?.value || '';
      const label = `${weekday} ${month} ${day}`; // e.g., Mon Nov 29
      const key = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().split('T')[0];
      days.push({ key, label });
    }
    return days;
  };

  useEffect(() => {
    const loadTutor = async () => {
      try {
        setLoading(true);
        const data = await tutorApi.getTutorProfile(tutorId);
        setTutor(data);
      } catch (err) {
        setError('Failed to load tutor profile');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (tutorId) {
      loadTutor();
    }
  }, [tutorId]);

  useEffect(() => {
    const loadAvailability = async () => {
      try {
        if (!tutorId) return;
        const data = await tutorApi.getAvailability(tutorId);
        setAvailability(data);
      } catch (err) {
        console.error('Failed to load availability', err);
      }
    };
    loadAvailability();
  }, [tutorId]);

  const handleBookTrial = () => {
    setPreSelectedSlot(null);
    setBookingModalOpen(true);
  };

  const handleSlotClick = (date: string, time: string, status: string) => {
    if (status === 'AVAIL') {
      // time is already in 24h KST format (e.g., "19:00")
      // Pass it directly - the BookingModal will convert PHT slots to KST for matching
      setPreSelectedSlot({ date, time });
      setBookingModalOpen(true);
    }
  };

  if (loading) {
    return (
      <>
        <SideBar />
        <div className={`main-content ${!user ? 'no-sidebar' : ''}`}>
          <Header />
          <div className="tutor-profile-loading">
            <div className="spinner"></div>
            <p>Loading tutor profile...</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !tutor) {
    return (
      <>
        <SideBar />
        <div className={`main-content ${!user ? 'no-sidebar' : ''}`}>
          <Header />
          <div className="tutor-profile-error">
            <i className="fi-sr-exclamation"></i>
            <h2>Tutor not found</h2>
            <p>{error || 'The tutor you are looking for does not exist.'}</p>
            <a href="/browse-tutors" className="btn-primary">Browse Tutors</a>
          </div>
        </div>
      </>
    );
  }

  const displayName = tutor.displayName || `${tutor.firstName} ${tutor.lastName}`;
  const initials = `${tutor.firstName?.[0] || ''}${tutor.lastName?.[0] || ''}`.toUpperCase();
  const hourlyRate = tutor.hourlyRate ? `₱${tutor.hourlyRate}` : 'Free';

  return (
    <>
      <SideBar />
      <div className={`main-content ${!user ? 'no-sidebar' : ''}`}>
        <Header />
        <div className="tutor-profile-page">
          <div className="profile-layout">
            {/* Main Content Column */}
            <div className="profile-main-column">
              {/* Hero Section */}
              <div className="profile-hero">
                <div className="profile-hero-content">
                  {/* Left: Avatar & Basic Info */}
                  <div className="profile-header-left">
                    <div className="profile-avatar-wrapper">
                      {tutor.profilePicture ? (
                      <img src={tutor.profilePicture} alt={displayName} className="profile-avatar-large" />
                    ) : (
                      <div className="profile-avatar-large profile-avatar-placeholder">{initials}</div>
                    )}
                    {tutor.isAvailable && (
                      <div className="availability-badge">
                        <span className="pulse-dot"></span>
                        Available
                      </div>
                    )}
                  </div>

                  {/* Mobile Book Button */}
                  <button onClick={handleBookTrial} className="btn-book-mobile">
                    <i className="fi-sr-calendar"></i>
                    Book Trial Lesson
                  </button>
                </div>

                {/* Right: Details */}
                <div className="profile-header-right">
                  <h1 className="profile-name">{displayName}</h1>

                  {/* Star Rating */}
                  <div className="profile-rating-row">
                    <div className="star-rating">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <i 
                          key={star} 
                          className={`fi-sr-star ${star <= Math.round(tutor.rating || 0) ? 'filled' : 'empty'}`}
                        ></i>
                      ))}
                    </div>
                    <span className="rating-score">{(tutor.rating || 0).toFixed(1)}</span>
                    <span className="rating-count">({tutor.totalReviews || 0} reviews)</span>
                    {tutor.isVerified && (
                      <div className="verified-badge">
                        <i className="fi-sr-badge-check"></i>
                        <span>Verified</span>
                      </div>
                    )}
                  </div>

                  {/* Languages & Country */}
                  <div className="profile-meta">
                    {tutor.languages && tutor.languages.length > 0 && (
                      <div className="meta-item">
                        <i className="fi-sr-globe"></i>
                        <span>Speaks: {tutor.languages.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Short Bio */}
                  {tutor.bio && (
                    <p className="profile-bio-short">
                      {tutor.bio.length > 150 ? `${tutor.bio.substring(0, 150)}...` : tutor.bio}
                    </p>
                  )}

                  {/* Specializations Tags */}
                  {tutor.specializations && tutor.specializations.length > 0 && (
                    <div className="profile-tags">
                      {tutor.specializations.slice(0, 5).map((spec, idx) => (
                        <span key={idx} className="tag">{spec}</span>
                      ))}
                      {tutor.specializations.length > 5 && (
                        <span className="tag tag-more">+{tutor.specializations.length - 5} more</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Video Introduction - Inside Hero Card but outside hero-content for full width */}
              {tutor.videoIntroUrl && (
                <div className="hero-video-section">
                  <h3 className="video-section-title">
                    <i className="fi-sr-play"></i>
                    Introduction Video
                  </h3>
                  <VideoPlayer src={tutor.videoIntroUrl} />
                </div>
              )}
            </div>

              {/* Tabs Navigation */}
              <div className="profile-tabs">
                <button 
                  className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
                  onClick={() => setActiveTab('about')}
                >
                  <i className="fi-sr-user"></i>
                  About
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
                  onClick={() => setActiveTab('schedule')}
                >
                  <i className="fi-sr-calendar"></i>
                  Schedule
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
                  onClick={() => setActiveTab('reviews')}
                >
                  <i className="fi-sr-star"></i>
                  Reviews ({tutor.totalReviews || 0})
                </button>
              </div>

              {/* Tab Content */}
              <div className="profile-content">
            {activeTab === 'about' && (
              <div className="tab-content">
                {/* About Me */}
                <section className="content-section">
                  <h2 className="section-title">
                    <i className="fi-sr-user"></i>
                    About Me
                  </h2>
                  <div className="section-content">
                    <p>{tutor.introduction || tutor.bio || 'This tutor has not provided an introduction yet.'}</p>
                  </div>
                </section>

                {/* Education */}
                {(tutor.schoolAttended || (tutor.education && tutor.education.length > 0)) && (
                  <section className="content-section">
                    <h2 className="section-title">
                      <i className="fi-sr-graduation-cap"></i>
                      Education
                    </h2>
                    <div className="section-content">
                      <div className="education-info">
                        {tutor.schoolAttended ? (
                          <>
                            <div className="education-row">
                              <i className="fi-sr-school"></i>
                              <span className="education-label">University:</span>
                              <strong>{tutor.schoolAttended}</strong>
                            </div>
                            {tutor.major && (
                              <div className="education-row">
                                <i className="fi-sr-diploma"></i>
                                <span className="education-label">Degree:</span>
                                <strong>{tutor.major}</strong>
                              </div>
                            )}
                          </>
                        ) : (
                          tutor.education?.map((edu, idx) => (
                            <div key={idx} className="education-row">
                              <div className="education-details">
                                <i className="fi-sr-school"></i>
                                <strong>{edu}</strong>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </section>
                )}

                {/* Interests */}
                {tutor.interests && tutor.interests.length > 0 && (
                  <section className="content-section">
                    <h2 className="section-title">
                      <i className="fi-sr-heart"></i>
                      Interests
                    </h2>
                    <div className="section-content">
                      <div className="interests-grid">
                        {tutor.interests.map((interest, idx) => (
                          <div key={idx} className="interest-tag">
                            <i className="fi-sr-star"></i>
                            <span>{interest}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}

                {/* Specializations */}
                {tutor.specializations && tutor.specializations.length > 0 && (
                  <section className="content-section">
                    <h2 className="section-title">
                      <i className="fi-sr-bulb"></i>
                      Areas of Expertise
                    </h2>
                    <div className="section-content">
                      <div className="specializations-grid">
                        {tutor.specializations.map((spec, idx) => (
                          <div key={idx} className="specialization-card">
                            <i className="fi-sr-check"></i>
                            <span>{spec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="tab-content">
                <section className="content-section">
                  <h2 className="section-title">
                    <i className="fi-sr-calendar"></i>
                    Available Time Slots
                  </h2>
                  {/* Period Tabs */}
                  <div className="schedule-period-tabs">
                    <button className={`period-tab ${selectedPeriod === 'morning' ? 'active' : ''}`} onClick={() => setSelectedPeriod('morning')}>Morning</button>
                    <button className={`period-tab ${selectedPeriod === 'afternoon' ? 'active' : ''}`} onClick={() => setSelectedPeriod('afternoon')}>Afternoon</button>
                    <button className={`period-tab ${selectedPeriod === 'evening' ? 'active' : ''}`} onClick={() => setSelectedPeriod('evening')}>Evening</button>
                    <div className="timezone-note">
                      <img src="https://flagcdn.com/w40/kr.png" alt="KR" style={{ width: '24px', height: '16px', borderRadius: '3px' }} />
                      <span>Seoul Time (Asia/Seoul)</span>
                      <span style={{ marginLeft: '8px', color: '#94a3b8' }}>(Tutor opens slots in Philippine Time 05:00–23:30)</span>
                    </div>
                  </div>
                  <div className="schedule-grid">
                    <table className="schedule-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          {getNextSevenDays().map((d, i) => (
                            <th key={i}>{d.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {timeSlots.map((time) => (
                          <tr key={time}>
                            <td className="time-col">{time}</td>
                            {getNextSevenDays().map((d, dayIdx) => {
                              const dateStr = d.key;
                              const slot = availability.find((s) => s.date === dateStr && s.time === time);
                              const status = slot?.status;
                              // Only show AVAIL or student's own BOOKED slots
                              const isMyBooking = status === 'BOOKED' && slot?.studentId === user?.userId;
                              const isAvailable = status === 'AVAIL';
                              const showSlot = isAvailable || isMyBooking;
                              const label = isMyBooking ? 'BOOKED' : isAvailable ? 'AVAIL' : '';
                              const isClickable = isAvailable;
                              return (
                                <td 
                                  key={dayIdx} 
                                  className={`slot ${showSlot ? (isMyBooking ? 'my-booking' : 'avail') : 'disabled'} ${isClickable ? 'clickable' : ''}`}
                                  onClick={() => isClickable && handleSlotClick(dateStr, time, status || '')}
                                  style={isClickable ? { cursor: 'pointer' } : undefined}
                                  title={isClickable ? 'Click to book this slot' : isMyBooking ? 'Your booked lesson' : undefined}
                                >
                                  {label}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="tab-content">
                <section className="content-section">
                  <h2 className="section-title">
                    <i className="fi-sr-star"></i>
                    Student Reviews
                  </h2>
                  {tutor.totalReviews && tutor.totalReviews > 0 ? (
                    <div className="reviews-summary">
                      <div className="reviews-overview">
                        <div className="overall-rating">
                          <span className="rating-big">{tutor.rating?.toFixed(1)}</span>
                          <div className="rating-stars">
                            {[1, 2, 3, 4, 5].map(star => (
                              <i key={star} className={`ri-star-${star <= (tutor.rating || 0) ? 'fill' : 'line'}`}></i>
                            ))}
                          </div>
                          <span className="rating-count">{tutor.totalReviews} reviews</span>
                        </div>
                      </div>
                      <div className="reviews-list-placeholder">
                        <p>Review details coming soon!</p>
                      </div>
                    </div>
                  ) : (
                    <div className="no-reviews">
                      <i className="ri-chat-quote-line"></i>
                      <p>This tutor doesn't have any reviews yet.</p>
                      <p className="no-reviews-hint">Be the first to book a lesson and leave a review!</p>
                    </div>
                  )}
                </section>
              </div>
            )}
              </div>
            </div>

            {/* Sidebar: Booking Card (Desktop) */}
            <div className="profile-sidebar">
              <div className="profile-booking-card">
                <div className="booking-card-price">
                  <span className="price-label">Trial Lesson</span>
                  <div className="price-value">{hourlyRate}<span className="price-unit">/25min</span></div>
                </div>
                
                <button onClick={handleBookTrial} className="btn-book-trial">
                  <i className="fi-sr-calendar"></i>
                  Book Trial Lesson
                </button>

                <div className="booking-features">
                  <div className="feature-item">
                    <i className="fi-sr-checkbox"></i>
                    <span>Cancel anytime</span>
                  </div>
                  <div className="feature-item">
                    <i className="fi-sr-checkbox"></i>
                    <span>25-minute session</span>
                  </div>
                  <div className="feature-item">
                    <i className="fi-sr-checkbox"></i>
                    <span>Instant confirmation</span>
                  </div>
                </div>

                <div className="booking-note">
                  <i className="fi-sr-info"></i>
                  <span>Get to know this tutor with a trial lesson</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {tutor && (
        <BookingModal
          isOpen={bookingModalOpen}
          onClose={() => {
            setBookingModalOpen(false);
            setPreSelectedSlot(null);
          }}
          tutorId={tutor.userId}
          tutorName={displayName}
          tutorAvatar={tutor.profilePicture}
          hourlyRate={tutor.hourlyRate}
          preSelectedDate={preSelectedSlot?.date}
          preSelectedTime={preSelectedSlot?.time}
        />
      )}
    </>
  );
};

export default TutorProfilePage;
