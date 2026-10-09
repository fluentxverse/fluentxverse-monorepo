import { useState, useEffect, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';
import { useThemeStore } from '../context/ThemeContext';
import { scheduleApi, type AbsenceReason } from '../api/schedule.api';
import { initSocket, getSocket, connectSocket, disconnectSocket } from '../client/socket/socket.client';
import type { Notification } from '../types/notification.types';
import { getSchedulePeriod } from '../utils/schedulePeriod';

// Penalty code types
type PenaltyCode = '301' | '302' | '303' | '401' | '501' | '502' | '601';

interface SlotPenalty {
  code: PenaltyCode;
  reason: string;
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

const BOOKING_NOTICE = 'Confirm availability 35 to 11 minutes before class. Unconfirmed open slots receive TA-302. Booked lessons receive TA-301 only for a declared absence or no classroom entry during the scheduled lesson. Only Present slots can be booked until 5 minutes before class.';
const ABSENCE_REASONS: AbsenceReason[] = ['Internet Outage', 'Electric Outage', 'Emergency', 'Disaster', 'Health', 'Others'];

const SchedulePage = () => {
  useEffect(() => {
    document.title = 'Schedule | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  const isDarkMode = useThemeStore((state) => state.resolvedTheme === 'dark');
  const { route } = useLocation();
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<Set<string>>(new Set());
  const [attendanceBySlot, setAttendanceBySlot] = useState<Map<string, 'present' | 'absent'>>(new Map());
  const [openSlotIds, setOpenSlotIds] = useState<Map<string, string>>(new Map());
  const [ta303BySlot, setTa303BySlot] = useState<Map<string, { count: number; reopenCount: number; lastAt?: string }>>(new Map());
  const [slotPenalties, setSlotPenalties] = useState<Map<string, SlotPenalty>>(new Map()); // Track penalty codes per slot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedulingBlock, setSchedulingBlock] = useState<{ active: boolean; expiresAt: string | null }>({ active: false, expiresAt: null });
  
  // Booked slot info type
  interface BookedSlotInfo {
    studentId: string;
    bookingId: string;
    studentName?: string;
    attendanceWindowOpenedAt?: string;
  }
  
  // Initialize booked slots map
  const [bookedSlots, setBookedSlots] = useState<Map<string, BookedSlotInfo>>(new Map()); // Map of slot key to booking info
  const [closedTimeSlots, setClosedTimeSlots] = useState<Set<string>>(new Set()); // Opened slots that elapsed without a booking
  const [reservedTimeSlots, setReservedTimeSlots] = useState<Set<string>>(new Set());
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState(() => getSchedulePeriod(Date.now()));
  const [showModal, setShowModal] = useState(false);
  const [pendingSelections, setPendingSelections] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'open' | 'close' | 'attendance' | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent' | null>(null);
  const [showAbsenceReasonModal, setShowAbsenceReasonModal] = useState(false);
  const [absenceReason, setAbsenceReason] = useState<AbsenceReason | ''>('');
  const [absenceAdditionalInfo, setAbsenceAdditionalInfo] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [bookingToast, setBookingToast] = useState<{ studentName?: string; time: string; date: string } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false); // Loading state for confirm button
  const [showSuccess, setShowSuccess] = useState(false); // Success animation state
  const [nowMs, setNowMs] = useState(Date.now());
  const schedulingBlocked = schedulingBlock.active && (!schedulingBlock.expiresAt || nowMs < Date.parse(schedulingBlock.expiresAt));
  const currentPeriod = getSchedulePeriod(nowMs);
  const previousPeriodRef = useRef(currentPeriod);
  const lastLoadedWeekRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousPeriodRef.current !== currentPeriod) {
      previousPeriodRef.current = currentPeriod;
      setSelectedPeriod(currentPeriod);
    }
  }, [currentPeriod]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000);
    const syncClock = () => {
      setNowMs(Date.now());
      if (!document.hidden) setRefreshTrigger(previous => previous + 1);
    };
    const poll = window.setInterval(() => {
      if (!document.hidden) setRefreshTrigger(previous => previous + 1);
    }, 30_000);
    window.addEventListener('focus', syncClock);
    document.addEventListener('visibilitychange', syncClock);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(poll);
      window.removeEventListener('focus', syncClock);
      document.removeEventListener('visibilitychange', syncClock);
    };
  }, []);

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
  const darkSlotBackground = '#242424';
  const darkSlotAltBackground = '#2b2b2b';
  const darkSlotHoverBackground = '#2b2b2b';
  const darkSlotAltHoverBackground = '#323232';
  const darkSlotPastBackground = '#1f1f1f';
  const darkSlotBorder = 'rgba(255, 255, 255, 0.1)';
  const darkSlotBookedBorder = '#60a5fa';
  const darkSlotBookedShadow = 'inset 0 0 0 1px rgba(96, 165, 250, 0.95), 0 0 14px rgba(96, 165, 250, 0.18)';
  const darkSlotBookedHoverShadow = 'inset 0 0 0 1px rgba(147, 197, 253, 1), 0 0 18px rgba(96, 165, 250, 0.28)';
  const lightBookedSlotBackground = 'linear-gradient(110deg, transparent 0%, transparent 34%, rgba(255, 255, 255, 0.46) 50%, transparent 66%, transparent 100%), linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
  const lightBookedSlotHoverBackground = 'linear-gradient(110deg, transparent 0%, transparent 34%, rgba(255, 255, 255, 0.52) 50%, transparent 66%, transparent 100%), linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
  const darkBookedSlotBackground = 'linear-gradient(110deg, transparent 0%, transparent 34%, rgba(96, 165, 250, 0.34) 50%, transparent 66%, transparent 100%), linear-gradient(135deg, #2b2b2b 0%, #323232 100%)';
  const darkBookedSlotHoverBackground = 'linear-gradient(110deg, transparent 0%, transparent 34%, rgba(147, 197, 253, 0.42) 50%, transparent 66%, transparent 100%), linear-gradient(135deg, #323232 0%, #3a3a3a 100%)';
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
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(nowMs));
    const part = (name: string) => Number(parts.find(item => item.type === name)?.value);
    const today = new Date(part('year'), part('month') - 1, part('day'), 12);
    
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
  const weekStartKey = formatDateISO(weekDates[0]);

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
      
      if (lastLoadedWeekRef.current !== weekStartKey) setLoading(true);
      setError(null);
      
      try {
        const scheduleData = await scheduleApi.getWeekSchedule(currentWeekOffset);
        setSchedulingBlock(scheduleData.schedulingBlock || { active: false, expiresAt: null });
        
        
        // Convert schedule data to local state format
        const newSelectedSlots = new Set<string>();
        const newBookedSlots = new Map<string, BookedSlotInfo>();
        const newClosedSlots = new Set<string>();
        const newReservedSlots = new Set<string>();
        const newAttendance = new Map<string, 'present' | 'absent'>();
        const newOpenSlotIds = new Map<string, string>();
        const newTa303 = new Map<string, { count: number; reopenCount: number; lastAt?: string }>();
        const newPenalties = new Map<string, SlotPenalty>();
        
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
            if ((slot.status === 'open' || slot.status === 'pending') && slot.slotId) newOpenSlotIds.set(key, slot.slotId);
            if (slot.status === 'pending') newReservedSlots.add(key);
            if (slot.ta303Count || slot.penaltyCode === '303') {
              newTa303.set(key, {
                count: slot.ta303Count || 1,
                reopenCount: slot.ta303ReopenCount || 0,
                lastAt: slot.lastTa303At
              });
            }
            const marked = slot.status === 'booked' ? slot.attendanceTutor : slot.attendanceMarked;
            if (marked === 'present' || marked === 'absent') newAttendance.set(key, marked);
            if (slot.penaltyCode && slot.penaltyCode in PENALTY_LABELS) {
              newPenalties.set(key, {
                code: slot.penaltyCode as PenaltyCode,
                reason: slot.penaltyReason || PENALTY_LABELS[slot.penaltyCode as PenaltyCode].label
              });
            }
            
            const isPast = Date.parse(`${slot.date}T${convertTo24Hour(time12h)}:00+08:00`) <= Date.now();


            if ((slot.status === 'open' || slot.status === 'pending') && !isPast) {
              newSelectedSlots.add(key);
            } else if (slot.status === 'open' && isPast) {
              newClosedSlots.add(key);
            } else if (slot.status === 'booked' && slot.studentId && slot.bookingId) {
              newSelectedSlots.add(key); // Keep as open slot visually
              newBookedSlots.set(key, {
                studentId: slot.studentId,
                bookingId: slot.bookingId,
                studentName: slot.studentName,
                attendanceWindowOpenedAt: slot.attendanceWindowOpenedAt
              });
            } else {
            }
          } else {
          }
        });
        
        
        setSelectedTimeSlots(newSelectedSlots);
        setReservedTimeSlots(newReservedSlots);
        setTa303BySlot(newTa303);
        setBookedSlots(newBookedSlots);
        setClosedTimeSlots(newClosedSlots);
        setAttendanceBySlot(newAttendance);
        setOpenSlotIds(newOpenSlotIds);
        setSlotPenalties(newPenalties);
        lastLoadedWeekRef.current = weekStartKey;
      } catch (err: any) {
        console.error('Failed to load schedule:', err);
        setError(err.message || 'Failed to load schedule');
      } finally {
        setLoading(false);
      }
    };
    
    loadSchedule();
  }, [currentWeekOffset, userId, refreshTrigger, weekStartKey]);

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

  // Check if slot can be opened at least 11 minutes ahead.
  const canOpenSlot = (date: Date, timeStr: string): boolean => {
    return !schedulingBlocked && attendanceStartMs(date, timeStr) - nowMs >= 11 * 60_000;
  };

  const reopenRestriction = (key: string): string | null => {
    const policy = ta303BySlot.get(key);
    if (!policy) return null;
    if (policy.count >= 2 || policy.reopenCount >= 1) return 'TA-303 reopening has already been used';
    const [dayIdx] = key.split('-');
    const slotDate = formatDateISO(weekDates[Number(dayIdx)]);
    const todayPht = new Date(nowMs + 8 * 60 * 60_000).toISOString().slice(0, 10);
    if (todayPht !== slotDate) return 'This TA-303 slot can reopen on its lesson day';
    if (policy.lastAt) {
      const lastMs = Date.parse(policy.lastAt);
      const penaltyDay = new Date(lastMs + 8 * 60 * 60_000).toISOString().slice(0, 10);
      if (penaltyDay === slotDate && nowMs - lastMs < 30 * 60_000) {
        return 'Wait 30 minutes after TA-303 before reopening';
      }
    }
    return null;
  };

  const attendanceStartMs = (date: Date, timeStr: string): number =>
    Date.parse(`${formatDateISO(date)}T${convertTo24Hour(timeStr)}:00+08:00`);

  // Attendance is recorded in Philippine time, regardless of the tutor's browser timezone.
  const canMarkAttendance = (date: Date, timeStr: string, _bookedAt?: string): boolean => {
    const startMs = attendanceStartMs(date, timeStr);
    const minutesUntilStart = (startMs - nowMs) / 60_000;
    return minutesUntilStart >= 11 && minutesUntilStart <= 35;
  };

  const isValidAttendanceSelection = (keys: string[], status: 'present' | 'absent' = 'present'): boolean => {
    if (!keys.length || keys.length > 12) return false;
    const slots = keys.map(key => {
      const [dayIdx, time] = key.split('-');
      return { dayIdx, time, start: attendanceStartMs(weekDates[Number(dayIdx)], time) };
    }).sort((a, b) => a.start - b.start);
    const first = slots[0];
    const firstKey = `${first.dayIdx}-${first.time}`;
    if (!slots.every((slot, index) =>
      slot.dayIdx === first.dayIdx && (index === 0 || slot.start - slots[index - 1].start === 30 * 60_000))) return false;
    if (status === 'absent') {
      if (slots.some(slot => reservedTimeSlots.has(`${slot.dayIdx}-${slot.time}`))) return false;
      const booked = slots.filter(slot => bookedSlots.has(`${slot.dayIdx}-${slot.time}`));
      const open = slots.filter(slot => !bookedSlots.has(`${slot.dayIdx}-${slot.time}`));
      return open.every(slot => slot.start - nowMs >= 11 * 60_000) &&
        (!booked.length || canMarkAttendance(weekDates[Number(booked[0].dayIdx)], booked[0].time,
          bookedSlots.get(`${booked[0].dayIdx}-${booked[0].time}`)?.attendanceWindowOpenedAt));
    }
    if (canMarkAttendance(weekDates[Number(first.dayIdx)], first.time, bookedSlots.get(firstKey)?.attendanceWindowOpenedAt)) return true;

    let precedingStart = first.start;
    for (let count = slots.length; count < 12; count++) {
      precedingStart -= 30 * 60_000;
      const neighbor = [...attendanceBySlot.entries()].find(([key, marked]) => {
        if (marked !== 'present') return false;
        const [neighborDay, neighborTime] = key.split('-');
        return Number(neighborDay) === Number(first.dayIdx) &&
          attendanceStartMs(weekDates[Number(neighborDay)], neighborTime) === precedingStart;
      });
      if (!neighbor) return false;
      const [, neighborTime] = neighbor[0].split('-');
      if (canMarkAttendance(weekDates[Number(first.dayIdx)], neighborTime,
        bookedSlots.get(neighbor[0])?.attendanceWindowOpenedAt)) return true;
    }
    return false;
  };

  const canSelectAttendanceSlot = (dayIdx: number, time: string): boolean => {
    const key = `${dayIdx}-${time}`;
    return pendingSelections.has(key) ||
      isValidAttendanceSelection([...pendingSelections, key], 'present') ||
      isValidAttendanceSelection([...pendingSelections, key], 'absent');
  };

  const openBookedLesson = (dayIdx: number, time: string) => {
    const key = `${dayIdx}-${time}`;
    const bookingInfo = bookedSlots.get(key);
    
    if (bookingInfo) {
      window.open(`/lesson/${bookingInfo.bookingId}`, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSlotClick = (dayIdx: number, time: string) => {
    
    const date = weekDates[dayIdx];
    const key = `${dayIdx}-${time}`;
    const isBooked = bookedSlots.has(key);
    const isCurrentlyOpen = selectedTimeSlots.has(key);
    
    // Check if slot is in the past or too close (but allow booked slots)
    if ((!canOpenSlot(date, time) || reopenRestriction(key)) && !isCurrentlyOpen && !isBooked) {
      return; // Don't select past/near slots
    }

    // For open slots, check if they can be marked for attendance
    if ((isCurrentlyOpen || isBooked) && !pendingSelections.has(key) && !canSelectAttendanceSlot(dayIdx, time)) {
      return;
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
      if ((isCurrentlyOpen || isBooked) && newPendingSelections.size > 2 &&
          !isValidAttendanceSelection([...newPendingSelections].filter(selected => selected !== key), 'present') &&
          !isValidAttendanceSelection([...newPendingSelections].filter(selected => selected !== key), 'absent')) return;
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
      setAttendanceStatus(null);
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
        if (!attendanceStatus || !isValidAttendanceSelection([...pendingSelections], attendanceStatus)) {
          throw new Error('Selected slots are outside the allowed attendance or cancellation window');
        }
        if (attendanceStatus === 'absent' && !absenceReason) throw new Error('Select an absence reason');
        const bookingIds: string[] = [];
        const slotIds: string[] = [];
        for (const key of pendingSelections) {
          const bookingId = bookedSlots.get(key)?.bookingId;
          const slotId = openSlotIds.get(key);
          if (bookingId) bookingIds.push(bookingId);
          else if (slotId) slotIds.push(slotId);
          else throw new Error('Slot data is unavailable. Refresh the schedule and try again.');
        }
        await scheduleApi.markAttendanceBulk(
          bookingIds, slotIds, attendanceStatus,
          attendanceStatus === 'absent' ? absenceReason as AbsenceReason : undefined,
          attendanceStatus === 'absent' ? absenceAdditionalInfo.trim() : undefined
        );
        setAttendanceBySlot(previous => {
          const updated = new Map(previous);
          pendingSelections.forEach(key => {
            if (attendanceStatus === 'absent' && !bookedSlots.has(key)) updated.delete(key);
            else updated.set(key, attendanceStatus);
          });
          return updated;
        });
        if (attendanceStatus === 'absent' && slotIds.length) {
          setSelectedTimeSlots(previous => {
            const updated = new Set(previous);
            pendingSelections.forEach(key => {
              if (!bookedSlots.has(key)) updated.delete(key);
            });
            return updated;
          });
          setOpenSlotIds(previous => {
            const updated = new Map(previous);
            pendingSelections.forEach(key => {
              if (!bookedSlots.has(key)) updated.delete(key);
            });
            return updated;
          });
        }
        setRefreshTrigger(previous => previous + 1);
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
          const openedSlots = await scheduleApi.openSlots(slotsToOpen);
          const openedIds = new Map<string, string>();
          for (const slot of openedSlots) {
            if (slot.status !== 'open') continue;
            const dayIdx = weekDates.findIndex(date => formatDateISO(date) === slot.date);
            if (dayIdx >= 0) openedIds.set(`${dayIdx}-${convertTo12Hour(slot.time)}`, slot.slotId);
          }
          setOpenSlotIds(previous => new Map([...previous, ...openedIds]));
          
          // Update local state only after successful API call
          pendingSelections.forEach(key => {
            if (openedIds.has(key)) newSet.add(key);
          });
        } else if (bulkAction === 'close') {
          // For closing, we need slot IDs which we don't have in current state
          // For now, just update local state
          // TODO: Store slot IDs when loading schedule data
          pendingSelections.forEach(key => {
            newSet.delete(key);
            // Also remove from attendance if closing
            setAttendanceBySlot(previous => {
              const updated = new Map(previous);
              updated.delete(key);
              return updated;
            });
          });
        }
        
        setSelectedTimeSlots(newSet);
      }
      window.dispatchEvent(new Event('fxv:tutor-schedule-updated'));
      
      if (showAbsenceReasonModal) {
        setShowAbsenceReasonModal(false);
        setShowModal(true);
      }

      // Show success animation
      setIsConfirming(false);
      setShowSuccess(true);
      
      // Wait for animation then close
      setTimeout(() => {
        setShowSuccess(false);
        setPendingSelections(new Set());
        setShowModal(false);
        setShowAbsenceReasonModal(false);
        setBulkAction(null);
        setAttendanceStatus(null);
        setAbsenceReason('');
        setAbsenceAdditionalInfo('');
      }, 1200);
    } catch (err: any) {
      console.error('Failed to perform action:', err);
      setError(err.message || 'Failed to perform action');
      setIsConfirming(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setShowAbsenceReasonModal(false);
    setBulkAction(null);
    setAttendanceStatus(null);
    setAbsenceReason('');
    setAbsenceAdditionalInfo('');
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
      
      if (!isBooked && !isAlreadyOpen && !reservedTimeSlots.has(key) && canOpen && !reopenRestriction(key)) {
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
      
      if (!isBooked && !isAlreadyOpen && !reservedTimeSlots.has(key) && canOpen && !reopenRestriction(key)) {
        count++;
      }
    });
    
    return count;
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
          @keyframes bookedSlotShimmer {
            0% { background-position: -220% 0, 0 0; }
            100% { background-position: 220% 0, 0 0; }
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
        <main className="tutor-schedule-page" style={{ padding: '40px 0', background: pageBackground, minHeight: '100vh' }}>
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
            .schedule-ticker { height: 28px; margin-bottom: 8px; overflow: hidden; white-space: nowrap; }
            .schedule-ticker-track { display: flex; width: max-content; animation: schedule-ticker-scroll 28s linear infinite; }
            .schedule-ticker:hover .schedule-ticker-track { animation-play-state: paused; }
            .schedule-ticker-item { flex: none; padding: 0 44px; line-height: 28px; font-size: 12px; font-weight: 700; }
            @keyframes schedule-ticker-scroll { to { transform: translateX(-25%); } }
            @media (prefers-reduced-motion: reduce) {
              .schedule-ticker { overflow-x: auto; }
              .schedule-ticker-track { animation: none; }
            }
            .schedule-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 12px; margin-bottom: 16px; }
            .schedule-toolbar .schedule-prev { justify-self: start; }
            .schedule-toolbar .schedule-next { justify-self: end; }
            .schedule-toolbar .schedule-periods { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }
            .schedule-penalty-list { display: grid; grid-template-columns: 1fr; column-gap: 24px; }
            @media (min-width: 1050px) {
              .schedule-penalty-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }
            @media (max-width: 767px) {
              .schedule-toolbar { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
              .schedule-toolbar .schedule-periods { grid-column: 1 / -1; grid-row: 2; }
              .schedule-toolbar .schedule-next { grid-column: 2; grid-row: 1; }
              .schedule-toolbar .schedule-week-button { padding: 8px 10px !important; font-size: 12px !important; white-space: nowrap; }
              .schedule-toolbar .schedule-periods button { padding: 8px 12px !important; font-size: 12px !important; }
            }
            @media (min-width: 768px) {
              .tutor-schedule-page { padding: 16px 0 !important; min-height: calc(100vh - 60px) !important; }
              .tutor-schedule-page .tutor-schedule-container { max-width: 1280px !important; }
              .tutor-schedule-page .schedule-title-row { margin-bottom: 4px !important; }
              .tutor-schedule-page .schedule-card { padding: 12px !important; border-radius: 8px !important; }
              .tutor-schedule-page .schedule-toolbar { margin-bottom: 8px !important; }
              .tutor-schedule-page .schedule-week-button { padding: 8px 14px !important; border-radius: 6px !important; }
              .tutor-schedule-page .schedule-periods button { padding: 6px 14px !important; border-radius: 6px !important; }
              .tutor-schedule-page .schedule-grid { border-spacing: 3px !important; }
              .tutor-schedule-page .schedule-grid thead tr:first-child th { padding: 4px 8px !important; border-radius: 6px !important; }
              .tutor-schedule-page .schedule-grid thead tr:nth-child(2) th { padding: 1px !important; }
              .tutor-schedule-page .schedule-grid thead tr:nth-child(2) button { padding: 3px !important; }
              .tutor-schedule-page .schedule-grid tbody td { padding: 1px !important; }
              .tutor-schedule-page .schedule-grid tbody button { height: 28px !important; padding: 4px 3px !important; border-radius: 6px !important; }
              .tutor-schedule-page .schedule-grid tbody td > div { gap: 3px !important; }
            }
          `}</style>
          <div className="container tutor-schedule-container">
            {/* Header Section */}
            <div className="schedule-title-row" style={{
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '4px',
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

            <div className="schedule-ticker" role="note" aria-label={BOOKING_NOTICE} style={{
              background: isDarkMode ? 'rgba(245, 158, 11, 0.07)' : 'rgba(245, 158, 11, 0.08)',
              color: isDarkMode ? '#fcd34d' : '#92400e',
              borderTop: '1px solid rgba(245, 158, 11, 0.2)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.2)'
            }}>
              <div className="schedule-ticker-track" aria-hidden="true">
                {Array.from({ length: 4 }, (_, index) => (
                  <span className="schedule-ticker-item" key={index}>{BOOKING_NOTICE}</span>
                ))}
              </div>
            </div>

            {schedulingBlocked && <div role="alert" style={{ padding: '16px', marginBottom: '16px', border: '1px solid #dc2626', borderRadius: '8px' }}>
              <strong>New lesson bookings are temporarily blocked.</strong>{' '}
              {schedulingBlock.expiresAt && <span>Until {new Date(schedulingBlock.expiresAt).toLocaleString('en-US', { timeZone: 'Asia/Manila' })} PHT. </span>}
              Existing booked lessons remain accessible.
            </div>}
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
            <div className="schedule-card" style={{
              background: cardBackground,
              backdropFilter: 'blur(10px)',
              borderRadius: '24px',
              padding: '32px',
              boxShadow: boxShadowCard,
              border: borderSoft
            }}>
              <div className="schedule-toolbar">
                <button
                  className="schedule-week-button schedule-prev"
                  type="button"
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

                <div className="schedule-periods" role="group" aria-label="Time of day">
                  {(['morning', 'afternoon', 'evening'] as const).map((period) => {
                    const periodStyle = periodStyles[period];
                    const isActive = selectedPeriod === period;

                    return (
                      <button
                        key={period}
                        type="button"
                        aria-pressed={isActive}
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

                <button
                  className="schedule-week-button schedule-next"
                  type="button"
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

              {/* Calendar Grid */}
              <div style={{ overflowX: 'auto' }} className="schedule-scrollable">
                <table className="schedule-grid" style={{
                  width: '100%',
                  minWidth: '900px',
                  tableLayout: 'fixed',
                  borderCollapse: 'separate',
                  borderSpacing: '4px',
                  background: isDarkMode ? '#1f1f1f' : 'transparent'
                }}>
                  <colgroup>
                    <col style={{ width: '14%' }} />
                    <col span={7} style={{ width: `${86 / 7}%` }} />
                  </colgroup>
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
                          const isReserved = reservedTimeSlots.has(key);
                          const bookingInfo = bookedSlots.get(key);
                          const isSelected = selectedTimeSlots.has(key);
                          const hasStarted = attendanceStartMs(date, time) <= nowMs;
                          const isClosed = closedTimeSlots.has(key) || (isSelected && !isBooked && hasStarted);
                          const isOpen = isSelected && !isBooked && !isClosed;
                          const isMarkedPresent = attendanceBySlot.get(key) === 'present';
                          const isMarkedAbsent = attendanceBySlot.get(key) === 'absent';
                          const isPendingSelection = pendingSelections.has(key);
                          const canOpen = canOpenSlot(date, time);
                          const reopenBlocked = !isSelected && reopenRestriction(key);
                          const isPastOrNear = (isReserved || !canOpen || Boolean(reopenBlocked)) && !isSelected && !isBooked;
                          const canMarkAttend = isOpen && canSelectAttendanceSlot(dayIdx, time);
                          const penalty = slotPenalties.get(key);
                          
                          // Check if booked slot is marked present
                          const isBookedAndPresent = isBooked && isMarkedPresent;
                          
                          // Show loading skeleton while fetching schedule data
                          if (loading) {
                            return (
                              <td key={dayIdx} style={{ padding: '2px', background: isDarkMode ? darkRowBackground : 'transparent' }}>
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
                          if (isReserved) {
                            slotLabel = 'RESERVED';
                          } else if (penalty) {
                            const penaltyInfo = PENALTY_LABELS[penalty.code];
                            slotLabel = penaltyInfo.label;
                          } else if (isBooked && bookingInfo) {
                            slotLabel = bookingInfo.studentId?.slice(-6) || 'BOOKED';
                          } else if (isClosed) {
                            slotLabel = 'CLOSED';
                          } else if (isPastOrNear) {
                            slotLabel = hasStarted ? 'PAST' : 'UNAVAILABLE';
                          } else if (isPendingSelection) {
                            slotLabel = 'SELECTED';
                          } else if (isMarkedPresent) {
                            slotLabel = 'PRESENT';
                          } else if (isMarkedAbsent) {
                            slotLabel = 'ABSENT';
                          } else if (isOpen) {
                            slotLabel = 'OPEN';
                          }
                          
                          return (
                            <td key={dayIdx} style={{ padding: '2px', background: isDarkMode ? darkRowBackground : 'transparent' }}>
                              <div
                                title={reopenBlocked || undefined}
                                style={{ display: 'flex', alignItems: 'stretch', gap: '4px', width: '100%' }}
                              >
                                <button
                                key={`${key}-${isDarkMode ? 'dark' : 'light'}-${isBooked ? 'booked' : 'idle'}`}
                                type="button"
                                onClick={() => isBooked ? openBookedLesson(dayIdx, time) : handleSlotClick(dayIdx, time)}
                                disabled={!isBooked && (isPastOrNear || (isSelected && !canMarkAttend))}
                                aria-label={isBooked ? `Open lesson with ${bookingInfo?.studentName || bookingInfo?.studentId || 'student'}` : `${slotLabel} ${time}`}
                                title={isBooked ? `Open lesson with ${bookingInfo?.studentName || bookingInfo?.studentId || 'student'}` : reopenBlocked || penalty?.reason}
                                style={{
                                  width: isBooked ? 'auto' : '100%',
                                  flex: isBooked ? 1 : undefined,
                                  minWidth: 0,
                                  height: '38px',
                                  display: 'block',
                                  padding: isBooked ? '10px 3px' : '10px 6px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  borderRadius: '8px',
                                  outline: 'none',
                                  appearance: 'none',
                                  cursor: isBooked ? 'pointer' : isPastOrNear || (isSelected && !canMarkAttend) ? 'not-allowed' : 'pointer',
                                  background: penalty
                                    ? PENALTY_LABELS[penalty.code].bgColor
                                    : isClosed
                                    ? (isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(148, 163, 184, 0.2)')
                                    : isPastOrNear
                                    ? (isDarkMode ? darkSlotPastBackground : 'rgba(203, 213, 225, 0.5)')
                                    : isBookedAndPresent
                                    ? (isDarkMode ? darkBookedSlotBackground : lightBookedSlotBackground)
                                    : isBooked
                                    ? (isDarkMode ? darkBookedSlotBackground : lightBookedSlotBackground)
                                    : isPendingSelection
                                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                    : isMarkedPresent
                                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                    : isSelected
                                    ? (isDarkMode ? 'rgba(59, 130, 246, 0.18)' : 'rgba(59, 130, 246, 0.1)')
                                    : (isDarkMode ? 'rgba(16, 185, 129, 0.13)' : 'rgba(16, 185, 129, 0.08)'),
                                  color: penalty
                                    ? PENALTY_LABELS[penalty.code].color
                                    : isPendingSelection || isMarkedPresent ? '#fff' : isBooked ? (isDarkMode ? '#e5e7eb' : '#fff') : isClosed ? (isDarkMode ? '#cbd5e1' : '#475569') : isPastOrNear ? textSoft : isSelected ? (isDarkMode ? '#93c5fd' : '#1d4ed8') : isDarkMode ? '#6ee7b7' : '#047857',
                                  fontWeight: 800,
                                  fontSize: isBooked ? '11px' : penalty ? '13px' : '11px',
                                  transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
                                  backgroundSize: isBooked && !penalty ? '220% 100%, 100% 100%' : undefined,
                                  animation: isBooked && !penalty ? 'bookedSlotShimmer 2.4s linear infinite' : undefined,
                                  animationPlayState: isBooked && !penalty ? 'running' : undefined,
                                  willChange: isBooked && !penalty ? 'background-position' : undefined,
                                  boxShadow: penalty
                                    ? `0 2px 8px ${PENALTY_LABELS[penalty.code].color}40`
                                    : isBookedAndPresent
                                    ? (isDarkMode ? `${darkSlotBookedShadow}, inset 0 0 0 3px rgba(16, 185, 129, 0.72)` : '0 2px 8px rgba(59, 130, 246, 0.4), inset 0 0 0 2px rgba(16, 185, 129, 0.8)')
                                    : isBooked
                                    ? (isDarkMode ? darkSlotBookedShadow : '0 2px 8px rgba(59, 130, 246, 0.4)')
                                    : isPendingSelection
                                    ? '0 2px 8px rgba(245, 158, 11, 0.4), inset 0 0 0 2px rgba(255, 255, 255, 0.3)'
                                    : isMarkedPresent
                                    ? '0 2px 8px rgba(16, 185, 129, 0.3)'
                                    : isDarkMode ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.05)',
                                  letterSpacing: isBooked ? '0' : penalty ? '1px' : '0.5px',
                                  border: penalty
                                    ? `2px solid ${PENALTY_LABELS[penalty.code].color}`
                                    : isBookedAndPresent
                                    ? (isDarkMode ? `2px solid ${darkSlotBookedBorder}` : '2px solid #10b981')
                                    : isBooked
                                    ? (isDarkMode ? `2px solid ${darkSlotBookedBorder}` : '2px solid transparent')
                                    : isPendingSelection
                                    ? '2px solid rgba(251, 191, 36, 0.6)'
                                    : isClosed
                                    ? (isDarkMode ? '2px solid rgba(148, 163, 184, 0.35)' : '2px solid rgba(100, 116, 139, 0.3)')
                                    : isOpen && !isMarkedPresent
                                    ? (isDarkMode ? '2px solid rgba(96, 165, 250, 0.8)' : '2px solid #3b82f6')
                                    : !isSelected && !isPastOrNear
                                    ? isDarkMode ? '2px solid rgba(52, 211, 153, 0.42)' : '2px solid rgba(16, 185, 129, 0.3)'
                                    : isDarkMode ? `2px solid ${darkSlotBorder}` : '2px solid transparent',
                                  opacity: isSelected && !canMarkAttend && !isBooked ? 0.85 : 1,
                                  boxSizing: 'border-box'
                                }}
                                onMouseEnter={(e) => {
                                  if (isBookedAndPresent) {
                                    e.currentTarget.style.background = isDarkMode ? darkBookedSlotHoverBackground : lightBookedSlotHoverBackground;
                                    e.currentTarget.style.backgroundSize = '220% 100%, 100% 100%';
                                    e.currentTarget.style.boxShadow = isDarkMode ? `${darkSlotBookedHoverShadow}, inset 0 0 0 3px rgba(16, 185, 129, 0.86)` : '0 4px 12px rgba(59, 130, 246, 0.5), inset 0 0 0 2px rgba(16, 185, 129, 1)';
                                  } else if (isBooked) {
                                    e.currentTarget.style.background = isDarkMode ? darkBookedSlotHoverBackground : lightBookedSlotHoverBackground;
                                    e.currentTarget.style.backgroundSize = '220% 100%, 100% 100%';
                                    e.currentTarget.style.boxShadow = isDarkMode ? darkSlotBookedHoverShadow : '0 4px 12px rgba(59, 130, 246, 0.5)';
                                  } else if (!isSelected && !isPastOrNear && !isPendingSelection) {
                                    e.currentTarget.style.background = isDarkMode ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.14)';
                                    e.currentTarget.style.borderColor = isDarkMode ? 'rgba(110, 231, 183, 0.72)' : 'rgba(5, 150, 105, 0.55)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (isBookedAndPresent) {
                                    e.currentTarget.style.background = isDarkMode ? darkBookedSlotBackground : lightBookedSlotBackground;
                                    e.currentTarget.style.backgroundSize = '220% 100%, 100% 100%';
                                    e.currentTarget.style.boxShadow = isDarkMode ? `${darkSlotBookedShadow}, inset 0 0 0 3px rgba(16, 185, 129, 0.72)` : '0 2px 8px rgba(59, 130, 246, 0.4), inset 0 0 0 2px rgba(16, 185, 129, 0.8)';
                                  } else if (isBooked) {
                                    e.currentTarget.style.background = isDarkMode ? darkBookedSlotBackground : lightBookedSlotBackground;
                                    e.currentTarget.style.backgroundSize = '220% 100%, 100% 100%';
                                    e.currentTarget.style.boxShadow = isDarkMode ? darkSlotBookedShadow : '0 2px 8px rgba(59, 130, 246, 0.4)';
                                  } else if (!isSelected && !isPastOrNear && !isPendingSelection) {
                                    e.currentTarget.style.background = isDarkMode ? 'rgba(16, 185, 129, 0.13)' : 'rgba(16, 185, 129, 0.08)';
                                    e.currentTarget.style.borderColor = isDarkMode ? 'rgba(52, 211, 153, 0.42)' : 'rgba(16, 185, 129, 0.3)';
                                  }
                                }}
                              >
                                {isBooked && <i className="fas fa-book-open" aria-hidden="true" style={{ marginRight: '3px', fontSize: '10px' }} />}
                                {slotLabel}
                                </button>
                                {isBooked && (
                                <button
                                  type="button"
                                  onClick={() => handleSlotClick(dayIdx, time)}
                                  disabled={!canSelectAttendanceSlot(dayIdx, time)}
                                  aria-label={`Update attendance for ${bookingInfo?.studentName || bookingInfo?.studentId || 'student'} at ${time}`}
                                  aria-pressed={isPendingSelection}
                                  title={canSelectAttendanceSlot(dayIdx, time) ? `Update attendance${attendanceBySlot.has(key) ? ` (currently ${attendanceBySlot.get(key)})` : ''}` : 'Attendance updates are available 35 to 11 minutes before the first lesson'}
                                  style={{
                                    width: '32px',
                                    height: '38px',
                                    flexShrink: 0,
                                    boxSizing: 'border-box',
                                    borderRadius: '8px',
                                    border: isPendingSelection ? '2px solid #fbbf24' : (isDarkMode ? '2px solid #60a5fa' : '2px solid #3b82f6'),
                                    background: isPendingSelection ? '#b45309' : (isDarkMode ? '#26384f' : '#e8f1ff'),
                                    color: isPendingSelection ? '#fff' : (isDarkMode ? '#bfdbfe' : '#1d4ed8'),
                                    cursor: canSelectAttendanceSlot(dayIdx, time) ? 'pointer' : 'not-allowed',
                                    opacity: canSelectAttendanceSlot(dayIdx, time) ? 1 : 0.5,
                                  }}
                                >
                                  <i className="fas fa-clipboard-check" aria-hidden="true" />
                                </button>
                                )}
                              </div>
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
                  color: isDarkMode ? 'rgba(16, 185, 129, 0.13)' : 'rgba(16, 185, 129, 0.08)',
                  textColor: isDarkMode ? '#6ee7b7' : '#047857',
                  border: isDarkMode ? '2px solid rgba(52, 211, 153, 0.42)' : '2px solid rgba(16, 185, 129, 0.3)'
                },
                {
                  label: 'Booked',
                  color: isDarkMode ? darkBookedSlotBackground : lightBookedSlotBackground,
                  border: isDarkMode ? `2px solid ${darkSlotBookedBorder}` : '2px solid transparent',
                  boxShadow: isDarkMode ? darkSlotBookedShadow : '0 2px 8px rgba(59, 130, 246, 0.4)'
                },
                { label: 'Selected', color: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', textColor: '#fff' },
                {
                  label: 'Your Open Slots',
                  color: isDarkMode ? 'rgba(59, 130, 246, 0.18)' : 'rgba(59, 130, 246, 0.1)',
                  textColor: isDarkMode ? '#93c5fd' : '#1d4ed8',
                  border: isDarkMode ? '2px solid rgba(96, 165, 250, 0.8)' : '2px solid #3b82f6',
                  boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.2)'
                },
                {
                  label: 'Closed',
                  color: isDarkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(148, 163, 184, 0.2)',
                  textColor: isDarkMode ? '#cbd5e1' : '#475569',
                  border: isDarkMode ? '2px solid rgba(148, 163, 184, 0.35)' : '2px solid rgba(100, 116, 139, 0.3)'
                },
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
                    backgroundSize: item.label === 'Booked' ? '220% 100%, 100% 100%' : undefined,
                    animation: item.label === 'Booked' ? 'bookedSlotShimmer 2.4s linear infinite' : undefined,
                    boxShadow: item.boxShadow || (isDarkMode ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)')
                  }}></div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: isDarkMode ? '#d1d5db' : '#475569' }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Penalty Code Reference */}
            <div style={{
              marginTop: '20px',
              background: cardBackground,
              borderRadius: '8px',
              padding: '16px',
              boxShadow: boxShadowSoft,
              border: borderSoft
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <i className="fas fa-info-circle" style={{ color: '#fff', fontSize: '14px' }}></i>
                </div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: textPrimary }}>
                  Penalty Code Reference
                </h4>
              </div>
              <p style={{ margin: '0 0 10px', color: textMuted, fontSize: '12px', lineHeight: 1.5 }}>
                Booked time is protected because a student has committed to it. Unbooked time cancelled at least 48 hours ahead has no penalty; later cancellations receive TA-303 because students may have planned around that opening. One delayed reopening allows a genuine recovery without repeated last-minute changes.
              </p>
              
              <div className="schedule-penalty-list">
                {[
                  {
                    code: '301',
                    label: 'TA-301',
                    title: 'Tutor Absence (Booked)',
                    description: 'Booked lesson explicitly marked absent, or no tutor classroom entry during the scheduled lesson. Automatic no-show penalties are assigned only after the lesson ends; entering at any point during the lesson counts as attendance.',
                    severity: 'critical',
                    color: '#dc2626'
                  },
                  {
                    code: '302',
                    label: 'TA-302',
                    title: 'Tutor Absence (Unbooked)',
                    description: 'Unbooked open slot without Present confirmation at the 11-minute deadline. It closes with TA-302 and cannot be reopened.',
                    severity: 'high',
                    color: '#ea580c'
                  },
                  {
                    code: '303',
                    label: 'TA-303',
                    title: 'Short Notice Cancellation',
                    description: 'Unbooked slot cancelled under 48 hours before start. It can reopen once: after 30 minutes if cancelled on the lesson day, or on the lesson day if cancelled earlier. A second TA-303 keeps it closed.',
                    severity: 'medium',
                    color: '#f59e0b'
                  },
                  {
                    code: '401',
                    label: 'SUB-401',
                    title: 'Substitution',
                    description: 'Slot temporarily closed for potential substitution. Becomes available again 30 minutes before lesson if no transfer occurs.',
                    severity: 'low',
                    color: '#6366f1'
                  },
                  {
                    code: '501',
                    label: 'SYS-501',
                    title: 'System Issue',
                    description: 'Lesson terminated or not conducted due to system or student-side issues. Tutor is compensated.',
                    severity: 'low',
                    color: '#8b5cf6'
                  },
                  {
                    code: '502',
                    label: 'STU-502',
                    title: 'Student Absent',
                    description: 'Student failed to attend the booked lesson. Tutor is compensated.',
                    severity: 'low',
                    color: '#06b6d4'
                  },
                  {
                    code: '601',
                    label: 'BLK-601',
                    title: 'Penalty Block',
                    description: 'Temporary block on future unbooked slots due to repeated absences (3+ TA-301 codes in 30 days).',
                    severity: 'critical',
                    color: '#991b1b'
                  }
                ].map((item) => (
                  <div
                    key={item.code}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '72px minmax(0, 1fr)',
                      gap: '10px',
                      padding: '9px 2px',
                      borderBottom: borderSoft,
                      alignItems: 'start'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '2px'
                    }}>
                      <span style={{
                        fontWeight: 800,
                        fontSize: '11px',
                        color: item.color,
                        background: isDarkMode ? `${item.color}1f` : `${item.color}15`,
                        padding: '2px 5px',
                        borderRadius: '4px',
                        border: isDarkMode ? `1px solid ${item.color}22` : 'none'
                      }}>
                        {item.label}
                      </span>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        color: isDarkMode ? '#94a3b8' : item.color,
                        textTransform: 'uppercase',
                        paddingLeft: '3px'
                      }}>
                        {item.severity}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontWeight: 700,
                        fontSize: '13px',
                        color: isDarkMode ? '#f8fafc' : textPrimary,
                        marginBottom: '2px'
                      }}>
                        {item.title}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: isDarkMode ? '#cbd5e1' : textMuted,
                        lineHeight: 1.35
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
                    disabled={!isValidAttendanceSelection([...pendingSelections], 'present')}
                    style={{
                      flex: 1,
                      background: attendanceStatus === 'present'
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'rgba(16, 185, 129, 0.1)',
                      color: attendanceStatus === 'present' ? '#fff' : '#10b981',
                      border: attendanceStatus === 'present' ? '2px solid transparent' : '2px solid rgba(16, 185, 129, 0.3)',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: isValidAttendanceSelection([...pendingSelections], 'present') ? 'pointer' : 'not-allowed',
                      letterSpacing: '0.5px',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: attendanceStatus === 'present' ? (isDarkMode ? '0 4px 14px rgba(16, 185, 129, 0.22)' : '0 4px 16px rgba(16, 185, 129, 0.4)') : 'none',
                      opacity: isValidAttendanceSelection([...pendingSelections], 'present') ? 1 : 0.45
                    }}
                  >
                    <i className="fas fa-check-circle" style={{ fontSize: '18px' }}></i>
                    Present
                  </button>
                  <button
                    onClick={() => setAttendanceStatus('absent')}
                    disabled={!isValidAttendanceSelection([...pendingSelections], 'absent')}
                    style={{
                      flex: 1,
                      background: attendanceStatus === 'absent'
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        : 'rgba(239, 68, 68, 0.1)',
                      color: attendanceStatus === 'absent' ? '#fff' : '#ef4444',
                      border: attendanceStatus === 'absent' ? '2px solid transparent' : '2px solid rgba(239, 68, 68, 0.3)',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: isValidAttendanceSelection([...pendingSelections], 'absent') ? 'pointer' : 'not-allowed',
                      letterSpacing: '0.5px',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: attendanceStatus === 'absent' ? (isDarkMode ? '0 4px 14px rgba(239, 68, 68, 0.22)' : '0 4px 16px rgba(239, 68, 68, 0.4)') : 'none',
                      opacity: isValidAttendanceSelection([...pendingSelections], 'absent') ? 1 : 0.45
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
            {error && <p role="alert" style={{ color: '#f87171', fontSize: '13px', margin: '0 0 12px' }}>{error}</p>}
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
                onClick={() => {
                  if (bulkAction === 'attendance' && attendanceStatus === 'absent') {
                    setError(null);
                    setShowModal(false);
                    setShowAbsenceReasonModal(true);
                  } else {
                    void confirmBulkAction();
                  }
                }}
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
      {showAbsenceReasonModal && bulkAction === 'attendance' && pendingSelections.size > 0 && (
        <div
          role="presentation"
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000, padding: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.72)', backdropFilter: 'blur(8px)'
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="absence-reason-title"
            onClick={event => event.stopPropagation()}
            style={{
              width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto',
              padding: '24px', borderRadius: '8px', background: elevatedBackground,
              border: borderSoft, boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
              color: textPrimary
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <i className="fas fa-clipboard-list" aria-hidden="true" style={{ fontSize: '20px', color: '#f59e0b' }} />
              <div>
                <h3 id="absence-reason-title" style={{ margin: 0, fontSize: '19px' }}>Report Absence</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: textMuted }}>
                  {pendingSelections.size} selected slot{pendingSelections.size === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <p style={{ fontSize: '13px', color: textMuted, lineHeight: 1.5, margin: '0 0 18px' }}>
              Booked lessons receive TA-301. Unbooked slots return to Available; cancellations under 48 hours receive TA-303.
            </p>
            <label htmlFor="absence-reason" style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '7px' }}>
              Reason <span style={{ color: '#f87171' }}>*</span>
            </label>
            <select
              id="absence-reason"
              value={absenceReason}
              onChange={event => setAbsenceReason(event.currentTarget.value as AbsenceReason | '')}
              style={{
                width: '100%', height: '44px', padding: '0 12px', borderRadius: '6px',
                border: borderSoft, background: cardBackgroundMuted, color: textPrimary,
                fontSize: '14px', marginBottom: '18px'
              }}
            >
              <option value="">Select a reason</option>
              {ABSENCE_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
            </select>
            <label htmlFor="absence-details" style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '7px' }}>
              Additional information <span style={{ color: textMuted, fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea
              id="absence-details"
              value={absenceAdditionalInfo}
              onInput={event => setAbsenceAdditionalInfo(event.currentTarget.value)}
              maxLength={1000}
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                resize: 'vertical', borderRadius: '6px', border: borderSoft,
                background: cardBackgroundMuted, color: textPrimary, fontSize: '14px'
              }}
            />
            {error && <p role="alert" style={{ color: '#f87171', fontSize: '13px', margin: '12px 0 0' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                disabled={isConfirming}
                onClick={() => { setError(null); setShowAbsenceReasonModal(false); setShowModal(true); }}
                style={{ flex: 1, height: '44px', borderRadius: '6px', border: borderSoft, background: cardBackgroundMuted, color: textPrimary, fontWeight: 700 }}
              >Back</button>
              <button
                type="button"
                disabled={isConfirming || !absenceReason}
                onClick={() => void confirmBulkAction()}
                style={{
                  flex: 1, height: '44px', borderRadius: '6px', border: 'none',
                  background: '#dc2626', color: '#fff', fontWeight: 700,
                  opacity: isConfirming || !absenceReason ? 0.5 : 1,
                  cursor: isConfirming || !absenceReason ? 'not-allowed' : 'pointer'
                }}
              >{isConfirming ? 'Submitting...' : 'Confirm Absence'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SchedulePage;
