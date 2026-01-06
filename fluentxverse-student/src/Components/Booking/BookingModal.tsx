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
  const [ticketLoading, setTicketLoading] = useState(true);
  const [transferringTicket, setTransferringTicket] = useState(false);

  // Get the connected account for ticket transfer
  const activeAccount = useActiveAccount();

  // Fetch ticket balance when modal opens
  useEffect(() => {
    if (isOpen && activeAccount?.address) {
      setTicketLoading(true);
      console.log('[BookingModal] Fetching ticket balance for:', activeAccount.address);
      getTicketBalance(activeAccount.address)
        .then((balance) => {
          console.log('[BookingModal] Got ticket balance:', balance);
          setTicketBalance(balance);
        })
        .catch((err) => {
          console.error('[BookingModal] Error fetching ticket balance:', err);
        })
        .finally(() => {
          setTicketLoading(false);
        });
    } else if (isOpen && !activeAccount?.address) {
      setTicketLoading(false);
    }
  }, [isOpen, activeAccount?.address]);

  // Helper function to convert PHT time to KST time
  // Returns the ACTUAL KST date (may be next day for late-night PHT times)
  // Handles both 12-hour format (6:00 PM) and 24-hour format (18:00)
  const convertToKoreanTimeWithDate = (phDateString: string, phTimeString: string): { date: string; time: string; dateRolledOver: boolean } => {
    let hours: number;
    let minutes: string;
    
    // Trim input and normalize whitespace
    const normalizedTime = phTimeString.trim();
    
    // Try 12-hour format first (e.g., "6:00 PM", "11:30PM", "11:30 pm")
    const time12Match = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (time12Match) {
      hours = parseInt(time12Match[1], 10);
      minutes = time12Match[2];
      const period = time12Match[3].toUpperCase();
      
      // Convert to 24-hour format
      if (period === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }
      console.log(`🕐 Parsed 12h time "${normalizedTime}" -> ${hours}:${minutes}`);
    } else {
      // Try 24-hour format (e.g., "18:00", "23:30")
      const time24Match = normalizedTime.match(/^(\d{1,2}):(\d{2})$/);
      if (time24Match) {
        hours = parseInt(time24Match[1], 10);
        minutes = time24Match[2];
        console.log(`🕐 Parsed 24h time "${normalizedTime}" -> ${hours}:${minutes}`);
      } else {
        // Can't parse, return as-is
        console.log(`🕐 Failed to parse time "${normalizedTime}", returning as-is`);
        return { date: phDateString, time: phTimeString, dateRolledOver: false };
      }
    }

    // Add 1 hour for Korean timezone (UTC+9 vs UTC+8)
    hours += 1;

    // Handle hour overflow - roll to next day
    let dateRolledOver = false;
    let resultDate = phDateString;
    if (hours >= 24) {
      hours -= 24;
      dateRolledOver = true;
      // Calculate the next day manually without timezone issues
      // Parse the PHT date string and add 1 day
      const [year, month, day] = phDateString.split('-').map(Number);
      const nextDayDate = new Date(year, month - 1, day + 1);
      resultDate = `${nextDayDate.getFullYear()}-${String(nextDayDate.getMonth() + 1).padStart(2, '0')}-${String(nextDayDate.getDate()).padStart(2, '0')}`;
      console.log(`🕐 Date rolled over: ${phDateString} -> ${resultDate}`);
    }

    return { date: resultDate, time: `${String(hours).padStart(2, '0')}:${minutes}`, dateRolledOver };
  };

  // Simple time-only conversion for display (keeps original PHT date for display grouping)
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

  // Helper to check if a PHT slot belongs to a specific PHT date
  // The date filter now represents PHT dates (tutor's timezone)
  // Students see all slots from that PHT date, with times converted to KST for display
  // e.g., Jan 6 PHT 11:00 PM displays as Jan 7 00:00 KST, but it's still a "Jan 6" slot
  const slotBelongsToPHTDate = (slotDate: string, targetPHTDate: string): boolean => {
    return slotDate === targetPHTDate;
  };

  const fetchAvailableSlots = async () => {
    setLoading(true);
    setError(null);
    try {
      // filterDate is a PHT date (same as tutor's timezone)
      // We fetch slots for that exact PHT date
      const startDate = filterDate || new Date().toISOString().split('T')[0];
      const endDate = filterDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const slots = await scheduleApi.getAvailableSlots(tutorId, startDate, endDate);
      console.log('📅 Fetched available slots (startDate:', startDate, 'endDate:', endDate, '):', slots);
      
      // Debug: Log conversion for each slot
      if (filterDate) {
        slots.forEach(slot => {
          const converted = convertToKoreanTimeWithDate(slot.date, slot.time);
          console.log(`📅 Slot ${slot.date} ${slot.time} PHT -> ${converted.date} ${converted.time} KST (rolled: ${converted.dateRolledOver})`);
        });
      }
      
      // If filterDate is set, filter to show slots that belong to this PHT date
      // All slots from that PHT date are shown, with times converted to KST for display
      // e.g., Jan 6 PHT 11:00 PM -> displays as 00:00 KST (next day in KST, but still Jan 6 slot)
      const filteredSlots = filterDate 
        ? slots.filter(slot => {
            const belongs = slotBelongsToPHTDate(slot.date, filterDate);
            const converted = convertToKoreanTimeWithDate(slot.date, slot.time);
            console.log(`📅 Slot ${slot.date} ${slot.time} PHT (-> ${converted.date} ${converted.time} KST) belongs to PHT ${filterDate}: ${belongs}`);
            return belongs;
          })
        : slots;
      
      console.log('📅 Filtered slots for PHT date', filterDate, ':', filteredSlots.length);
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

    // Wait for ticket data to load
    if (ticketLoading) {
      setError('Loading ticket balance, please wait...');
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

  // Helper to check if a slot has already elapsed (for today's date in KST)
  const isSlotElapsed = (slotDate: string, slotTime: string): boolean => {
    // Get current time in KST (Korea Standard Time, UTC+9)
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kstTime = new Date(utcTime + (9 * 60 * 60000)); // UTC+9
    
    // Format today's date in KST without using toISOString (which converts to UTC)
    const todayKST = `${kstTime.getFullYear()}-${String(kstTime.getMonth() + 1).padStart(2, '0')}-${String(kstTime.getDate()).padStart(2, '0')}`;
    
    // Convert slot PHT date/time to actual KST date/time
    const { date: kstDate, time: kstTimeStr } = convertToKoreanTimeWithDate(slotDate, slotTime);
    
    // If slot's KST date is in the future, not elapsed
    if (kstDate > todayKST) {
      return false;
    }
    
    // If slot's KST date is in the past, it's elapsed
    if (kstDate < todayKST) {
      return true;
    }
    
    // Same day - check time
    const [slotHours, slotMinutes] = kstTimeStr.split(':').map(Number);
    const slotTotalMinutes = slotHours * 60 + slotMinutes;
    const nowTotalMinutes = kstTime.getHours() * 60 + kstTime.getMinutes();
    
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
                  disabled={booking || ticketLoading}
                >
                  {booking ? (
                    <>
                      <span className="booking-modal-spinner-small"></span>
                      Booking...
                    </>
                  ) : ticketLoading ? (
                    <>
                      <span className="booking-modal-spinner-small"></span>
                      Loading...
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
