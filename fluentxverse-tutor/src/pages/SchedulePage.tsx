import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { scheduleApi } from '../api/schedule.api';

// Penalty code types
type PenaltyCode = '301' | '302' | '303' | '401' | '501' | '502' | '601';

interface SlotPenalty {
  code: PenaltyCode;
  label: string;
  reason: string;
  timestamp: Date;
}

const PENALTY_LABELS: Record<PenaltyCode, { label: string; color: string; bgColor: string }> = {
  '301': { label: 'TA-301', color: '#dc2626', bgColor: '#fef2f2' }, // Tutor Absence - Booked
  '302': { label: 'TA-302', color: '#ea580c', bgColor: '#fff7ed' }, // Tutor Absence - Unbooked
  '303': { label: 'TA-303', color: '#f59e0b', bgColor: '#fffbeb' }, // Short Notice Cancel
  '401': { label: 'SUB-401', color: '#6366f1', bgColor: '#eef2ff' }, // Substitution
  '501': { label: 'SYS-501', color: '#8b5cf6', bgColor: '#f5f3ff' }, // System Issue
  '502': { label: 'STU-502', color: '#06b6d4', bgColor: '#ecfeff' }, // Student Absent
  '601': { label: 'BLK-601', color: '#991b1b', bgColor: '#fef2f2' }, // Penalty Block
};

const SchedulePage = () => {
  const { user } = useAuthContext();
  const { route } = useLocation();
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<Set<string>>(new Set());
  const [attendanceMarked, setAttendanceMarked] = useState<Set<string>>(new Set()); // Track which open slots are marked as present
  const [slotPenalties, setSlotPenalties] = useState<Map<string, SlotPenalty>>(new Map()); // Track penalty codes per slot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize with a test booking for Nov 25, 2025 at 11:30 PM
  const initializeBookedSlots = () => {
    const map = new Map<string, string>();
    // Nov 25, 2025 is a Tuesday (day index 1 in the current week)
    const testKey = '1-11:30 PM';
    map.set(testKey, 'STD001');
    return map;
  };
  
  const [bookedSlots, setBookedSlots] = useState<Map<string, string>>(initializeBookedSlots()); // Map of slot key to student ID
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'morning' | 'afternoon' | 'evening'>('evening');
  const [showModal, setShowModal] = useState(false);
  const [pendingSelections, setPendingSelections] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'open' | 'close' | 'attendance' | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent' | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Refresh handler
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Generate current week dates
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
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Time slots for different periods
  // Generate 30-min slots for PH time 05:00–23:30
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
      const [h, m] = t.split(':').map(Number);
      const hour = p === 'PM' ? (h === 12 ? 12 : h + 12) : h;
      return hour >= 5 && hour < 12;
    }),
    afternoon: allSlots.filter(s => {
      const [t, p] = s.split(' ');
      const [h, m] = t.split(':').map(Number);
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

  // Parse time string to Date object
  const parseTimeString = (timeStr: string): { hour: number; minute: number } => {
    const [time, period] = timeStr.split(' ');
    let [hour, minute] = time.split(':').map(Number);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return { hour, minute };
  };

  // Format date to YYYY-MM-DD for API
  const formatDateISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const { getUserId } = useAuthContext();
  const userId = getUserId();
  
  // Load schedule data from API when week changes
  useEffect(() => {
    const loadSchedule = async () => {
      if (!userId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const scheduleData = await scheduleApi.getWeekSchedule(currentWeekOffset);
        
        // Convert schedule data to local state format
        const newSelectedSlots = new Set<string>();
        const newBookedSlots = new Map<string, string>();
        
        scheduleData.slots.forEach(slot => {

          
          // Find which day of the week this slot belongs to
          const slotDate = new Date(slot.date + 'T00:00:00'); // Parse as local date

          
          const dayIdx = weekDates.findIndex(d => {
            const match = d.getFullYear() === slotDate.getFullYear() &&
              d.getMonth() === slotDate.getMonth() &&
              d.getDate() === slotDate.getDate();

            return match;
          });
          
          if (dayIdx !== -1) {
            const key = `${dayIdx}-${slot.time}`;

            if (slot.status === 'open') {
              newSelectedSlots.add(key);

            } else if (slot.status === 'booked' && slot.studentId) {
              newSelectedSlots.add(key); // Keep as open slot visually
              newBookedSlots.set(key, slot.studentId);

            }
          } else {
            console.warn('Could not find dayIdx for slot date:', slot.date);
          }
        });
        

        
        setSelectedTimeSlots(newSelectedSlots);
        setBookedSlots(newBookedSlots);
      } catch (err: any) {
        console.error('Failed to load schedule:', err);
        setError(err.message || 'Failed to load schedule');
      } finally {
        setLoading(false);
      }
    };
    
    loadSchedule();
  }, [currentWeekOffset, userId, refreshTrigger]);

  // Check if slot can be opened (more than 5 minutes away)
  const canOpenSlot = (date: Date, timeStr: string): boolean => {
    const now = new Date();
    const { hour, minute } = parseTimeString(timeStr);
    const slotDateTime = new Date(date);
    slotDateTime.setHours(hour, minute, 0, 0);
    const diffInMinutes = (slotDateTime.getTime() - now.getTime()) / (1000 * 60);
    return diffInMinutes > 5;
  };

  // Check if slot can be marked for attendance (current day, more than 5 minutes before)
  const canMarkAttendance = (date: Date, timeStr: string): boolean => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const slotDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Must be today
    if (slotDate.getTime() !== today.getTime()) {
      return false;
    }
    
    // Must be more than 5 minutes before slot time
    const { hour, minute } = parseTimeString(timeStr);
    const slotDateTime = new Date(date);
    slotDateTime.setHours(hour, minute, 0, 0);
    const diffInMinutes = (slotDateTime.getTime() - now.getTime()) / (1000 * 60);
    return diffInMinutes > 5;
  };

  const handleSlotDoubleClick = (dayIdx: number, time: string) => {
    const key = `${dayIdx}-${time}`;
    const isBooked = bookedSlots.has(key);
    
    if (isBooked) {
      const studentId = bookedSlots.get(key);
      // Open in new tab
      window.open(`/student/${studentId}`, '_blank');
    }
  };

  const handleSlotClick = (dayIdx: number, time: string) => {
    console.log('🔴 handleSlotClick called', { dayIdx, time });
    
    const date = weekDates[dayIdx];
    const key = `${dayIdx}-${time}`;
    const isBooked = bookedSlots.has(key);
    const isCurrentlyOpen = selectedTimeSlots.has(key);
    
    console.log('🔴 Slot state:', {
      key,
      date: formatDateISO(date),
      isBooked,
      isCurrentlyOpen,
      canOpen: canOpenSlot(date, time),
      canMarkAttendance: canMarkAttendance(date, time)
    });
    
    // Check if slot is in the past or too close (but allow booked slots)
    if (!canOpenSlot(date, time) && !isCurrentlyOpen && !isBooked) {
      return; // Don't select past/near slots
    }

    // For open slots, check if they can be marked for attendance
    if (isCurrentlyOpen && !canMarkAttendance(date, time)) {
      return; // Can't mark attendance for non-current-day or too-close slots
    }

    // For booked slots, check if they can be marked for attendance
    if (isBooked && !canMarkAttendance(date, time)) {
      return; // Can't mark attendance for non-current-day or too-close slots
    }

    // Determine slot type: "available", "open", or "booked"
    const slotType = isBooked ? 'booked' : isCurrentlyOpen ? 'open' : 'available';
    
    // Check if we have any existing selections and ensure they're compatible types
    if (pendingSelections.size > 0) {
      // Get the first selected slot to check its type
      const firstKey = Array.from(pendingSelections)[0];
      const firstIsBooked = bookedSlots.has(firstKey);
      const firstSlotIsOpen = selectedTimeSlots.has(firstKey);
      const firstSlotType = firstIsBooked ? 'booked' : firstSlotIsOpen ? 'open' : 'available';
      
      // Allow mixing open and booked (both can be marked for attendance)
      // But don't allow mixing available with open/booked
      if (firstSlotType === 'available' && slotType !== 'available') {
        return;
      }
      if ((firstSlotType === 'open' || firstSlotType === 'booked') && slotType === 'available') {
        return;
      }
    }

    // Toggle selection for bulk action
    const newPendingSelections = new Set(pendingSelections);
    if (newPendingSelections.has(key)) {
      newPendingSelections.delete(key);
    } else {
      newPendingSelections.add(key);
    }
    setPendingSelections(newPendingSelections);
  };

  const handleOpenSelected = () => {
    console.log('🟡 handleOpenSelected called', {
      pendingSelectionsSize: pendingSelections.size,
      pendingSelectionsArray: Array.from(pendingSelections)
    });
    
    if (pendingSelections.size === 0) return;
    
    // Check if selections are for "open/booked" slots (to update attendance) or "available" slots (to open them)
    const firstKey = Array.from(pendingSelections)[0];
    const isBookedSlots = bookedSlots.has(firstKey);
    const isOpenSlots = selectedTimeSlots.has(firstKey);
    
    if (isOpenSlots || isBookedSlots) {
      setBulkAction('attendance');
      // If booked slots are selected, default to absent (disable present)
      if (isBookedSlots) {
        setAttendanceStatus(null);
      }
    } else {
      setBulkAction('open');
    }
    setShowModal(true);
  };

  const confirmBulkAction = async () => {
    console.log('🔵 confirmBulkAction called', {
      bulkAction,
      pendingSelectionsSize: pendingSelections.size,
      pendingSelectionsArray: Array.from(pendingSelections)
    });
    
    setLoading(true);
    setError(null);

    try {
      if (bulkAction === 'attendance') {
        // For attendance, update the attendanceMarked set
        const newAttendanceMarked = new Set(attendanceMarked);
        
        if (attendanceStatus === 'present') {
          pendingSelections.forEach(key => newAttendanceMarked.add(key));
        } else if (attendanceStatus === 'absent') {
          pendingSelections.forEach(key => newAttendanceMarked.delete(key));
        }
        
        setAttendanceMarked(newAttendanceMarked);
        console.log('Attendance marked as:', attendanceStatus, 'for slots:', Array.from(pendingSelections));
      } else {
        const newSet = new Set(selectedTimeSlots);
        
        if (bulkAction === 'open') {
          console.log('🟢 Processing OPEN action');
          console.log('weekDates:', weekDates.map(d => formatDateISO(d)));
          
          // Convert pending selections to API format
          const slotsToOpen = Array.from(pendingSelections).map(key => {
            const [dayIdx, time] = key.split('-');
            const date = weekDates[parseInt(dayIdx)];
            console.log(`  Processing key: ${key} -> dayIdx: ${dayIdx}, time: ${time}, date: ${formatDateISO(date)}`);
            return {
              date: formatDateISO(date),
              time: time
            };
          });
          
          console.log('🚀 About to call scheduleApi.openSlots with:', slotsToOpen);
          
          // Call API to open slots
          const result = await scheduleApi.openSlots(slotsToOpen);
          console.log('✅ API call successful, result:', result);
          
          // Update local state only after successful API call
          pendingSelections.forEach(key => newSet.add(key));
        } else if (bulkAction === 'close') {
          // For closing, we need slot IDs which we don't have in current state
          // For now, just update local state
          // TODO: Store slot IDs when loading schedule data
          pendingSelections.forEach(key => {
            newSet.delete(key);
            // Also remove from attendance if closing
            const newAttendanceMarked = new Set(attendanceMarked);
            newAttendanceMarked.delete(key);
            setAttendanceMarked(newAttendanceMarked);
          });
        }
        
        setSelectedTimeSlots(newSet);
      }
      
      setPendingSelections(new Set());
      setShowModal(false);
      setBulkAction(null);
      setAttendanceStatus(null);
    } catch (err: any) {
      console.error('Failed to perform action:', err);
      setError(err.message || 'Failed to perform action');
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setBulkAction(null);
    setAttendanceStatus(null);
  };

  const clearSelections = () => {
    setPendingSelections(new Set());
  };

  // Check if any pending selection is booked
  const hasBookedSlots = () => {
    return Array.from(pendingSelections).some(key => bookedSlots.has(key));
  };

  // Check if we can change attendance to absent (must be more than 5 minutes before)
  const canChangeToAbsent = () => {
    return Array.from(pendingSelections).every(key => {
      const details = getSlotDetails(key);
      return canMarkAttendance(details.date, details.time);
    });
  };

  // Get slot details from key
  const getSlotDetails = (key: string) => {
    const [dayIdx, time] = key.split('-');
    const dayIndex = parseInt(dayIdx);
    return {
      dayName: days[dayIndex],
      date: weekDates[dayIndex],
      time: timeSlots[selectedPeriod].find(t => key.includes(t)) || time
    };
  };

  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    return { day, month };
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <main style={{ padding: '40px 0', background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)', minHeight: '100vh' }}>
          <style>{`
            /* Custom scrollbar styling for schedule page */
            .schedule-scrollable::-webkit-scrollbar {
              width: 8px;
              height: 8px;
            }
            .schedule-scrollable::-webkit-scrollbar-track {
              background: rgba(2, 69, 174, 0.1);
              border-radius: 4px;
            }
            .schedule-scrollable::-webkit-scrollbar-thumb {
              background: linear-gradient(135deg, #0245ae 0%, #4a9eff 100%);
              border-radius: 4px;
            }
            .schedule-scrollable::-webkit-scrollbar-thumb:hover {
              background: linear-gradient(135deg, #023a8f 0%, #3d8ce6 100%);
            }
          `}</style>
          <div className="container">
            {/* Header Section */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '32px',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(2, 69, 174, 0.3)'
                }}>
                  <i className="fas fa-calendar-alt" style={{ color: '#fff', fontSize: '22px' }}></i>
                </div>
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '32px', 
                  fontWeight: 800, 
                  background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '0.5px'
                }}>
                  Lesson Schedule
                </h2>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button 
                  onClick={handleRefresh}
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(2, 69, 174, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    letterSpacing: '0.5px',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
                  Refresh
                </button>
              </div>
            </div>

            {/* Info Banner */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              padding: '20px 24px',
              borderRadius: '16px',
              marginBottom: '32px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              boxShadow: '0 4px 20px rgba(251, 191, 36, 0.15)',
              border: '1px solid rgba(251, 191, 36, 0.3)'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
              }}>
                <i className="fas fa-info-circle" style={{ color: '#fff', fontSize: '22px' }}></i>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#92400e', lineHeight: '1.6', fontWeight: 500 }}>
                Students can reserve your lessons 3 minutes before the lesson time starts. Please click refresh to get your latest reservation status.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                background: 'rgba(220, 38, 38, 0.1)',
                backdropFilter: 'blur(10px)',
                padding: '16px 20px',
                borderRadius: '12px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                border: '1px solid rgba(220, 38, 38, 0.3)'
              }}>
                <i className="fas fa-exclamation-circle" style={{ color: '#dc2626', fontSize: '20px' }}></i>
                <p style={{ margin: 0, fontSize: '14px', color: '#dc2626', fontWeight: 600 }}>
                  {error}
                </p>
              </div>
            )}

            {/* Loading Indicator */}
            {loading && (
              <div style={{
                background: 'rgba(2, 69, 174, 0.05)',
                padding: '16px 20px',
                borderRadius: '12px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                justifyContent: 'center'
              }}>
                <i className="fas fa-spinner fa-spin" style={{ color: '#0245ae', fontSize: '20px' }}></i>
                <p style={{ margin: 0, fontSize: '14px', color: '#0245ae', fontWeight: 600 }}>
                  Loading schedule...
                </p>
              </div>
            )}

            {/* Main Schedule Card */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '24px',
              padding: '32px',
              boxShadow: '0 8px 32px rgba(2, 69, 174, 0.12)',
              border: '1px solid rgba(2, 69, 174, 0.08)'
            }}>
              {/* Week Navigation */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                paddingBottom: '20px',
                borderBottom: '2px solid rgba(2, 69, 174, 0.1)'
              }}>
                <button
                  onClick={() => setCurrentWeekOffset(currentWeekOffset - 1)}
                  style={{
                    background: 'rgba(2, 69, 174, 0.1)',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0245ae',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <i className="fas fa-chevron-left"></i>
                  Previous Week
                </button>
                
                <h3 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 800,
                  color: '#0245ae',
                  letterSpacing: '0.5px'
                }}>
                  This Week
                </h3>

                <button
                  onClick={() => setCurrentWeekOffset(currentWeekOffset + 1)}
                  style={{
                    background: 'rgba(2, 69, 174, 0.1)',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0245ae',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.3s ease'
                  }}
                >
                  Next Week
                  <i className="fas fa-chevron-right"></i>
                </button>
              </div>

              {/* Period Toggle */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '28px',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                {(['morning', 'afternoon', 'evening'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    style={{
                      background: selectedPeriod === period 
                        ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
                        : 'rgba(15, 23, 42, 0.05)',
                      color: selectedPeriod === period ? '#fff' : '#64748b',
                      border: 'none',
                      padding: '10px 24px',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: selectedPeriod === period ? '0 4px 12px rgba(15, 23, 42, 0.3)' : 'none',
                      textTransform: 'capitalize'
                    }}
                  >
                    <i className={`fas fa-${period === 'morning' ? 'sun' : period === 'afternoon' ? 'cloud-sun' : 'moon'}`}></i>
                    {period}
                  </button>
                ))}
              </div>

              {/* Penalty Code Legend */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                border: '1px solid rgba(2, 69, 174, 0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  <i className="fas fa-info-circle" style={{ color: '#0245ae', fontSize: '18px' }}></i>
                  <h4 style={{
                    margin: 0,
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0f172a'
                  }}>
                    Penalty Code Reference
                  </h4>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px'
                }}>
                  {Object.entries(PENALTY_LABELS).map(([code, info]) => (
                    <div
                      key={code}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        background: info.bgColor,
                        borderRadius: '8px',
                        border: `1px solid ${info.color}30`
                      }}
                    >
                      <span style={{
                        fontWeight: 800,
                        fontSize: '11px',
                        color: info.color,
                        letterSpacing: '0.5px'
                      }}>
                        {info.label}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        color: '#64748b',
                        flex: 1
                      }}>
                        {code === '301' && 'Absent (Booked)'}
                        {code === '302' && 'Absent (Unbooked)'}
                        {code === '303' && 'Short Notice Cancel'}
                        {code === '401' && 'Substitution'}
                        {code === '501' && 'System Issue'}
                        {code === '502' && 'Student Absent'}
                        {code === '601' && 'Penalty Block'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Calendar Grid */}
              <div style={{ overflowX: 'auto' }} className="schedule-scrollable">
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '8px' }}>
                  <thead>
                    <tr>
                      <th style={{
                        background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                        padding: '16px',
                        borderRadius: '12px',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '13px',
                        textAlign: 'center',
                        minWidth: '120px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <img src="https://flagcdn.com/w40/ph.png" alt="PH" style={{ width: '24px', height: '16px', borderRadius: '3px' }} />
                          <div>Philippine Time</div>
                        </div>
                      </th>
                      {weekDates.map((date, idx) => {
                        const { day, month } = formatDate(date);
                        return (
                          <th key={idx} style={{
                            background: 'rgba(2, 69, 174, 0.08)',
                            padding: '16px 12px',
                            borderRadius: '12px',
                            textAlign: 'center',
                            minWidth: '100px'
                          }}>
                            <div style={{ fontWeight: 800, fontSize: '12px', color: '#64748b', marginBottom: '6px', letterSpacing: '0.5px' }}>
                              {days[idx]}
                            </div>
                            <div style={{ fontSize: '24px', fontWeight: 900, color: '#0245ae', lineHeight: 1 }}>
                              {day}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginTop: '4px', letterSpacing: '0.5px' }}>
                              {month}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots[selectedPeriod].map((time, timeIdx) => (
                      <tr key={timeIdx}>
                        <td style={{
                          background: 'rgba(248, 250, 252, 0.8)',
                          padding: '12px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          fontSize: '13px',
                          color: '#475569',
                          textAlign: 'center'
                        }}>
                          {time}
                        </td>
                        {weekDates.map((date, dayIdx) => {
                          const key = `${dayIdx}-${time}`;
                          const isBooked = bookedSlots.has(key);
                          const studentId = bookedSlots.get(key);
                          const isSelected = selectedTimeSlots.has(key);
                          const isMarkedPresent = attendanceMarked.has(key);
                          const isPendingSelection = pendingSelections.has(key);
                          const canOpen = canOpenSlot(date, time);
                          const isPastOrNear = !canOpen && !isSelected && !isBooked;
                          const canMarkAttend = isSelected && canMarkAttendance(date, time);
                          const penalty = slotPenalties.get(key);
                          
                          // Check if booked slot is marked present
                          const isBookedAndPresent = isBooked && isMarkedPresent;
                          
                          // Determine slot display label
                          let slotLabel = 'AVAILABLE';
                          if (penalty) {
                            const penaltyInfo = PENALTY_LABELS[penalty.code];
                            slotLabel = penaltyInfo.label;
                          } else if (isBooked) {
                            slotLabel = studentId || 'BOOKED';
                          } else if (isPastOrNear) {
                            slotLabel = 'PAST';
                          } else if (isPendingSelection) {
                            slotLabel = 'SELECTED';
                          } else if (isMarkedPresent) {
                            slotLabel = 'PRESENT';
                          } else if (isSelected) {
                            slotLabel = 'OPEN';
                          }
                          
                          return (
                            <td key={dayIdx} style={{ padding: '4px' }}>
                              <button
                                onClick={() => handleSlotClick(dayIdx, time)}
                                onDblClick={() => handleSlotDoubleClick(dayIdx, time)}
                                disabled={!isBooked && (isPastOrNear || (isSelected && !canMarkAttend))}
                                style={{
                                  width: '100%',
                                  padding: '16px 8px',
                                  borderRadius: '10px',
                                  cursor: isBooked ? 'pointer' : isPastOrNear || (isSelected && !canMarkAttend) ? 'not-allowed' : 'pointer',
                                  background: penalty
                                    ? PENALTY_LABELS[penalty.code].bgColor
                                    : isPastOrNear
                                    ? 'rgba(203, 213, 225, 0.5)'
                                    : isBookedAndPresent
                                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                    : isBooked
                                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                    : isPendingSelection
                                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                    : isMarkedPresent
                                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                    : isSelected
                                    ? 'rgba(255, 255, 255, 0.9)'
                                    : 'rgba(255, 255, 255, 0.9)',
                                  color: penalty
                                    ? PENALTY_LABELS[penalty.code].color
                                    : isPendingSelection || isMarkedPresent || isBooked ? '#fff' : isPastOrNear ? '#94a3b8' : isSelected ? '#10b981' : '#64748b',
                                  fontWeight: 800,
                                  fontSize: isBooked || penalty ? '13px' : '11px',
                                  transition: 'all 0.3s ease',
                                  boxShadow: penalty
                                    ? `0 2px 8px ${PENALTY_LABELS[penalty.code].color}40`
                                    : isBookedAndPresent
                                    ? '0 4px 12px rgba(59, 130, 246, 0.5), 0 0 0 3px rgba(16, 185, 129, 0.5)'
                                    : isBooked
                                    ? '0 4px 12px rgba(59, 130, 246, 0.5)'
                                    : isPendingSelection
                                    ? '0 4px 12px rgba(245, 158, 11, 0.5), 0 0 0 2px rgba(245, 158, 11, 0.3)'
                                    : isMarkedPresent
                                    ? '0 4px 12px rgba(16, 185, 129, 0.4)'
                                    : '0 2px 4px rgba(0, 0, 0, 0.05)',
                                  letterSpacing: isBooked || penalty ? '1px' : '0.5px',
                                  border: penalty
                                    ? `2px solid ${PENALTY_LABELS[penalty.code].color}`
                                    : isBookedAndPresent
                                    ? '3px solid #10b981'
                                    : isBooked
                                    ? 'none'
                                    : isSelected && !isMarkedPresent && !isPendingSelection 
                                    ? '2px solid #10b981' 
                                    : !isSelected && !isPastOrNear && !isPendingSelection 
                                    ? '1px solid rgba(2, 69, 174, 0.1)' 
                                    : 'none',
                                  transform: isPendingSelection || isBooked ? 'scale(1.05)' : 'scale(1)',
                                  opacity: isSelected && !canMarkAttend && !isBooked ? 0.5 : 1
                                }}
                                onMouseEnter={(e) => {
                                  if (isBookedAndPresent) {
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.6), 0 0 0 3px rgba(16, 185, 129, 0.6)';
                                  } else if (isBooked) {
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.6)';
                                  } else if (!isSelected && !isPastOrNear && !isPendingSelection) {
                                    e.currentTarget.style.background = 'rgba(2, 69, 174, 0.1)';
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (isBookedAndPresent) {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.5), 0 0 0 3px rgba(16, 185, 129, 0.5)';
                                  } else if (isBooked) {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.5)';
                                  } else if (!isSelected && !isPastOrNear && !isPendingSelection) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.9)';
                                    e.currentTarget.style.transform = 'scale(1)';
                                  }
                                }}
                                title={penalty ? penalty.reason : undefined}
                              >
                                {slotLabel}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              {pendingSelections.size > 0 && (
                <div style={{
                  marginTop: '32px',
                  paddingTop: '24px',
                  borderTop: '2px solid rgba(2, 69, 174, 0.1)',
                  display: 'flex',
                  gap: '16px',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  <button 
                    onClick={handleOpenSelected}
                    style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '14px 32px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '15px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                    letterSpacing: '0.5px',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <i className={`fas fa-${selectedTimeSlots.has(Array.from(pendingSelections)[0]) ? 'clipboard-check' : 'check'}`}></i>
                    {selectedTimeSlots.has(Array.from(pendingSelections)[0]) 
                      ? `Update Attendance (${pendingSelections.size})`
                      : `Confirm Selection (${pendingSelections.size})`}
                  </button>

                  <button
                    onClick={clearSelections}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#dc2626',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      padding: '14px 32px',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '15px',
                      cursor: 'pointer',
                      letterSpacing: '0.5px',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <i className="fas fa-times"></i>
                    Clear Selection
                  </button>
                </div>
              )}
            </div>

            {/* Legend */}
            <div style={{
              marginTop: '24px',
              display: 'flex',
              gap: '24px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              {[
                { label: 'Available', color: 'rgba(255, 255, 255, 0.9)', textColor: '#64748b', border: '1px solid rgba(2, 69, 174, 0.1)' },
                { label: 'Selected', color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', textColor: '#fff' },
                { label: 'Your Open Slots', color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', textColor: '#fff' },
                { label: 'Past/Unavailable', color: 'rgba(203, 213, 225, 0.5)', textColor: '#94a3b8', border: 'none' }
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: item.color,
                    border: item.border || 'none',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}></div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Confirmation Modal */}
      {showModal && bulkAction && pendingSelections.size > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(10px)',
              borderRadius: '24px',
              padding: '40px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(2, 69, 174, 0.3)',
              border: '1px solid rgba(2, 69, 174, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                background: bulkAction === 'attendance'
                  ? 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)'
                  : bulkAction === 'open'
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: bulkAction === 'attendance'
                  ? '0 8px 24px rgba(2, 69, 174, 0.4)'
                  : bulkAction === 'open'
                  ? '0 8px 24px rgba(16, 185, 129, 0.4)'
                  : '0 8px 24px rgba(239, 68, 68, 0.4)'
              }}>
                <i className={`fas fa-${bulkAction === 'attendance' ? 'clipboard-check' : bulkAction === 'open' ? 'unlock-alt' : 'lock'}`} style={{ color: '#fff', fontSize: '36px' }}></i>
              </div>
              <h3 style={{
                margin: '0 0 12px',
                fontSize: '28px',
                fontWeight: 900,
                color: '#0f172a',
                letterSpacing: '0.5px'
              }}>
                {bulkAction === 'attendance' 
                  ? 'Update Attendance?' 
                  : bulkAction === 'open' 
                  ? 'Open Selected Slots?' 
                  : 'Close Selected Slots?'}
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
                You have selected {pendingSelections.size} time slot{pendingSelections.size > 1 ? 's' : ''}
              </p>
            </div>

            {/* Selected Slots List */}
            <div style={{
              background: 'rgba(2, 69, 174, 0.05)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '24px',
              border: '1px solid rgba(2, 69, 174, 0.1)',
              maxHeight: '300px',
              overflowY: 'auto'
            }}
            className="schedule-scrollable"
            >
              <h4 style={{ 
                margin: '0 0 16px', 
                fontSize: '14px', 
                fontWeight: 800, 
                color: '#0245ae',
                letterSpacing: '0.5px',
                textTransform: 'uppercase'
              }}>
                Selected Time Slots
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Array.from(pendingSelections).map((key) => {
                  const details = getSlotDetails(key);
                  return (
                    <div key={key} style={{
                      background: 'rgba(255, 255, 255, 0.8)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      border: '1px solid rgba(2, 69, 174, 0.1)'
                    }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <i className="fas fa-clock" style={{ color: '#fff', fontSize: '16px' }}></i>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>
                          {details.dayName}, {details.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                          {details.time}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirmation Message or Attendance Selection */}
            {bulkAction === 'attendance' ? (
              <div style={{ marginBottom: '32px' }}>
                <h4 style={{ 
                  margin: '0 0 16px', 
                  fontSize: '14px', 
                  fontWeight: 800, 
                  color: '#0245ae',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  textAlign: 'center'
                }}>
                  Mark Attendance Status
                </h4>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    onClick={() => setAttendanceStatus('present')}
                    disabled={hasBookedSlots()}
                    style={{
                      flex: 1,
                      background: hasBookedSlots()
                        ? 'rgba(203, 213, 225, 0.3)'
                        : attendanceStatus === 'present' 
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'rgba(16, 185, 129, 0.1)',
                      color: hasBookedSlots()
                        ? '#94a3b8'
                        : attendanceStatus === 'present' ? '#fff' : '#10b981',
                      border: hasBookedSlots()
                        ? '2px solid rgba(203, 213, 225, 0.3)'
                        : attendanceStatus === 'present' ? 'none' : '2px solid rgba(16, 185, 129, 0.3)',
                      padding: '16px 24px',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '15px',
                      cursor: hasBookedSlots() ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.5px',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: attendanceStatus === 'present' ? '0 4px 16px rgba(16, 185, 129, 0.4)' : 'none',
                      opacity: hasBookedSlots() ? 0.5 : 1
                    }}
                  >
                    <i className="fas fa-check-circle" style={{ fontSize: '32px' }}></i>
                    Present
                  </button>
                  <button
                    onClick={() => setAttendanceStatus('absent')}
                    disabled={!canChangeToAbsent()}
                    style={{
                      flex: 1,
                      background: !canChangeToAbsent()
                        ? 'rgba(203, 213, 225, 0.3)'
                        : attendanceStatus === 'absent' 
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        : 'rgba(239, 68, 68, 0.1)',
                      color: !canChangeToAbsent()
                        ? '#94a3b8'
                        : attendanceStatus === 'absent' ? '#fff' : '#ef4444',
                      border: !canChangeToAbsent()
                        ? '2px solid rgba(203, 213, 225, 0.3)'
                        : attendanceStatus === 'absent' ? 'none' : '2px solid rgba(239, 68, 68, 0.3)',
                      padding: '16px 24px',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '15px',
                      cursor: !canChangeToAbsent() ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.5px',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: attendanceStatus === 'absent' ? '0 4px 16px rgba(239, 68, 68, 0.4)' : 'none'
                    }}
                  >
                    <i className="fas fa-times-circle" style={{ fontSize: '32px' }}></i>
                    Absent
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                background: bulkAction === 'open' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '32px',
                border: bulkAction === 'open' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.6', fontWeight: 500, textAlign: 'center' }}>
                  {bulkAction === 'open'
                    ? `You are about to open ${pendingSelections.size} time slot${pendingSelections.size > 1 ? 's' : ''}. Students will be able to book these times for lessons.`
                    : `You are about to close ${pendingSelections.size} time slot${pendingSelections.size > 1 ? 's' : ''}. Students will no longer be able to book these times.`}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={closeModal}
                style={{
                  flex: 1,
                  background: 'rgba(100, 116, 139, 0.1)',
                  color: '#475569',
                  border: '1px solid rgba(100, 116, 139, 0.2)',
                  padding: '14px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '15px',
                  cursor: 'pointer',
                  letterSpacing: '0.5px',
                  transition: 'all 0.3s ease'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkAction}
                disabled={bulkAction === 'attendance' && !attendanceStatus}
                style={{
                  flex: 1,
                  background: bulkAction === 'attendance'
                    ? attendanceStatus === 'present'
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : attendanceStatus === 'absent'
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                      : 'rgba(2, 69, 174, 0.3)'
                    : bulkAction === 'open'
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '14px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '15px',
                  cursor: (bulkAction === 'attendance' && !attendanceStatus) ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.5px',
                  boxShadow: (bulkAction === 'attendance' && !attendanceStatus)
                    ? 'none'
                    : bulkAction === 'attendance'
                    ? attendanceStatus === 'present'
                      ? '0 4px 16px rgba(16, 185, 129, 0.4)'
                      : '0 4px 16px rgba(239, 68, 68, 0.4)'
                    : bulkAction === 'open'
                    ? '0 4px 16px rgba(16, 185, 129, 0.4)'
                    : '0 4px 16px rgba(239, 68, 68, 0.4)',
                  transition: 'all 0.3s ease',
                  opacity: (bulkAction === 'attendance' && !attendanceStatus) ? 0.6 : 1
                }}
              >
                {bulkAction === 'attendance'
                  ? attendanceStatus
                    ? `Mark as ${attendanceStatus === 'present' ? 'Present' : 'Absent'}`
                    : 'Select Status'
                  : bulkAction === 'open' 
                  ? `Open ${pendingSelections.size} Slot${pendingSelections.size > 1 ? 's' : ''}` 
                  : `Close ${pendingSelections.size} Slot${pendingSelections.size > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SchedulePage;
