import { createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js';
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, ChevronUp, CircleAlert, Maximize2, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-solid';
import { useAuthContext } from '../../context/AuthContext';
import { useThemeStore } from '../../context/ThemeContext';
import { getTutorPerformance } from '../../api/performance.api';
import { firstLessonProgress, type FirstLessonProgress } from '../../utils/firstLessonGuide';
import TutorDialog from '../Common/TutorDialog';
import './FirstLessonGuide.css';

const steps = [
    {
        label: 'Choose times', title: 'Choose your available times', image: 'choose-times',
        alt: 'Schedule screenshot: a selected time is marked 1, and Confirm Selection is marked 2.',
        instructions: [
            'Open My schedule, choose the week and Morning, Afternoon, or Evening, then click the AVAILABLE times you can teach.',
            'Click Confirm Selection after choosing your times.',
        ],
        note: 'All schedule times are in Philippine Time (PHT). Choose slots at least 11 minutes ahead.',
    },
    {
        label: 'Open slots', title: 'Confirm your open slots', image: 'open-slots',
        alt: 'Confirmation screenshot: the Open 1 Slot button is marked 1.',
        instructions: ['Check the selected times, then click Open 1 Slot. The number on this button changes when you select several slots.'],
        note: 'The time changes to OPEN. It becomes bookable once you confirm Present.',
    },
    {
        label: 'Attendance', title: 'Select a slot for attendance', image: 'select-attendance',
        alt: 'Schedule screenshot: an open slot selected for attendance is marked 1, and Update Attendance is marked 2.',
        instructions: [
            'Between 35 and 11 minutes before the first selected slot, click the OPEN time you are ready to teach.',
            'Click Update Attendance. For an already booked lesson, select the clipboard beside the student ID instead.',
        ],
        note: 'For a 10:00 AM slot, confirm between 9:25 and 9:49 AM PHT. Outside that window, the attendance control is disabled.',
    },
    {
        label: 'Present', title: 'Confirm that you are Present', image: 'confirm-present',
        alt: 'Attendance screenshot: Present is marked 1, and Mark as Present is marked 2.',
        instructions: ['Choose Present in the attendance dialog.', 'Click Mark as Present to save. Check that the slot now says PRESENT.'],
        note: 'Present confirms your availability, not classroom attendance. When booked, open the lesson and enter the classroom on time. Submit your lesson notes after teaching.',
    },
    {
        label: 'Booked lesson', title: 'Open your booked lesson', image: 'open-booked-lesson',
        alt: 'Schedule screenshot: the booked student ID button is marked 1.',
        instructions: ['When a student books your slot, the time shows their student ID. Open My schedule and find the booked time.', 'Click the student ID to open the lesson page in a new tab. Use the student ID, not the clipboard beside it.'],
        note: 'An OPEN or PRESENT slot without a student ID has not been booked yet. There is no classroom to enter for an unbooked slot.',
    },
    {
        label: 'Classroom', title: 'Enter the classroom on time', image: 'enter-classroom',
        alt: 'Lesson page screenshot: the Enter Classroom button is marked 1.',
        instructions: ['On the lesson page, check the student and lesson time, then click Enter Classroom. The classroom opens in another tab.', 'Allow camera and microphone access when prompted. Keep the classroom tab open and be ready to teach at the scheduled start.'],
        note: 'The button becomes available five minutes before the lesson. For a 10:00 AM lesson, enter from 9:55 AM PHT. If the new tab does not open, allow pop-ups for FluentXVerse and try again.',
    },
    {
        label: 'Material', title: 'Open the lesson material', image: 'choose-material',
        alt: 'Classroom screenshot: the course library selector is marked 1 and Open article is marked 2.',
        instructions: ['Check Lesson Request for the student\'s chosen course and material. If they have not chosen one, agree on a material together.', 'In Select a Material, choose a course library. For Daily Dispatch, click Open article; for other courses, choose a level, chapter, and lesson.'],
        note: 'Use the material the student requested when available. Teaching cues and the lesson-notes widget are tutor-only tools.',
    },
    {
        label: 'Save notes', title: 'Save your lesson feedback', image: 'save-lesson-notes',
        alt: 'Lesson notes editor screenshot: Student feedback is marked 1 and Save Changes is marked 2.',
        instructions: ['After teaching, return to the lesson page and click Edit notes. Check the material used and its completion or stopping point.', 'Write at least 100 characters of useful Student feedback, then click Save Changes. Add the optional English level assessment or Tutor handoff when useful.'],
        note: 'Use "the student", not their name or personal details. Save Changes stores a draft; it does not submit your notes or confirm attendance.',
    },
    {
        label: 'Submit', title: 'Submit notes and confirm attendance', image: 'submit-lesson-notes',
        alt: 'Lesson notes screenshot: Submit notes & confirm attendance is marked 1.',
        instructions: ['After the scheduled lesson ends, save all changes, then click Submit notes & confirm attendance.', 'Check that the status says Notes submitted. In Schedule, the lesson-notes clipboard shows a check once submitted; an X after the lesson means notes still need attention.'],
        note: 'Submit within 48 hours of the scheduled end. If the student was absent, use Mark student absent instead; no notes are required for an absent lesson.',
    },
] as const;

export default function FirstLessonGuide() {
    const preview = new URLSearchParams(window.location.search).get('preview') === 'first-lesson';
    const auth = useAuthContext();
    const dark = createMemo(() => useThemeStore(state => state.resolvedTheme === 'dark'));
    const [progress, setProgress] = createSignal<FirstLessonProgress | null>(null);
    const [error, setError] = createSignal(false);
    const [revision, setRevision] = createSignal(0);
    const [selected, setSelected] = createSignal(0);
    const [expanded, setExpanded] = createSignal(true);
    const [imageOpen, setImageOpen] = createSignal(false);
    const [imageZoom, setImageZoom] = createSignal(false);
    let owner: string | undefined;
    let manualStep = false;

    createEffect(on(() => [auth.user?.userId, revision()] as const, ([userId]) => {
        if (owner !== userId) {
            owner = userId; setProgress(null); setError(false); setSelected(0); setExpanded(true); setImageOpen(false); manualStep = false;
        }
        if (!userId) return;
        if (preview) { setProgress({ slotsPublished: false, completed: false }); return; }
        if (progress()?.completed) return;
        const controller = new AbortController();
        let fetching = false;
        let timer: ReturnType<typeof setInterval> | undefined;
        const refresh = async () => {
            if (fetching || controller.signal.aborted || progress()?.completed || document.hidden) return;
            fetching = true;
            try {
                const result = firstLessonProgress(await getTutorPerformance('all', undefined, 1, controller.signal));
                if (controller.signal.aborted) return;
                setProgress(result); setError(false);
                if (!manualStep) setSelected(result.slotsPublished ? 2 : 0);
                if (result.completed) { clearInterval(timer); setImageOpen(false); }
            } catch {
                if (!controller.signal.aborted) setError(true);
            } finally { fetching = false; }
        };
        void refresh();
        timer = setInterval(() => void refresh(), 30000);
        const onWake = () => void refresh();
        window.addEventListener('focus', onWake); window.addEventListener('online', onWake); document.addEventListener('visibilitychange', onWake);
        onCleanup(() => {
            controller.abort(); clearInterval(timer); window.removeEventListener('focus', onWake); window.removeEventListener('online', onWake); document.removeEventListener('visibilitychange', onWake);
        });
    }));
    const step = createMemo(() => steps[selected()]);
    const imagePath = createMemo(() => `/assets/img/first-lesson/${step().image}-${dark() ? 'dark' : 'light'}.png`);
    const chooseStep = (index: number) => { manualStep = true; setSelected(index); };
    const failure = () => <div class="first-lesson-guide-error" role="alert"><CircleAlert size={17}/><span>Could not check first-lesson progress.</span><button type="button" onClick={() => setRevision(value => value + 1)}><RotateCw size={15}/>Retry setup guide</button></div>;

    return <>
        {preview && <div class="first-lesson-guide-preview" role="status"><strong>First-lesson guide preview</strong><a href="/home" onClick={event => { event.preventDefault(); window.location.assign('/home'); }}>Exit preview</a></div>}
        {error() && !progress() && failure()}
        {progress() && !progress()!.completed && <section class="first-lesson-guide" aria-labelledby="first-lesson-guide-title">
            <header class="first-lesson-guide-header"><div><h2 id="first-lesson-guide-title">Get ready for your first lesson</h2><span>{progress()!.slotsPublished ? <><Check size={14}/>Slots opened</> : <><CalendarDays size={14}/>Start with your teaching schedule</>}</span></div>
                <div><a class="fxv-button fxv-button--secondary" href="/schedule"><CalendarDays size={16}/>Open schedule<ArrowRight size={15}/></a><button type="button" class="first-lesson-guide-toggle" aria-label={expanded() ? 'Collapse first-lesson guide' : 'Expand first-lesson guide'} title={expanded() ? 'Collapse guide' : 'Expand guide'} aria-expanded={expanded()} aria-controls="first-lesson-guide-content" onClick={() => setExpanded(value => !value)}>{expanded() ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}</button></div>
            </header>
            {error() && failure()}
            {expanded() && <div id="first-lesson-guide-content">
                <nav class="first-lesson-guide-steps" aria-label="First lesson guide steps">{steps.map((item, index) => <button type="button" aria-label={`Step ${index + 1}: ${item.label}`} aria-pressed={selected() === index} onClick={() => chooseStep(index)}><span>{index + 1}</span>{item.label}</button>)}</nav>
                <div class="first-lesson-guide-body"><div class="first-lesson-guide-copy"><span class="first-lesson-guide-step-label">Step {selected() + 1} of {steps.length}</span><h3>{step().title}</h3>
                    <ol>{step().instructions.map(instruction => <li>{instruction}</li>)}</ol><p class="first-lesson-guide-note">{step().note}</p>
                    <div class="first-lesson-guide-pagination"><button type="button" title="Previous step" aria-label="Previous guide step" disabled={selected() === 0} onClick={() => chooseStep(selected() - 1)}><ArrowLeft size={16}/></button><button type="button" disabled={selected() === steps.length - 1} onClick={() => chooseStep(selected() + 1)}>Next step<ArrowRight size={16}/></button></div>
                </div><button class="first-lesson-guide-image" type="button" aria-label={`Enlarge screenshot: ${step().title}`} title="Enlarge screenshot" onClick={() => { setImageZoom(false); setImageOpen(true); }}><img src={imagePath()} alt={step().alt} width="1200" height="750"/><span><Maximize2 size={16}/></span></button></div>
            </div>}
        </section>}
        {imageOpen() && <TutorDialog label="Schedule guide screenshot" className="first-lesson-screenshot-dialog" onClose={() => setImageOpen(false)}>
            <header><h2>{step().title}</h2><div><button type="button" title={imageZoom() ? 'Fit screenshot' : 'Zoom screenshot'} aria-label={imageZoom() ? 'Fit screenshot' : 'Zoom screenshot'} aria-pressed={imageZoom()} onClick={() => setImageZoom(value => !value)}>{imageZoom() ? <ZoomOut size={19}/> : <ZoomIn size={19}/>}</button><button type="button" title="Close screenshot" aria-label="Close screenshot" onClick={() => setImageOpen(false)}><X size={19}/></button></div></header>
            <div class={`first-lesson-screenshot-scroll ${imageZoom() ? 'is-zoomed' : ''}`} tabIndex={0} role="region" aria-label="Guide screenshot"><img src={imagePath()} alt={step().alt}/></div>
        </TutorDialog>}
    </>;
}
