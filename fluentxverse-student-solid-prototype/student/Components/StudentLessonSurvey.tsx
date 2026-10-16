import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { lessonSurveyApi, type LessonSurveyState } from '../api/lessonSurvey.api';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, Star } from "lucide-solid";
import './StudentLessonSurvey.css';
import AnonymousLessonReview from './AnonymousLessonReview';
const ratingNames = ['Very dissatisfied', 'Dissatisfied', 'Okay', 'Satisfied', 'Very satisfied'];
interface Props {
    bookingId: string;
    mode?: 'inline' | 'flow';
    initialData?: LessonSurveyState;
    onSubmitted?: (survey: NonNullable<LessonSurveyState['survey']>) => void;
    onBusyChange?: (busy: boolean) => void;
}
export default function StudentLessonSurvey(_props0: Props) {
    const [data, setData] = createSignal<LessonSurveyState | null>(_props0["initialData"] || null);
    const [step, setStep] = createSignal(0);
    const [rating, setRating] = createSignal(0);
    const [positive, setPositive] = createSignal<string[]>([]);
    const [improvement, setImprovement] = createSignal<string[]>([]);
    const [comment, setComment] = createSignal('');
    const [error, setError] = createSignal('');
    const [revision, setRevision] = createSignal(0);
    const [saving, setSaving] = createSignal(false);
    const busy = { current: false } as {
        current: any;
    };
    const errorRef = { current: null } as {
        current: HTMLParagraphElement | null;
    };
    const bodyRef = { current: null } as {
        current: HTMLDivElement | null;
    };
    const callbacks = { current: { get onSubmitted() {
                return _props0["onSubmitted"];
            }, get onBusyChange() {
                return _props0["onBusyChange"];
            } } } as {
        current: any;
    };
    callbacks.current = { get onSubmitted() {
            return _props0["onSubmitted"];
        }, get onBusyChange() {
            return _props0["onBusyChange"];
        } };
    const now = useCurrentTime();
    createEffect(on(() => [_props0["bookingId"], revision(), _props0["initialData"]], () => {
        const _cleanup1 = untrack(() => {
            const controller = new AbortController();
            if (_props0["initialData"] && revision() === 0) {
                setData(_props0["initialData"]);
                return;
            }
            setError('');
            lessonSurveyApi.get(_props0["bookingId"], controller.signal).then(result => { if (!controller.signal.aborted)
                setData(result); })
                .catch(() => { if (!controller.signal.aborted)
                setError('Could not load your lesson survey.'); });
            return () => controller.abort();
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [error()], () => {
        const _cleanup2 = untrack(() => { if (error())
            errorRef.current?.focus(); });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    createEffect(on(() => [saving()], () => {
        const _cleanup3 = untrack(() => { callbacks.current.onBusyChange?.(saving()); });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    createEffect(on(() => [data()?.survey], () => {
        const _cleanup4 = untrack(() => { if (data()?.survey)
            callbacks.current.onSubmitted?.(data().survey); });
        if (typeof _cleanup4 === "function")
            onCleanup(_cleanup4);
    }));
    createEffect(on(() => [step(), _props0["mode"] === undefined ? 'inline' : _props0["mode"]], () => {
        const _cleanup5 = untrack(() => {
            if ((_props0["mode"] === undefined ? 'inline' : _props0["mode"]) !== 'flow')
                return;
            bodyRef.current?.scrollTo({ top: 0 });
            bodyRef.current?.querySelector<HTMLElement>('legend, .lesson-survey-comment-label')?.focus({ preventScroll: true });
        });
        if (typeof _cleanup5 === "function")
            onCleanup(_cleanup5);
    }));
    const open = createMemo(() => data()?.eligible && data().closesAt && now() < Date.parse(data().closesAt));
    const toggle = (group: 'positive' | 'improvement', id: string, checked: boolean) => {
        const update = (items: string[]) => checked ? [...items.filter(item => item !== id), id] : items.filter(item => item !== id);
        if (group === 'positive') {
            setPositive(update);
            if (checked && id !== 'other')
                setImprovement(items => items.filter(item => item !== id));
        }
        else {
            setImprovement(update);
            if (checked && id !== 'other')
                setPositive(items => items.filter(item => item !== id));
        }
    };
    const submit = async (event: Event) => {
        event.preventDefault();
        if (busy.current)
            return;
        if (!rating()) {
            setError('Choose an overall lesson rating before submitting.');
            return;
        }
        if (!open()) {
            setError('The 48-hour survey window has closed.');
            return;
        }
        if ((_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'flow' && step() < 2) {
            setStep(value => value + 1);
            setError('');
            return;
        }
        busy.current = true;
        setSaving(true);
        setError('');
        try {
            const survey = await lessonSurveyApi.submit(_props0["bookingId"], { get rating() {
                    return rating();
                }, get positive() {
                    return positive();
                }, get improvement() {
                    return improvement();
                }, get comment() {
                    return comment();
                } });
            setData(previous => previous ? { ...previous, survey } : previous);
        }
        catch (err: any) {
            if ([403, 409].includes(err.response?.status))
                setRevision(value => value + 1);
            setError(err.response?.data?.error || err.message || 'Could not submit your survey. Please try again.');
        }
        finally {
            busy.current = false;
            setSaving(false);
        }
    };
    return createMemo(() => {
        if (data()?.mode === 'anonymous' && data()?.enrollment)
            return <AnonymousLessonReview bookingId={_props0.bookingId} enrollment={data()!.enrollment!} onBusyChange={_props0.onBusyChange}/>;
        if (data() && !data().survey && ['not_ended', 'unavailable', 'absent'].includes(data().reason || '')) {
            return (_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'inline' ? null : <p class="lesson-survey-muted">{data().reason === 'not_ended' ? 'Lesson feedback is not available yet.' : 'Lesson feedback is not available for this lesson.'}</p>;
        }
        return <section class={`student-lesson-survey${(_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'flow' ? ' student-lesson-survey--flow' : ''}`} aria-labelledby={(_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'inline' ? 'lesson-survey-heading' : undefined}>
    {(_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'inline' && <header><h2 id="lesson-survey-heading"><Star size={18}/>Lesson feedback</h2><span>{data()?.survey ? 'Submitted' : 'Optional'}</span></header>}
    {error() && <p class="lesson-survey-error" role="alert" tabIndex={-1} ref={_element => errorRef.current = _element}>{error()}
      {!data() && <button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button>}</p>}
    {!data() ? !error() && <p role="status">Loading lesson survey...</p> : data().survey ? <div class="lesson-survey-thanks" role="status">
      <h3>Thank you for your feedback</h3><p>{data().survey.rating} / 5 - {ratingNames[data().survey.rating - 1]}</p>
      {(['positive', 'improvement'] as const).map(group => data().survey![group].length > 0 && <p><strong>{group === 'positive' ? 'What went well:' : 'What could be better:'}</strong> {data().survey![group].map(id => data().topics.find(topic => topic.id === id)?.label || id).join(', ')}</p>)}
      {data().survey.comment && <p class="lesson-survey-comment">{data().survey.comment}</p>}
    </div> : !open() ? <p class="lesson-survey-muted">The 48-hour feedback window has closed.</p> : <form onSubmit={submit}>
      {(_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'flow' && <div class="lesson-survey-step" aria-label={`Step ${step() + 1} of 3`}><span>Step {step() + 1} of 3</span><progress max={3} value={step() + 1} aria-label="Survey progress"/></div>}
      <div class={(_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'flow' ? 'lesson-survey-flow-body' : ''} ref={_element => bodyRef.current = _element}>
      {((_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'inline' || step() === 0) && <fieldset class="lesson-survey-overall" disabled={saving()}><legend tabIndex={(_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'flow' ? -1 : undefined}>How was your lesson?</legend>
        <div class="lesson-survey-stars">{ratingNames.map((name, index) => <label title={`${index + 1} / 5 - ${name}`}>
          <input type="radio" name="lesson-rating" value={index + 1} checked={rating() === index + 1} onChange={() => { setRating(index + 1); setError(''); }} aria-label={`${index + 1} star${index ? 's' : ''} - ${name}`}/>
          <Star size={27} class={rating() > index ? 'selected' : ''} fill={rating() > index ? 'currentColor' : 'none'} aria-hidden="true"/>
        </label>)}</div><p class="lesson-survey-muted">{rating() ? ratingNames[rating() - 1] : 'Overall rating'}</p>
      </fieldset>}
      {rating() > 0 && <>
        {((_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'inline' || step() === 1) &&
                        <div class="lesson-survey-topics">{(['positive', 'improvement'] as const).map(group => <fieldset disabled={saving()}>
          <legend tabIndex={(_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'flow' ? -1 : undefined}>{group === 'positive' ? <CheckCircle2 size={17}/> : <CircleAlert size={17}/>}{group === 'positive' ? 'What went well?' : 'What could be better?'}</legend>
          {data().topics.filter(topic => group === 'improvement' || topic.positive).map(topic => <label>
            <input type="checkbox" checked={(group === 'positive' ? positive() : improvement()).includes(topic.id)} onChange={event => toggle(group, topic.id, event.currentTarget.checked)}/>
            <span>{topic.label}</span>
          </label>)}
        </fieldset>)}</div>}
        {((_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'inline' || step() === 2) && <>
        <label class="lesson-survey-comment-label" tabIndex={(_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'flow' ? -1 : undefined} for="lesson-survey-comment">Anything else? <span>Optional</span></label>
        <textarea id="lesson-survey-comment" value={comment()} onInput={event => setComment(event.currentTarget.value)} maxLength={500} rows={3} disabled={saving()}/>
        <div class="lesson-survey-comment-meta"><span>Keep feedback about the lesson. Leave out names and contact details.</span><span>{comment().length}/500</span></div>
        {(_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'flow' && <p class="lesson-survey-review">Overall rating: <strong>{rating()} / 5 - {ratingNames[rating() - 1]}</strong></p>}
        </>}
      </>}
      </div>
      <footer><p class="lesson-survey-muted">Submit by {new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(data().closesAt!))} JST</p>
        <div class="lesson-survey-flow-actions">
          {(_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'flow' && step() > 0 && <button type="button" class="lesson-survey-back" disabled={saving()} onClick={() => { setStep(value => value - 1); setError(''); }}><ArrowLeft size={16}/>Back</button>}
          <button type="submit" disabled={saving()}>{(_props0["mode"] === undefined ? 'inline' : _props0["mode"]) === 'flow' && step() < 2 ? <><span>Next</span><ArrowRight size={16}/></> : <><Check size={16}/>{saving() ? 'Submitting...' : 'Submit feedback'}</>}</button>
        </div></footer>
    </form>}
  </section>;
    }) as unknown as JSX.Element;
}
