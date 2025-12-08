import { useState, useEffect } from 'preact/hooks';
import DashboardHeader from '@/Components/Dashboard/DashboardHeader';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { interviewApi, type InterviewSlot, type MyInterview } from '../api/interview.api';
import './InterviewBookingPage.css';

const InterviewBookingPage = () => {
  useEffect(() => {
    document.title = 'Book Interview | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'morning' | 'afternoon' | 'evening'>('afternoon');
  const [availableSlots, setAvailableSlots] = useState<Map<string, InterviewSlot>>(new Map());
  const [myBooking, setMyBooking] = useState<MyInterview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<InterviewSlot | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [cancelInProgress, setCancelInProgress] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Generate week dates
  const getWeekDates = (offset: number) => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1 + (offset * 7));
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      week.push(date);
    }
    return week;
  };

  const weekDates = getWeekDates(currentWeekOffset);

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
      } else {
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
    const now = new Date();
    const [time, period] = timeStr.split(' ');
    let [hour, minute] = time.split(':').map(Number);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    const slotDateTime = new Date(date);
    slotDateTime.setHours(hour, minute, 0, 0);
    return slotDateTime < now;
  };

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [slotsData, bookingData] = await Promise.all([
          interviewApi.getAvailableSlots(currentWeekOffset),
          interviewApi.getMyBooking()
        ]);
        
        const newSlots = new Map<string, InterviewSlot>();
        slotsData.forEach(slot => {
          const slotDate = new Date(slot.date + 'T00:00:00');
          const dayIdx = weekDates.findIndex(d => 
            d.getFullYear() === slotDate.getFullYear() &&
            d.getMonth() === slotDate.getMonth() &&
            d.getDate() === slotDate.getDate()
          );
          if (dayIdx !== -1) {
            const key = `${dayIdx}-${slot.time}`;
            newSlots.set(key, slot);
          }
        });
        
        setAvailableSlots(newSlots);
        setMyBooking(bookingData);
      } catch (err: any) {
        console.error('Failed to load interview data:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [currentWeekOffset]);

  // Handle slot click
  const handleSlotClick = (slot: InterviewSlot) => {
    if (myBooking) {
      // Already have a booking
      return;
    }
    setSelectedSlot(slot);
    setShowConfirmModal(true);
  };

  // Confirm booking
  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;
    
    setBookingInProgress(true);
    
    try {
      await interviewApi.bookSlot(selectedSlot.id);
      
      // Reload data
      const [slotsData, bookingData] = await Promise.all([
        interviewApi.getAvailableSlots(currentWeekOffset),
        interviewApi.getMyBooking()
      ]);
      
      const newSlots = new Map<string, InterviewSlot>();
      slotsData.forEach(slot => {
        const slotDate = new Date(slot.date + 'T00:00:00');
        const dayIdx = weekDates.findIndex(d => 
          d.getFullYear() === slotDate.getFullYear() &&
          d.getMonth() === slotDate.getMonth() &&
          d.getDate() === slotDate.getDate()
        );
        if (dayIdx !== -1) {
          const key = `${dayIdx}-${slot.time}`;
          newSlots.set(key, slot);
        }
      });
      
      setAvailableSlots(newSlots);
      setMyBooking(bookingData);
      setShowConfirmModal(false);
      setSelectedSlot(null);
    } catch (err: any) {
      setError(err.message || 'Failed to book interview');
    } finally {
      setBookingInProgress(false);
    }
  };

  // Cancel booking with confirmation
  const handleCancelBooking = async () => {
    if (!myBooking) return;
    
    setCancelInProgress(true);
    
    try {
      await interviewApi.cancelBooking(myBooking.id);
      
      // Reload data
      const [slotsData, bookingData] = await Promise.all([
        interviewApi.getAvailableSlots(currentWeekOffset),
        interviewApi.getMyBooking()
      ]);
      
      const newSlots = new Map<string, InterviewSlot>();
      slotsData.forEach(slot => {
        const slotDate = new Date(slot.date + 'T00:00:00');
        const dayIdx = weekDates.findIndex(d => 
          d.getFullYear() === slotDate.getFullYear() &&
          d.getMonth() === slotDate.getMonth() &&
          d.getDate() === slotDate.getDate()
        );
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
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to cancel booking', type: 'error' });
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setCancelInProgress(false);
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <DashboardHeader />
        <div className="interview-booking-page">
          <div className="container">
            {/* Page Header */}
            <div className="interview-header">
              <div className="interview-header-left">
                <div className="interview-header-icon">
                  <i className="fas fa-calendar-alt"></i>
                </div>
                <h1>Book Your Interview</h1>
              </div>
              <div className="interview-header-actions">
                <button className="btn-today" onClick={() => setCurrentWeekOffset(0)}>
                  <i className="fas fa-calendar-check"></i> Today
                </button>
              </div>
            </div>

            {/* Current Booking */}
            {myBooking && (
              <div className="current-booking-card">
                <h2><i className="fas fa-calendar-check"></i> Your Scheduled Interview</h2>
                <div className="booking-details">
                  <div className="booking-detail">
                    <i className="fas fa-calendar-day"></i>
                    <span>{formatDateFull(myBooking.date)}</span>
                  </div>
                  <div className="booking-detail">
                    <i className="fas fa-clock"></i>
                    <span>{myBooking.time}</span>
                  </div>
                </div>
                <div className="booking-actions">
                  <button 
                    className="btn-join-interview" 
                    onClick={() => window.location.href = `/interview/room/${myBooking.id}`}
                  >
                    <i className="fas fa-video"></i> Join Interview
                  </button>
                  <button className="btn-cancel" onClick={() => setShowCancelConfirmModal(true)}>
                    <i className="fas fa-times"></i> Cancel Interview
                  </button>
                </div>
              </div>
            )}

            {/* Cancel Confirmation Modal */}
            {showCancelConfirmModal && (
              <div className="modal-overlay" onClick={() => setShowCancelConfirmModal(false)}>
                <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h2><i className="fas fa-exclamation-circle"></i> Confirm Cancellation</h2>
                    <button className="modal-close" onClick={() => setShowCancelConfirmModal(false)}>
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                  <div className="modal-body">
                    <p>Are you sure you want to cancel your interview booking?</p>
                    <p className="modal-date">
                      <strong>Scheduled for:</strong> {myBooking && formatDateFull(myBooking.date)} at {myBooking?.time}
                    </p>
                  </div>
                  <div className="modal-actions">
                    <button className="btn-secondary" onClick={() => setShowCancelConfirmModal(false)} disabled={cancelInProgress}>
                      Keep Booking
                    </button>
                    <button className="btn-danger" onClick={handleCancelBooking} disabled={cancelInProgress}>
                      {cancelInProgress ? <span><i className="fas fa-spinner fa-spin"></i> Cancelling...</span> : <span><i className="fas fa-times"></i> Cancel Interview</span>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Toast Notification */}
            {toastMessage && (
              <div className={`toast-notification ${toastMessage.type}`}>
                <i className={`fas ${toastMessage.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                {toastMessage.text}
              </div>
            )}

            {/* Info Card */}
            {!myBooking && (
              <div className="info-card">
                <div className="info-card-icon">
                  <i className="fas fa-info-circle"></i>
                </div>
                <p>
                  Select an available interview slot below. You can only have one scheduled interview at a time.
                  The interview will be conducted by a FluentXVerse administrator to verify your teaching capabilities.
                </p>
              </div>
            )}

            {/* Schedule Card */}
            <div className="schedule-card">
              {/* Calendar Navigation */}
              <div className="calendar-nav">
                <div className="week-navigation">
                  <button className="nav-btn" onClick={() => setCurrentWeekOffset(prev => prev - 1)}>
                    <i className="fas fa-chevron-left"></i>
                    <span>Previous</span>
                  </button>
                  <span className="week-range">
                    {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
                  </span>
                  <button className="nav-btn" onClick={() => setCurrentWeekOffset(prev => prev + 1)}>
                    <span>Next</span>
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>

              {/* Period Tabs */}
              <div className="period-tabs">
                <button 
                  className={`period-tab ${selectedPeriod === 'morning' ? 'active' : ''}`}
                  onClick={() => setSelectedPeriod('morning')}
                >
                  <i className="fas fa-sun"></i>
                  Morning
                </button>
                <button 
                  className={`period-tab ${selectedPeriod === 'afternoon' ? 'active' : ''}`}
                  onClick={() => setSelectedPeriod('afternoon')}
                >
                  <i className="fas fa-cloud-sun"></i>
                  Afternoon
                </button>
                <button 
                  className={`period-tab ${selectedPeriod === 'evening' ? 'active' : ''}`}
                  onClick={() => setSelectedPeriod('evening')}
                >
                  <i className="fas fa-moon"></i>
                  Evening
                </button>
              </div>

              {/* Calendar Grid */}
              {loading && !availableSlots.size ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading available slots...</p>
                </div>
              ) : error ? (
                <div className="error-container">
                  <i className="fas fa-exclamation-triangle"></i>
                  <p>{error}</p>
                  <button className="btn btn-primary" onClick={() => setCurrentWeekOffset(currentWeekOffset)}>
                    Retry
                  </button>
                </div>
              ) : (
                <div className="calendar-container">
                  <div className="calendar-grid">
                    {/* Header Row */}
                    <div className="calendar-header">
                      <div className="time-header"></div>
                      {weekDates.map((date, idx) => (
                        <div key={idx} className={`day-header ${isToday(date) ? 'today' : ''}`}>
                          <div className="day-name">{days[idx].substring(0, 3)}</div>
                          <div className="day-date">{date.getDate()}</div>
                        </div>
                      ))}
                    </div>

                    {/* Time Rows */}
                    {timeSlots[selectedPeriod].map(time => (
                      <div key={time} className="time-row">
                        <div className="time-label">{time}</div>
                        {weekDates.map((date, dayIdx) => {
                          const key = `${dayIdx}-${time}`;
                          const slot = availableSlots.get(key);
                          const isPast = isPastSlot(date, time);
                          
                          // Check if this slot is the user's booking
                          const dateStr = date.toISOString().split('T')[0];
                          const isMyBooking = myBooking && myBooking.date === dateStr && myBooking.time === time;
                          
                          return (
                            <div 
                              key={key}
                              className={`slot-cell ${isPast ? 'past' : ''} ${isMyBooking ? 'booked' : ''} ${slot && !myBooking ? 'available' : ''}`}
                            >
                              {isMyBooking ? (
                                <div className="slot-badge booked">
                                  <i className="fas fa-check-circle"></i> Your Booking
                                </div>
                              ) : slot && !myBooking ? (
                                <div 
                                  className="slot-badge open"
                                  onClick={() => handleSlotClick(slot)}
                                >
                                  <i className="fas fa-plus-circle"></i> Available
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {availableSlots.size === 0 && !loading && !error && (
              <div className="empty-state">
                <i className="fas fa-calendar-times"></i>
                <h3>No Available Slots</h3>
                <p>There are no interview slots available for this week. Please check back later or try a different week.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && selectedSlot && (
        <div className="interview-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="interview-modal" onClick={e => e.stopPropagation()}>
            <h3>Confirm Interview Booking</h3>
            <p>You are about to book the following interview slot:</p>
            <div className="booking-confirm-details">
              <p><i className="fas fa-calendar-day"></i> {formatDateFull(selectedSlot.date)}</p>
              <p><i className="fas fa-clock"></i> {selectedSlot.time}</p>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              Please make sure you're available at this time. You can cancel up until the interview time.
            </p>
            <div className="interview-modal-actions">
              <button 
                className="interview-modal-btn interview-modal-btn-secondary" 
                onClick={() => setShowConfirmModal(false)}
                disabled={bookingInProgress}
              >
                Cancel
              </button>
              <button 
                className="interview-modal-btn interview-modal-btn-primary"
                onClick={handleConfirmBooking}
                disabled={bookingInProgress}
              >
                {bookingInProgress ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InterviewBookingPage;
