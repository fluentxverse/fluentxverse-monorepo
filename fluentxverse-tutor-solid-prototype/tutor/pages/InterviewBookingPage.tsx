import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorDialog from "../Components/Common/TutorDialog";
import TutorIcon from "../Components/Common/TutorIcon";
import TutorArt from "../Components/Common/TutorArt";
import IdentitySubmission from '../Components/IdentitySubmission';
import DashboardHeader from '@/Components/Dashboard/DashboardHeader';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { interviewApi, type InterviewSlot, type MyInterview } from '../api/interview.api';
import './InterviewBookingPage.css';
const InterviewBookingPage = () => {
    const manilaToday = () => new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) + 'T00:00:00');
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => {
            document.title = 'Book Interview | FluentXVerse';
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    const _state0 = useAuthContext();
    const [currentWeekOffset, setCurrentWeekOffset] = createSignal(0);
    const [refreshVersion, setRefreshVersion] = createSignal(0);
    const [availableSlots, setAvailableSlots] = createSignal<Map<string, InterviewSlot>>(new Map());
    const [myBooking, setMyBooking] = createSignal<MyInterview | null>(null);
    const bookingSummary = createMemo(() => {
        const booking = myBooking();
        if (booking?.result === 'pass') return { title: 'Interview passed', status: 'Passed', tone: 'passed', icon: 'fas fa-check-circle', description: 'Next, complete your tutor profile and submit it for review.' };
        if (booking?.result === 'fail') return { title: 'Interview not passed', status: 'Not passed', tone: 'failed', icon: 'fas fa-times-circle', description: 'Contact support for feedback and the next steps in your application.' };
        if (booking?.status === 'completed' || booking?.mediaClosed) return { title: 'Interview completed', status: 'Pending review', tone: 'pending', icon: 'fas fa-clock', description: 'Your interview is finished. Your recruitment team will share the decision here.' };
        return { title: 'Your interview is booked', status: 'Scheduled', tone: 'scheduled', icon: 'fas fa-calendar-check', description: 'Meet with the FluentXVerse recruitment team for your teaching interview.' };
    });
    createEffect(on(() => myBooking()?.id, id => {
        if (!id) return;
        let active = true, fetching = false;
        const refresh = async () => {
            if (fetching || document.hidden) return;
            fetching = true;
            try {
                const booking = await interviewApi.getMyBooking();
                if (active) setMyBooking(booking);
            } catch { /* Preserve the existing booking if a background refresh fails. */ }
            finally { fetching = false; }
        };
        const timer = window.setInterval(refresh, 15000);
        window.addEventListener('focus', refresh);
        onCleanup(() => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); });
    }));
    const [loading, setLoading] = createSignal(true);
    const [identityEligible, setIdentityEligible] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = createSignal(false);
    const [selectedSlot, setSelectedSlot] = createSignal<InterviewSlot | null>(null);
    const [bookingInProgress, setBookingInProgress] = createSignal(false);
    const [showCancelConfirmModal, setShowCancelConfirmModal] = createSignal(false);
    const [cancelInProgress, setCancelInProgress] = createSignal(false);
    const [toastMessage, setToastMessage] = createSignal<{
        text: string;
        type: 'success' | 'error';
    } | null>(null);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    // Generate week dates
    const getWeekDates = (offset: number) => {
        const today = manilaToday();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (today.getDay() + 6) % 7 + (offset * 7));
        const week = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            week.push(date);
        }
        return week;
    };
    const weekDates = createMemo(() => getWeekDates(currentWeekOffset()));
    // Format date for display
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    const formatDateFull = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    };
    // Week dates represent calendar days, not instants to convert to UTC.
    const calendarDateKey = (date: Date) =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    // Generate time slots for different periods
    const generateTimeSlots = () => {
        const slots: string[] = [];
        for (let h = 5; h < 24; h++) {
            const hour12 = h % 12 === 0 ? 12 : h % 12;
            const ampm = h < 12 ? 'AM' : 'PM';
            slots.push(`${hour12}:00 ${ampm}`);
            if (h < 23) {
                slots.push(`${hour12}:30 ${ampm}`);
            }
            else {
                slots.push('11:30 PM');
            }
        }
        return slots;
    };
    const allSlots = generateTimeSlots();
    const timeSlots = {
        morning: allSlots.filter(s => {
            const [t, p] = s.split(' ');
            const [h] = t.split(':').map(Number);
            const hour = p === 'PM' ? (h === 12 ? 12 : h + 12) : h;
            return hour >= 5 && hour < 12;
        }),
        afternoon: allSlots.filter(s => {
            const [t, p] = s.split(' ');
            const [h] = t.split(':').map(Number);
            const hour = p === 'PM' ? (h === 12 ? 12 : h + 12) : h;
            return hour >= 12 && hour < 18;
        }),
        evening: allSlots.filter(s => {
            const [t, p] = s.split(' ');
            const [h, m] = t.split(':').map(Number);
            const hour = p === 'PM' ? (h === 12 ? 12 : h + 12) : h;
            return hour >= 18 && (hour < 24 || (hour === 23 && m === 30));
        })
    };
    // Check if slot is in the past
    const isPastSlot = (date: Date, timeStr: string): boolean => {
        const [time, period] = timeStr.split(' ');
        let [hour, minute] = time.split(':').map(Number);
        if (period === 'PM' && hour !== 12)
            hour += 12;
        if (period === 'AM' && hour === 12)
            hour = 0;
        const dateString = calendarDateKey(date);
        return Date.parse(`${dateString}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`) <= Date.now();
    };
    // Load data
    const bookableSlots = createMemo(() => [...availableSlots().values()]
      .filter(slot => !isPastSlot(new Date(slot.date + 'T00:00:00'), slot.time))
      .sort((a, b) => {
        const at = (s: InterviewSlot) => {
          const [time, period] = s.time.split(' '), [h, m] = time.split(':').map(Number);
          return Date.parse(`${s.date}T${String(h % 12 + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+08:00`);
        };
        return at(a) - at(b);
      }));
    createEffect(on(() => [currentWeekOffset(), refreshVersion()], () => {
        const _cleanup2 = untrack(() => {
            const loadData = async () => {
                setLoading(true);
                setError(null);
                try {
                    const [slotsData, bookingData] = await Promise.all([
                        interviewApi.getAvailableSlots(currentWeekOffset()),
                        interviewApi.getMyBooking()
                    ]);
                    const newSlots = new Map<string, InterviewSlot>();
                    slotsData.forEach(slot => {
                        const slotDate = new Date(slot.date + 'T00:00:00');
                        const dayIdx = weekDates().findIndex(d => d.getFullYear() === slotDate.getFullYear() &&
                            d.getMonth() === slotDate.getMonth() &&
                            d.getDate() === slotDate.getDate());
                        if (dayIdx !== -1) {
                            const key = `${dayIdx}-${slot.time}`;
                            newSlots.set(key, slot);
                        }
                    });
                    setAvailableSlots(newSlots);
                    setMyBooking(bookingData);
                }
                catch (err: any) {
                    console.error('Failed to load interview data:', err);
                    setError(err.message || 'Failed to load data');
                }
                finally {
                    setLoading(false);
                }
            };
            loadData();
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    // Handle slot click
    const handleSlotClick = (slot: InterviewSlot) => {
        if (!identityEligible()) return;
        if (myBooking()) {
            // Already have a booking
            return;
        }
        setSelectedSlot(slot);
        setShowConfirmModal(true);
    };
    // Confirm booking
    const handleConfirmBooking = async () => {
        if (!selectedSlot())
            return;
        setBookingInProgress(true);
        try {
            await interviewApi.bookSlot(selectedSlot().id);
            // Reload data
            const [slotsData, bookingData] = await Promise.all([
                interviewApi.getAvailableSlots(currentWeekOffset()),
                interviewApi.getMyBooking()
            ]);
            const newSlots = new Map<string, InterviewSlot>();
            slotsData.forEach(slot => {
                const slotDate = new Date(slot.date + 'T00:00:00');
                const dayIdx = weekDates().findIndex(d => d.getFullYear() === slotDate.getFullYear() &&
                    d.getMonth() === slotDate.getMonth() &&
                    d.getDate() === slotDate.getDate());
                if (dayIdx !== -1) {
                    const key = `${dayIdx}-${slot.time}`;
                    newSlots.set(key, slot);
                }
            });
            setAvailableSlots(newSlots);
            setMyBooking(bookingData);
            setShowConfirmModal(false);
            setSelectedSlot(null);
        }
        catch (err: any) {
            setError(err.message || 'Failed to book interview');
        }
        finally {
            setBookingInProgress(false);
        }
    };
    // Cancel booking with confirmation
    const handleCancelBooking = async () => {
        if (!myBooking())
            return;
        setCancelInProgress(true);
        try {
            await interviewApi.cancelBooking(myBooking().id);
            // Reload data
            const [slotsData, bookingData] = await Promise.all([
                interviewApi.getAvailableSlots(currentWeekOffset()),
                interviewApi.getMyBooking()
            ]);
            const newSlots = new Map<string, InterviewSlot>();
            slotsData.forEach(slot => {
                const slotDate = new Date(slot.date + 'T00:00:00');
                const dayIdx = weekDates().findIndex(d => d.getFullYear() === slotDate.getFullYear() &&
                    d.getMonth() === slotDate.getMonth() &&
                    d.getDate() === slotDate.getDate());
                if (dayIdx !== -1) {
                    const key = `${dayIdx}-${slot.time}`;
                    newSlots.set(key, slot);
                }
            });
            setAvailableSlots(newSlots);
            setMyBooking(bookingData);
            setShowCancelConfirmModal(false);
            setToastMessage({ text: 'Interview cancelled successfully', type: 'success' });
            setTimeout(() => setToastMessage(null), 3000);
        }
        catch (err: any) {
            setToastMessage({ text: err.message || 'Failed to cancel booking', type: 'error' });
            setTimeout(() => setToastMessage(null), 3000);
        }
        finally {
            setCancelInProgress(false);
        }
    };
    const isToday = (date: Date) => {
        const today = manilaToday();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };
    return (<>
      <SideBar />
      <div class="main-content">
        <DashboardHeader />
        <div class="interview-booking-page">
          <div class="container">
            {/* Page Header */}
            <div class="interview-header">
              <div class="interview-header-left">
                <div class="interview-header-icon">
                  <TutorArt name="schedule" size={32}/>
                </div>
                <h1>{identityEligible() || myBooking() ? 'Book Your Interview' : 'Interview application'}</h1>
              </div>
              <a class="booking-guide-link" href="/interview-guide">Interview guide <TutorIcon name="fas fa-arrow-right"/></a>
            </div>

            {/* Current Booking */}
            {myBooking() && (<section class="current-booking-card interview-appointment" aria-labelledby="interview-appointment-title">
                <div class="interview-appointment-header">
                  <span class="interview-appointment-eyebrow">Your application interview</span>
                  <span class={`interview-appointment-status ${bookingSummary().tone}`}><TutorIcon name={bookingSummary().icon}/>{bookingSummary().status}</span>
                </div>
                <div class="interview-appointment-body">
                  <div class="interview-appointment-date" aria-hidden="true">
                    <span>{new Date(myBooking().date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</span>
                    <strong>{Number(myBooking().date.slice(-2))}</strong>
                  </div>
                  <div class="interview-appointment-content">
                    <h2 id="interview-appointment-title" class="interview-appointment-title">{bookingSummary().title}</h2>
                    <p class="interview-appointment-full-date">{formatDateFull(myBooking().date)}</p>
                    <p class="interview-appointment-description">{bookingSummary().description}</p>
                    <dl class="interview-appointment-meta">
                      <div><dt><TutorIcon name="fas fa-clock"/> Time</dt><dd>{myBooking().time}<span>Manila (UTC+08:00)</span></dd></div>
                      <div><dt><TutorIcon name="fas fa-video"/> Location</dt><dd>Online video call<span>FluentXVerse interview room</span></dd></div>
                    </dl>
                  </div>
                </div>
                <div class="interview-appointment-actions">
                  {myBooking().status === 'booked' && !myBooking().mediaClosed && <button class="interview-appointment-action primary" onClick={() => window.location.href = `/interview/room/${myBooking().id}`}>
                    <TutorIcon name="fas fa-video"/> Join interview
                  </button>}
                  <a class={`interview-appointment-action ${myBooking().status === 'booked' && !myBooking().mediaClosed ? 'secondary' : 'primary'}`} href={myBooking().result === 'pass' ? '/application/profile' : '/home'}>{myBooking().result === 'pass' ? 'Complete your profile' : 'Application progress'}<TutorIcon name="fas fa-arrow-right"/></a>
                  {myBooking().status === 'booked' && !myBooking().mediaClosed && !myBooking().result && <button class="interview-appointment-action cancel" onClick={() => setShowCancelConfirmModal(true)}>
                    <TutorIcon name="fas fa-times"/> Cancel interview
                  </button>}
                </div>
              </section>)}

            {/* Cancel Confirmation Modal */}
            {showCancelConfirmModal() && (<TutorDialog label="Cancel interview" className="tutor-interview-dialog" onClose={() => setShowCancelConfirmModal(false)} busy={cancelInProgress()}>
                <div class="modal-dialog" onClick={(e) => e.stopPropagation()}>
                  <div class="modal-header">
                    <h2><TutorArt name="community" size={32}/> Confirm Cancellation</h2>
                    <button class="modal-close" onClick={() => setShowCancelConfirmModal(false)} disabled={cancelInProgress()} aria-label="Close cancellation confirmation">
                      <TutorIcon name="fas fa-times"/>
                    </button>
                  </div>
                  <div class="modal-body">
                    <p>Are you sure you want to cancel your interview booking?</p>
                    <p class="modal-date">
                      <strong>Scheduled for:</strong> {myBooking() && formatDateFull(myBooking().date)} at {myBooking()?.time}
                    </p>
                  </div>
                  <div class="modal-actions">
                    <button class="btn-secondary" onClick={() => setShowCancelConfirmModal(false)} disabled={cancelInProgress()}>
                      Keep Booking
                    </button>
                    <button class="btn-danger" onClick={handleCancelBooking} disabled={cancelInProgress()}>
                      {cancelInProgress() ? <span><TutorIcon name="fas fa-spinner fa-spin"/> Cancelling...</span> : <span><TutorIcon name="fas fa-times"/> Cancel Interview</span>}
                    </button>
                  </div>
                </div>
              </TutorDialog>)}

            {/* Toast Notification */}
            {toastMessage() && (<div class={`toast-notification ${toastMessage().type}`}>
                <TutorIcon name={`fas ${toastMessage().type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}/>
                {toastMessage().text}
              </div>)}

            <IdentitySubmission onEligibility={setIdentityEligible}/>
            {(identityEligible() || myBooking()) && <>
            {!myBooking() && <div class="booking-workspace">
            <section class="booking-availability" aria-label="Interview availability">
              <div class="booking-section-heading"><div><h2>Choose your interview time</h2>
              <p class="interview-timezone">Manila time · UTC+08:00</p></div>
              <button class="booking-refresh" title="Refresh availability" aria-label="Refresh availability" disabled={loading()} onClick={() => setRefreshVersion(v => v + 1)}><TutorIcon name="fas fa-sync-alt"/></button></div>
              <div class="interview-calendar-toolbar">
              {/* Calendar Navigation */}
              <div class="calendar-nav">
                <div class="week-navigation">
                  <button class="nav-btn" disabled={currentWeekOffset() <= 0} aria-label="Previous week" title="Previous week" onClick={() => setCurrentWeekOffset(prev => Math.max(0, prev - 1))}>
                    <TutorIcon name="fas fa-chevron-left"/>
                  </button>
                  <span class="week-range" aria-live="polite">
                    {formatDate(weekDates()[0])} - {formatDate(weekDates()[6])}
                  </span>
                  <button class="nav-btn" aria-label="Next week" title="Next week" onClick={() => setCurrentWeekOffset(prev => prev + 1)}>
                    <TutorIcon name="fas fa-chevron-right"/>
                  </button>
                </div>
              </div>
              <button class="booking-week-reset" onClick={() => setCurrentWeekOffset(0)}>This week</button>
              </div>

              {/* Calendar Grid */}
              {loading() && !availableSlots().size ? (<div class="loading-container">
                  <div class="loading-spinner"></div>
                  <p>Loading available slots...</p>
                </div>) : error() ? (<div class="error-container">
                  <TutorIcon name="fas fa-exclamation-triangle"/>
                  <p>{error()}</p>
                  <button class="btn btn-primary" onClick={() => setRefreshVersion(v => v + 1)}>
                    Retry
                  </button>
                </div>) : bookableSlots().length === 0 ? (<div class="booking-empty" role="status">
                  <TutorArt name="schedule" size={64}/><h3>No interview times available yet</h3>
                  <p>Our team opens slots up to three days ahead. Check back soon for new times. Your ID booking deadline still applies.</p>
                  <button class="interview-appointment-action secondary" onClick={() => setRefreshVersion(v => v + 1)}><TutorIcon name="fas fa-sync-alt"/> Check again</button>
                </div>) : <div class="booking-date-list">{weekDates().map(date => {
                  const slots = () => bookableSlots().filter(s => s.date === calendarDateKey(date));
                  return <>{slots().length > 0 && <section class="booking-date-row"><div class="booking-date-label"><strong>{isToday(date) ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'long' })}</strong><span>{formatDate(date)}</span></div>
                    <div class="booking-time-options">{slots().map(slot => <button class="booking-time" disabled={!identityEligible()} aria-label={`Book interview on ${formatDateFull(slot.date)} at ${slot.time}`} onClick={() => handleSlotClick(slot)}><TutorIcon name="fas fa-clock"/>{slot.time}</button>)}</div>
                  </section>}</>;
                })}</div>}
            </section>
            <aside class="booking-preparation"><TutorArt name="contactCheck" size={56}/><h2>Ready for your interview</h2>
              <ul><li>Keep the same ID you submitted ready to show on camera.</li><li>Check your microphone, camera and internet connection.</li><li>Choose a quiet, well-lit place for your video call.</li></ul>
              <p>You can hold one interview booking at a time. Cancelling or missing it requires a new ID submission.</p>
              <a class="booking-guide-link" href="/interview-guide">Read the interview guide <TutorIcon name="fas fa-arrow-right"/></a>
            </aside>
            </div>}
            </>}
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirmModal() && selectedSlot() && (<TutorDialog label="Confirm interview booking" className="tutor-interview-dialog" onClose={() => setShowConfirmModal(false)} busy={bookingInProgress()}>
          <div class="interview-modal" onClick={e => e.stopPropagation()}>
            <h3>Confirm Interview Booking</h3>
            <p>You are about to book the following interview slot:</p>
            <div class="booking-confirm-details">
              <p><TutorIcon name="fas fa-calendar-day"/> {formatDateFull(selectedSlot().date)}</p>
              <p><TutorIcon name="fas fa-clock"/> {selectedSlot().time}</p>
            </div>
            <p class="interview-modal-note">
              Please make sure you're available at this time. You can cancel up until the interview time.
            </p>
            <div class="interview-modal-actions">
              <button class="interview-modal-btn interview-modal-btn-secondary" onClick={() => setShowConfirmModal(false)} disabled={bookingInProgress()}>
                Cancel
              </button>
              <button class="interview-modal-btn interview-modal-btn-primary" onClick={handleConfirmBooking} disabled={bookingInProgress()}>
                {bookingInProgress() ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </TutorDialog>)}
    </>);
};
export default InterviewBookingPage;
