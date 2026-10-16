import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { TICKETING_VISIBLE } from '../config/launch';
import { cssStyle, Fragment } from "../utils/cssStyle";
import { CircleAlert, CalendarDays, Check, Globe, Play, User, Star, GraduationCap, School, Award, Heart, Lightbulb, MessagesSquare, CircleCheck, Info, Ticket, ShieldCheck, ArrowLeft } from "lucide-solid";
import { useRoute } from "../routing";
import { tutorApi } from '../api/tutor.api';
import { favoritesApi } from '../api/favorites.api';
import { scheduleApi, type AvailableSlot } from '../api/schedule.api';
import type { TutorProfile } from '../types/tutor.types';
import ProfileAvatar from '../Components/Common/ProfileAvatar';
import { mediaUrl } from '../utils/mediaUrl';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { BookingModal } from '../Components/Booking/BookingModal';
import { useAuthContext } from '../context/AuthContext';
import VideoPlayer from '../Components/Common/VideoPlayer';
import { Toast, useToast } from '../Components/Common/Toast';
import { getTicketBalance } from '../services/ticket.service';
import { API_BASE_URL } from '../config/api';
import './TutorProfilePage.css';
import ScreeningCertification from '../Components/Common/ScreeningCertification';
import AnonymousTutorRatings from '../Components/AnonymousTutorRatings';
const getZkProfileBadge = (tutor: TutorProfile) => {
    if (!tutor.zkCertificationStatus)
        return null;
    const labels: Partial<Record<NonNullable<TutorProfile['zkCertificationStatus']>, string>> = {
        local_proof_generated: 'ZK Proof Ready',
        submitted: 'zkVerify Pending',
        verified: 'zkVerify Proof (v1)'
    };
    const label = labels[tutor.zkCertificationStatus];
    if (!label)
        return null;
    const className = `zk-proof-badge zk-proof-badge--${tutor.zkCertificationStatus}`;
    const icon = tutor.zkCertificationStatus === 'verified' ? 'fi-sr-shield-check' : 'fi-sr-shield';
    if (!tutor.zkCredentialCommitment) {
        return (<span class={className}>
        <ShieldCheck size={16}/>
        <span>{label}</span>
      </span>);
    }
    return (<a class={className} href={`${API_BASE_URL}/proof/tutor-certification/public/${encodeURIComponent(tutor.zkCredentialCommitment)}`} target="_blank" rel="noreferrer" title="View public certification proof">
      <ShieldCheck size={16}/>
      <span>{label}</span>
    </a>);
};
export const TutorProfilePage = () => {
    const _state0 = useAuthContext();
    const _state1 = useToast();
    createEffect(on(() => [], () => {
        const _cleanup3 = untrack(() => {
            document.title = 'Tutor Profile | FluentXVerse';
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const _state2 = useRoute();
    const tutorId = createMemo(() => _state2.params.tutorId);
    const [tutor, setTutor] = createSignal<TutorProfile | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);
    const [activeTab, setActiveTab] = createSignal<'about' | 'schedule' | 'reviews'>('about');
    const [showVideoModal, setShowVideoModal] = createSignal(false);
    const [bookingModalOpen, setBookingModalOpen] = createSignal(false);
    const [isFavorite, setIsFavorite] = createSignal(false);
    const [hasTrialTickets, setHasTrialTickets] = createSignal(false);
    const [hasAnyTickets, setHasAnyTickets] = createSignal(false);
    const [ticketsLoading, setTicketsLoading] = createSignal(true);
    const [rawSlots, setRawSlots] = createSignal<AvailableSlot[]>([]); // Raw PHT slots from API
    const [availability, setAvailability] = createSignal<Array<{
        date: string;
        time: string;
        status: 'AVAIL' | 'TAKEN' | 'BOOKED';
        studentId?: string;
        slotId?: string;
    }>>([]);
    const [selectedPeriod, setSelectedPeriod] = createSignal<'morning' | 'afternoon' | 'evening'>('evening');
    const [preSelectedSlot, setPreSelectedSlot] = createSignal<{
        date: string;
        time: string;
    } | null>(null);
    // Convert PHT time to JST (add 1 hour, handle date rollover)
    const convertPHTtoJST = (phDateString: string, phTimeString: string): {
        date: string;
        time: string;
    } => {
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
            }
            else if (period === 'AM' && hours === 12) {
                hours = 0;
            }
        }
        else {
            // Try 24-hour format
            const time24Match = normalizedTime.match(/^(\d{1,2}):(\d{2})$/);
            if (time24Match) {
                hours = parseInt(time24Match[1], 10);
                minutes = time24Match[2];
            }
            else {
                return { date: phDateString, time: phTimeString };
            }
        }
        // Add 1 hour for JST
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
    // Generate 30-minute interval time slots for Asia/Tokyo based on selected period
    // Tutor opens Philippine time 06:00 - 23:30; student sees equivalent in Asia/Tokyo (+1 hour).
    // PHT 06:00-23:30 => JST 07:00-00:30 (next day)
    const getPeriodTimeSlots = (period: 'morning' | 'afternoon' | 'evening') => {
        let slots: string[] = [];
        if (period === 'morning') {
            // JST 06:00 - 11:30
            for (let h = 6; h < 12; h++) {
                slots.push(`${String(h).padStart(2, '0')}:00`);
                slots.push(`${String(h).padStart(2, '0')}:30`);
            }
        }
        else if (period === 'afternoon') {
            // JST 12:00 - 17:30
            for (let h = 12; h < 18; h++) {
                slots.push(`${String(h).padStart(2, '0')}:00`);
                slots.push(`${String(h).padStart(2, '0')}:30`);
            }
        }
        else if (period === 'evening') {
            // JST 18:00 - 00:30 (next day)
            // PHT 6:00 PM (18:00) = JST 19:00
            // PHT 11:30 PM (23:30) = JST 00:30 next day
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
    const timeSlots = createMemo(() => getPeriodTimeSlots(selectedPeriod()));
    // Helper to format next 7 days with weekday and month abbreviation
    // We use PHT dates for the columns since tutors schedule in PHT
    // Times are converted to JST for display, but slots are grouped by PHT date
    const getNextSevenDays = () => {
        const days: {
            key: string;
            label: string;
            phtDate: string;
        }[] = [];
        // Get current date in PHT (UTC+8)
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const phtNow = new Date(utcTime + (8 * 60 * 60000)); // UTC+8
        for (let i = 0; i < 7; i++) {
            const phtDate = new Date(phtNow);
            phtDate.setDate(phtDate.getDate() + i);
            // Format PHT date for key (YYYY-MM-DD)
            const year = phtDate.getFullYear();
            const month = String(phtDate.getMonth() + 1).padStart(2, '0');
            const day = String(phtDate.getDate()).padStart(2, '0');
            const phtDateStr = `${year}-${month}-${day}`;
            // Format label for display
            const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const label = `${weekdays[phtDate.getDay()]} ${months[phtDate.getMonth()]} ${phtDate.getDate()}`;
            days.push({ key: phtDateStr, label, phtDate: phtDateStr });
        }
        return days;
    };
    createEffect(on(() => [tutorId()], () => {
        const _cleanup4 = untrack(() => {
            let active = true;
            const id = tutorId();
            const loadTutor = async () => {
                try {
                    setLoading(true);
                    setError(null);
                    const data = await tutorApi.getTutorProfile(id);
                    if (active)
                        setTutor(data);
                }
                catch (err) {
                    if (active) {
                        setError('Failed to load tutor profile');
                        console.error(err);
                    }
                }
                finally {
                    if (active)
                        setLoading(false);
                }
            };
            if (id) {
                loadTutor();
            }
            return () => { active = false; };
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    createEffect(on(() => [tutorId()], () => {
        const _cleanup5 = untrack(() => {
            let active = true;
            const id = tutorId();
            const loadAvailability = async () => {
                try {
                    if (!id)
                        return;
                    // Get next 7 days in PHT format for API query
                    const now = new Date();
                    const startDate = now.toISOString().split('T')[0];
                    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    // Fetch raw PHT slots from the same API that BookingModal uses
                    const slots = await scheduleApi.getAvailableSlots(id, startDate, endDate);
                    if (!active)
                        return;
                    setRawSlots(slots);
                    // Keep PHT dates, but convert times to JST for display
                    // This way slots are grouped by PHT date (tutor's schedule date)
                    // but times shown to student are in JST
                    const convertedSlots = slots.map(slot => {
                        // Convert time only (PHT to JST is +1 hour)
                        const { time: jstTime } = convertPHTtoJST(slot.date, slot.time);
                        return {
                            date: slot.date, // Keep PHT date for grouping by tutor's schedule date
                            time: jstTime, // Convert time to JST for display
                            status: 'AVAIL' as const,
                            slotId: slot.slotId // Keep slotId for booking
                        };
                    });
                    setAvailability(convertedSlots);
                }
                catch (err) {
                    if (active)
                        console.error('Failed to load availability', err);
                }
            };
            loadAvailability();
            return () => { active = false; };
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    // Check if user has tickets
    createEffect(on(() => [_state0.user?.walletAddress], () => {
        const _cleanup6 = untrack(() => {
            const checkTickets = async () => {
                if (TICKETING_VISIBLE && _state0.user?.walletAddress) {
                    setTicketsLoading(true);
                    try {
                        const balance = await getTicketBalance(_state0.user.walletAddress);
                        setHasTrialTickets(balance.trial > 0);
                        setHasAnyTickets(balance.basic > 0 || balance.premium > 0 || balance.trial > 0);
                    }
                    catch (err) {
                        console.error('Failed to check tickets', err);
                    }
                    finally {
                        setTicketsLoading(false);
                    }
                }
                else {
                    setTicketsLoading(false);
                }
            };
            checkTickets();
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    // Check if tutor is in favorites
    createEffect(on(() => [_state0.user, tutorId()], () => {
        const _cleanup7 = untrack(() => {
            const checkFavoriteStatus = async () => {
                if (_state0.user && tutorId()) {
                    try {
                        const isFav = await favoritesApi.checkFavorite(tutorId());
                        setIsFavorite(isFav);
                    }
                    catch (err) {
                        console.error('Failed to check favorite status', err);
                    }
                }
            };
            checkFavoriteStatus();
        });
        if (typeof _cleanup7 === "function")
            onCleanup(_cleanup7);
    }));
    const handleToggleFavorite = async () => {
        if (!_state0.user) {
            _state1.showError('Please log in to add favorites');
            return;
        }
        try {
            const result = await favoritesApi.toggleFavorite(tutorId(), isFavorite());
            if (result.success) {
                setIsFavorite(result.isFavorite);
                if (result.isFavorite) {
                    _state1.showSuccess('Added to favorites!');
                }
                else {
                    _state1.showSuccess('Removed from favorites');
                }
            }
        }
        catch (err) {
            console.error('Failed to toggle favorite', err);
            _state1.showError('Failed to update favorites');
        }
    };
    const handleBookTrial = () => {
        setPreSelectedSlot(null);
        setBookingModalOpen(true);
    };
    const handleSlotClick = (date: string, time: string, status: string) => {
        if (status === 'AVAIL') {
            // time is already in 24h JST format (e.g., "19:00")
            // Pass it directly - the BookingModal will convert PHT slots to JST for matching
            setPreSelectedSlot({ date, time });
            setBookingModalOpen(true);
        }
    };
    return createMemo(() => {
        if (loading()) {
            return (<>
        {_state0.user && <SideBar />}
        <div class={`student-tutor-page ${!_state0.user ? 'student-tutor-page--guest' : ''}`}>
          <Header />
          <div class="tutor-profile-loading">
            <div class="spinner"></div>
            <p>Loading tutor profile...</p>
          </div>
        </div>
      </>);
        }
        if (error() || !tutor()) {
            return (<>
        <SideBar />
        <div class={`student-tutor-page ${!_state0.user ? 'student-tutor-page--guest' : ''}`}>
          <Header />
          <div class="tutor-profile-error">
            <CircleAlert size={18} aria-hidden="true"/>
            <h2>Tutor not found</h2>
            <p>{error() || 'The tutor you are looking for does not exist.'}</p>
            <a href="/browse-tutors" class="btn-primary">Browse Tutors</a>
          </div>
        </div>
      </>);
        }
        const displayName = createMemo(() => tutor().displayName || `${tutor().firstName} ${tutor().lastName}`);
        const initials = createMemo(() => `${tutor().firstName?.[0] || ''}${tutor().lastName?.[0] || ''}`.toUpperCase());
        const hourlyRate = createMemo(() => tutor().hourlyRate ? `₱${tutor().hourlyRate}` : 'Free');
        return (<>
      <SideBar />
      <div class={`student-tutor-page ${!_state0.user ? 'student-tutor-page--guest' : ''}`}>
        <Header />
        <div class="tutor-profile-page">
          <div class="profile-heading"><img src="/assets/img/home-icons/community-v1.webp" alt="" width="48" height="48"/><a href="/browse-tutors"><ArrowLeft size={16}/>Browse tutors</a></div><div class="profile-layout">
            {/* Main Content Column */}
            <div class="profile-main-column">
              {/* Hero Section */}
              <div class="profile-hero">
                <div class="profile-hero-content">
                  {/* Left: Avatar & Basic Info */}
                  <div class="profile-header-left">
                    <div class="profile-avatar-wrapper">
                      <ProfileAvatar src={tutor().profilePicture} alt={displayName()} className="profile-avatar-large" fallbackClassName="profile-avatar-placeholder" fallback={initials()}/>
                    {tutor().isAvailable && (<div class="availability-badge">
                        <span class="pulse-dot"></span>
                        Available
                      </div>)}
                  </div>

                  {/* Mobile Book Button */}
                  <button onClick={handleBookTrial} class="btn-book-mobile">
                    <CalendarDays size={18} aria-hidden="true"/>
                    Book Trial Lesson
                  </button>
                </div>

                {/* Right: Details */}
                <div class="profile-header-right">
                  <div class="profile-name-row">
                    <h1 class="profile-name">{displayName()}</h1>
                    {_state0.user && (<button onClick={handleToggleFavorite} class={`btn-favorite-star ${isFavorite() ? 'favorited' : ''}`} title={isFavorite() ? 'Remove from Favorites' : 'Add to Favorites'}>
                        <Star size={20} fill={isFavorite() ? "currentColor" : "none"}/>
                      </button>)}
                  </div>

                  {/* Star Rating */}
                  <div class="profile-rating-row">
                    <div class="star-rating">
                      {[1, 2, 3, 4, 5].map((star) => (<Star size={16} fill={star <= Math.round(tutor().rating || 0) ? "currentColor" : "none"}/>))}
                    </div>
                    <span class="rating-score">{(tutor().rating || 0).toFixed(1)}</span>
                    <span class="rating-count">({tutor().totalReviews || 0} {tutor().totalReviews === 1 ? 'review' : 'reviews'})</span>
                    {tutor().isVerified && (<div class="verified-badge">
                        <Check size={18} aria-hidden="true"/>
                        <span>Verified</span>
                      </div>)}
                    {getZkProfileBadge(tutor())}
                  </div>
                  <ScreeningCertification tutorId={tutorId()} />

                  {/* Languages & Country */}
                  <div class="profile-meta">
                    {tutor().languages && tutor().languages.length > 0 && (<div class="meta-item">
                        <Globe size={18} aria-hidden="true"/>
                        <span>Speaks: {tutor().languages.join(', ')}</span>
                      </div>)}
                  </div>

                  {/* Short Bio */}
                  {tutor().bio && (<p class="profile-bio-short">
                      {tutor().bio.length > 150 ? `${tutor().bio.substring(0, 150)}...` : tutor().bio}
                    </p>)}

                  {/* Specializations Tags */}
                  {tutor().specializations && tutor().specializations.length > 0 && (<div class="profile-tags">
                      {tutor().specializations.slice(0, 5).map((spec, idx) => (<span class="tag">{spec}</span>))}
                      {tutor().specializations.length > 5 && (<span class="tag tag-more">+{tutor().specializations.length - 5} more</span>)}
                    </div>)}
                </div>
              </div>

              {/* Video Introduction - Inside Hero Card but outside hero-content for full width */}
              {tutor().videoIntroUrl && (<div class="hero-video-section">
                  <h3 class="video-section-title">
                    <Play size={18} aria-hidden="true"/>
                    Introduction Video
                  </h3>
                  <VideoPlayer src={mediaUrl(tutor().videoIntroUrl)!}/>
                </div>)}
            </div>

              {/* Tabs Navigation */}
              <div class="profile-tabs">
                <button class={`tab-btn ${activeTab() === 'about' ? 'active' : ''}`} onClick={() => setActiveTab('about')}>
                  <User size={18} aria-hidden="true"/>
                  About
                </button>
                <button class={`tab-btn ${activeTab() === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>
                  <CalendarDays size={18} aria-hidden="true"/>
                  Schedule
                </button>
                <button class={`tab-btn ${activeTab() === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
                  <Star size={18} aria-hidden="true"/>
                  Reviews ({tutor().totalReviews || 0})
                </button>
              </div>

              {/* Tab Content */}
              <div class="profile-content">
            {activeTab() === 'about' && (<div class="tab-content">
                {/* About Me */}
                <section class="content-section">
                  <h2 class="section-title">
                    <img src="/assets/img/home-icons/community-v1.webp" alt="" width="32" height="32"/>
                    About Me
                  </h2>
                  <div class="section-content">
                    <p>{tutor().introduction || tutor().bio || 'This tutor has not provided an introduction yet.'}</p>
                  </div>
                </section>

                {/* Education */}
                {(tutor().schoolAttended || (tutor().education && tutor().education.length > 0)) && (<section class="content-section">
                    <h2 class="section-title">
                      <img src="/assets/img/home-icons/training-v1.webp" alt="" width="32" height="32"/>
                      Education
                    </h2>
                    <div class="section-content">
                      <div class="education-info">
                        {tutor().schoolAttended ? (<>
                            <div class="education-row">
                              <School size={18} aria-hidden="true"/>
                              <span class="education-label">University:</span>
                              <strong>{tutor().schoolAttended}</strong>
                            </div>
                            {tutor().major && (<div class="education-row">
                                <Award size={18} aria-hidden="true"/>
                                <span class="education-label">Degree:</span>
                                <strong>{tutor().major}</strong>
                              </div>)}
                          </>) : (tutor().education?.map((edu, idx) => (<div class="education-row">
                              <div class="education-details">
                                <School size={18} aria-hidden="true"/>
                                <strong>{edu}</strong>
                              </div>
                            </div>)))}
                      </div>
                    </div>
                  </section>)}

                {/* Interests */}
                {tutor().interests && tutor().interests.length > 0 && (<section class="content-section">
                    <h2 class="section-title">
                      <img src="/assets/img/home-icons/community-v1.webp" alt="" width="32" height="32"/>
                      Interests
                    </h2>
                    <div class="section-content">
                      <div class="interests-grid">
                        {tutor().interests.map((interest, idx) => (<div class="interest-tag">
                            <Star size={18} aria-hidden="true"/>
                            <span>{interest}</span>
                          </div>))}
                      </div>
                    </div>
                  </section>)}

                {/* Specializations */}
                {tutor().specializations && tutor().specializations.length > 0 && (<section class="content-section">
                    <h2 class="section-title">
                      <img src="/assets/img/home-icons/community-v1.webp" alt="" width="32" height="32"/>
                      Areas of Expertise
                    </h2>
                    <div class="section-content">
                      <div class="specializations-grid">
                        {tutor().specializations.map((spec, idx) => (<div class="specialization-card">
                            <Check size={18} aria-hidden="true"/>
                            <span>{spec}</span>
                          </div>))}
                      </div>
                    </div>
                  </section>)}
              </div>)}

            {activeTab() === 'schedule' && (<div class="tab-content">
                <section class="content-section">
                  <h2 class="section-title">
                    <img src="/assets/img/home-icons/schedule-v1.webp" alt="" width="32" height="32"/>
                    Available Time Slots
                  </h2>
                  {/* Period Tabs */}
                  <div class="schedule-period-tabs">
                    <button class={`period-tab ${selectedPeriod() === 'morning' ? 'active' : ''}`} onClick={() => setSelectedPeriod('morning')}>Morning</button>
                    <button class={`period-tab ${selectedPeriod() === 'afternoon' ? 'active' : ''}`} onClick={() => setSelectedPeriod('afternoon')}>Afternoon</button>
                    <button class={`period-tab ${selectedPeriod() === 'evening' ? 'active' : ''}`} onClick={() => setSelectedPeriod('evening')}>Evening</button>
                    <div class="timezone-note">
                      <img src="https://flagcdn.com/w40/kr.png" alt="KR" style={cssStyle({ width: '24px', height: '16px', borderRadius: '3px' })}/>
                      <span>Japan Time (Asia/Tokyo)</span>
                      <span style={cssStyle({ marginLeft: '8px', color: '#94a3b8' })}>(Tutor opens slots in Philippine Time 06:00–23:30)</span>
                    </div>
                  </div>
                  <div class="schedule-grid">
                    <table class="schedule-table">
                      <thead>
                        <tr>
                          <th>Time (JST)</th>
                          {getNextSevenDays().map((d, i) => (<th>{d.label}</th>))}
                        </tr>
                      </thead>
                      <tbody>
                        {timeSlots().map((time) => (<tr>
                            <td class="time-col">{time}</td>
                            {getNextSevenDays().map((d, dayIdx) => {
                        // Use PHT date directly - slots are now grouped by PHT date
                        // This ensures 00:00 and 00:30 JST times (which are 11:00 PM and 11:30 PM PHT)
                        // appear in the same column as other evening slots for that PHT date
                        const dateStr = d.key;
                        const slot = availability().find((s) => s.date === dateStr && s.time === time);
                        const status = slot?.status;
                        // Only show AVAIL or student's own BOOKED slots
                        const isMyBooking = status === 'BOOKED' && slot?.studentId === _state0.user?.userId;
                        const isAvailable = status === 'AVAIL';
                        const showSlot = isAvailable || isMyBooking;
                        const label = isMyBooking ? 'BOOKED' : isAvailable ? 'AVAIL' : '';
                        const isClickable = isAvailable;
                        return (<td class={`slot ${showSlot ? (isMyBooking ? 'my-booking' : 'avail') : 'disabled'} ${isClickable ? 'clickable' : ''}`} style={cssStyle(isClickable ? { cursor: 'pointer' } : undefined)} title={isClickable ? 'Click to book this slot' : isMyBooking ? 'Your booked lesson' : undefined}>
                                  {isClickable ? <button type="button" class="profile-slot-button" onClick={() => handleSlotClick(dateStr, time, status || '')} aria-label={`Book ${dateStr} at ${time} JST`}>{label}</button> : label}
                                </td>);
                    })}
                          </tr>))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>)}

            {activeTab() === 'reviews' && (<div class="tab-content">
                <section class="content-section">
                  <h2 class="section-title">
                    <img src="/assets/img/home-icons/community-v1.webp" alt="" width="32" height="32"/>
                    Student Reviews
                  </h2>
                  {tutor().totalReviews && tutor().totalReviews > 0 ? (<div class="reviews-summary">
                      <div class="reviews-overview">
                        <div class="overall-rating">
                          <span class="rating-big">{tutor().rating?.toFixed(1)}</span>
                          <div class="rating-stars">
                            {[1, 2, 3, 4, 5].map(star => (<Star size={16} fill={star <= (tutor().rating || 0) ? "currentColor" : "none"}/>))}
                          </div>
                          <span class="rating-count">{tutor().totalReviews} reviews</span>
                        </div>
                      </div>
                      <div class="reviews-list-placeholder">
                        <p>Review details coming soon!</p>
                      </div>
                    </div>) : (<div class="no-reviews">
                      <MessagesSquare size={18} aria-hidden="true"/>
                      <p>This tutor doesn't have any reviews yet.</p>
                      <p class="no-reviews-hint">Be the first to book a lesson and leave a review!</p>
                    </div>)}
                  <AnonymousTutorRatings tutorId={tutorId()} />
                </section>
              </div>)}
              </div>
            </div>

            {/* Sidebar: Booking Card (Desktop) */}
            <div class="profile-sidebar">
              <div class="profile-booking-card"><img src="/assets/img/home-icons/schedule-v1.webp" alt="" width="40" height="40"/>
                {!TICKETING_VISIBLE ? (<>
                    <div class="booking-card-header"><span class="booking-card-title">Free Trial Lesson</span><span class="booking-card-subtitle">25-minute session</span></div>
                    <button onClick={handleBookTrial} class="btn-book-trial"><CalendarDays size={18} aria-hidden="true"/>Book Free Trial</button>
                  </>) : ticketsLoading() ? (<div class="booking-card-loading">
                    <div class="loading-spinner"></div>
                    <span>Loading...</span>
                  </div>) : hasTrialTickets() ? (<>
                    <div class="booking-card-price">
                      <span class="price-label">Trial Lesson</span>
                      <div class="price-value">{hourlyRate()}<span class="price-unit">/25min</span></div>
                    </div>
                    
                    <button onClick={handleBookTrial} class="btn-book-trial">
                      <CalendarDays size={18} aria-hidden="true"/>
                      Book Trial Lesson
                    </button>

                    <div class="booking-features">
                      <div class="feature-item">
                        <CircleCheck size={18} aria-hidden="true"/>
                        <span>Cancel anytime</span>
                      </div>
                      <div class="feature-item">
                        <CircleCheck size={18} aria-hidden="true"/>
                        <span>25-minute session</span>
                      </div>
                      <div class="feature-item">
                        <CircleCheck size={18} aria-hidden="true"/>
                        <span>Instant confirmation</span>
                      </div>
                    </div>

                    <div class="booking-note">
                      <Info size={18} aria-hidden="true"/>
                      <span>Get to know this tutor with a trial lesson</span>
                    </div>
                  </>) : hasAnyTickets() ? (<>
                    <div class="booking-card-header">
                      <span class="booking-card-title">Book a Lesson</span>
                      <span class="booking-card-subtitle">1 Ticket per session</span>
                    </div>
                    
                    <button onClick={handleBookTrial} class="btn-book-trial">
                      <CalendarDays size={18} aria-hidden="true"/>
                      Book Now
                    </button>

                    <div class="booking-features">
                      <div class="feature-item">
                        <CircleCheck size={18} aria-hidden="true"/>
                        <span>Flexible scheduling</span>
                      </div>
                      <div class="feature-item">
                        <CircleCheck size={18} aria-hidden="true"/>
                        <span>1-on-1 session</span>
                      </div>
                      <div class="feature-item">
                        <CircleCheck size={18} aria-hidden="true"/>
                        <span>Personalized learning</span>
                      </div>
                    </div>

                    <div class="booking-note">
                      <Info size={18} aria-hidden="true"/>
                      <span>Use your tickets to book a lesson</span>
                    </div>
                  </>) : (<>
                    <div class="booking-card-header">
                      <span class="booking-card-title">Get Started</span>
                      <span class="booking-card-subtitle">Purchase tickets to book lessons</span>
                    </div>
                    
                    <a href="/tickets" class="btn-book-trial btn-buy-tickets">
                      <Ticket size={18} aria-hidden="true"/>
                      Buy Tickets
                    </a>

                    <div class="booking-features">
                      <div class="feature-item">
                        <CircleCheck size={18} aria-hidden="true"/>
                        <span>Affordable packages</span>
                      </div>
                      <div class="feature-item">
                        <CircleCheck size={18} aria-hidden="true"/>
                        <span>Flexible options</span>
                      </div>
                      <div class="feature-item">
                        <CircleCheck size={18} aria-hidden="true"/>
                        <span>No expiration</span>
                      </div>
                    </div>

                    <div class="booking-note">
                      <Info size={18} aria-hidden="true"/>
                      <span>Tickets let you book lessons with any tutor</span>
                    </div>
                  </>)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {tutor() && (<BookingModal isOpen={bookingModalOpen()} onClose={() => {
                    setBookingModalOpen(false);
                    setPreSelectedSlot(null);
                }} tutorId={tutor().userId} tutorName={displayName()} tutorAvatar={tutor().profilePicture} hourlyRate={tutor().hourlyRate} preSelectedDate={preSelectedSlot()?.date} preSelectedTime={preSelectedSlot()?.time}/>)}

      {/* Toast Notifications */}
      <Toast toasts={_state1.toasts} onRemove={_state1.removeToast}/>
    </>);
    }) as unknown as JSX.Element;
};
export default TutorProfilePage;
