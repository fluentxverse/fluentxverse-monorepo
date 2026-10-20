import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { AlertCircle, ArrowLeft, Bookmark, CalendarDays, CalendarPlus, CheckCircle2, CircleX, Clock3, Hourglass, Info, LoaderCircle, RotateCw, UserRound, Video, X } from "lucide-solid";
import { scheduleApi } from '../api/schedule.api';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import StudentLessonRecap from '../Components/StudentLessonRecap';
import ClassroomLessonSurvey from '../Components/ClassroomLessonSurvey';
import StudentLessonMaterialRequest from '../Components/StudentLessonMaterialRequest';
import StudentLessonIssueReport from '../Components/StudentLessonIssueReport';
import LessonEvidence from '../../../shared/ui/LessonEvidence';
import { lessonPrivacyApi } from '../api/lessonPrivacy.api';
import ProfileAvatar from '../Components/Common/ProfileAvatar';
import StudentDialog from '../Components/Common/StudentDialog';
import LessonJourney from '../Components/Booking/LessonJourney';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { canCancelLesson } from '../utils/lessonCancellation';
import { canJoinClassroom } from '../utils/classroomWindow';
import './LessonPage.css';
interface LessonDetails {
    paymentMethod?: string;
    bookingId: string;
    tutorId: string;
    tutorName: string;
    tutorAvatar?: string;
    tutorBio?: string;
    slotDate: string;
    slotTime: string;
    durationMinutes: number;
    status: string;
    bookedAt: Date;
    sessionId?: string;
    startsAt?: string;
    surveyReadyAt?: string | null;
}
const art = (name: string, className = '') => <img class={`lesson-art ${className}`} src={`/assets/img/home-icons/${name}-v1.webp`} alt=""/>;
const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', minute: '2-digit' });
const bookedFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'short', day: 'numeric' });
// Legacy slot date/time fields are PHT; startsAt is the authoritative instant.
function lessonStart(lesson: LessonDetails) {
    if (lesson.startsAt)
        return new Date(lesson.startsAt).getTime();
    const match = lesson.slotTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match)
        return NaN;
    let hours = Number(match[1]);
    if (match[3])
        hours = hours % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    if (hours > 23 || Number(match[2]) > 59)
        return NaN;
    return new Date(`${lesson.slotDate}T${String(hours).padStart(2, '0')}:${match[2]}:00+08:00`).getTime();
}
export const LessonPage = (_props0: {
    bookingId?: string;
}) => {
    const bookingId = createMemo(() => _props0["bookingId"] || window.location.pathname.split('/lesson/')[1]?.split('?')[0]);
    const [lesson, setLesson] = createSignal<LessonDetails | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal('');
    const [revision, setRevision] = createSignal(0);
    const [cancelModalOpen, setCancelModalOpen] = createSignal(false);
    const [cancelling, setCancelling] = createSignal(false);
    const [cancelError, setCancelError] = createSignal('');
    const [cancelSuccess, setCancelSuccess] = createSignal<{
        message: string;
        refunded: boolean;
    } | null>(null);
    const cancelBusy = { current: false } as {
        current: any;
    };
    const now = useCurrentTime();
    createEffect(on(() => [], () => {
        const _cleanup1 = untrack(() => { document.title = 'Lesson Details | FluentXVerse'; });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [bookingId(), revision()], () => {
        const _cleanup2 = untrack(() => {
            let active = true;
            setLoading(true);
            setError('');
            setLesson(null);
            setCancelSuccess(null);
            if (!bookingId()) {
                setError('Lesson not found.');
                setLoading(false);
                return;
            }
            scheduleApi.getLessonDetails(bookingId())
                .then(details => { if (active)
                setLesson(details); })
                .catch(err => { if (active)
                setError(typeof err === 'string' ? err : err.message || 'Could not load this lesson.'); })
                .finally(() => { if (active)
                setLoading(false); });
            return () => { active = false; };
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const startsAt = createMemo(() => lesson() ? lessonStart(lesson()) : NaN);
    const endsAt = createMemo(() => startsAt() + (lesson()?.durationMinutes || 25) * 60000);
    const canCancel = createMemo(() => !cancelSuccess() && canCancelLesson(lesson()?.status || '', startsAt(), now()));
    const hasEnded = createMemo(() => lesson()?.status !== 'cancelled' && now() >= endsAt());
    const canJoin = createMemo(() => !cancelSuccess() && canJoinClassroom(lesson()?.status || '', startsAt(), endsAt(), now()));
    const refundEligible = createMemo(() => now() <= startsAt() - 60 * 60000);
    const date = createMemo(() => Number.isFinite(startsAt()) ? dateFormatter.format(startsAt()) : lesson()?.slotDate);
    const time = createMemo(() => Number.isFinite(startsAt()) ? `${timeFormatter.format(startsAt())} JST` : lesson()?.slotTime);
    const bookedAt = createMemo(() => lesson() ? new Date(lesson().bookedAt).getTime() : NaN);
    createEffect(on(() => [canCancel(), cancelling()], () => {
        const _cleanup3 = untrack(() => { if (!canCancel() && !cancelling())
            setCancelModalOpen(false); });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const countdown = () => {
        if (hasEnded())
            return 'Lesson ended';
        const diff = startsAt() - now();
        if (!Number.isFinite(diff))
            return 'Time unavailable';
        if (diff <= 0)
            return 'In progress';
        const days = Math.floor(diff / 86400000);
        const remainingMinutes = Math.ceil(diff / 60000);
        const hours = Math.floor(remainingMinutes / 60) % 24;
        const minutes = remainingMinutes % 60;
        if (days)
            return `in ${days} day${days === 1 ? '' : 's'}`;
        if (hours)
            return `in ${hours} hour${hours === 1 ? '' : 's'} ${minutes} min`;
        return `in ${Math.ceil(diff / 60000)} minute${Math.ceil(diff / 60000) === 1 ? '' : 's'}`;
    };
    const closeCancel = () => { if (!cancelBusy.current)
        setCancelModalOpen(false); };
    const confirmCancel = async () => {
        if (!lesson() || cancelBusy.current)
            return;
        if (!canCancelLesson(lesson().status, startsAt())) {
            setCancelModalOpen(false);
            return;
        }
        cancelBusy.current = true;
        setCancelling(true);
        setCancelError('');
        try {
            const result = await scheduleApi.cancelBooking(lesson().bookingId);
            setCancelSuccess({ message: result.message || 'Lesson cancelled.', refunded: result.refundEligible });
            setLesson(current => current && ({ ...current, status: 'cancelled' }));
            setCancelModalOpen(false);
        }
        catch (err: any) {
            setCancelError(typeof err === 'string' ? err : err.message || 'Could not cancel this lesson. Please try again.');
        }
        finally {
            cancelBusy.current = false;
            setCancelling(false);
        }
    };
    return <>
    <SideBar />
    <div class="student-lesson-shell">
      <Header />
      <main class="lesson-page">
        <div class="lesson-inner">
          <header class="lesson-page-header">
            <div class="lesson-page-header-left">
              {art('training', 'lesson-heading-art')}
              <div><h1>Lesson details</h1>
                {lesson() ? <p class="lesson-page-subtitle"><span class={`lesson-status-dot ${lesson().status}`}/><span>{lesson().status.charAt(0).toUpperCase() + lesson().status.slice(1)}{lesson().status === 'confirmed' && ` · ${countdown()}`}</span></p>
            : <p class="lesson-page-subtitle">Your lesson space</p>}
              </div>
            </div>
            <a href="/schedule" class="lesson-back-link"><ArrowLeft size={17}/>Back to Schedule</a>
          </header>
          {loading() ? <div class="lesson-state" role="status">{art('schedule')}<LoaderCircle class="lesson-spin" size={22}/><p>Loading lesson details...</p></div>
            : error() || !lesson() ? <div class="lesson-state" role="alert">{art('issue')}<h2>Unable to load lesson</h2><p>{error() || 'Lesson not found.'}</p><button class="lesson-secondary" onClick={() => setRevision(value => value + 1)}><RotateCw size={17}/>Try again</button></div>
                : <>
              {cancelSuccess() && <div class="lesson-notification" role="status"><CheckCircle2 size={20}/><span>{cancelSuccess().message}{cancelSuccess().refunded && ' Your ticket has been refunded.'}</span></div>}
              {lesson().status !== 'cancelled' && <LessonJourney active={hasEnded() ? 'feedback' : canJoin() ? 'classroom' : 'prepare'}/>}
              <div class="lesson-grid">
                <section class="lesson-detail-card lesson-overview-card" aria-labelledby="lesson-tutor-title">
                  <header class="lesson-card-heading">{art('profile')}<h2 id="lesson-tutor-title">Your tutor</h2></header>
                  <div class="lesson-tutor-profile">
                    <ProfileAvatar src={lesson().tutorAvatar} alt={lesson().tutorName} className="lesson-tutor-avatar" fallback={<UserRound size={30}/>}/>
                    <div class="lesson-tutor-info"><h3>{lesson().tutorName}</h3>{lesson().tutorBio && <p>{lesson().tutorBio}</p>}
                      <a href={`/tutor/${encodeURIComponent(lesson().tutorId)}`} class="lesson-secondary"><UserRound size={16}/>View Profile</a>
                    </div>
                  </div>
                  <div class="lesson-schedule-heading">{art('schedule')}<h3>Schedule</h3></div>
                  <dl class="lesson-schedule-details">
                    <div><dt><CalendarDays size={16}/>Date</dt><dd>{date()}</dd></div>
                    <div><dt><Clock3 size={16}/>Time</dt><dd>{time()}</dd></div>
                    <div><dt><Hourglass size={16}/>Duration</dt><dd>{lesson().durationMinutes} minutes</dd></div>
                    <div><dt><Bookmark size={16}/>Booked</dt><dd>{Number.isFinite(bookedAt()) ? bookedFormatter.format(bookedAt()) : 'Not available'}</dd></div>
                  </dl>
                  {canCancel() && <button class="lesson-cancel-action" onClick={() => { if (canCancelLesson(lesson().status, startsAt())) {
                    setCancelError('');
                    setCancelModalOpen(true);
                } }}><CircleX size={17}/>Cancel Lesson</button>}
                </section>
                <section class="lesson-detail-card lesson-classroom-card" aria-labelledby="lesson-classroom-title">
                  <header class="lesson-card-heading">{art('classroom')}<h2 id="lesson-classroom-title">Classroom</h2></header>
                  <div class="lesson-classroom-content">
                    {art(canJoin() ? 'classroom' : lesson().status === 'cancelled' ? 'schedule' : hasEnded() || lesson().status === 'completed' ? 'training' : 'schedule', 'lesson-classroom-art')}
                    <h3>{canJoin() ? hasEnded() ? 'Lesson wrap-up' : now() < startsAt() ? 'Your classroom is open' : 'Ready to join' : lesson().status === 'cancelled' ? 'Lesson cancelled' : hasEnded() || lesson().status === 'completed' ? 'Lesson ended' : 'Your lesson is coming up'}</h3>
                    <p>{canJoin() ? hasEnded() ? 'You can stay for up to three minutes after the lesson.' : now() < startsAt() ? 'Settle in now. Audio, video, and chat start at your scheduled time.' : 'Join your lesson in the classroom.'
                        : lesson().status === 'cancelled' ? 'This lesson is no longer available.'
                            : hasEnded() || lesson().status === 'completed' ? "Your lesson is finished. Review your notes below."
                                : 'The classroom opens five minutes before your lesson.'}</p>
                    {canJoin() ? <button class="lesson-primary" onClick={() => { if (canJoinClassroom(lesson().status, startsAt(), endsAt()))
                        window.open(`/classroom/${encodeURIComponent(lesson().sessionId || bookingId()!)}`, '_blank', 'noopener,noreferrer'); }}><Video size={19}/>Enter Classroom</button>
                        : lesson().status === 'cancelled' ? <a class="lesson-secondary" href="/schedule"><CalendarDays size={18}/>Back to Schedule</a>
                            : hasEnded() || lesson().status === 'completed' ? <a class="lesson-primary" href="/browse-tutors"><CalendarPlus size={18}/>Book Another Lesson</a>
                                : <div class="lesson-countdown"><span>Starts</span><strong>{countdown()}</strong></div>}
                  </div>
                  <div class="lesson-classroom-extras">
                    <StudentLessonMaterialRequest bookingId={bookingId()!}/>
                    {(hasEnded() || (lesson().status !== 'cancelled' && lesson().surveyReadyAt)) && <ClassroomLessonSurvey bookingId={bookingId()!} placement="lesson"/>}
                  </div>
                </section>
              </div>
              <StudentLessonIssueReport bookingId={bookingId()!}/>
              <StudentLessonRecap bookingId={bookingId()!}/>
              <LessonEvidence bookingId={bookingId()!} role="student" api={lessonPrivacyApi}/>
            </>}
        </div>
      </main>
      {cancelModalOpen() && lesson() && <StudentDialog className="lesson-cancel-dialog" label="Cancel lesson?" onClose={closeCancel} busy={cancelling()}>
          <header><h2 id="lesson-cancel-title">Cancel lesson?</h2><button class="lesson-dialog-close" aria-label="Close cancellation" title="Close cancellation" disabled={cancelling()} onClick={closeCancel} autofocus><X size={20}/></button></header>
          <div class="lesson-cancel-body">
            <div class="lesson-cancel-summary">{art('schedule')}<div><strong>{lesson().tutorName}</strong><p>{date()}</p><p>{time()} · {lesson().durationMinutes} minutes</p></div></div>
            <div class={`lesson-refund-notice ${refundEligible() ? 'eligible' : ''}`}>{refundEligible() ? <CheckCircle2 size={20}/> : <Info size={20}/>}<div><strong>{lesson().paymentMethod === 'trial' ? refundEligible() ? 'Your trial will be available again' : 'Your trial allowance remains used' : refundEligible() ? 'Your credit will be refunded' : 'No credit refund'}</strong><p>{refundEligible() ? 'You are cancelling at least one hour before the lesson.' : lesson().paymentMethod === 'trial' ? 'Cancelling within one hour of the lesson uses your trial allowance.' : 'Cancellations within one hour of the lesson are not eligible for a refund.'}</p></div></div>
            <p id="lesson-cancel-warning">This cancellation cannot be undone.</p>
            {cancelError() && <p class="lesson-cancel-error" role="alert"><AlertCircle size={18}/>{cancelError()}</p>}
          </div>
          <footer><button class="fxv-button fxv-button--secondary lesson-secondary" disabled={cancelling()} onClick={closeCancel}>Keep Lesson</button><button class="fxv-button lesson-danger" disabled={cancelling()} onClick={confirmCancel}>{cancelling() ? <LoaderCircle size={17} class="lesson-spin"/> : <CircleX size={17}/>}{cancelling() ? 'Cancelling...' : 'Cancel Lesson'}</button></footer>
      </StudentDialog>}
    </div>
  </>;
};
export default LessonPage;
