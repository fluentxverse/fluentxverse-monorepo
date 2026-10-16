import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { ArrowRight, CalendarDays, Clock, History, Globe, UserRound, X, RefreshCw, Search, TriangleAlert, Ticket, LoaderCircle, ShieldCheck, ExternalLink, CheckCircle } from "lucide-solid";
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import PastLessonCalendar from '../Components/PastLessonCalendar';
import ProfileAvatar from '../Components/Common/ProfileAvatar';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { canCancelLesson } from '../utils/lessonCancellation';
import { useAuthContext } from '../context/AuthContext';
import { scheduleApi, type StudentBooking } from '../api/schedule.api';
import { lessonProofApi, type LessonProof } from '../api/lessonProof.api';
import { API_BASE_URL } from '../config/api';
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
    attendanceStudent?: string;
    paymentMethod?: string;
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
const CancelModal = (_props0: CancelModalProps) => {
    return createMemo(() => {
        if (!_props0["isOpen"] || !_props0["booking"])
            return null;
        return (<div class="cancel-modal-overlay" onClick={_props0["onCancel"]}>
      <div class="cancel-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-lesson-title" onClick={(e) => e.stopPropagation()}>
        <div class="cancel-modal-header">
          <TriangleAlert size={16}/>
          <h3 id="cancel-lesson-title">Cancel Lesson</h3>
        </div>
        <div class="cancel-modal-body">
          <p>Are you sure you want to cancel your lesson with <strong>{_props0["booking"].tutorName}</strong>?</p>
          <div class="cancel-lesson-info">
            <div class="cancel-info-row">
              <CalendarDays size={16}/>
              <span>{_props0["booking"].date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' })}</span>
            </div>
            <div class="cancel-info-row">
              <Clock size={16}/>
              <span>{_props0["booking"].timeDisplay} JST</span>
            </div>
          </div>
          <div class={`refund-notice ${_props0["willGetRefund"] ? 'refund-yes' : 'refund-no'}`}>
            <Ticket size={20}/>
            {_props0["willGetRefund"] ? (<span>{_props0.booking.paymentMethod === 'trial' ? 'Your trial lesson will be available to book again.' : 'You will receive a credit refund for this cancellation.'}</span>) : (<span>{_props0.booking.paymentMethod === 'trial' ? 'Cancelling less than 1 hour before the lesson uses your trial allowance.' : 'Cancellations less than 1 hour before the lesson are not eligible for refund.'}</span>)}
          </div>
        </div>
        <div class="cancel-modal-actions">
          <button class="cancel-modal-btn cancel-btn" onClick={_props0["onCancel"]} disabled={_props0["isLoading"]}>
            Keep Lesson
          </button>
          <button class="cancel-modal-btn confirm-btn" onClick={_props0["onConfirm"]} disabled={_props0["isLoading"]}>
            {_props0["isLoading"] ? (<>
                <LoaderCircle size={16} class="schedule-spin"/>
                Cancelling...
              </>) : (<>
                <X size={16}/>
                Cancel Lesson
              </>)}
          </button>
        </div>
      </div>
    </div>);
    }) as unknown as JSX.Element;
};
const SchedulePage = () => {
    createEffect(on(() => [], () => {
        const _cleanup4 = untrack(() => {
            document.title = 'My Schedule | FluentXVerse';
        });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    const _state1 = useAuthContext();
    const [bookings, setBookings] = createSignal<Booking[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);
    const [activeTab, setActiveTab] = createSignal<'upcoming' | 'past'>(new URLSearchParams(window.location.search).get('tab') === 'past' ? 'past' : 'upcoming');
    const currentTime = useCurrentTime();
    const [lessonProofs, setLessonProofs] = createSignal<Record<string, LessonProof>>({});
    const [proofLoading, setProofLoading] = createSignal<string | null>(null);
    const [proofError, setProofError] = createSignal<Record<string, string>>({});
    // Cancel modal state
    const [cancelModalOpen, setCancelModalOpen] = createSignal(false);
    const [bookingToCancel, setBookingToCancel] = createSignal<Booking | null>(null);
    const [cancelling, setCancelling] = createSignal(false);
    const [cancelSuccess, setCancelSuccess] = createSignal<{
        message: string;
        refunded: boolean;
    } | null>(null);
    // Check if cancellation is eligible for refund (more than 1 hour before lesson)
    const isRefundEligible = (lessonDate: Date): boolean => {
        const now = new Date();
        const oneHourBefore = new Date(lessonDate.getTime() - 60 * 60 * 1000);
        return now < oneHourBefore;
    };
    // Handle cancel button click
    const handleCancelClick = (booking: Booking) => {
        if (!canCancelLesson(booking.originalStatus, booking.date.getTime()))
            return;
        setBookingToCancel(booking);
        setCancelModalOpen(true);
    };
    // Handle cancel confirmation
    const handleConfirmCancel = async () => {
        if (!bookingToCancel())
            return;
        if (!canCancelLesson(bookingToCancel().originalStatus, bookingToCancel().date.getTime())) {
            setCancelModalOpen(false);
            return;
        }
        setCancelling(true);
        try {
            const result = await scheduleApi.cancelBooking(bookingToCancel().id);
            // Remove the cancelled booking from the list
            setBookings(prev => prev.filter(b => b.id !== bookingToCancel().id));
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
        }
        catch (err: any) {
            console.error('Failed to cancel booking:', err);
            setError(typeof err === 'string' ? err : err.message || 'Failed to cancel booking');
        }
        finally {
            setCancelling(false);
        }
    };
    // Handle modal close
    const handleCancelModalClose = () => {
        if (!cancelling()) {
            setCancelModalOpen(false);
            setBookingToCancel(null);
        }
    };
    // Convert 12-hour or 24-hour PHT time to 24-hour JST time
    const convertPHTtoJST = (dateStr: string, timeStr: string): {
        date: string;
        time: string;
        dateObj: Date;
    } => {
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
            }
            else if (isPM) {
                hour += 12;
            }
        }
        else {
            // Try 24-hour format (e.g., "23:30")
            const match24 = timeStr.match(/(\d{1,2}):(\d{2})/);
            if (match24) {
                hour = parseInt(match24[1], 10);
                minute = parseInt(match24[2], 10);
            }
            else {
                return { date: dateStr, time: '00:00', dateObj: new Date(dateStr) };
            }
        }
        let jstHour = hour + 1;
        let jstDate = dateStr;
        if (jstHour >= 24) {
            jstHour -= 24;
            // Calculate next day without using toISOString (which converts to UTC)
            const [year, month, day] = dateStr.split('-').map(Number);
            const nextDay = new Date(year, month - 1, day + 1);
            jstDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
        }
        const jstTime = `${String(jstHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        // Explicitly specify JST timezone (UTC+9) so JavaScript doesn't interpret as local time
        const dateObj = new Date(`${jstDate}T${jstTime}:00+09:00`);
        return { date: jstDate, time: jstTime, dateObj };
    };
    createEffect(on(() => [_state1.user], () => {
        const _cleanup5 = untrack(() => {
            const fetchBookings = async () => {
                if (!_state1.user) {
                    setLoading(false);
                    return;
                }
                try {
                    setLoading(true);
                    setError(null);
                    const [data, proofResult] = await Promise.all([
                        scheduleApi.getStudentBookings(),
                        lessonProofApi.list().catch(() => null),
                    ]);
                    if (proofResult)
                        setLessonProofs(Object.fromEntries(proofResult.map(proof => [proof.bookingId, proof])));
                    const LESSON_DURATION_MS = 25 * 60 * 1000; // 25 minutes
                    const transformedBookings: Booking[] = data.map((booking: StudentBooking) => {
                        const { date: jstDate, time: jstTime, dateObj } = convertPHTtoJST(booking.slotDate, booking.slotTime);
                        const now = new Date();
                        const lessonEndTime = new Date(dateObj.getTime() + LESSON_DURATION_MS);
                        let status: 'upcoming' | 'completed' | 'cancelled' = 'upcoming';
                        if (booking.status === 'completed') {
                            status = 'completed';
                        }
                        else if (booking.status === 'cancelled') {
                            status = 'cancelled';
                        }
                        else if (now >= lessonEndTime) {
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
                            dateStr: jstDate,
                            time: jstTime,
                            timeDisplay: jstTime,
                            duration: booking.durationMinutes,
                            status,
                            originalStatus: booking.status,
                            paymentMethod: booking.paymentMethod,
                            attendanceStudent: booking.attendanceStudent
                        };
                    });
                    setBookings(transformedBookings);
                }
                catch (err) {
                    console.error('Failed to fetch bookings:', err);
                    setError('Failed to load your schedule. Please try again.');
                }
                finally {
                    setLoading(false);
                }
            };
            fetchBookings();
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    const claimLessonProof = async (bookingId: string) => {
        setProofLoading(bookingId);
        setProofError(previous => ({ ...previous, [bookingId]: '' }));
        try {
            const proof = await lessonProofApi.claim(bookingId);
            setLessonProofs(previous => ({ ...previous, [bookingId]: { ...proof, eligible: true } }));
        }
        catch (err) {
            setProofError(previous => ({ ...previous, [bookingId]: err instanceof Error ? err.message : 'Could not generate proof' }));
        }
        finally {
            setProofLoading(null);
        }
    };
    const LESSON_DURATION_MS = 25 * 60 * 1000; // 25 minutes in milliseconds
    // Helper to check if lesson is still ongoing (within 25 minutes of start)
    const isLessonOngoing = createMemo(on(() => [], () => (lessonDate: Date): boolean => {
        const currentTime = Date.now();
        const lessonEnd = lessonDate.getTime() + LESSON_DURATION_MS;
        return currentTime >= lessonDate.getTime() && currentTime < lessonEnd;
    }));
    // Helper to check if lesson end time has passed
    const isLessonEnded = createMemo(on(() => [], () => (lessonDate: Date): boolean => {
        const lessonEnd = lessonDate.getTime() + LESSON_DURATION_MS;
        return Date.now() >= lessonEnd;
    }));
    // Memoize filtered and sorted lesson lists
    const _state2 = createMemo(() => {
        const upcoming = bookings().filter(b => {
            if (b.status !== 'upcoming')
                return false;
            const lessonEnd = b.date.getTime() + LESSON_DURATION_MS;
            return b.date.getTime() > currentTime() || currentTime() < lessonEnd;
        })
            .sort((a, b) => a.date.getTime() - b.date.getTime());
        const past = bookings().filter(b => {
            if (b.status === 'completed')
                return true;
            const lessonEnd = b.date.getTime() + LESSON_DURATION_MS;
            return currentTime() >= lessonEnd;
        })
            .sort((a, b) => b.date.getTime() - a.date.getTime());
        return { upcomingLessons: upcoming, pastLessons: past };
    });
    createEffect(on(() => [bookingToCancel(), cancelling(), currentTime()], () => {
        const _cleanup6 = untrack(() => {
            if (bookingToCancel() && !cancelling() && !canCancelLesson(bookingToCancel().originalStatus, bookingToCancel().date.getTime(), currentTime())) {
                setCancelModalOpen(false);
                setBookingToCancel(null);
            }
        });
        if (typeof _cleanup6 === "function")
            onCleanup(_cleanup6);
    }));
    // Create JST formatter once (memoized)
    const jstFormatter = createMemo(() => new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }));
    const jstDateFormatter = createMemo(() => new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }));
    // Pre-compute today and tomorrow in JST (memoized)
    const _state3 = createMemo(() => {
        const now = new Date();
        const todayParts = jstFormatter().formatToParts(now);
        const todayYear = parseInt(todayParts.find(p => p.type === 'year')?.value || '0');
        const todayMonth = parseInt(todayParts.find(p => p.type === 'month')?.value || '0');
        const todayDay = parseInt(todayParts.find(p => p.type === 'day')?.value || '0');
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowParts = jstFormatter().formatToParts(tomorrow);
        const tomorrowYear = parseInt(tomorrowParts.find(p => p.type === 'year')?.value || '0');
        const tomorrowMonth = parseInt(tomorrowParts.find(p => p.type === 'month')?.value || '0');
        const tomorrowDay = parseInt(tomorrowParts.find(p => p.type === 'day')?.value || '0');
        return {
            todayJST: `${todayYear}-${todayMonth}-${todayDay}`,
            tomorrowJST: `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`
        };
    });
    // Format date for display - optimized with memoized formatters
    const formatLessonDate = createMemo(on(() => [jstFormatter(), jstDateFormatter(), _state3().todayJST, _state3().tomorrowJST], () => (date: Date) => {
        const jstParts = jstFormatter().formatToParts(date);
        const jstYear = parseInt(jstParts.find(p => p.type === 'year')?.value || '0');
        const jstMonth = parseInt(jstParts.find(p => p.type === 'month')?.value || '0');
        const jstDay = parseInt(jstParts.find(p => p.type === 'day')?.value || '0');
        const dateKey = `${jstYear}-${jstMonth}-${jstDay}`;
        if (dateKey === _state3().todayJST)
            return 'Today';
        if (dateKey === _state3().tomorrowJST)
            return 'Tomorrow';
        return jstDateFormatter().format(date);
    }));
    const getTimeUntil = createMemo(on(() => [], () => (date: Date) => {
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
        }
        else if (hours < 24) {
            return `in ${hours}h ${minutes % 60}m`;
        }
        else {
            return `in ${days} day${days > 1 ? 's' : ''}`;
        }
    }));
    const getTimeSince = createMemo(on(() => [], () => (date: Date) => {
        const currentTime = Date.now();
        const diff = currentTime - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 30) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        else if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
        else if (hours > 0) {
            return `${hours}h ago`;
        }
        else {
            return `${minutes}m ago`;
        }
    }));
    const displayedLessons = createMemo(() => activeTab() === 'upcoming' ? _state2().upcomingLessons : _state2().pastLessons);
    const selectTab = (tab: 'upcoming' | 'past') => {
        setActiveTab(tab);
        const url = new URL(window.location.href);
        if (tab === 'past')
            url.searchParams.set('tab', 'past');
        else {
            url.searchParams.delete('tab');
            url.searchParams.delete('month');
            url.searchParams.delete('day');
        }
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    };
    const renderPastActions = (bookingId: string) => {
        const lesson = _state2().pastLessons.find(item => item.id === bookingId);
        if (!lesson)
            return null;
        const proof = lessonProofs()[bookingId];
        return <>
      {proof?.eligible && ['ready', 'failed'].includes(proof.status) && <button class="action-btn primary" disabled={proofLoading() === bookingId} onClick={() => claimLessonProof(bookingId)}><ShieldCheck size={16}/>{proofLoading() === bookingId ? 'Generating...' : proof.status === 'failed' ? 'Retry proof' : 'Claim proof'}</button>}
      {proof?.eligible && proof.status === 'local_proof_generated' && (proof.submissionAvailable ? <button class="action-btn primary" disabled={proofLoading() === bookingId} onClick={() => claimLessonProof(bookingId)}><ShieldCheck size={16}/>{proofLoading() === bookingId ? 'Submitting...' : 'Submit proof'}</button> : <span class="lesson-proof-pending">Local proof ready</span>)}
      {proof?.commitment && <a class="action-btn secondary" target="_blank" rel="noopener noreferrer" href={`${API_BASE_URL}/proof/student-lessons/public/${proof.commitment}`}><ExternalLink size={16}/>{proof.status === 'verified' ? 'Verified proof' : 'View proof status'}</a>}
      {proof && !proof.eligible && proof.status === 'ready' && <span class="lesson-proof-pending">Attendance verification pending</span>}
      {proofError()[bookingId] && <span role="alert" class="lesson-proof-error">{proofError()[bookingId]}</span>}
      <a href={`/tutor/${lesson.tutorId}`} class="action-btn secondary"><RefreshCw size={16}/>Book Again</a>
    </>;
    };
    return (<>
      <SideBar />
      <div class="student-schedule-shell">
        <Header />
        <main class="schedule-page">
          <div class="container">
            {/* Header Section */}
            <div class="schedule-header">
              <div class="schedule-header-left">
                <img class="schedule-art" src="/assets/img/home-icons/schedule-v1.webp" width={64} height={64} alt=""/>
                <div>
                  <h1 class="schedule-title">My Schedule</h1>
                  <p class="schedule-subtitle">
                    {loading() ? 'Your learning calendar' : `${_state2().upcomingLessons.length} upcoming lesson${_state2().upcomingLessons.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              <a href="/browse-tutors" class="schedule-book-btn">
                <CalendarDays size={16}/>
                Book a Lesson
              </a>
            </div>

            {/* Tabs */}
            <div class="schedule-tabs">
              <button class={`schedule-tab ${activeTab() === 'upcoming' ? 'active' : ''}`} onClick={() => selectTab('upcoming')}>
                <Clock size={16}/>
                Upcoming
                {_state2().upcomingLessons.length > 0 && (<span class="tab-count">{_state2().upcomingLessons.length}</span>)}
              </button>
              <button class={`schedule-tab ${activeTab() === 'past' ? 'active' : ''}`} onClick={() => selectTab('past')}>
                <History size={16}/>
                Past Lessons
                {_state2().pastLessons.length > 0 && (<span class="tab-count past">{_state2().pastLessons.length}</span>)}
              </button>
            </div>

            {/* Timezone Notice */}
            <div class="schedule-timezone">
              <Globe size={16}/>
              <span>All times shown in Japan Time (JST)</span>
            </div>

            {/* Loading State - Skeleton Loader */}
            {loading() && (<div class="schedule-skeleton">
                {[1, 2, 3].map((i) => (<div class="skeleton-card">
                    <div class="skeleton-date"></div>
                    <div class="skeleton-avatar"></div>
                    <div class="skeleton-info">
                      <div class="skeleton-title"></div>
                      <div class="skeleton-detail"></div>
                      <div class="skeleton-detail" style={cssStyle({ width: '150px' })}></div>
                    </div>
                    <div class="skeleton-actions">
                      <div class="skeleton-btn"></div>
                      <div class="skeleton-btn" style={cssStyle({ width: '80px' })}></div>
                    </div>
                  </div>))}
              </div>)}

            {/* Error State */}
            {error() && !loading() && (<div class="schedule-error">
                <TriangleAlert size={16}/>
                <h3>Error Loading Schedule</h3>
                <p>{error()}</p>
                <button onClick={() => window.location.reload()} class="retry-btn">
                  <RefreshCw size={16}/>
                  Try Again
                </button>
              </div>)}

            {/* Lessons List */}
            {!loading() && !error() && activeTab() === 'past' && <PastLessonCalendar lessons={_state2().pastLessons} renderActions={renderPastActions}/>}
            {!loading() && !error() && activeTab() === 'upcoming' && displayedLessons().length > 0 && (<div class="schedule-list">
                {displayedLessons().map((lesson) => (<div class={`schedule-card ${activeTab()}`}>
                    {/* Date Badge */}
                    <div class="schedule-card-date">
                      <span class="date-day">{lesson.date.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'Asia/Tokyo' })}</span>
                      <span class="date-month">{lesson.date.toLocaleDateString('en-US', { month: 'short', timeZone: 'Asia/Tokyo' })}</span>
                    </div>

                    {/* Tutor Avatar */}
                    <div class="schedule-card-avatar">
                      <ProfileAvatar src={lesson.tutorAvatar} alt={lesson.tutorName} fallbackClassName="avatar-placeholder" fallback={<UserRound size={16}/>}/>
                    </div>

                    {/* Lesson Info */}
                    <div class="schedule-card-info">
                      <h3 class="schedule-card-tutor-name">{lesson.tutorName}</h3>
                      <div class="lesson-details">
                        <div class="lesson-detail">
                          <CalendarDays size={16}/>
                          <span>{formatLessonDate()(lesson.date)}</span>
                        </div>
                        <div class="lesson-detail">
                          <Clock size={16}/>
                          <span>{lesson.timeDisplay} JST ({lesson.duration} min)</span>
                        </div>
                        {activeTab() === 'upcoming' && (<div class={`lesson-detail countdown ${isLessonOngoing()(lesson.date) ? 'ongoing' : ''}`}>
                            <Clock size={16}/>
                            <span>{getTimeUntil()(lesson.date)}</span>
                          </div>)}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div class="schedule-card-actions">
                      {activeTab() === 'upcoming' ? (<>
                          <a href={`/lesson/${lesson.id}`} class="action-btn primary">
                            <ArrowRight size={16}/>
                            Open Lesson
                          </a>
                          <a href={`/tutor/${lesson.tutorId}`} class="action-btn secondary">
                            <UserRound size={16}/>
                            View Tutor
                          </a>
                        </>) : renderPastActions(lesson.id)}
                    </div>
                  </div>))}
              </div>)}

            {/* Empty State */}
            {!loading() && !error() && activeTab() === 'upcoming' && displayedLessons().length === 0 && (<div class="schedule-empty">
                <div class="empty-icon">
                  <img class="schedule-art" src="/assets/img/home-icons/community-v1.webp" width={88} height={88} alt=""/>
                </div>
                <h3>{activeTab() === 'upcoming' ? 'No Upcoming Lessons' : 'No Past Lessons'}</h3>
                <p>
                  {activeTab() === 'upcoming'
                ? "Find a tutor for your next conversation."
                : "You haven't completed any lessons yet. Book your first lesson to get started!"}
                </p>
                {activeTab() === 'upcoming' && (<a href="/browse-tutors" class="empty-cta">
                    <Search size={16}/>
                    Browse Tutors
                  </a>)}
              </div>)}

            {/* Cancel Success Notification */}
            {cancelSuccess() && (<div class={`cancel-notification ${cancelSuccess().refunded ? 'refunded' : ''}`}>
                <CheckCircle size={20}/>
                <span>{cancelSuccess().message}</span>
                {cancelSuccess().refunded && (<span class="refund-badge">Ticket Refunded</span>)}
                <button class="notification-close" aria-label="Dismiss notification" onClick={() => setCancelSuccess(null)}>
                  <X size={16}/>
                </button>
              </div>)}
          </div>
        </main>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelModalOpen() && bookingToCancel() && (<div class="cancel-modal-overlay" onClick={handleCancelModalClose}>
          <div class="cancel-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-cancel-title" onClick={(e) => e.stopPropagation()}>
            <div class="cancel-modal-header">
              <h3 id="schedule-cancel-title">Cancel Lesson</h3>
              <button class="modal-close-btn" aria-label="Close cancellation dialog" onClick={handleCancelModalClose} disabled={cancelling()}>
                <X size={16}/>
              </button>
            </div>
            
            <div class="cancel-modal-body">
              <div class="cancel-lesson-info">
                <div class="cancel-tutor-avatar">
                  <ProfileAvatar src={bookingToCancel().tutorAvatar} alt={bookingToCancel().tutorName} fallbackClassName="avatar-placeholder" fallback={<UserRound size={16}/>}/>
                </div>
                <div class="cancel-lesson-details">
                  <h4>{bookingToCancel().tutorName}</h4>
                  <p>
                    <CalendarDays size={16}/>
                    {formatLessonDate()(bookingToCancel().date)} at {bookingToCancel().timeDisplay} JST
                  </p>
                  <p>
                    <Clock size={16}/>
                    {bookingToCancel().duration} minutes
                  </p>
                </div>
              </div>

              <div class={`refund-notice ${isRefundEligible(bookingToCancel().date) ? 'eligible' : 'not-eligible'}`}>
                {isRefundEligible(bookingToCancel().date) ? (<>
                    <CheckCircle size={20}/>
                    <div>
                      <strong>{bookingToCancel().paymentMethod === 'trial' ? 'Trial Available Again' : 'Refund Eligible'}</strong>
                      <p>{bookingToCancel().paymentMethod === 'trial' ? "Your trial lesson will be available to book again because you're cancelling at least 1 hour before the lesson." : "Your credit will be refunded since you're cancelling at least 1 hour before the lesson."}</p>
                    </div>
                  </>) : (<>
                    <TriangleAlert size={16}/>
                    <div>
                      <strong>{bookingToCancel().paymentMethod === 'trial' ? 'Trial Allowance Used' : 'No Refund'}</strong>
                      <p>{bookingToCancel().paymentMethod === 'trial' ? 'Cancelling less than 1 hour before the lesson uses your trial allowance.' : 'Cancellations less than 1 hour before the lesson are not eligible for a refund.'}</p>
                    </div>
                  </>)}
              </div>

              <p class="cancel-warning">
                Are you sure you want to cancel this lesson? This action cannot be undone.
              </p>
            </div>

            <div class="cancel-modal-footer">
              <button class="cancel-modal-btn secondary" onClick={handleCancelModalClose} disabled={cancelling()}>
                Keep Lesson
              </button>
              <button class="cancel-modal-btn danger" onClick={handleConfirmCancel} disabled={cancelling()}>
                {cancelling() ? (<>
                    <span class="btn-spinner"></span>
                    Cancelling...
                  </>) : (<>
                    <X size={16}/>
                    Cancel Lesson
                  </>)}
              </button>
            </div>
          </div>
        </div>)}
    </>);
};
export default SchedulePage;
