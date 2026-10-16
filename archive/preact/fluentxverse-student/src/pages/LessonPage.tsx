import { useEffect, useRef, useState } from 'preact/hooks';
import { AlertCircle, ArrowLeft, Bookmark, CalendarDays, CalendarPlus, CheckCircle2, CircleX, Clock3, Hourglass, Info, LoaderCircle, RotateCw, UserRound, Video, X } from 'lucide-preact';
import { scheduleApi } from '../api/schedule.api';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import StudentLessonRecap from '../Components/StudentLessonRecap';
import ClassroomLessonSurvey from '../Components/ClassroomLessonSurvey';
import StudentLessonMaterialRequest from '../Components/StudentLessonMaterialRequest';
import StudentLessonIssueReport from '../Components/StudentLessonIssueReport';
import ProfileAvatar from '../Components/Common/ProfileAvatar';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { canCancelLesson } from '../utils/lessonCancellation';
import { canJoinClassroom } from '../utils/classroomWindow';
import './LessonPage.css';

interface LessonDetails {
  bookingId: string; tutorId: string; tutorName: string; tutorAvatar?: string; tutorBio?: string;
  slotDate: string; slotTime: string; durationMinutes: number; status: string; bookedAt: Date;
  sessionId?: string; startsAt?: string; surveyReadyAt?: string | null;
}

const art = (name: string, className = '') => <img className={`lesson-art ${className}`} src={`/assets/img/home-icons/${name}-v1.webp`} alt="" />;
const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', minute: '2-digit' });
const bookedFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'short', day: 'numeric' });

// Legacy slot date/time fields are PHT; startsAt is the authoritative instant.
function lessonStart(lesson: LessonDetails) {
  if (lesson.startsAt) return new Date(lesson.startsAt).getTime();
  const match = lesson.slotTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return NaN;
  let hours = Number(match[1]);
  if (match[3]) hours = hours % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  if (hours > 23 || Number(match[2]) > 59) return NaN;
  return new Date(`${lesson.slotDate}T${String(hours).padStart(2, '0')}:${match[2]}:00+08:00`).getTime();
}

export const LessonPage = ({ bookingId: propBookingId }: { bookingId?: string }) => {
  const bookingId = propBookingId || window.location.pathname.split('/lesson/')[1]?.split('?')[0];
  const [lesson, setLesson] = useState<LessonDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState<{ message: string; refunded: boolean } | null>(null);
  const modal = useRef<HTMLDivElement>(null);
  const cancelBusy = useRef(false);
  const now = useCurrentTime();

  useEffect(() => { document.title = 'Lesson Details | FluentXVerse'; }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setLesson(null); setCancelSuccess(null);
    if (!bookingId) { setError('Lesson not found.'); setLoading(false); return; }
    scheduleApi.getLessonDetails(bookingId)
      .then(details => { if (active) setLesson(details); })
      .catch(err => { if (active) setError(typeof err === 'string' ? err : err.message || 'Could not load this lesson.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId, revision]);

  const startsAt = lesson ? lessonStart(lesson) : NaN;
  const endsAt = startsAt + (lesson?.durationMinutes || 25) * 60_000;
  const canCancel = !cancelSuccess && canCancelLesson(lesson?.status || '', startsAt, now);
  const hasEnded = lesson?.status !== 'cancelled' && now >= endsAt;
  const canJoin = !cancelSuccess && canJoinClassroom(lesson?.status || '', startsAt, endsAt, now);
  const refundEligible = now < startsAt - 60 * 60_000;
  const date = Number.isFinite(startsAt) ? dateFormatter.format(startsAt) : lesson?.slotDate;
  const time = Number.isFinite(startsAt) ? `${timeFormatter.format(startsAt)} JST` : lesson?.slotTime;
  const bookedAt = lesson ? new Date(lesson.bookedAt).getTime() : NaN;

  useEffect(() => { if (!canCancel && !cancelling) setCancelModalOpen(false); }, [canCancel, cancelling]);
  useEffect(() => {
    if (!cancelModalOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modal.current?.querySelector<HTMLButtonElement>('.lesson-dialog-close')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !cancelBusy.current) setCancelModalOpen(false);
      if (event.key !== 'Tab') return;
      const controls = [...(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') || [])];
      if (!controls.length) { event.preventDefault(); return; }
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); previousFocus?.focus(); };
  }, [cancelModalOpen]);

  const countdown = () => {
    if (hasEnded) return 'Lesson ended';
    const diff = startsAt - now;
    if (!Number.isFinite(diff)) return 'Time unavailable';
    if (diff <= 0) return 'In progress';
    const days = Math.floor(diff / 86_400_000);
    const remainingMinutes = Math.ceil(diff / 60_000);
    const hours = Math.floor(remainingMinutes / 60) % 24;
    const minutes = remainingMinutes % 60;
    if (days) return `in ${days} day${days === 1 ? '' : 's'}`;
    if (hours) return `in ${hours} hour${hours === 1 ? '' : 's'} ${minutes} min`;
    return `in ${Math.ceil(diff / 60_000)} minute${Math.ceil(diff / 60_000) === 1 ? '' : 's'}`;
  };

  const closeCancel = () => { if (!cancelBusy.current) setCancelModalOpen(false); };
  const confirmCancel = async () => {
    if (!lesson || cancelBusy.current) return;
    if (!canCancelLesson(lesson.status, startsAt)) { setCancelModalOpen(false); return; }
    cancelBusy.current = true; setCancelling(true); setCancelError('');
    try {
      const result = await scheduleApi.cancelBooking(lesson.bookingId);
      setCancelSuccess({ message: result.message || 'Lesson cancelled.', refunded: result.refundEligible });
      setLesson(current => current && ({ ...current, status: 'cancelled' }));
      setCancelModalOpen(false);
    } catch (err: any) {
      setCancelError(typeof err === 'string' ? err : err.message || 'Could not cancel this lesson. Please try again.');
    } finally { cancelBusy.current = false; setCancelling(false); }
  };

  return <>
    <SideBar />
    <div className="student-lesson-shell">
      <Header />
      <main className="lesson-page">
        <div className="lesson-inner">
          <header className="lesson-page-header">
            <div className="lesson-page-header-left">
              {art('training', 'lesson-heading-art')}
              <div><h1>Lesson details</h1>
                {lesson ? <p className="lesson-page-subtitle"><span className={`lesson-status-dot ${lesson.status}`} /><span>{lesson.status.charAt(0).toUpperCase() + lesson.status.slice(1)}{lesson.status === 'confirmed' && ` · ${countdown()}`}</span></p>
                  : <p className="lesson-page-subtitle">Your lesson space</p>}
              </div>
            </div>
            <a href="/schedule" className="lesson-back-link"><ArrowLeft size={17} />Back to Schedule</a>
          </header>
          {loading ? <div className="lesson-state" role="status">{art('schedule')}<LoaderCircle className="lesson-spin" size={22} /><p>Loading lesson details...</p></div>
            : error || !lesson ? <div className="lesson-state" role="alert">{art('community')}<h2>Unable to load lesson</h2><p>{error || 'Lesson not found.'}</p><button className="lesson-secondary" onClick={() => setRevision(value => value + 1)}><RotateCw size={17} />Try again</button></div>
            : <>
              {cancelSuccess && <div className="lesson-notification" role="status"><CheckCircle2 size={20} /><span>{cancelSuccess.message}{cancelSuccess.refunded && ' Your ticket has been refunded.'}</span></div>}
              <div className="lesson-grid">
                <section className="lesson-detail-card lesson-overview-card" aria-labelledby="lesson-tutor-title">
                  <header className="lesson-card-heading">{art('community')}<h2 id="lesson-tutor-title">Your tutor</h2></header>
                  <div className="lesson-tutor-profile">
                    <ProfileAvatar src={lesson.tutorAvatar} alt={lesson.tutorName} className="lesson-tutor-avatar" fallback={<UserRound size={30} />} />
                    <div className="lesson-tutor-info"><h3>{lesson.tutorName}</h3>{lesson.tutorBio && <p>{lesson.tutorBio}</p>}
                      <a href={`/tutor/${encodeURIComponent(lesson.tutorId)}`} className="lesson-secondary"><UserRound size={16} />View Profile</a>
                    </div>
                  </div>
                  <div className="lesson-schedule-heading">{art('schedule')}<h3>Schedule</h3></div>
                  <dl className="lesson-schedule-details">
                    <div><dt><CalendarDays size={16} />Date</dt><dd>{date}</dd></div>
                    <div><dt><Clock3 size={16} />Time</dt><dd>{time}</dd></div>
                    <div><dt><Hourglass size={16} />Duration</dt><dd>{lesson.durationMinutes} minutes</dd></div>
                    <div><dt><Bookmark size={16} />Booked</dt><dd>{Number.isFinite(bookedAt) ? bookedFormatter.format(bookedAt) : 'Not available'}</dd></div>
                  </dl>
                  {canCancel && <button className="lesson-cancel-action" onClick={() => { if (canCancelLesson(lesson.status, startsAt)) { setCancelError(''); setCancelModalOpen(true); } }}><CircleX size={17} />Cancel Lesson</button>}
                </section>
                <section className="lesson-detail-card lesson-classroom-card" aria-labelledby="lesson-classroom-title">
                  <header className="lesson-card-heading">{art('home')}<h2 id="lesson-classroom-title">Classroom</h2></header>
                  <div className="lesson-classroom-content">
                    {art(canJoin ? 'community' : lesson.status === 'cancelled' ? 'schedule' : hasEnded || lesson.status === 'completed' ? 'training' : 'schedule', 'lesson-classroom-art')}
                    <h3>{canJoin ? hasEnded ? 'Lesson wrap-up' : now < startsAt ? 'Your classroom is open' : 'Ready to join' : lesson.status === 'cancelled' ? 'Lesson cancelled' : hasEnded || lesson.status === 'completed' ? 'Lesson ended' : 'Your lesson is coming up'}</h3>
                    <p>{canJoin ? hasEnded ? 'You can stay for up to three minutes after the lesson.' : now < startsAt ? 'Settle in now. Audio, video, and chat start at your scheduled time.' : 'Join your lesson in the classroom.'
                      : lesson.status === 'cancelled' ? 'This lesson is no longer available.'
                        : hasEnded || lesson.status === 'completed' ? "Your lesson is finished. Review your notes below."
                          : 'The classroom opens five minutes before your lesson.'}</p>
                    {canJoin ? <button className="lesson-primary" onClick={() => { if (canJoinClassroom(lesson.status, startsAt, endsAt)) window.open(`/classroom/${encodeURIComponent(lesson.sessionId || bookingId!)}`, '_blank', 'noopener,noreferrer'); }}><Video size={19} />Enter Classroom</button>
                      : lesson.status === 'cancelled' ? <a className="lesson-secondary" href="/schedule"><CalendarDays size={18} />Back to Schedule</a>
                        : hasEnded || lesson.status === 'completed' ? <a className="lesson-primary" href="/browse-tutors"><CalendarPlus size={18} />Book Another Lesson</a>
                          : <div className="lesson-countdown"><span>Starts</span><strong>{countdown()}</strong></div>}
                  </div>
                  <div className="lesson-classroom-extras">
                    <StudentLessonMaterialRequest key={`request-${bookingId}-${lesson.status}`} bookingId={bookingId!} />
                    {(hasEnded || (lesson.status !== 'cancelled' && lesson.surveyReadyAt)) && <ClassroomLessonSurvey key={`survey-${bookingId}`} bookingId={bookingId!} placement="lesson" />}
                  </div>
                </section>
              </div>
              <StudentLessonIssueReport key={`report-${bookingId}-${lesson.status}`} bookingId={bookingId!} />
              <StudentLessonRecap key={`${bookingId}-${lesson.status}`} bookingId={bookingId!} />
            </>}
        </div>
      </main>
      {cancelModalOpen && lesson && <div className="lesson-cancel-overlay" onClick={closeCancel}>
        <div className="lesson-cancel-dialog" ref={modal} role="dialog" aria-modal="true" aria-labelledby="lesson-cancel-title" aria-describedby="lesson-cancel-warning" onClick={event => event.stopPropagation()}>
          <header><h2 id="lesson-cancel-title">Cancel lesson?</h2><button className="lesson-dialog-close" aria-label="Close cancellation" title="Close cancellation" disabled={cancelling} onClick={closeCancel}><X size={20} /></button></header>
          <div className="lesson-cancel-body">
            <div className="lesson-cancel-summary">{art('schedule')}<div><strong>{lesson.tutorName}</strong><p>{date}</p><p>{time} · {lesson.durationMinutes} minutes</p></div></div>
            <div className={`lesson-refund-notice ${refundEligible ? 'eligible' : ''}`}>{refundEligible ? <CheckCircle2 size={20} /> : <Info size={20} />}<div><strong>{refundEligible ? 'Your ticket will be refunded' : 'No ticket refund'}</strong><p>{refundEligible ? 'You are cancelling more than one hour before the lesson.' : 'Cancellations within one hour of the lesson are not eligible for a refund.'}</p></div></div>
            <p id="lesson-cancel-warning">This cancellation cannot be undone.</p>
            {cancelError && <p className="lesson-cancel-error" role="alert"><AlertCircle size={18} />{cancelError}</p>}
          </div>
          <footer><button className="lesson-secondary" disabled={cancelling} onClick={closeCancel}>Keep Lesson</button><button className="lesson-danger" disabled={cancelling} onClick={confirmCancel}>{cancelling ? <LoaderCircle size={17} className="lesson-spin" /> : <CircleX size={17} />}{cancelling ? 'Cancelling...' : 'Cancel Lesson'}</button></footer>
        </div>
      </div>}
    </div>
  </>;
};

export default LessonPage;
