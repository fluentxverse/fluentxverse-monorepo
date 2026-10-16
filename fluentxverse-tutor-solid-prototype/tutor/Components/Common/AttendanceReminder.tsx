import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import TutorIcon from ".//TutorIcon";
import { useLocation } from "../../routing";
import { scheduleApi, type WeekSchedule } from '../../api/schedule.api';
import { useAuthContext } from '../../context/AuthContext';
import { activeClassroomBookingId, getAttendanceReminderSlots, getRoomEntryReminderSlots } from '../../utils/attendanceReminder';
import './AttendanceReminder.css';
export default function AttendanceReminder() {
    const _state0 = useAuthContext();
    const _state1 = useLocation();
    const isEmbedded = window.self !== window.top;
    const activeBookingId = createMemo(() => activeClassroomBookingId(_state1.path));
    const [slots, setSlots] = createSignal<WeekSchedule['slots']>([]);
    const [nowMs, setNowMs] = createSignal(Date.now());
    const [snoozedUntilMs, setSnoozedUntilMs] = createSignal(0);
    const [roomSnoozedUntilMs, setRoomSnoozedUntilMs] = createSignal(0);
    createEffect(on(() => [isEmbedded, _state0.isAuthenticated, _state0.user?.userId], () => {
        const _cleanup2 = untrack(() => {
            if (isEmbedded || !_state0.isAuthenticated || !_state0.user?.userId) {
                setSlots([]);
                return;
            }
            let disposed = false;
            let inFlight = false;
            const refresh = async () => {
                if (inFlight)
                    return;
                inFlight = true;
                try {
                    const schedule = await scheduleApi.getWeekSchedule(0);
                    if (!disposed)
                        setSlots(schedule.slots);
                }
                catch {
                    // A failed refresh leaves the last known slots visible until their window expires.
                }
                finally {
                    inFlight = false;
                }
            };
            const onFocus = () => {
                setNowMs(Date.now());
                if (!document.hidden)
                    void refresh();
            };
            void refresh();
            const poll = window.setInterval(() => {
                if (!document.hidden)
                    void refresh();
            }, 30000);
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
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    createEffect(on(() => [isEmbedded], () => {
        const _cleanup3 = untrack(() => {
            if (isEmbedded)
                return;
            const clock = window.setInterval(() => setNowMs(Date.now()), 15000);
            return () => window.clearInterval(clock);
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const due = createMemo(() => getAttendanceReminderSlots(slots(), nowMs()));
    const roomDue = createMemo(() => getRoomEntryReminderSlots(slots(), nowMs(), activeBookingId()));
    const next = createMemo(() => due()[0]);
    const room = createMemo(() => roomDue()[0]);
    const standbyCount = createMemo(() => due().filter(item => item.slot.attendanceSource === 'room_entry_reset').length);
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true
    });
    return createMemo(() => {
        if (isEmbedded || !_state0.isAuthenticated || (!next() && !room()))
            return null;
        return (<div class="tutor-reminder-stack">
    {room() && nowMs() >= roomSnoozedUntilMs() && (<aside class="attendance-reminder attendance-reminder--room" role="alert">
        <div class="attendance-reminder__icon" aria-hidden="true"><TutorIcon name="fas fa-video"/></div>
        <div class="attendance-reminder__body">
          <div class="attendance-reminder__title">Enter your lesson room</div>
          <p>
            Your {timeFormatter.format(room().startMs)} PHT lesson is marked Present, but you have not entered the room.
            {' '}You can enter five minutes before start. Chat and audio/video sharing begin at the scheduled time.
            If you never enter during the lesson, TA-301 applies after it ends.
          </p>
          <a class="attendance-reminder__action" target="_top" href={`/classroom/${encodeURIComponent(room().slot.bookingId!)}`}>
            Enter classroom <TutorIcon name="fas fa-arrow-right" aria-hidden="true"/>
          </a>
        </div>
        <button type="button" class="attendance-reminder__snooze" onClick={() => setRoomSnoozedUntilMs(Math.min(Date.now() + 60000, room().deadlineMs - 15000))} aria-label="Remind me again shortly" title="Remind me again shortly">
          <TutorIcon name="fas fa-times" aria-hidden="true"/>
        </button>
      </aside>)}
    {next() && nowMs() >= snoozedUntilMs() && (<aside class="attendance-reminder" role="status" aria-live="polite">
      <div class="attendance-reminder__icon" aria-hidden="true">
        <TutorIcon name="fas fa-clock"/>
      </div>
      <div class="attendance-reminder__body">
        <div class="attendance-reminder__title">
          {standbyCount() ? 'Reconfirm standby attendance' : 'Attendance needs confirmation'}
        </div>
        <p>
          {standbyCount() ? `${standbyCount()} consecutive ${standbyCount() === 1 ? 'slot was' : 'slots were'} reset after a missed room entry.`
                    : `${due().length === 1 ? 'One slot' : `${due().length} slots`} still ${due().length === 1 ? 'needs' : 'need'} a status.`}
          {' '}Next: {timeFormatter.format(next().startMs)} PHT. Deadline {next().deadlineMs - nowMs() < 60000 ? 'in less than a minute' : `in ${Math.ceil((next().deadlineMs - nowMs()) / 60000)} min`}.
        </p>
        <button type="button" class="attendance-reminder__action" onClick={() => {
                    setSnoozedUntilMs(Date.now() + 60000);
                    _state1.route('/schedule');
                }}>
          View schedule <TutorIcon name="fas fa-arrow-right" aria-hidden="true"/>
        </button>
      </div>
      <button type="button" class="attendance-reminder__snooze" onClick={() => setSnoozedUntilMs(Date.now() + 2 * 60000)} aria-label="Remind me in 2 minutes" title="Remind me in 2 minutes">
        <TutorIcon name="fas fa-times" aria-hidden="true"/>
      </button>
    </aside>)}
    </div>);
    }) as unknown as JSX.Element;
}
