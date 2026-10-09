import type { WeekSchedule } from '../api/schedule.api';

type ScheduleSlot = WeekSchedule['slots'][number];

export interface AttendanceReminderSlot {
  slot: ScheduleSlot;
  startMs: number;
  deadlineMs: number;
}

export interface RoomEntryReminderSlot extends AttendanceReminderSlot {}

export function activeClassroomBookingId(path: string): string | undefined {
  const match = /^\/classroom\/([^/?#]+)\/?(?:[?#].*)?$/.exec(path);
  if (!match) return undefined;
  try { return decodeURIComponent(match[1]!); } catch { return undefined; }
}

function slotStartMs(slot: ScheduleSlot): number {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i.exec(slot.time.trim());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date) || !match) return NaN;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return NaN;
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return Date.parse(`${slot.date}T${String(hour).padStart(2, '0')}:${match[2]}:00+08:00`);
}

export function getAttendanceReminderSlots(slots: ScheduleSlot[], nowMs: number): AttendanceReminderSlot[] {
  return slots.flatMap(slot => {
    if (!['open', 'pending', 'booked'].includes(slot.status)) return [];
    const marked = slot.status === 'booked' ? slot.attendanceTutor : slot.attendanceMarked;
    if (marked === 'present' || marked === 'absent') return [];

    const startMs = slotStartMs(slot);
    const minutesUntilStart = (startMs - nowMs) / 60_000;
    if (!Number.isFinite(startMs) || minutesUntilStart < 11 || minutesUntilStart > 35) return [];
    return [{ slot, startMs, deadlineMs: startMs - 11 * 60_000 }];
  }).sort((a, b) => a.deadlineMs - b.deadlineMs);
}

export function getRoomEntryReminderSlots(slots: ScheduleSlot[], nowMs: number, activeBookingId?: string): RoomEntryReminderSlot[] {
  return slots.flatMap(slot => {
    if (slot.status !== 'booked' || slot.attendanceTutor !== 'present' ||
        !slot.bookingId || slot.bookingId === activeBookingId ||
        !slot.roomEntryPolicyActivatedAt || slot.roomEntryCheckCompletedAt) return [];
    const startMs = slotStartMs(slot);
    const deadlineMs = startMs + 5 * 60_000;
    if (!Number.isFinite(startMs) || nowMs < startMs - 5 * 60_000 || nowMs >= deadlineMs) return [];
    const enteredAtMs = slot.tutorRoomEnteredAt ? Date.parse(slot.tutorRoomEnteredAt) : NaN;
    if (enteredAtMs >= startMs - 5 * 60_000 && enteredAtMs <= deadlineMs) return [];
    return [{ slot, startMs, deadlineMs }];
  }).sort((a, b) => a.deadlineMs - b.deadlineMs);
}
