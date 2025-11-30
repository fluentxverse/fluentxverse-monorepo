import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';

const SchedulePage = () => {
  const { user } = useAuthContext();
  const { route } = useLocation();
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<Set<string>>(new Set());
  const [attendanceMarked, setAttendanceMarked] = useState<Set<string>>(new Set()); // Track which open slots are marked as present
  
  // Initialize with a test booking for Nov 25, 2025 at 11:30 PM
  const initializeBookedSlots = () => {
    const map = new Map<string, string>();
    // Nov 25, 2025 is a Tuesday (day index 1 in the current week)
    const testKey = '1-11:30 PM';
    map.set(testKey, 'STD001');
    console.log('Initialized booked slots:', { key: testKey, studentId: 'STD001', mapSize: map.size });
    return map;
  };
  
  const [bookedSlots, setBookedSlots] = useState<Map<string, string>>(initializeBookedSlots()); // Map of slot key to student ID
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'morning' | 'afternoon' | 'evening'>('evening');
  const [showModal, setShowModal] = useState(false);
  const [pendingSelections, setPendingSelections] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'open' | 'close' | 'attendance' | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent' | null>(null);

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
  const timeSlots = {
    morning: ['6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'],
    afternoon: ['12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM'],
    evening: ['6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM', '10:00 PM', '10:30 PM', '11:00 PM', '11:30 PM']
  };

  // Parse time string to Date object
  const parseTimeString = (timeStr: string): { hour: number; minute: number } => {
    const [time, period] = timeStr.split(' ');
    let [hour, minute] = time.split(':').map(Number);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return { hour, minute };
  };

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
    const date = weekDates[dayIdx];
    const key = `${dayIdx}-${time}`;
    const isBooked = bookedSlots.has(key);
    const isCurrentlyOpen = selectedTimeSlots.has(key);
    
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

  const confirmBulkAction = () => {
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
        pendingSelections.forEach(key => newSet.add(key));
      } else if (bulkAction === 'close') {
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

  // Student click handler: join if it's your booking, otherwise book or show message
  const handleStudentSlotClick = (dayIdx: number, time: string) => {
    const key = `${dayIdx}-${time}`;
    const isBooked = bookedSlots.has(key);
    const studentId = bookedSlots.get(key);

    if (isBooked) {
      if (studentId === user?.userId) {
        // Student's own booking - open lesson room
        window.open(`/lesson/${key}`, '_blank');
      } else {
        // Already booked by someone else
        window.alert('This time slot is already booked.');
      }
      return;
    }

    // Not booked: navigate to booking flow (Browse Tutors)
    window.location.href = '/browse-tutors';
  };

  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    return { day, month };
  };

  return (
    <>

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
                  My Schedule
                </h2>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button style={{
                  background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(2, 69, 174, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  letterSpacing: '0.5px'
                }}>
                  <i className="fas fa-sync-alt"></i>
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
                Here are your upcoming lessons. Click "Join" to open the lesson room. To book new lessons, visit Browse Tutors.
              </p>
            </div>

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
                          
                          // Check if booked slot is marked present
                          const isBookedAndPresent = isBooked && isMarkedPresent;
                          
                          return (
                            <td key={dayIdx} style={{ padding: '4px' }}>
                              <button
                                onClick={() => handleStudentSlotClick(dayIdx, time)}
                                style={{
                                  width: '100%',
                                  padding: '12px 8px',
                                  borderRadius: '10px',
                                  cursor: isBooked ? 'pointer' : canOpen ? 'pointer' : 'not-allowed',
                                  background: isBooked
                                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                    : isPastOrNear
                                    ? 'rgba(203, 213, 225, 0.5)'
                                    : 'rgba(255, 255, 255, 0.95)',
                                  color: isBooked ? '#fff' : isPastOrNear ? '#94a3b8' : '#0245ae',
                                  fontWeight: 800,
                                  fontSize: '13px',
                                  transition: 'all 0.2s ease',
                                  border: isBooked ? 'none' : '1px solid rgba(2, 69, 174, 0.06)'
                                }}
                              >
                                {isBooked ? (studentId === user?.userId ? 'Join Lesson' : 'Booked') : (canOpen ? 'Book' : 'Unavailable')}
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
