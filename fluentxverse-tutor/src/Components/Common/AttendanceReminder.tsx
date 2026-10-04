import { useEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { scheduleApi, type WeekSchedule } from '../../api/schedule.api';
import { useAuthContext } from '../../context/AuthContext';
import { getAttendanceReminderSlots, getRoomEntryReminderSlots } from '../../utils/attendanceReminder';
import './AttendanceReminder.css';

export default function AttendanceReminder() {
  const { isAuthenticated, user } = useAuthContext();
  const { route } = useLocation();
  const [slots, setSlots] = useState<WeekSchedule['slots']>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [snoozedUntilMs, setSnoozedUntilMs] = useState(0);
  const [roomSnoozedUntilMs, setRoomSnoozedUntilMs] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !user?.userId) {
      setSlots([]);
      return;
    }

    let disposed = false;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const schedule = await scheduleApi.getWeekSchedule(0);
        if (!disposed) setSlots(schedule.slots);
      } catch {
        // A failed refresh leaves the last known slots visible until their window expires.
      } finally {
        inFlight = false;
      }
    };
    const onFocus = () => {
      setNowMs(Date.now());
      if (!document.hidden) void refresh();
    };
    void refresh();
    const poll = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30_000);
    window.addEventListener('focus', onFocus);
    window.addEventListener('fxv:tutor-schedule-updated', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      disposed = true;
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('fxv:tutor-schedule-updated', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [isAuthenticated, user?.userId]);

  useEffect(() => {
    const clock = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(clock);
  }, []);

  const due = getAttendanceReminderSlots(slots, nowMs);
  const roomDue = getRoomEntryReminderSlots(slots, nowMs);
  const next = due[0];
  const room = roomDue[0];
  const standbyCount = due.filter(item => item.slot.attendanceSource === 'room_entry_reset').length;
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true
  });
  if (!isAuthenticated || (!next && !room)) return null;

  return (
    <div className="tutor-reminder-stack">
    {room && nowMs >= roomSnoozedUntilMs && (
      <aside className="attendance-reminder attendance-reminder--room" role="alert">
        <div className="attendance-reminder__icon" aria-hidden="true"><i className="fas fa-video" /></div>
        <div className="attendance-reminder__body">
          <div className="attendance-reminder__title">Enter your lesson room</div>
          <p>
            Your {timeFormatter.format(room.startMs)} PHT lesson is marked Present, but you have not entered the room.
            {' '}Join by {timeFormatter.format(room.deadlineMs)} PHT. Missing that deadline marks this booking absent (TA-301)
            and resets later consecutive Present slots to standby for reconfirmation.
          </p>
          <button type="button" className="attendance-reminder__action"
            onClick={() => route(`/classroom/${room.slot.bookingId}`)}>
            Enter classroom <i className="fas fa-arrow-right" aria-hidden="true" />
          </button>
        </div>
        <button type="button" className="attendance-reminder__snooze"
          onClick={() => setRoomSnoozedUntilMs(Math.min(Date.now() + 60_000, room.deadlineMs - 15_000))}
          aria-label="Remind me again shortly" title="Remind me again shortly">
          <i className="fas fa-times" aria-hidden="true" />
        </button>
      </aside>
    )}
    {next && nowMs >= snoozedUntilMs && (
    <aside className="attendance-reminder" role="status" aria-live="polite">
      <div className="attendance-reminder__icon" aria-hidden="true">
        <i className="fas fa-clock" />
      </div>
      <div className="attendance-reminder__body">
        <div className="attendance-reminder__title">
          {standbyCount ? 'Reconfirm standby attendance' : 'Attendance needs confirmation'}
        </div>
        <p>
          {standbyCount
            ? `${standbyCount} consecutive ${standbyCount === 1 ? 'slot was' : 'slots were'} reset after a missed room entry.`
            : `${due.length === 1 ? 'One slot' : `${due.length} slots`} still ${due.length === 1 ? 'needs' : 'need'} a status.`}
          {' '}Next: {timeFormatter.format(next.startMs)} PHT. Deadline {next.deadlineMs - nowMs < 60_000 ? 'in less than a minute' : `in ${Math.ceil((next.deadlineMs - nowMs) / 60_000)} min`}.
        </p>
        <button
          type="button"
          className="attendance-reminder__action"
          onClick={() => {
            setSnoozedUntilMs(Date.now() + 60_000);
            route('/schedule');
          }}
        >
          View schedule <i className="fas fa-arrow-right" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        className="attendance-reminder__snooze"
        onClick={() => setSnoozedUntilMs(Date.now() + 2 * 60_000)}
        aria-label="Remind me in 2 minutes"
        title="Remind me in 2 minutes"
      >
        <i className="fas fa-times" aria-hidden="true" />
      </button>
    </aside>
    )}
    </div>
  );
}
