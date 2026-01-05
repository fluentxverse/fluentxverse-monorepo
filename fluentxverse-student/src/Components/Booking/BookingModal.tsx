import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { scheduleApi, AvailableSlot } from '../../api/schedule.api';
import { transferTicketForBooking, getTicketBalance, type TicketBalance } from '../../services/ticket.service';
import { useActiveAccount } from 'thirdweb/react';
import { getErrorMessage } from '../../api/utils';
import './BookingModal.css';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  tutorId: string;
  tutorName: string;
  tutorAvatar?: string;
  hourlyRate?: number;
  preSelectedDate?: string;
  preSelectedTime?: string;
  filterDate?: string; // YYYY-MM-DD format - only show slots for this date
}

export const BookingModal = ({ 
  isOpen, 
  onClose, 
  tutorId, 
  tutorName,
  tutorAvatar,
  hourlyRate,
  preSelectedDate,
  preSelectedTime,
  filterDate
}: BookingModalProps) => {
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [ticketBalance, setTicketBalance] = useState<TicketBalance | null>(null);
  const [transferringTicket, setTransferringTicket] = useState(false);

  // Get the connected account for ticket transfer
  const activeAccount = useActiveAccount();

  // Fetch ticket balance when modal opens
  useEffect(() => {
    if (isOpen && activeAccount?.address) {
      console.log('[BookingModal] Fetching ticket balance for:', activeAccount.address);
      getTicketBalance(activeAccount.address)
        .then((balance) => {
          console.log('[BookingModal] Got ticket balance:', balance);
          setTicketBalance(balance);
        })
        .catch((err) => {
          console.error('[BookingModal] Error fetching ticket balance:', err);
        });
    }
  }, [isOpen, activeAccount?.address]);

  // Helper function to convert PHT 12h to KST 24h format
  // IMPORTANT: Keep the original date, only convert time (11 PM PHT Dec 5 -> 00:00 KST Dec 5)
  const convertToKoreanTimeWithDate = (phDateString: string, phTimeString: string): { date: string; time: string } => {
    // Parse Philippine time (12-hour format like "6:00 PM")
    const timeMatch = phTimeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!timeMatch) return { date: phDateString, time: phTimeString };

    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2];
    const period = timeMatch[3].toUpperCase();

    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    // Add 1 hour for Korean timezone (UTC+9 vs UTC+8)
    hours += 1;

    // Handle hour overflow (wrap to 00:00, keep same date)
    if (hours >= 24) {
      hours -= 24;
    }

    // Keep the original date (tutor's schedule date)
    return { date: phDateString, time: `${String(hours).padStart(2, '0')}:${minutes}` };
  };

  // Simple time-only conversion for display
  const convertToKoreanTime = (phTimeString: string): string => {
    const result = convertToKoreanTimeWithDate('2000-01-01', phTimeString);
    return result.time;
  };

  useEffect(() => {
    if (isOpen && tutorId) {
      fetchAvailableSlots();
    }
  }, [isOpen, tutorId]);

  // Auto-select slot when preSelectedDate/Time are provided
  // preSelectedDate and preSelectedTime are in KST format, slots are in PHT format
  useEffect(() => {
    if (preSelectedDate && preSelectedTime && availableSlots.length > 0) {
      const matchingSlot = availableSlots.find(slot => {
        // Convert slot's PHT date+time to KST for comparison
        const { date: kstDate, time: kstTime } = convertToKoreanTimeWithDate(slot.date, slot.time);
        return kstDate === preSelectedDate && kstTime === preSelectedTime;
      });
      if (matchingSlot) {
        setSelectedSlot(matchingSlot);
      }
    }
  }, [preSelectedDate, preSelectedTime, availableSlots]);

  const fetchAvailableSlots = async () => {
    setLoading(true);
    setError(null);
    try {
      // If filterDate is provided, only fetch for that date
      // Otherwise fetch 7 days
      const startDate = filterDate || new Date().toISOString().split('T')[0];
      const endDate = filterDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const slots = await scheduleApi.getAvailableSlots(tutorId, startDate, endDate);
      console.log('📅 Fetched available slots:', slots);
      
      // If filterDate is set, filter to only show slots for that date
      const filteredSlots = filterDate 
        ? slots.filter(slot => slot.date === filterDate)
        : slots;
      
      console.log('📅 Filtered slots for date', filterDate, ':', filteredSlots.length);
      setAvailableSlots(filteredSlots);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBookSlot = async () => {
    if (!selectedSlot) return;
    
    // Check if user has connected wallet
    if (!activeAccount) {
      setError('Please connect your wallet to book a lesson');
      return;
    }

    // Check ticket balance
    console.log('[BookingModal] Checking ticket balance:', ticketBalance);
    const hasBasicTickets = ticketBalance && ticketBalance.basic >= 1;
    const hasPremiumTickets = ticketBalance && ticketBalance.premium >= 1;
    
    if (!hasBasicTickets && !hasPremiumTickets) {
      setError('You need at least 1 ticket to book a lesson. Please purchase tickets first.');
      return;
    }
    
    // Use basic tickets first, fallback to premium
    const ticketTier = hasBasicTickets ? 'basic' : 'premium';
    console.log('[BookingModal] Will use ticket tier:', ticketTier);
    
    setBooking(true);
    setTransferringTicket(true);
    setError(null);
    
    try {
      // Step 1: Transfer ticket to vault wallet (on-chain)
      console.log('🎟️ Step 1: Transferring ticket to vault...');
      const transferResult = await transferTicketForBooking(activeAccount, ticketTier as 'basic' | 'premium', 1);
      
      if (!transferResult.success) {
        throw new Error(transferResult.error || 'Failed to transfer ticket');
      }
      
      console.log('🎟️ Ticket transferred! TX:', transferResult.transactionHash);
      setTransferringTicket(false);
      
      // Step 2: Create booking on backend (pass transaction hash for verification)
      console.log('📅 Step 2: Creating booking on server...');
      await scheduleApi.bookSlot(selectedSlot.slotId, transferResult.transactionHash);
      
      setBookingSuccess(true);
      
      // Refresh ticket balance
      if (activeAccount?.address) {
        getTicketBalance(activeAccount.address).then(setTicketBalance).catch(console.error);
      }
      
      // Close modal after 2 seconds and redirect to schedule page
      setTimeout(() => {
        setBookingSuccess(false);
        onClose();
        window.location.href = '/schedule';
      }, 2000);
    } catch (err: any) {
      console.error('❌ Booking failed:', err);
      setError(getErrorMessage(err));
    } finally {
      setBooking(false);
      setTransferringTicket(false);
    }
  };

  const handleClose = () => {
    if (!booking && !bookingSuccess) {
      setSelectedSlot(null);
      setError(null);
      setBookingSuccess(false);
      setAvailableSlots([]);
      onClose();
    }
  };

  // Helper to check if a slot has already elapsed (for today's date)
  const isSlotElapsed = (slotDate: string, slotTime: string): boolean => {
    // Get current time in KST (Korea Standard Time, UTC+9)
    const now = new Date();
    const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));
    const todayKST = kstNow.toISOString().split('T')[0];
    
    // Only filter if it's today's date
    if (slotDate !== todayKST) {
      return false;
    }
    
    // Convert slot time to KST for comparison
    const kstTime = convertToKoreanTime(slotTime);
    const [slotHours, slotMinutes] = kstTime.split(':').map(Number);
    const slotTotalMinutes = slotHours * 60 + slotMinutes;
    const nowTotalMinutes = kstNow.getHours() * 60 + kstNow.getMinutes();
    
    // Slot is elapsed if its time has already passed
    return slotTotalMinutes <= nowTotalMinutes;
  };

  // Group slots by date and deduplicate by time
  const slotsByDate = availableSlots.reduce((acc, slot) => {
    // Skip elapsed slots
    if (isSlotElapsed(slot.date, slot.time)) {
      return acc;
    }
    
    if (!acc[slot.date]) {
      acc[slot.date] = new Map<string, AvailableSlot>();
    }
    // Only keep one slot per time (first one wins)
    if (!acc[slot.date].has(slot.time)) {
      acc[slot.date].set(slot.time, slot);
    }
    return acc;
  }, {} as Record<string, Map<string, AvailableSlot>>);

  // Convert Map values back to arrays
  const dedupedSlotsByDate = Object.entries(slotsByDate).reduce((acc, [date, slotsMap]) => {
    acc[date] = Array.from(slotsMap.values());
    return acc;
  }, {} as Record<string, AvailableSlot[]>);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const formatTime = (timeString: string) => {
    console.log('🕐 Formatting time:', timeString);
    // Convert Philippine time to Korean time (add 1 hour) - returns 24h format
    return convertToKoreanTime(timeString);
  };

  if (!isOpen) return null;

  return (
    <div className="booking-modal-overlay" onClick={handleClose}>
      <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
        <button className="booking-modal-close" onClick={handleClose} aria-label="Close">
          ×
        </button>

        {/* Header */}
        <div className="booking-modal-header">
          <div className="booking-modal-tutor">
            {tutorAvatar ? (
              <img src={tutorAvatar} alt={tutorName} className="booking-modal-avatar" />
            ) : (
              <div className="booking-modal-avatar booking-modal-avatar-placeholder">
                {tutorName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="booking-modal-tutor-info">
              <h2 className="booking-modal-title">Book a Lesson</h2>
              <p className="booking-modal-tutor-name">{tutorName}</p>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {bookingSuccess && (
          <div className="booking-modal-success">
            <div className="booking-modal-success-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h3>Booking Confirmed!</h3>
            <p>Redirecting to your schedule...</p>
          </div>
        )}

        {/* Loading State */}
        {loading && !bookingSuccess && (
          <div className="booking-modal-loading">
            <div className="booking-modal-spinner"></div>
            <p>Loading available slots...</p>
          </div>
        )}

        {/* Error State */}
        {error && !bookingSuccess && (
          <div className="booking-modal-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
            <button onClick={fetchAvailableSlots} className="booking-modal-retry">
              Retry
            </button>
          </div>
        )}

        {/* Available Slots */}
        {!loading && !bookingSuccess && !error && (
          <>
            <div className="booking-modal-content">
              {Object.keys(dedupedSlotsByDate).length === 0 ? (
                <div className="booking-modal-empty">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <p>No available slots for this date</p>
                  <small>Please check another date or try another tutor</small>
                </div>
              ) : (
                <div className="booking-modal-slots">
                  {Object.entries(dedupedSlotsByDate).map(([date, slots]) => (
                    <div key={date} className="booking-modal-date-group">
                      <h3 className="booking-modal-date-header">{formatDate(date)}</h3>
                      <div className="booking-modal-time-grid">
                        {slots.map((slot) => (
                          <button
                            key={slot.slotId}
                            className={`booking-modal-time-slot ${selectedSlot?.slotId === slot.slotId ? 'selected' : ''}`}
                            onClick={() => setSelectedSlot(slot)}
                          >
                            <span>{formatTime(slot.time)} KST</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {selectedSlot && (
              <div className="booking-modal-footer">
                <div className="booking-modal-selected-info">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>
                    {formatDate(selectedSlot.date)} at {formatTime(selectedSlot.time)} KST
                    <span className="booking-modal-duration"> ({(() => {
                      console.log('⏱️ Duration value:', selectedSlot.durationMinutes);
                      console.log('⏱️ Duration type:', typeof selectedSlot.durationMinutes);
                      // Neo4j Integer object has 'low' and 'high' properties
                      const duration = typeof selectedSlot.durationMinutes === 'object' && selectedSlot.durationMinutes !== null
                        ? (selectedSlot.durationMinutes as any).low || selectedSlot.durationMinutes
                        : Number(selectedSlot.durationMinutes);
                      console.log('⏱️ Converted duration:', duration);
                      return duration;
                    })()} min)</span>
                  </span>
                </div>
                <button
                  className="booking-modal-confirm"
                  onClick={handleBookSlot}
                  disabled={booking}
                >
                  {booking ? (
                    <>
                      <span className="booking-modal-spinner-small"></span>
                      Booking...
                    </>
                  ) : (
                    <>
                      Confirm Booking
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
