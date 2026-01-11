import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useRoute } from 'preact-iso';
import { tutorApi } from '../api/tutor.api';
import { favoritesApi } from '../api/favorites.api';
import { scheduleApi, type AvailableSlot } from '../api/schedule.api';
import type { TutorProfile } from '../types/tutor.types';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { BookingModal } from '../Components/Booking/BookingModal';
import { useAuthContext } from '../context/AuthContext';
import VideoPlayer from '../Components/Common/VideoPlayer';
import { Toast, useToast } from '../Components/Common/Toast';
import { getTicketBalance } from '../services/ticket.service';
import './TutorProfilePage.css';

export const TutorProfilePage = () => {
  const { user } = useAuthContext();
  const { toasts, removeToast, showSuccess, showError } = useToast();
  
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
  const [isFavorite, setIsFavorite] = useState(false);
  const [hasTrialTickets, setHasTrialTickets] = useState(false);
  const [hasAnyTickets, setHasAnyTickets] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [rawSlots, setRawSlots] = useState<AvailableSlot[]>([]); // Raw PHT slots from API
  const [availability, setAvailability] = useState<Array<{ date: string; time: string; status: 'AVAIL' | 'TAKEN' | 'BOOKED'; studentId?: string; slotId?: string }>>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'morning' | 'afternoon' | 'evening'>('evening');
  const [preSelectedSlot, setPreSelectedSlot] = useState<{ date: string; time: string } | null>(null);

  // Convert PHT time to KST (add 1 hour, handle date rollover)
  const convertPHTtoKST = (phDateString: string, phTimeString: string): { date: string; time: string } => {
    let hours: number;
    let minutes: string;
    
    // Normalize time string
    const normalizedTime = phTimeString.trim();
    
    // Try 12-hour format first (e.g., "6:00 PM")
    const time12Match = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (time12Match) {
      hours = parseInt(time12Match[1], 10);
      minutes = time12Match[2];
      const period = time12Match[3].toUpperCase();
      
      if (period === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }
    } else {
      // Try 24-hour format
      const time24Match = normalizedTime.match(/^(\d{1,2}):(\d{2})$/);
      if (time24Match) {
        hours = parseInt(time24Match[1], 10);
        minutes = time24Match[2];
      } else {
        return { date: phDateString, time: phTimeString };
      }
    }

    // Add 1 hour for KST
    hours += 1;

    // Handle date rollover
    let resultDate = phDateString;
    if (hours >= 24) {
      hours -= 24;
      const [year, month, day] = phDateString.split('-').map(Number);
      const nextDayDate = new Date(year, month - 1, day + 1);
      resultDate = `${nextDayDate.getFullYear()}-${String(nextDayDate.getMonth() + 1).padStart(2, '0')}-${String(nextDayDate.getDate()).padStart(2, '0')}`;
    }

    return { date: resultDate, time: `${String(hours).padStart(2, '0')}:${minutes}` };
  };

  // Generate 30-minute interval time slots for Asia/Seoul based on selected period
  // Tutor opens Philippine time 06:00 - 23:30; student sees equivalent in Asia/Seoul (+1 hour).
  // PHT 06:00-23:30 => KST 07:00-00:30 (next day)
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
      // KST 18:00 - 00:30 (next day)
      // PHT 6:00 PM (18:00) = KST 19:00
      // PHT 11:30 PM (23:30) = KST 00:30 next day
      for (let h = 19; h < 24; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`);
        slots.push(`${String(h).padStart(2, '0')}:30`);
      }
      // Add next day times (00:00, 00:30)
      slots.push('00:00');
      slots.push('00:30');
    }
    return slots;
  };

  const timeSlots = getPeriodTimeSlots(selectedPeriod);

  // Helper to format next 7 days with weekday and month abbreviation in Asia/Seoul time
  const getNextSevenDays = () => {
    const days: { key: string; label: string }[] = [];
    
    // Format for display label
    const labelFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    
    // Format for extracting date parts in KST
    const dateFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      const label = labelFmt.format(date); // e.g., "Sun Jan 11"
      const key = dateFmt.format(date); // YYYY-MM-DD format in KST timezone
      
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
        
        // Get next 7 days in PHT format for API query
        const now = new Date();
        const startDate = now.toISOString().split('T')[0];
        const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // Fetch raw PHT slots from the same API that BookingModal uses
        const slots = await scheduleApi.getAvailableSlots(tutorId, startDate, endDate);
        console.log('🗓️ Raw PHT slots from API:', slots);
        setRawSlots(slots);
        
        // Convert each slot to KST for display in the grid
        const convertedSlots = slots.map(slot => {
          const { date, time } = convertPHTtoKST(slot.date, slot.time);
          console.log(`🗓️ Converted: ${slot.date} ${slot.time} PHT -> ${date} ${time} KST`);
          return {
            date,
            time,
            status: 'AVAIL' as const,
            slotId: slot.slotId // Keep slotId for booking
          };
        });
        
        console.log('🗓️ Converted KST slots:', convertedSlots);
        console.log('🗓️ Next 7 days:', getNextSevenDays());
        setAvailability(convertedSlots);
      } catch (err) {
        console.error('Failed to load availability', err);
      }
    };
    loadAvailability();
  }, [tutorId]);

  // Check if user has tickets
  useEffect(() => {
    const checkTickets = async () => {
      if (user?.walletAddress) {
        setTicketsLoading(true);
        try {
          const balance = await getTicketBalance(user.walletAddress);
          setHasTrialTickets(balance.trial > 0);
          setHasAnyTickets(balance.basic > 0 || balance.premium > 0 || balance.trial > 0);
        } catch (err) {
          console.error('Failed to check tickets', err);
        } finally {
          setTicketsLoading(false);
        }
      } else {
        setTicketsLoading(false);
      }
    };
    checkTickets();
  }, [user?.walletAddress]);

  // Check if tutor is in favorites
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (user && tutorId) {
        try {
          const isFav = await favoritesApi.checkFavorite(tutorId);
          setIsFavorite(isFav);
        } catch (err) {
          console.error('Failed to check favorite status', err);
        }
      }
    };
    checkFavoriteStatus();
  }, [user, tutorId]);

  const handleToggleFavorite = async () => {
    if (!user) {
      showError('Please log in to add favorites');
      return;
    }
    
    try {
      const result = await favoritesApi.toggleFavorite(tutorId, isFavorite);
      if (result.success) {
        setIsFavorite(result.isFavorite);
        if (result.isFavorite) {
          showSuccess('Added to favorites!');
        } else {
          showSuccess('Removed from favorites');
        }
      }
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      showError('Failed to update favorites');
    }
  };

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
                  <div className="profile-name-row">
                    <h1 className="profile-name">{displayName}</h1>
                    {user && (
                      <button 
                        onClick={handleToggleFavorite} 
                        className={`btn-favorite-star ${isFavorite ? 'favorited' : ''}`}
                        title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                      >
                        <i className={isFavorite ? "fas fa-star" : "far fa-star"}></i>
                      </button>
                    )}
                  </div>

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
                        <i className="fi-sr-check"></i>
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
                      <span style={{ marginLeft: '8px', color: '#94a3b8' }}>(Tutor opens slots in Philippine Time 06:00–23:30)</span>
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
                              let dateStr = d.key;
                              
                              // For evening period: 00:00 and 00:30 slots belong to the NEXT day in KST
                              // So when looking at column "Jan 11", we need to find slots with date "Jan 12" for 00:00/00:30
                              if (selectedPeriod === 'evening' && (time === '00:00' || time === '00:30')) {
                                const [year, month, day] = d.key.split('-').map(Number);
                                const nextDay = new Date(year, month - 1, day + 1);
                                dateStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
                              }
                              
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
                {ticketsLoading ? (
                  <div className="booking-card-loading">
                    <div className="loading-spinner"></div>
                    <span>Loading...</span>
                  </div>
                ) : hasTrialTickets ? (
                  <>
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
                  </>
                ) : hasAnyTickets ? (
                  <>
                    <div className="booking-card-header">
                      <span className="booking-card-title">Book a Lesson</span>
                      <span className="booking-card-subtitle">1 Ticket per session</span>
                    </div>
                    
                    <button onClick={handleBookTrial} className="btn-book-trial">
                      <i className="fi-sr-calendar"></i>
                      Book Now
                    </button>

                    <div className="booking-features">
                      <div className="feature-item">
                        <i className="fi-sr-checkbox"></i>
                        <span>Flexible scheduling</span>
                      </div>
                      <div className="feature-item">
                        <i className="fi-sr-checkbox"></i>
                        <span>1-on-1 session</span>
                      </div>
                      <div className="feature-item">
                        <i className="fi-sr-checkbox"></i>
                        <span>Personalized learning</span>
                      </div>
                    </div>

                    <div className="booking-note">
                      <i className="fi-sr-info"></i>
                      <span>Use your tickets to book a lesson</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="booking-card-header">
                      <span className="booking-card-title">Get Started</span>
                      <span className="booking-card-subtitle">Purchase tickets to book lessons</span>
                    </div>
                    
                    <a href="/tickets" className="btn-book-trial btn-buy-tickets">
                      <i className="fi-sr-ticket"></i>
                      Buy Tickets
                    </a>

                    <div className="booking-features">
                      <div className="feature-item">
                        <i className="fi-sr-checkbox"></i>
                        <span>Affordable packages</span>
                      </div>
                      <div className="feature-item">
                        <i className="fi-sr-checkbox"></i>
                        <span>Flexible options</span>
                      </div>
                      <div className="feature-item">
                        <i className="fi-sr-checkbox"></i>
                        <span>No expiration</span>
                      </div>
                    </div>

                    <div className="booking-note">
                      <i className="fi-sr-info"></i>
                      <span>Tickets let you book lessons with any tutor</span>
                    </div>
                  </>
                )}
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

      {/* Toast Notifications */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </>
  );
};

export default TutorProfilePage;
