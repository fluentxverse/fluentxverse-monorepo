import { createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js';
import { ArrowRight, CalendarDays, CircleAlert, ClipboardList, Clock3, FilePenLine, LockKeyhole, RotateCw } from 'lucide-solid';
import { useAuthContext } from '../../context/AuthContext';
import { scheduleApi, type WeekSchedule } from '../../api/schedule.api';
import { lessonWorkflowApi } from '../../api/lessonWorkflow.api';
import { currentPhtMonth } from '../../api/performance.api';
import { getTutorLessonIssues, type TutorLessonIssues } from '../../api/lessonIssues.api';
import { getAttendanceReminderSlots, getRoomEntryReminderSlots } from '../../utils/attendanceReminder';
import { activeSchedulingBlock, noteTaskStatus, teachingSlotTime, upcomingTeachingSlots, type PendingLessonNote } from '../../utils/teachingDesk';
import StatusPanel from '../../../../shared/ui/StatusPanel';
import './TeachingDesk.css';

const date = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' });
const time = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

export default function TeachingDesk() {
    const auth = useAuthContext();
    const [weeks, setWeeks] = createSignal<WeekSchedule[] | null>(null);
    const [notes, setNotes] = createSignal<PendingLessonNote[] | null>(null);
    const [issues, setIssues] = createSignal<TutorLessonIssues[] | null>(null);
    const [failures, setFailures] = createSignal<string[]>([]);
    const [loading, setLoading] = createSignal(false);
    const [updated, setUpdated] = createSignal<number | null>(null);
    const [revision, setRevision] = createSignal(0);
    const [view, setView] = createSignal<'lessons' | 'notes' | 'issues'>('lessons');
    const [now, setNow] = createSignal(Date.now());
    createEffect(on(() => auth.user?.userId, () => { setWeeks(null); setNotes(null); setIssues(null); setUpdated(null); }));
    createEffect(on(() => [auth.user?.userId, revision()] as const, ([userId]) => {
        if (!userId) return;
        const controller = new AbortController();
        setLoading(true); setFailures([]);
        const failed: string[] = [];
        const tasks = [
            Promise.all([scheduleApi.getWeekSchedule(0, controller.signal), scheduleApi.getWeekSchedule(1, controller.signal)])
                .then(value => { if (!controller.signal.aborted) setWeeks(value); }).catch(() => { failed.push('schedule'); }),
            lessonWorkflowApi.pending(controller.signal).then(value => { if (!controller.signal.aborted) setNotes(value); }).catch(() => { failed.push('lesson notes'); }),
            Promise.all((['sent', 'received'] as const).flatMap(direction => (['submitted', 'under_review'] as const)
                .map(status => getTutorLessonIssues('all', currentPhtMonth(), direction, status, 1, controller.signal))))
                .then(value => { if (!controller.signal.aborted) setIssues(value); }).catch(() => { failed.push('lesson issues'); }),
        ];
        void Promise.all(tasks).then(() => {
            if (controller.signal.aborted) return;
            setFailures(failed); setLoading(false);
            if (!failed.length) setUpdated(Date.now());
        });
        onCleanup(() => controller.abort());
    }));
    createEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 30000);
        const refresh = () => { if (!document.hidden) { setNow(Date.now()); setRevision(value => value + 1); } };
        window.addEventListener('online', refresh);
        window.addEventListener('focus', refresh);
        onCleanup(() => { clearInterval(timer); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); });
    });
    const booked = createMemo(() => upcomingTeachingSlots(weeks() || [], now()));
    const block = createMemo(() => activeSchedulingBlock(weeks() || [], now()));
    const attendance = createMemo(() => getAttendanceReminderSlots((weeks() || []).flatMap(week => week.slots), now()));
    const entry = createMemo(() => getRoomEntryReminderSlots((weeks() || []).flatMap(week => week.slots), now()));
    const pending = createMemo(() => (notes() || []).filter(note => !['submitted', 'not_required'].includes(note.notesStatus))
        .sort((a, b) => Date.parse(a.editableUntil) - Date.parse(b.editableUntil)));
    const issueCount = createMemo(() => issues() ? [...new Map(issues()!.map(source => [source.direction, source.statusCounts])).values()]
        .reduce((count, counts) => count + counts.submitted + counts.under_review, 0) : undefined);
    const reports = createMemo(() => (issues() || []).flatMap(source => source.items).filter(issue => issue.status !== 'resolved')
        .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')));
    return <section class="teaching-desk" aria-labelledby="teaching-desk-title" aria-busy={loading()}>
        <header class="teaching-desk-heading"><div><span>{date.format(now())} / Philippine time</span><h2 id="teaching-desk-title">Teaching Desk</h2></div>
            <div><span>{loading() ? 'Refreshing...' : updated() ? `Updated ${time.format(updated()!)}` : 'Not yet updated'}</span><button type="button" class="fxv-button fxv-button--secondary" title="Refresh teaching tasks" aria-label="Refresh teaching tasks" disabled={loading()} onClick={() => setRevision(value => value + 1)}><RotateCw size={17}/></button></div>
        </header>
        {block() && <div class="teaching-desk-block" role="alert"><LockKeyhole size={20}/><div><strong>Opening new slots is temporarily restricted</strong><p>{block()!.expiresAt ? `Until ${date.format(Date.parse(block()!.expiresAt!))}, ${time.format(Date.parse(block()!.expiresAt!))} PHT.` : 'Contact support to review this restriction.'} Existing lessons still need your attention.</p></div><a href="/contact">Contact support<ArrowRight size={15}/></a></div>}
        {(attendance().length > 0 || entry().length > 0) && <div class="teaching-desk-urgent" role="status"><Clock3 size={19}/><span>{entry().length ? 'A confirmed lesson needs classroom entry now.' : `${attendance().length} slot${attendance().length === 1 ? ' needs' : 's need'} attendance confirmation before the deadline.`}</span><a href={entry().length ? `/classroom/${encodeURIComponent(entry()[0].slot.bookingId!)}` : '/schedule'}>{entry().length ? 'Enter classroom' : 'Review attendance'}<ArrowRight size={15}/></a></div>}
        <nav class="teaching-desk-tabs" aria-label="Teaching tasks">{([
            ['lessons', 'Upcoming lessons', weeks() ? booked().length : null, CalendarDays],
            ['notes', 'Lesson notes', notes() ? pending().length : null, FilePenLine],
            ['issues', 'Lesson issues', issueCount() ?? null, CircleAlert],
        ] as const).map(([value, label, count, Icon]) => <button type="button" aria-pressed={view() === value} onClick={() => setView(value)}><Icon size={17}/><span>{label}</span><strong>{count ?? '--'}</strong></button>)}</nav>
        {failures().length > 0 && <StatusPanel compact kind="error" title={`Could not refresh ${failures().join(', ')}`} message="Previously loaded tasks are kept until a refresh succeeds." onRetry={() => setRevision(value => value + 1)}/>}
        {loading() && !weeks() && !notes() && !issues() && <StatusPanel kind="loading" title="Loading teaching tasks..."/>}
        {view() === 'lessons' && weeks() && <div class="teaching-desk-list">{!booked().length ? <StatusPanel kind="empty" title="No booked lessons in the next seven days" message="Your open slots are available on your schedule."/> : booked().slice(0, 6).map(slot => <a class="teaching-desk-row" href={`/lesson/${encodeURIComponent(slot.bookingId!)}`}><CalendarDays size={19}/><div><strong>{slot.studentName || 'Booked lesson'}</strong><span>{date.format(teachingSlotTime(slot))}, {time.format(teachingSlotTime(slot))} PHT</span></div><span class="teaching-desk-state">{teachingSlotTime(slot) <= now() ? 'In progress' : 'Open lesson'}</span><ArrowRight size={17}/></a>)}<a class="teaching-desk-more" href="/schedule">View full schedule<ArrowRight size={16}/></a></div>}
        {view() === 'notes' && notes() && <div class="teaching-desk-list">{!pending().length ? <StatusPanel kind="empty" title="No outstanding lesson notes"/> : pending().slice(0, 8).map(note => <a class="teaching-desk-row" href={`/lesson/${encodeURIComponent(note.bookingId)}`}><ClipboardList size={19}/><div><strong>{note.studentName || 'Lesson notes'}</strong><span>{Number.isFinite(Date.parse(note.editableUntil)) ? `Submission window ends ${date.format(Date.parse(note.editableUntil))}, ${time.format(Date.parse(note.editableUntil))} PHT` : 'Open the lesson to check submission availability'}</span></div><span class={`teaching-desk-state ${noteTaskStatus(note, now()) === 'due' ? 'is-due' : ''}`}>{noteTaskStatus(note, now()) === 'closed' ? 'Window closed' : noteTaskStatus(note, now()) === 'due' ? 'Needs submission' : 'Upcoming'}</span><ArrowRight size={17}/></a>)}</div>}
        {view() === 'issues' && issues() && <div class="teaching-desk-list">{!issueCount() ? <StatusPanel kind="empty" title="No unresolved lesson issues"/> : reports().slice(0, 6).map(issue => <a class="teaching-desk-row" href={`/lesson/${encodeURIComponent(issue.bookingId)}`}><CircleAlert size={19}/><div><strong>{issue.issueLabel || issue.reasonLabel}</strong><span>{issue.direction === 'received' ? 'Received report' : 'Sent report'}{issue.createdAt && Number.isFinite(Date.parse(issue.createdAt)) ? ` / ${date.format(Date.parse(issue.createdAt))}` : ''}</span></div><span class="teaching-desk-state">{issue.status === 'under_review' ? 'Under review' : 'Submitted'}</span><ArrowRight size={17}/></a>)}<a class="teaching-desk-more" href="/performance-metrics?period=all#issues">View all lesson issues<ArrowRight size={16}/></a></div>}
    </section>;
}
