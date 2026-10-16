import { expect, test } from 'bun:test';
import { activeClassroomBookingId, getAttendanceReminderSlots, getRoomEntryReminderSlots } from '../src/utils/attendanceReminder';
import type { WeekSchedule } from '../src/api/schedule.api';

type Slot = WeekSchedule['slots'][number];
const startMs = Date.parse('2026-10-03T18:00:00+08:00');
const open: Slot = { date: '2026-10-03', time: '6:00 PM', status: 'open', slotId: 'open-1' };

test('only recognizes top-level classroom routes and safely decodes booking IDs', () => {
  expect(activeClassroomBookingId('/classroom/booking-1')).toBe('booking-1');
  expect(activeClassroomBookingId('/classroom/booking%201/?tab=material')).toBe('booking 1');
  expect(activeClassroomBookingId('/materials/daily-dispatch/article-1')).toBeUndefined();
  expect(activeClassroomBookingId('/classroom/%broken')).toBeUndefined();
});

test('reminds only during the 35-to-11-minute attendance window', () => {
  expect(getAttendanceReminderSlots([open], startMs - 36 * 60_000)).toHaveLength(0);
  expect(getAttendanceReminderSlots([open], startMs - 35 * 60_000)).toHaveLength(1);
  expect(getAttendanceReminderSlots([open], startMs - 11 * 60_000)).toHaveLength(1);
  expect(getAttendanceReminderSlots([open], startMs - 10 * 60_000)).toHaveLength(0);
});

test('includes unconfirmed booked and pending slots, but not confirmed or closed slots', () => {
  const slots: Slot[] = [
    open,
    { ...open, slotId: 'pending', status: 'pending' },
    { ...open, slotId: 'booked', status: 'booked', bookingId: 'booking-1' },
    { ...open, slotId: 'present', attendanceMarked: 'present' },
    { ...open, slotId: 'absent', status: 'booked', attendanceTutor: 'absent' },
    { ...open, slotId: 'closed', status: 'closed' }
  ];
  expect(getAttendanceReminderSlots(slots, startMs - 20 * 60_000).map(item => item.slot.slotId))
    .toEqual(['open-1', 'pending', 'booked']);
});

test('parses 24-hour PHT times and orders reminders by deadline', () => {
  const later: Slot = { ...open, slotId: 'later', time: '18:10' };
  const due = getAttendanceReminderSlots([later, open], startMs - 25 * 60_000);
  expect(due.map(item => item.slot.slotId)).toEqual(['open-1', 'later']);
  expect(due[1].startMs).toBe(startMs + 10 * 60_000);
  expect(due[1].deadlineMs).toBe(startMs - 60_000);
});

test('warns about a Present booking from five minutes before start until room-entry deadline', () => {
  const booked: Slot = {
    ...open, status: 'booked', bookingId: 'booking-1', attendanceTutor: 'present',
    roomEntryPolicyActivatedAt: new Date(startMs - 35 * 60_000).toISOString()
  };
  expect(getRoomEntryReminderSlots([booked], startMs - 6 * 60_000)).toHaveLength(0);
  expect(getRoomEntryReminderSlots([booked], startMs - 5 * 60_000)).toHaveLength(1);
  expect(getRoomEntryReminderSlots([booked], startMs + 4 * 60_000)).toHaveLength(1);
  expect(getRoomEntryReminderSlots([booked], startMs + 5 * 60_000)).toHaveLength(0);
  expect(getRoomEntryReminderSlots([{ ...booked, roomEntryCheckCompletedAt: new Date(startMs).toISOString() }], startMs))
    .toHaveLength(0);
  expect(getRoomEntryReminderSlots([{ ...booked, attendanceTutor: 'absent' }], startMs)).toHaveLength(0);
});

test('does not ask tutors to reenter the classroom already open, even with stale schedule data', () => {
  const booked: Slot = { ...open, status: 'booked', bookingId: 'booking-1', attendanceTutor: 'present', roomEntryPolicyActivatedAt: new Date(startMs - 35 * 60_000).toISOString() };
  const other: Slot = { ...booked, bookingId: 'booking-2' };
  expect(getRoomEntryReminderSlots([booked, other], startMs, 'booking-1').map(item => item.slot.bookingId)).toEqual(['booking-2']);
  expect(getRoomEntryReminderSlots([booked], startMs, 'unrelated-room')).toHaveLength(1);
  expect(getRoomEntryReminderSlots([booked], startMs)).toHaveLength(1);
});

test('respects recorded on-time room entry without treating early or invalid entries as confirmation', () => {
  const booked: Slot = { ...open, status: 'booked', bookingId: 'booking-1', attendanceTutor: 'present', roomEntryPolicyActivatedAt: new Date(startMs - 35 * 60_000).toISOString() };
  for (const enteredAt of [startMs - 5 * 60_000, startMs, startMs + 4 * 60_000]) {
    expect(getRoomEntryReminderSlots([{ ...booked, tutorRoomEnteredAt: new Date(enteredAt).toISOString() }], startMs + 4 * 60_000)).toHaveLength(0);
  }
  expect(getRoomEntryReminderSlots([{ ...booked, tutorRoomEnteredAt: new Date(startMs - 6 * 60_000).toISOString() }], startMs)).toHaveLength(1);
  expect(getRoomEntryReminderSlots([{ ...booked, tutorRoomEnteredAt: 'invalid' }], startMs)).toHaveLength(1);
});
