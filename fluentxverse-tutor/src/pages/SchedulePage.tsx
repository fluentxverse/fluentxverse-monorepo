import { useState, useEffect, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { useThemeStore } from '../context/ThemeContext';
import { scheduleApi } from '../api/schedule.api';
import { initSocket, getSocket, connectSocket, disconnectSocket } from '../client/socket/socket.client';
import type { Notification } from '../types/notification.types';

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
  useEffect(() => {
    document.title = 'Schedule | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  const isDarkMode = useThemeStore((state) => state.resolvedTheme === 'dark');
  const { route } = useLocation();
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<Set<string>>(new Set());
  const [attendanceMarked, setAttendanceMarked] = useState<Set<string>>(new Set()); // Track which open slots are marked as present
  const [slotPenalties, setSlotPenalties] = useState<Map<string, SlotPenalty>>(new Map()); // Track penalty codes per slot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Booked slot info type
  interface BookedSlotInfo {
    studentId: string;
    bookingId: string;
    studentName?: string;
  }
  
  // Initialize booked slots map
  const [bookedSlots, setBookedSlots] = useState<Map<string, BookedSlotInfo>>(new Map()); // Map of slot key to booking info
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'morning' | 'afternoon' | 'evening'>('evening');
  const [showModal, setShowModal] = useState(false);
  const [pendingSelections, setPendingSelections] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'open' | 'close' | 'attendance' | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent' | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [bookingToast, setBookingToast] = useState<{ studentName?: string; time: string; date: string } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false); // Loading state for confirm button
  const [showSuccess, setShowSuccess] = useState(false); // Success animation state

  const pageBackground = isDarkMode ? '#1a1a1a' : 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)';
  const cardBackground = isDarkMode
    ? 'linear-gradient(135deg, #1e1e1e 0%, #232323 100%)'
    : 'rgba(255, 255, 255, 0.95)';
  const cardBackgroundSoft = isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(2, 69, 174, 0.1)';
  const cardBackgroundMuted = isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(248, 250, 252, 0.8)';
  const elevatedBackground = isDarkMode ? '#202020' : 'rgba(255, 255, 255, 0.98)';
  const borderSoft = isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(2, 69, 174, 0.08)';
  const borderAccentSoft = isDarkMode ? '2px solid rgba(255, 255, 255, 0.08)' : '2px solid rgba(2, 69, 174, 0.1)';
  const textPrimary = isDarkMode ? '#f3f4f6' : '#0f172a';
  const textMuted = isDarkMode ? '#a3a3a3' : '#64748b';
  const textSoft = isDarkMode ? '#737373' : '#94a3b8';
  const boxShadowSoft = isDarkMode ? '0 4px 14px rgba(0, 0, 0, 0.16)' : '0 4px 12px rgba(2, 69, 174, 0.3)';
  const boxShadowCard = isDarkMode ? '0 10px 26px rgba(0, 0, 0, 0.2)' : '0 8px 32px rgba(2, 69, 174, 0.12)';
  const warningBannerBackground = isDarkMode ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.9)';
  const warningBannerText = isDarkMode ? '#fcd34d' : '#92400e';
  const darkSlotBackground = '#242424';
  const darkSlotAltBackground = '#2b2b2b';
  const darkSlotHoverBackground = '#2b2b2b';
  const darkSlotAltHoverBackground = '#323232';
  const darkSlotBookedBackground = '#323232';
  const darkSlotPastBackground = '#1f1f1f';
  const darkSlotBorder = 'rgba(255, 255, 255, 0.1)';
  const periodStyles = {
    morning: {
      background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)',
      shadow: '0 4px 14px rgba(249, 115, 22, 0.34)'
    },
    afternoon: {
      background: 'linear-gradient(135deg, #fb923c 0%, #dc2626 100%)',
      shadow: '0 4px 14px rgba(220, 38, 38, 0.32)'
    },
    evening: {
      background: 'linear-gradient(135deg, #1e3a8a 0%, #111827 100%)',
      shadow: '0 4px 14px rgba(30, 58, 138, 0.34)'
    }
  };

  // Refresh handler
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Generate current week dates
  const getWeekDates = (offset: number) => {
    const today = new Date();
    
    // If today is Sunday (day 0), start from the current week's Monday
    // Otherwise, include today's date in the week view
    const startDate = new Date(today);
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate how many days back to Monday of current week
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
    startDate.setDate(today.getDate() - daysToMonday + (offset * 7));
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
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

  // Convert 24-hour time string (e.g., "18:00") to 12-hour format (e.g., "6:00 PM")
  const convertTo12Hour = (time24h: string): string => {
    const [hourStr, minuteStr] = time24h.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = minuteStr || '00';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    if (hour === 0) hour = 12;
    else if (hour > 12) hour -= 12;
    return `${hour}:${minute} ${ampm}`;
  };

  // Parse time string to Date object
  const parseTimeString = (timeStr: string): { hour: number; minute: number } => {
    const [time, period] = timeStr.split(' ');
    let [hour, minute] = time.split(':').map(Number);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return { hour, minute };
  };

  // Convert 12-hour time string (e.g., "6:00 PM") to 24-hour format (e.g., "18:00")
  const convertTo24Hour = (timeStr: string): string => {
    const { hour, minute } = parseTimeString(timeStr);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  // Format date to YYYY-MM-DD for API
  const formatDateISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const resolveRealtimeSlotKey = (slotDate?: string, slotTime?: string): string | null => {
    if (!slotDate || !slotTime) {
      return null;
    }

    const currentWeekDates = getWeekDates(currentWeekOffset);
    let dayIdx = -1;

    if (/^\d{4}-\d{2}-\d{2}/.test(slotDate)) {
      const date = new Date(`${slotDate.slice(0, 10)}T00:00:00`);
      dayIdx = currentWeekDates.findIndex((weekDate) =>
        weekDate.getFullYear() === date.getFullYear() &&
        weekDate.getMonth() === date.getMonth() &&
        weekDate.getDate() === date.getDate()
      );
    } else {
      dayIdx = currentWeekDates.findIndex((weekDate) =>
        weekDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        }) === slotDate
      );
    }

    if (dayIdx === -1) {
      return null;
    }

    const timeLabel = /\b(?:AM|PM)\b/i.test(slotTime)
      ? slotTime.replace(/\s+/g, ' ').toUpperCase()
      : convertTo12Hour(slotTime);

    return `${dayIdx}-${timeLabel}`;
  };

  const applyBookedSlotUpdate = (
    slotKey: string,
    bookingInfo?: BookedSlotInfo
  ) => {
    setSelectedTimeSlots((prev) => {
      const next = new Set(prev);
      next.add(slotKey);
      return next;
    });

    if (bookingInfo) {
      setBookedSlots((prev) => {
        const next = new Map(prev);
        next.set(slotKey, bookingInfo);
        return next;
      });
    }
  };

  const applyCancelledSlotUpdate = (slotKey: string) => {
    setSelectedTimeSlots((prev) => {
      const next = new Set(prev);
      next.add(slotKey);
      return next;
    });

    setBookedSlots((prev) => {
      const next = new Map(prev);
      next.delete(slotKey);
      return next;
    });
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
        const newBookedSlots = new Map<string, BookedSlotInfo>();
        
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
            // Convert 24h time from API to 12h format used by UI grid
            const time12h = convertTo12Hour(slot.time);
            const key = `${dayIdx}-${time12h}`;
            
            // Parse slot time and check if it's in the past (use 24h format for parsing)
            const [hourStr, minuteStr] = slot.time.split(':');
            const hour = parseInt(hourStr, 10);
            const minute = parseInt(minuteStr || '0', 10);
            const slotDateTime = new Date(slotDate);
            slotDateTime.setHours(hour, minute, 0, 0);
            const now = new Date();
            const isPast = slotDateTime < now;


            if (slot.status === 'open' && !isPast) {
              // Only add to selected slots if not in the past
              newSelectedSlots.add(key);
            } else if (slot.status === 'booked' && slot.studentId && slot.bookingId) {
              newSelectedSlots.add(key); // Keep as open slot visually
              newBookedSlots.set(key, {
                studentId: slot.studentId,
                bookingId: slot.bookingId,
                studentName: slot.studentName
              });
            } else {
            }
            // Past open slots are simply not added, so they show as PAST
          } else {
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

  // WebSocket subscription for real-time schedule updates
  useEffect(() => {
    if (!userId) return;
    
    // Initialize and connect socket
    initSocket();
    connectSocket();
    
    try {
      const socket = getSocket();
      
      // Subscribe to schedule updates for this tutor
      socket.emit('schedule:subscribe', { tutorId: userId });
      
      // Listen for slot booked events
      const handleSlotBooked = (data: { 
        tutorId: string; 
        slotKey: string; 
        bookingId?: string;
        studentId: string; 
        studentName?: string; 
        date: string; 
        time: string 
      }) => {
        const gridSlotKey = resolveRealtimeSlotKey(data.date, data.time);

        if (gridSlotKey && data.bookingId) {
          applyBookedSlotUpdate(gridSlotKey, {
            bookingId: data.bookingId,
            studentId: data.studentId,
            studentName: data.studentName,
          });
        }
        
        // Show toast notification
        setBookingToast({
          studentName: data.studentName,
          time: data.time,
          date: data.date
        });
        
        // Auto-hide toast after 5 seconds
        setTimeout(() => setBookingToast(null), 5000);
        
        // Refresh the schedule to show updated data
        setRefreshTrigger(prev => prev + 1);
      };
      
      // Listen for slot cancelled events
      const handleSlotCancelled = (data: {
        tutorId: string;
        slotKey: string;
        date: string;
        time: string;
      }) => {
        const gridSlotKey = resolveRealtimeSlotKey(data.date, data.time);

        if (gridSlotKey) {
          applyCancelledSlotUpdate(gridSlotKey);
        }
        
        // Refresh the schedule
        setRefreshTrigger(prev => prev + 1);
      };
      
      socket.on('schedule:slot-booked', handleSlotBooked);
      socket.on('schedule:slot-cancelled', handleSlotCancelled);
      
      return () => {
        // Cleanup: unsubscribe and remove listeners
        socket.emit('schedule:unsubscribe');
        socket.off('schedule:slot-booked', handleSlotBooked);
        socket.off('schedule:slot-cancelled', handleSlotCancelled);
      };
    } catch (error) {
    }
  }, [userId, currentWeekOffset]);

  useEffect(() => {
    const handleScheduleNotification = (event: Event) => {
      const notification = (event as CustomEvent<Notification>).detail;
      const slotKey = notification
        ? resolveRealtimeSlotKey(notification.data?.date, notification.data?.time)
        : null;

      if (slotKey) {
        if (notification.type === 'booking_cancelled') {
          applyCancelledSlotUpdate(slotKey);
        }

        if (notification.type === 'booking_new') {
          if (notification.data?.bookingId && notification.data?.studentId) {
            applyBookedSlotUpdate(slotKey, {
              bookingId: notification.data!.bookingId!,
              studentId: notification.data!.studentId!,
              studentName: notification.data?.studentName,
            });
          } else {
            applyBookedSlotUpdate(slotKey);
          }
        }
      }

      setRefreshTrigger(prev => prev + 1);
    };

    window.addEventListener('fxv:schedule-notification', handleScheduleNotification);

    return () => {
      window.removeEventListener('fxv:schedule-notification', handleScheduleNotification);
    };
  }, [currentWeekOffset]);

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
    const bookingInfo = bookedSlots.get(key);
    
    if (bookingInfo) {
      // Navigate to lesson details page in new tab
      window.open(`/lesson/${bookingInfo.bookingId}`, '_blank');
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

  const confirmBulkAction = async () => {
    setIsConfirming(true);
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
      } else {
        const newSet = new Set(selectedTimeSlots);
        
        if (bulkAction === 'open') {
          
          // Convert pending selections to API format
          const slotsToOpen = Array.from(pendingSelections).map(key => {
            const [dayIdx, ...timeParts] = key.split('-');
            const time = timeParts.join('-'); // Rejoin in case time has dashes (unlikely but safe)
            const date = weekDates[parseInt(dayIdx)];
            const time24 = convertTo24Hour(time);
            return {
              date: formatDateISO(date),
              time: time24
            };
          });
          
          
          // Call API to open slots
          const result = await scheduleApi.openSlots(slotsToOpen);
          
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
      
      // Show success animation
      setIsConfirming(false);
      setShowSuccess(true);
      
      // Wait for animation then close
      setTimeout(() => {
        setShowSuccess(false);
        setPendingSelections(new Set());
        setShowModal(false);
        setBulkAction(null);
        setAttendanceStatus(null);
      }, 1200);
    } catch (err: any) {
      console.error('Failed to perform action:', err);
      setError(err.message || 'Failed to perform action');
      setIsConfirming(false);
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

  // Select all available slots for a specific day column in the current period (toggle behavior)
  const selectAllForDay = (dayIdx: number) => {
    const newSelections = new Set(pendingSelections);
    const currentPeriodSlots = timeSlots[selectedPeriod];
    const date = weekDates[dayIdx];
    
    // First, count how many available slots exist and how many are already selected
    const availableKeys: string[] = [];
    currentPeriodSlots.forEach((time) => {
      const key = `${dayIdx}-${time}`;
      const isBooked = bookedSlots.has(key);
      const isAlreadyOpen = selectedTimeSlots.has(key);
      const canOpen = canOpenSlot(date, time);
      
      if (!isBooked && !isAlreadyOpen && canOpen) {
        availableKeys.push(key);
      }
    });
    
    // Check if all available slots are already selected
    const allSelected = availableKeys.length > 0 && availableKeys.every(key => newSelections.has(key));
    
    if (allSelected) {
      // Deselect all slots for this day
      availableKeys.forEach(key => newSelections.delete(key));
    } else {
      // Select all available slots
      availableKeys.forEach(key => newSelections.add(key));
    }
    
    setPendingSelections(newSelections);
  };

  // Count available slots for a specific day in the current period
  const countAvailableSlotsForDay = (dayIdx: number) => {
    let count = 0;
    const currentPeriodSlots = timeSlots[selectedPeriod];
    const date = weekDates[dayIdx];
    
    currentPeriodSlots.forEach((time) => {
      const key = `${dayIdx}-${time}`;
      const isBooked = bookedSlots.has(key);
      const isAlreadyOpen = selectedTimeSlots.has(key);
      const canOpen = canOpenSlot(date, time);
      
      if (!isBooked && !isAlreadyOpen && canOpen) {
        count++;
      }
    });
    
    return count;
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
      {/* Shimmer animation for loading skeleton */}
      <style>
        {`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>
      
      {/* Real-time booking toast notification */}
      {bookingToast && (
        <div
          style={{
            position: 'fixed',
            top: '90px',
            right: '24px',
            zIndex: 10000,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            animation: 'slideInRight 0.3s ease-out',
            maxWidth: '400px'
          }}
        >
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <i className="fas fa-calendar-check" style={{ fontSize: '22px' }}></i>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
              New Booking!
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              {bookingToast.studentName || 'A student'} booked your {bookingToast.time} slot on {bookingToast.date}
            </div>
          </div>
          <button
            onClick={() => setBookingToast(null)}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <i className="fas fa-times" style={{ fontSize: '12px' }}></i>
          </button>
        </div>
      )}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <SideBar />
      <div className="main-content">
        <DashboardHeader user={user || undefined} />
        <main style={{ padding: '40px 0', background: pageBackground, minHeight: '100vh' }}>
          <style>{`
            /* Custom scrollbar styling for schedule page */
            .schedule-scrollable::-webkit-scrollbar {
              width: 8px;
              height: 8px;
            }
            .schedule-scrollable::-webkit-scrollbar-track {
              background: ${isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(2, 69, 174, 0.1)'};
              border-radius: 4px;
            }
            .schedule-scrollable::-webkit-scrollbar-thumb {
              background: ${isDarkMode ? 'linear-gradient(135deg, #3a3a3a 0%, #5a5a5a 100%)' : 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)'};
              border-radius: 4px;
            }
            .schedule-scrollable::-webkit-scrollbar-thumb:hover {
              background: ${isDarkMode ? 'linear-gradient(135deg, #4a4a4a 0%, #6a6a6a 100%)' : 'linear-gradient(135deg, #023a8f 0%, #3d8ce6 100%)'};
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
                  boxShadow: boxShadowSoft
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
                    boxShadow: boxShadowSoft,
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
              background: warningBannerBackground,
              backdropFilter: 'blur(10px)',
              padding: '20px 24px',
              borderRadius: '16px',
              marginBottom: '32px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              boxShadow: isDarkMode ? '0 4px 14px rgba(0, 0, 0, 0.16)' : '0 4px 20px rgba(251, 191, 36, 0.15)',
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
              <p style={{ margin: 0, fontSize: '14px', color: warningBannerText, lineHeight: '1.6', fontWeight: 500 }}>
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
                background: isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(2, 69, 174, 0.05)',
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
              background: cardBackground,
              backdropFilter: 'blur(10px)',
              borderRadius: '24px',
              padding: '32px',
              boxShadow: boxShadowCard,
              border: borderSoft
            }}>
              {/* Week Navigation */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                paddingBottom: '20px',
                borderBottom: borderAccentSoft
              }}>
                <button
                  onClick={() => {
                    setCurrentWeekOffset(currentWeekOffset - 1);
                    setPendingSelections(new Set());
                  }}
                  style={{
                    background: cardBackgroundSoft,
                    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: isDarkMode ? '#93c5fd' : '#0245ae',
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
                  color: isDarkMode ? '#93c5fd' : '#0245ae',
                  letterSpacing: '0.5px'
                }}>
                  This Week
                </h3>

                <button
                  onClick={() => {
                    setCurrentWeekOffset(currentWeekOffset + 1);
                    setPendingSelections(new Set());
                  }}
                  style={{
                    background: cardBackgroundSoft,
                    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: isDarkMode ? '#93c5fd' : '#0245ae',
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
                marginBottom: '16px',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                {(['morning', 'afternoon', 'evening'] as const).map((period) => {
                  const periodStyle = periodStyles[period];
                  const isActive = selectedPeriod === period;

                  return (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      style={{
                        background: isActive
                          ? periodStyle.background
                          : isDarkMode ? '#2b2b2b' : 'rgba(15, 23, 42, 0.05)',
                        color: isActive ? '#fff' : textMuted,
                        border: isDarkMode && !isActive ? `1px solid ${darkSlotBorder}` : 'none',
                        padding: '10px 24px',
                        borderRadius: '12px',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: isActive ? periodStyle.shadow : 'none',
                        textTransform: 'capitalize'
                      }}
                    >
                      <i className={`fas fa-${period === 'morning' ? 'sun' : period === 'afternoon' ? 'cloud-sun' : 'moon'}`}></i>
                      {period}
                    </button>
                  );
                })}
              </div>

              {/* Calendar Grid */}
              <div style={{ overflowX: 'auto' }} className="schedule-scrollable">
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px' }}>
                  <thead>
                    <tr>
                      <th style={{
                        background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                        padding: '10px',
                        borderRadius: '10px',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '12px',
                        textAlign: 'center',
                        minWidth: '100px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <img src="https://flagcdn.com/w40/ph.png" alt="PH" style={{ width: '20px', height: '14px', borderRadius: '2px' }} />
                          <div>PH Time</div>
                        </div>
                      </th>
                      {weekDates.map((date, idx) => {
                        const { day, month } = formatDate(date);
                        return (
                          <th key={idx} style={{
                            background: isDarkMode
                              ? (idx % 2 === 0 ? '#2b2b2b' : '#242424')
                              : 'rgba(2, 69, 174, 0.08)',
                            padding: '10px 8px',
                            borderRadius: '10px',
                            textAlign: 'center',
                            border: isDarkMode ? `1px solid ${darkSlotBorder}` : 'none',
                            minWidth: '80px'
                          }}>
                            <div style={{ fontWeight: 800, fontSize: '11px', color: textMuted, marginBottom: '4px', letterSpacing: '0.5px' }}>
                              {days[idx]}
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: 900, color: isDarkMode ? '#d4d4d4' : '#0245ae', lineHeight: 1 }}>
                              {day}
                            </div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: textMuted, marginTop: '2px', letterSpacing: '0.5px' }}>
                              {month}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                    {/* Select All Row */}
                    <tr>
                      <th style={{
                        background: 'transparent',
                        padding: '4px',
                        textAlign: 'center'
                      }}>
                        {/* Empty cell for time column */}
                      </th>
                      {weekDates.map((_, dayIdx) => {
                        const availableCount = countAvailableSlotsForDay(dayIdx);
                        return (
                          <th key={`select-${dayIdx}`} style={{ padding: '4px' }}>
                            <button
                              onClick={() => selectAllForDay(dayIdx)}
                              disabled={availableCount === 0}
                              title={availableCount > 0 ? `Select all ${availableCount} available slots` : 'No available slots'}
                              style={{
                                width: '100%',
                                background: availableCount === 0 
                                  ? (isDarkMode ? '#202020' : 'rgba(148, 163, 184, 0.15)')
                                  : isDarkMode ? (dayIdx % 2 === 0 ? '#2b2b2b' : '#242424') : cardBackgroundSoft,
                                color: availableCount === 0 ? textSoft : isDarkMode ? '#d4d4d4' : '#0245ae',
                                border: availableCount === 0 ? (isDarkMode ? `1px dashed ${darkSlotBorder}` : 'none') : isDarkMode ? `1px dashed ${darkSlotBorder}` : '1px dashed rgba(2, 69, 174, 0.3)',
                                padding: '6px 4px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: 700,
                                cursor: availableCount === 0 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                opacity: availableCount === 0 ? 0.5 : 1
                              }}
                            >
                              <i className="fas fa-check-double" style={{ fontSize: '9px' }}></i>
                              {availableCount > 0 ? availableCount : '-'}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots[selectedPeriod].map((time, timeIdx) => {
                      const darkRowBackground = timeIdx % 2 === 0 ? darkSlotBackground : darkSlotAltBackground;
                      const darkRowHoverBackground = timeIdx % 2 === 0 ? darkSlotHoverBackground : darkSlotAltHoverBackground;
                      const darkTimeBackground = timeIdx % 2 === 0 ? '#242424' : '#303030';

                      return (
                      <tr key={timeIdx}>
                        <td style={{
                          background: isDarkMode ? darkTimeBackground : cardBackgroundMuted,
                          padding: '8px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: isDarkMode ? '#d4d4d4' : '#475569',
                          textAlign: 'center',
                          border: isDarkMode ? `1px solid ${darkSlotBorder}` : 'none'
                        }}>
                          {time}
                        </td>
                        {weekDates.map((date, dayIdx) => {
                          const key = `${dayIdx}-${time}`;
                          const isBooked = bookedSlots.has(key);
                          const bookingInfo = bookedSlots.get(key);
                          const isSelected = selectedTimeSlots.has(key);
                          const isMarkedPresent = attendanceMarked.has(key);
                          const isPendingSelection = pendingSelections.has(key);
                          const canOpen = canOpenSlot(date, time);
                          const isPastOrNear = !canOpen && !isSelected && !isBooked;
                          const canMarkAttend = isSelected && canMarkAttendance(date, time);
                          const penalty = slotPenalties.get(key);
                          
                          // Check if booked slot is marked present
                          const isBookedAndPresent = isBooked && isMarkedPresent;
                          
                          // Show loading skeleton while fetching schedule data
                          if (loading) {
                            return (
                              <td key={dayIdx} style={{ padding: '2px', background: 'transparent' }}>
                                <div
                                  style={{
                                    width: '100%',
                                    padding: '10px 6px',
                                    borderRadius: '8px',
                                    background: isDarkMode
                                      ? 'linear-gradient(90deg, rgba(38, 38, 38, 0.92) 25%, rgba(58, 58, 58, 0.98) 50%, rgba(38, 38, 38, 0.92) 75%)'
                                      : 'linear-gradient(90deg, rgba(226, 232, 240, 0.6) 25%, rgba(241, 245, 249, 0.8) 50%, rgba(226, 232, 240, 0.6) 75%)',
                                    backgroundSize: '200% 100%',
                                    animation: 'shimmer 1.5s infinite',
                                    height: '36px',
                                    border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(203, 213, 225, 0.3)'
                                  }}
                                />
                              </td>
                            );
                          }
                          
                          // Determine slot display label
                          let slotLabel = 'AVAILABLE';
                          if (penalty) {
                            const penaltyInfo = PENALTY_LABELS[penalty.code];
                            slotLabel = penaltyInfo.label;
                          } else if (isBooked && bookingInfo) {
                            // Truncate student ID to 6 characters to prevent cell width expansion
                            const studentId = bookingInfo.studentId || 'BOOKED';
                            slotLabel = studentId.length > 6 ? studentId.substring(0, 6) : studentId;
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
                            <td key={dayIdx} style={{ padding: '2px', background: 'transparent' }}>
                              <button
                                onClick={() => handleSlotClick(dayIdx, time)}
                                onDblClick={() => handleSlotDoubleClick(dayIdx, time)}
                                disabled={!isBooked && (isPastOrNear || (isSelected && !canMarkAttend))}
                                style={{
                                  width: '100%',
                                  display: 'block',
                                  padding: '10px 6px',
                                  borderRadius: '8px',
                                  outline: 'none',
                                  appearance: 'none',
                                  cursor: isBooked ? 'pointer' : isPastOrNear || (isSelected && !canMarkAttend) ? 'not-allowed' : 'pointer',
                                  background: penalty
                                    ? PENALTY_LABELS[penalty.code].bgColor
                                    : isPastOrNear
                                    ? (isDarkMode ? darkSlotPastBackground : 'rgba(203, 213, 225, 0.5)')
                                    : isBookedAndPresent
                                    ? (isDarkMode ? darkSlotBookedBackground : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)')
                                    : isBooked
                                    ? (isDarkMode ? darkSlotBookedBackground : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)')
                                    : isPendingSelection
                                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                    : isMarkedPresent
                                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                    : isSelected
                                    ? (isDarkMode ? darkRowBackground : 'rgba(255, 255, 255, 0.9)')
                                    : (isDarkMode ? darkRowBackground : 'rgba(255, 255, 255, 0.9)'),
                                  color: penalty
                                    ? PENALTY_LABELS[penalty.code].color
                                    : isPendingSelection || isMarkedPresent ? '#fff' : isBooked ? (isDarkMode ? '#e5e7eb' : '#fff') : isPastOrNear ? textSoft : isSelected ? '#10b981' : textMuted,
                                  fontWeight: 800,
                                  fontSize: isBooked || penalty ? '13px' : '11px',
                                  transition: 'all 0.2s ease',
                                  boxShadow: penalty
                                    ? `0 2px 8px ${PENALTY_LABELS[penalty.code].color}40`
                                    : isBookedAndPresent
                                    ? (isDarkMode ? 'inset 0 0 0 2px rgba(16, 185, 129, 0.8)' : '0 2px 8px rgba(59, 130, 246, 0.4), inset 0 0 0 2px rgba(16, 185, 129, 0.8)')
                                    : isBooked
                                    ? (isDarkMode ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.4)')
                                    : isPendingSelection
                                    ? '0 2px 8px rgba(245, 158, 11, 0.4), inset 0 0 0 2px rgba(255, 255, 255, 0.3)'
                                    : isMarkedPresent
                                    ? '0 2px 8px rgba(16, 185, 129, 0.3)'
                                    : isDarkMode ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.05)',
                                  letterSpacing: isBooked || penalty ? '1px' : '0.5px',
                                  border: penalty
                                    ? `2px solid ${PENALTY_LABELS[penalty.code].color}`
                                    : isBookedAndPresent
                                    ? '2px solid #10b981'
                                    : isBooked
                                    ? (isDarkMode ? `1px solid ${darkSlotBorder}` : '2px solid transparent')
                                    : isPendingSelection
                                    ? '2px solid rgba(251, 191, 36, 0.6)'
                                    : isSelected && !isMarkedPresent
                                    ? '2px solid #10b981' 
                                    : !isSelected && !isPastOrNear
                                    ? isDarkMode ? `1px solid ${darkSlotBorder}` : '2px solid rgba(2, 69, 174, 0.1)' 
                                    : isDarkMode ? `1px solid ${darkSlotBorder}` : '2px solid transparent',
                                  opacity: isSelected && !canMarkAttend && !isBooked ? 0.5 : 1,
                                  boxSizing: 'border-box'
                                }}
                                onMouseEnter={(e) => {
                                  if (isBookedAndPresent) {
                                    e.currentTarget.style.background = isDarkMode ? darkRowHoverBackground : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                                    e.currentTarget.style.boxShadow = isDarkMode ? 'inset 0 0 0 2px rgba(16, 185, 129, 1)' : '0 4px 12px rgba(59, 130, 246, 0.5), inset 0 0 0 2px rgba(16, 185, 129, 1)';
                                  } else if (isBooked) {
                                    e.currentTarget.style.background = isDarkMode ? darkRowHoverBackground : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                                    e.currentTarget.style.boxShadow = isDarkMode ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.5)';
                                  } else if (!isSelected && !isPastOrNear && !isPendingSelection) {
                                    e.currentTarget.style.background = isDarkMode ? darkRowHoverBackground : 'rgba(2, 69, 174, 0.1)';
                                    e.currentTarget.style.borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.18)' : 'rgba(2, 69, 174, 0.3)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (isBookedAndPresent) {
                                    e.currentTarget.style.background = isDarkMode ? darkSlotBookedBackground : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                                    e.currentTarget.style.boxShadow = isDarkMode ? 'inset 0 0 0 2px rgba(16, 185, 129, 0.8)' : '0 2px 8px rgba(59, 130, 246, 0.4), inset 0 0 0 2px rgba(16, 185, 129, 0.8)';
                                  } else if (isBooked) {
                                    e.currentTarget.style.background = isDarkMode ? darkSlotBookedBackground : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
                                    e.currentTarget.style.boxShadow = isDarkMode ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.4)';
                                  } else if (!isSelected && !isPastOrNear && !isPendingSelection) {
                                    e.currentTarget.style.background = isDarkMode ? darkRowBackground : 'rgba(255, 255, 255, 0.9)';
                                    e.currentTarget.style.borderColor = isDarkMode ? darkSlotBorder : 'rgba(2, 69, 174, 0.1)';
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
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              {pendingSelections.size > 0 && (
                <div style={{
                  marginTop: '32px',
                  paddingTop: '24px',
                  borderTop: borderAccentSoft,
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
                    boxShadow: isDarkMode ? '0 4px 14px rgba(16, 185, 129, 0.22)' : '0 4px 16px rgba(16, 185, 129, 0.4)',
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
                {
                  label: 'Available',
                  color: isDarkMode ? darkSlotBackground : 'rgba(255, 255, 255, 0.9)',
                  textColor: isDarkMode ? textMuted : '#64748b',
                  border: isDarkMode ? `1px solid ${darkSlotBorder}` : '1px solid rgba(2, 69, 174, 0.1)'
                },
                { label: 'Selected', color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', textColor: '#fff' },
                { label: 'Your Open Slots', color: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', textColor: '#fff' },
                {
                  label: 'Past/Unavailable',
                  color: isDarkMode ? darkSlotPastBackground : 'rgba(203, 213, 225, 0.5)',
                  textColor: '#94a3b8',
                  border: isDarkMode ? `1px solid ${darkSlotBorder}` : 'none'
                }
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: item.color,
                    border: item.border || 'none',
                    boxShadow: isDarkMode ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}></div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? '#d1d5db' : '#475569' }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Penalty Code Reference */}
            <div style={{
              marginTop: '32px',
              background: cardBackground,
              borderRadius: '16px',
              padding: '24px',
              boxShadow: boxShadowSoft,
              border: borderSoft
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className="fas fa-info-circle" style={{ color: '#fff', fontSize: '18px' }}></i>
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: textPrimary }}>
                    Penalty Code Reference
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: textMuted }}>
                    Applied to schedule slots for attendance and compliance tracking
                  </p>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  {
                    code: '301',
                    label: 'TA-301',
                    title: 'Tutor Absence (Booked)',
                    description: 'Tutor failed to attend a booked lesson slot. Includes short-notice cancellations (less than 48 hours), failure to confirm attendance, or technical issues not properly reported.',
                    severity: 'critical',
                    color: '#dc2626',
                    bgColor: '#fef2f2'
                  },
                  {
                    code: '302',
                    label: 'TA-302',
                    title: 'Tutor Absence (Unbooked)',
                    description: 'Tutor failed to attend an unbooked (open) lesson slot or failed to confirm attendance for an open slot.',
                    severity: 'high',
                    color: '#ea580c',
                    bgColor: '#fff7ed'
                  },
                  {
                    code: '303',
                    label: 'TA-303',
                    title: 'Short Notice Cancellation',
                    description: 'Open slot cancelled on short notice (within 48 hours of lesson time). Multiple occurrences may lead to slot restrictions.',
                    severity: 'medium',
                    color: '#f59e0b',
                    bgColor: '#fffbeb'
                  },
                  {
                    code: '401',
                    label: 'SUB-401',
                    title: 'Substitution',
                    description: 'Slot temporarily closed for potential substitution. Becomes available again 30 minutes before lesson if no transfer occurs.',
                    severity: 'low',
                    color: '#6366f1',
                    bgColor: '#eef2ff'
                  },
                  {
                    code: '501',
                    label: 'SYS-501',
                    title: 'System Issue',
                    description: 'Lesson terminated or not conducted due to system or student-side issues. Tutor is compensated.',
                    severity: 'low',
                    color: '#8b5cf6',
                    bgColor: '#f5f3ff'
                  },
                  {
                    code: '502',
                    label: 'STU-502',
                    title: 'Student Absent',
                    description: 'Student failed to attend the booked lesson. Tutor is compensated.',
                    severity: 'low',
                    color: '#06b6d4',
                    bgColor: '#ecfeff'
                  },
                  {
                    code: '601',
                    label: 'BLK-601',
                    title: 'Penalty Block',
                    description: 'Temporary block on future unbooked slots due to repeated absences (3+ TA-301 codes in 30 days).',
                    severity: 'critical',
                    color: '#991b1b',
                    bgColor: '#fef2f2'
                  }
                ].map((item) => (
                  <div
                    key={item.code}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      padding: '16px',
                      background: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : item.bgColor,
                      borderRadius: '12px',
                      border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : `1px solid ${item.color}20`,
                      boxShadow: isDarkMode ? 'inset 0 1px 0 rgba(255, 255, 255, 0.02)' : 'none',
                      alignItems: 'flex-start'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      minWidth: '70px'
                    }}>
                      <span style={{
                        fontWeight: 800,
                        fontSize: '12px',
                        color: item.color,
                        letterSpacing: '0.5px',
                        background: isDarkMode ? `${item.color}1f` : `${item.color}15`,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: isDarkMode ? `1px solid ${item.color}22` : 'none'
                      }}>
                        {item.label}
                      </span>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        color: isDarkMode ? '#94a3b8' : item.color,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {item.severity}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: '13px',
                        color: isDarkMode ? '#f8fafc' : textPrimary,
                        marginBottom: '4px'
                      }}>
                        {item.title}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: isDarkMode ? '#cbd5e1' : textMuted,
                        lineHeight: 1.5
                      }}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
              background: elevatedBackground,
              backdropFilter: 'blur(10px)',
              borderRadius: '20px',
              padding: '28px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: isDarkMode ? '0 12px 32px rgba(0, 0, 0, 0.28)' : '0 20px 60px rgba(2, 69, 174, 0.3)',
              border: borderSoft,
              position: 'relative',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success Overlay Animation */}
            {showSuccess && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: elevatedBackground,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                animation: 'fadeIn 0.3s ease'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  boxShadow: isDarkMode ? '0 4px 14px rgba(16, 185, 129, 0.22)' : '0 8px 24px rgba(16, 185, 129, 0.4)',
                  animation: 'scaleIn 0.4s ease'
                }}>
                  <i className="fas fa-check" style={{ 
                    color: '#fff', 
                    fontSize: '36px',
                    animation: 'checkmark 0.5s ease 0.2s both'
                  }}></i>
                </div>
                <h3 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 800,
                  color: isDarkMode ? '#6ee7b7' : '#059669',
                  animation: 'fadeInUp 0.4s ease 0.3s both'
                }}>
                  {bulkAction === 'attendance' 
                    ? `Marked as ${attendanceStatus === 'present' ? 'Present' : 'Absent'}!`
                    : bulkAction === 'open'
                    ? 'Slots Opened!'
                    : 'Slots Closed!'}
                </h3>
                <p style={{
                  margin: '8px 0 0',
                  fontSize: '14px',
                  color: textMuted,
                  animation: 'fadeInUp 0.4s ease 0.4s both'
                }}>
                  {pendingSelections.size} slot{pendingSelections.size > 1 ? 's' : ''} updated successfully
                </p>
              </div>
            )}
            
            {/* Keyframe styles */}
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes scaleIn {
                from { transform: scale(0); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
              @keyframes checkmark {
                from { transform: scale(0) rotate(-45deg); opacity: 0; }
                to { transform: scale(1) rotate(0deg); opacity: 1; }
              }
              @keyframes fadeInUp {
                from { transform: translateY(10px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>

            {/* Modal Header - Compact */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: bulkAction === 'attendance'
                  ? 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)'
                  : bulkAction === 'open'
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: bulkAction === 'attendance'
                  ? '0 6px 16px rgba(2, 69, 174, 0.3)'
                  : bulkAction === 'open'
                  ? '0 6px 16px rgba(16, 185, 129, 0.3)'
                  : '0 6px 16px rgba(239, 68, 68, 0.3)'
              }}>
                <i className={`fas fa-${bulkAction === 'attendance' ? 'clipboard-check' : bulkAction === 'open' ? 'unlock-alt' : 'lock'}`} style={{ color: '#fff', fontSize: '24px' }}></i>
              </div>
              <h3 style={{
                margin: '0 0 6px',
                fontSize: '22px',
                fontWeight: 900,
                color: textPrimary,
                letterSpacing: '0.3px'
              }}>
                {bulkAction === 'attendance' 
                  ? 'Update Attendance?' 
                  : bulkAction === 'open' 
                  ? 'Open Selected Slots?' 
                  : 'Close Selected Slots?'}
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: textMuted, fontWeight: 500 }}>
                You have selected {pendingSelections.size} time slot{pendingSelections.size > 1 ? 's' : ''}
              </p>
            </div>

            {/* Confirmation Message or Attendance Selection */}
            {bulkAction === 'attendance' ? (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ 
                  margin: '0 0 12px', 
                  fontSize: '13px', 
                  fontWeight: 800, 
                  color: isDarkMode ? '#93c5fd' : '#0245ae',
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
                        ? (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(203, 213, 225, 0.3)')
                        : attendanceStatus === 'present' 
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'rgba(16, 185, 129, 0.1)',
                      color: hasBookedSlots()
                        ? textSoft
                        : attendanceStatus === 'present' ? '#fff' : '#10b981',
                      border: hasBookedSlots()
                        ? (isDarkMode ? '2px solid rgba(255, 255, 255, 0.08)' : '2px solid rgba(203, 213, 225, 0.3)')
                        : attendanceStatus === 'present' ? 'none' : '2px solid rgba(16, 185, 129, 0.3)',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: hasBookedSlots() ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.5px',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: attendanceStatus === 'present' ? (isDarkMode ? '0 4px 14px rgba(16, 185, 129, 0.22)' : '0 4px 16px rgba(16, 185, 129, 0.4)') : 'none',
                      opacity: hasBookedSlots() ? 0.5 : 1
                    }}
                  >
                    <i className="fas fa-check-circle" style={{ fontSize: '18px' }}></i>
                    Present
                  </button>
                  <button
                    onClick={() => setAttendanceStatus('absent')}
                    disabled={!canChangeToAbsent()}
                    style={{
                      flex: 1,
                      background: !canChangeToAbsent()
                        ? (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(203, 213, 225, 0.3)')
                        : attendanceStatus === 'absent' 
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        : 'rgba(239, 68, 68, 0.1)',
                      color: !canChangeToAbsent()
                        ? textSoft
                        : attendanceStatus === 'absent' ? '#fff' : '#ef4444',
                      border: !canChangeToAbsent()
                        ? (isDarkMode ? '2px solid rgba(255, 255, 255, 0.08)' : '2px solid rgba(203, 213, 225, 0.3)')
                        : attendanceStatus === 'absent' ? 'none' : '2px solid rgba(239, 68, 68, 0.3)',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: !canChangeToAbsent() ? 'not-allowed' : 'pointer',
                      letterSpacing: '0.5px',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: attendanceStatus === 'absent' ? (isDarkMode ? '0 4px 14px rgba(239, 68, 68, 0.22)' : '0 4px 16px rgba(239, 68, 68, 0.4)') : 'none'
                    }}
                  >
                    <i className="fas fa-times-circle" style={{ fontSize: '18px' }}></i>
                    Absent
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                background: bulkAction === 'open' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '20px',
                border: bulkAction === 'open' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                <p style={{ margin: 0, fontSize: '13px', color: isDarkMode ? '#d1d5db' : '#334155', lineHeight: '1.5', fontWeight: 500, textAlign: 'center' }}>
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
                disabled={isConfirming}
                style={{
                  flex: 1,
                  background: 'rgba(100, 116, 139, 0.1)',
                  color: isDarkMode ? '#d1d5db' : '#475569',
                  border: '1px solid rgba(100, 116, 139, 0.2)',
                  padding: '14px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '15px',
                  cursor: isConfirming ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.5px',
                  transition: 'all 0.3s ease',
                  opacity: isConfirming ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkAction}
                disabled={(bulkAction === 'attendance' && !attendanceStatus) || isConfirming}
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
                  cursor: ((bulkAction === 'attendance' && !attendanceStatus) || isConfirming) ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.5px',
                  boxShadow: (bulkAction === 'attendance' && !attendanceStatus)
                    ? 'none'
                    : bulkAction === 'attendance'
                    ? attendanceStatus === 'present'
                    ? isDarkMode ? '0 4px 14px rgba(16, 185, 129, 0.22)' : '0 4px 16px rgba(16, 185, 129, 0.4)'
                    : isDarkMode ? '0 4px 14px rgba(239, 68, 68, 0.22)' : '0 4px 16px rgba(239, 68, 68, 0.4)'
                  : bulkAction === 'open'
                    ? isDarkMode ? '0 4px 14px rgba(16, 185, 129, 0.22)' : '0 4px 16px rgba(16, 185, 129, 0.4)'
                    : isDarkMode ? '0 4px 14px rgba(239, 68, 68, 0.22)' : '0 4px 16px rgba(239, 68, 68, 0.4)',
                  transition: 'all 0.3s ease',
                  opacity: ((bulkAction === 'attendance' && !attendanceStatus) || isConfirming) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isConfirming ? (
                  <>
                    <i className="fas fa-circle-notch" style={{ 
                      fontSize: '16px',
                      animation: 'spin 1s linear infinite' 
                    }}></i>
                    Processing...
                  </>
                ) : (
                  bulkAction === 'attendance'
                    ? attendanceStatus
                      ? `Mark as ${attendanceStatus === 'present' ? 'Present' : 'Absent'}`
                      : 'Select Status'
                    : bulkAction === 'open' 
                    ? `Open ${pendingSelections.size} Slot${pendingSelections.size > 1 ? 's' : ''}` 
                    : `Close ${pendingSelections.size} Slot${pendingSelections.size > 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SchedulePage;
