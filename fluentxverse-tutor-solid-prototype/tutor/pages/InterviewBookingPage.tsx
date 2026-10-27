import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorDialog from "../Components/Common/TutorDialog";
import TutorIcon from "../Components/Common/TutorIcon";
import TutorArt from "../Components/Common/TutorArt";
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
    const [selectedPeriod, setSelectedPeriod] = createSignal<'morning' | 'afternoon' | 'evening'>('afternoon');
    const [availableSlots, setAvailableSlots] = createSignal<Map<string, InterviewSlot>>(new Map());
    const [myBooking, setMyBooking] = createSignal<MyInterview | null>(null);
    const [loading, setLoading] = createSignal(true);
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
        const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return Date.parse(`${dateString}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`) <= Date.now();
    };
    // Load data
    createEffect(on(() => [currentWeekOffset()], () => {
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
                <h1>Book Your Interview</h1>
              </div>
              <div class="interview-header-actions">
                <button class="btn-today" onClick={() => setCurrentWeekOffset(0)}>
                  <TutorIcon name="fas fa-calendar-check"/> Today
                </button>
              </div>
            </div>

            {/* Current Booking */}
            {myBooking() && (<div class="current-booking-card">
                <h2><TutorArt name="schedule" size={32}/> Your Scheduled Interview</h2>
                <div class="booking-details">
                  <div class="booking-detail">
                    <TutorIcon name="fas fa-calendar-day"/>
                    <span>{formatDateFull(myBooking().date)}</span>
                  </div>
                  <div class="booking-detail">
                    <TutorIcon name="fas fa-clock"/>
                    <span>{myBooking().time}</span>
                  </div>
                </div>
                <div class="booking-actions">
                  <button class="btn-join-interview" onClick={() => window.location.href = `/interview/room/${myBooking().id}`}>
                    <TutorIcon name="fas fa-video"/> Join Interview
                  </button>
                  <button class="btn-cancel" onClick={() => setShowCancelConfirmModal(true)}>
                    <TutorIcon name="fas fa-times"/> Cancel Interview
                  </button>
                </div>
              </div>)}

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

            {/* Info Card */}
            {!myBooking() && (<div class="info-card">
                <div class="info-card-icon">
                  <TutorIcon name="fas fa-info-circle"/>
                </div>
                <p>
                  Select an available interview slot below. You can only have one scheduled interview at a time.
                  The interview will be conducted by a FluentXVerse administrator to verify your teaching capabilities.
                </p>
              </div>)}

            {/* Schedule Card */}
            <div class="schedule-card">
              <p class="interview-timezone">Interview times: Asia/Manila (UTC+08:00)</p>
              <div class="interview-calendar-toolbar">
              {/* Calendar Navigation */}
              <div class="calendar-nav">
                <div class="week-navigation">
                  <button class="nav-btn" aria-label="Previous week" title="Previous week" onClick={() => setCurrentWeekOffset(prev => prev - 1)}>
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

              {/* Period Tabs */}
              <div class="period-tabs" role="group" aria-label="Time of day">
                <button aria-pressed={selectedPeriod() === 'morning'} class={`period-tab ${selectedPeriod() === 'morning' ? 'active' : ''}`} onClick={() => setSelectedPeriod('morning')}>
                  <TutorIcon name="fas fa-sun"/>
                  Morning
                </button>
                <button aria-pressed={selectedPeriod() === 'afternoon'} class={`period-tab ${selectedPeriod() === 'afternoon' ? 'active' : ''}`} onClick={() => setSelectedPeriod('afternoon')}>
                  <TutorIcon name="fas fa-cloud-sun"/>
                  Afternoon
                </button>
                <button aria-pressed={selectedPeriod() === 'evening'} class={`period-tab ${selectedPeriod() === 'evening' ? 'active' : ''}`} onClick={() => setSelectedPeriod('evening')}>
                  <TutorIcon name="fas fa-moon"/>
                  Evening
                </button>
              </div>
              </div>

              {/* Calendar Grid */}
              {loading() && !availableSlots().size ? (<div class="loading-container">
                  <div class="loading-spinner"></div>
                  <p>Loading available slots...</p>
                </div>) : error() ? (<div class="error-container">
                  <TutorIcon name="fas fa-exclamation-triangle"/>
                  <p>{error()}</p>
                  <button class="btn btn-primary" onClick={() => setCurrentWeekOffset(currentWeekOffset())}>
                    Retry
                  </button>
                </div>) : (<div class="calendar-container" role="region" aria-label="Interview availability" tabIndex={0}>
                  <div class="calendar-grid">
                    {/* Header Row */}
                    <div class="calendar-header">
                      <div class="time-header"></div>
                      {weekDates().map((date, idx) => (<div class={`day-header ${isToday(date) ? 'today' : ''}`}>
                          <div class="day-name">{days[idx].substring(0, 3)}</div>
                          <div class="day-date">{date.getDate()}</div>
                        </div>))}
                    </div>

                    {/* Time Rows */}
                    {timeSlots[selectedPeriod()].map(time => (<div class="time-row">
                        <div class="time-label">{time}</div>
                        {weekDates().map((date, dayIdx) => {
                    const key = `${dayIdx}-${time}`;
                    const slot = availableSlots().get(key);
                    const isPast = isPastSlot(date, time);
                    // Check if this slot is the user's booking
                    const dateStr = date.toISOString().split('T')[0];
                    const isMyBooking = myBooking() && myBooking().date === dateStr && myBooking().time === time;
                    return (<div class={`slot-cell ${isPast ? 'past' : ''} ${isMyBooking ? 'booked' : ''} ${slot && !myBooking() ? 'available' : ''}`}>
                              {isMyBooking ? (<div class="slot-badge booked">
                                  <TutorIcon name="fas fa-check-circle"/> Your Booking
                                </div>) : slot && !myBooking() && !isPast ? (<button type="button" class="slot-badge open" aria-label={`Book interview on ${formatDateFull(slot.date)} at ${slot.time}`} onClick={() => handleSlotClick(slot)}>
                                  <TutorIcon name="fas fa-plus-circle"/> Available
                                </button>) : null}
                            </div>);
                })}
                      </div>))}
                  </div>
                </div>)}
            </div>

            {availableSlots().size === 0 && !loading() && !error() && (<div class="empty-state">
                <TutorIcon name="fas fa-calendar-times"/>
                <h3>No Available Slots</h3>
                <p>There are no interview slots available for this week. Please check back later or try a different week.</p>
              </div>)}
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
