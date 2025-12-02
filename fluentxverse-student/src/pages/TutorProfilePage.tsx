import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { tutorApi } from '../api/tutor.api';
import type { TutorProfile } from '../types/tutor.types';
import Header from '../Components/Header/Header';
import './TutorProfilePage.css';

export const TutorProfilePage = () => {
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
  const [availability, setAvailability] = useState<Array<{ date: string; time: string; status: 'AVAIL' | 'TAKEN' | 'BOOKED'; studentId?: string }>>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'morning' | 'afternoon' | 'evening'>('morning');

  // Generate 30-minute interval time slots for Asia/Seoul based on selected period
  // Tutor opens Philippine time 05:00 - 23:30; student sees equivalent in Asia/Seoul.
  // We only slice by period for UI, but total slots reflect full range.
  const getPeriodTimeSlots = (period: 'morning' | 'afternoon' | 'evening') => {
    // Full PH range converted visually to Seoul labels; slicing per period
    // Define period visual ranges in Seoul time
    // Manual mapping per user instruction
    let slots: string[] = [];
    if (period === 'morning') {
      for (let h = 6; h < 12; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        slots.push(`${String(h).padStart(2, '0')}:30`);
      }
      slots.push('11:30');
    } else if (period === 'afternoon') {
      for (let h = 12; h < 17; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        slots.push(`${String(h).padStart(2, '0')}:30`);
      }
      slots.push('17:30');
    } else if (period === 'evening') {
      for (let h = 18; h < 24; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        slots.push(`${String(h).padStart(2, '0')}:30`);
      }
      slots.push('24:00');
      slots.push('24:30');
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
    window.location.href = `/register?tutorId=${tutorId}`;
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="tutor-profile-loading">
          <div className="spinner"></div>
          <p>Loading tutor profile...</p>
        </div>
      </>
    );
  }

  if (error || !tutor) {
    return (
      <>
        <Header />
        <div className="tutor-profile-error">
          <i className="ri-error-warning-line"></i>
          <h2>Tutor not found</h2>
          <p>{error || 'The tutor you are looking for does not exist.'}</p>
          <a href="/browse-tutors" className="btn-primary">Browse Tutors</a>
        </div>
      </>
    );
  }

  const displayName = tutor.displayName || `${tutor.firstName} ${tutor.lastName}`;
  const initials = `${tutor.firstName?.[0] || ''}${tutor.lastName?.[0] || ''}`.toUpperCase();
  const hourlyRate = tutor.hourlyRate ? `₱${tutor.hourlyRate}` : 'Free';

  return (
    <>
      <Header />
      <div className="tutor-profile-page">
        <div className="profile-container">
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
                      Available Now
                    </div>
                  )}
                </div>

                {/* Mobile Book Button */}
                <button onClick={handleBookTrial} className="btn-book-mobile">
                  <i className="ri-calendar-line"></i>
                  Book Trial Lesson
                </button>
              </div>

              {/* Right: Details */}
              <div className="profile-header-right">
                <div className="profile-title-row">
                  <h1 className="profile-name">{displayName}</h1>
                  {tutor.isVerified && (
                    <div className="verified-badge">
                      <i className="ri-verified-badge-fill"></i>
                      <span>Verified</span>
                    </div>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="profile-quick-stats">
                  <div className="stat-item">
                    <i className="ri-star-fill"></i>
                    <span className="stat-value">{tutor.rating ? tutor.rating.toFixed(1) : 'New'}</span>
                    {(tutor?.totalReviews ?? 0) > 0 && <span className="stat-label">({tutor.totalReviews} reviews)</span>}
                  </div>
                  <div className="stat-divider"></div>
                  <div className="stat-item">
                    <i className="ri-video-chat-line"></i>
                    <span className="stat-value">{tutor.totalSessions || 0}</span>
                    <span className="stat-label">lessons</span>
                  </div>
                  {tutor.experienceYears && (
                    <>
                      <div className="stat-divider"></div>
                      <div className="stat-item">
                        <i className="ri-award-line"></i>
                        <span className="stat-value">{tutor.experienceYears}</span>
                        <span className="stat-label">years exp.</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Languages & Country */}
                <div className="profile-meta">
                  {tutor.languages && tutor.languages.length > 0 && (
                    <div className="meta-item">
                      <i className="ri-translate-2"></i>
                      <span>Speaks: {tutor.languages.join(', ')}</span>
                    </div>
                  )}
                  {tutor.country && (
                    <div className="meta-item">
                      <i className="ri-map-pin-line"></i>
                      <span>{tutor.country}</span>
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

            {/* Booking Card (Desktop) */}
            <div className="profile-booking-card">
              <div className="booking-card-price">
                <span className="price-label">Trial Lesson</span>
                <div className="price-value">{hourlyRate}<span className="price-unit">/30min</span></div>
              </div>
              
              <button onClick={handleBookTrial} className="btn-book-trial">
                <i className="ri-calendar-check-line"></i>
                Book Trial Lesson
              </button>

              <div className="booking-features">
                <div className="feature-item">
                  <i className="ri-checkbox-circle-line"></i>
                  <span>Cancel anytime</span>
                </div>
                <div className="feature-item">
                  <i className="ri-checkbox-circle-line"></i>
                  <span>30-minute session</span>
                </div>
                <div className="feature-item">
                  <i className="ri-checkbox-circle-line"></i>
                  <span>Instant confirmation</span>
                </div>
              </div>

              <button className="btn-message">
                <i className="ri-message-3-line"></i>
                Send Message
              </button>

              <div className="booking-note">
                <i className="ri-information-line"></i>
                <span>Get to know this tutor with a trial lesson</span>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="profile-tabs">
            <button 
              className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
              onClick={() => setActiveTab('about')}
            >
              <i className="ri-user-line"></i>
              About
            </button>
            <button 
              className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              <i className="ri-calendar-line"></i>
              Schedule
            </button>
            <button 
              className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
              onClick={() => setActiveTab('reviews')}
            >
              <i className="ri-star-line"></i>
              Reviews ({tutor.totalReviews || 0})
            </button>
          </div>

          {/* Tab Content */}
          <div className="profile-content">
            {activeTab === 'about' && (
              <div className="tab-content">
                {/* Introduction Video */}
                {tutor.videoIntroUrl && (
                  <section className="content-section">
                    <h2 className="section-title">
                      <i className="ri-video-line"></i>
                      Introduction Video
                    </h2>
                    <div className="video-player-wrapper">
                      <div className="video-placeholder">
                        <i className="ri-play-circle-fill"></i>
                        <button onClick={() => setShowVideoModal(true)} className="btn-play">
                          Watch Introduction
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* About Me */}
                <section className="content-section">
                  <h2 className="section-title">
                    <i className="ri-user-smile-line"></i>
                    About Me
                  </h2>
                  <div className="section-content">
                    <p>{tutor.introduction || tutor.bio || 'This tutor has not provided an introduction yet.'}</p>
                  </div>
                </section>

                {/* Teaching Experience */}
                <section className="content-section">
                  <h2 className="section-title">
                    <i className="ri-graduation-cap-line"></i>
                    Teaching Experience
                  </h2>
                  <div className="section-content">
                    <div className="experience-grid">
                      {tutor.experienceYears && (
                        <div className="experience-item">
                          <div className="experience-icon">
                            <i className="ri-time-line"></i>
                          </div>
                          <div className="experience-details">
                            <strong>{tutor.experienceYears} Years</strong>
                            <span>Teaching Experience</span>
                          </div>
                        </div>
                      )}
                      <div className="experience-item">
                        <div className="experience-icon">
                          <i className="ri-user-voice-line"></i>
                        </div>
                        <div className="experience-details">
                          <strong>{tutor.totalSessions || 0} Lessons</strong>
                          <span>Completed on Platform</span>
                        </div>
                      </div>
                      {tutor.rating && (
                        <div className="experience-item">
                          <div className="experience-icon">
                            <i className="ri-star-line"></i>
                          </div>
                          <div className="experience-details">
                            <strong>{tutor.rating.toFixed(1)} Rating</strong>
                            <span>Average Student Rating</span>
                          </div>
                        </div>
                      )}
                    </div>
                    {tutor.teachingStyle && (
                      <div className="teaching-style">
                        <h3>Teaching Approach</h3>
                        <p>{tutor.teachingStyle}</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Education & Certifications */}
                {(tutor.education?.length || tutor.certifications?.length) && (
                  <section className="content-section">
                    <h2 className="section-title">
                      <i className="ri-award-line"></i>
                      Education & Certifications
                    </h2>
                    <div className="section-content">
                      {tutor.education && tutor.education.length > 0 && (
                        <div className="credentials-group">
                          <h3>Education</h3>
                          <ul className="credentials-list">
                            {tutor.education.map((edu, idx) => (
                              <li key={idx}>
                                <i className="ri-book-line"></i>
                                <span>{edu}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {tutor.certifications && tutor.certifications.length > 0 && (
                        <div className="credentials-group">
                          <h3>Certifications</h3>
                          <ul className="credentials-list">
                            {tutor.certifications.map((cert, idx) => (
                              <li key={idx}>
                                <i className="ri-medal-line"></i>
                                <span>{cert}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Specializations */}
                {tutor.specializations && tutor.specializations.length > 0 && (
                  <section className="content-section">
                    <h2 className="section-title">
                      <i className="ri-lightbulb-line"></i>
                      Areas of Expertise
                    </h2>
                    <div className="section-content">
                      <div className="specializations-grid">
                        {tutor.specializations.map((spec, idx) => (
                          <div key={idx} className="specialization-card">
                            <i className="ri-check-line"></i>
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
                    <i className="ri-calendar-check-line"></i>
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
                              const label = status === 'TAKEN' ? 'TAKEN' : status === 'BOOKED' ? 'BOOKED' : status === 'AVAIL' ? 'AVAIL' : '';
                              return (
                                <td key={dayIdx} className={`slot ${label || 'disabled'}`}>
                                  {label}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="schedule-legend">
                      <span className="legend-item avail">AVAIL</span>
                      <span className="legend-item taken">TAKEN</span>
                      <span className="legend-item booked">BOOKED</span>
                      <span className="legend-item disabled">Unavailable</span>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="tab-content">
                <section className="content-section">
                  <h2 className="section-title">
                    <i className="ri-star-line"></i>
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
      </div>
    </>
  );
};

export default TutorProfilePage;
