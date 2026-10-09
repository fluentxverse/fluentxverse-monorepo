import { useEffect, useRef, useState } from 'preact/hooks';
import { lessonSurveyApi, type LessonSurveyState } from '../api/lessonSurvey.api';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { ArrowLeft, ArrowRight, Check } from 'lucide-preact';
import './StudentLessonSurvey.css';

const ratingNames = ['Very dissatisfied', 'Dissatisfied', 'Okay', 'Satisfied', 'Very satisfied'];

interface Props {
  bookingId: string;
  mode?: 'inline' | 'flow';
  initialData?: LessonSurveyState;
  onSubmitted?: (survey: NonNullable<LessonSurveyState['survey']>) => void;
  onBusyChange?: (busy: boolean) => void;
}
export default function StudentLessonSurvey({ bookingId, mode = 'inline', initialData, onSubmitted, onBusyChange }: Props) {
  const [data, setData] = useState<LessonSurveyState | null>(initialData || null);
  const [step, setStep] = useState(0);
  const [rating, setRating] = useState(0);
  const [positive, setPositive] = useState<string[]>([]);
  const [improvement, setImprovement] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onSubmitted, onBusyChange });
  callbacks.current = { onSubmitted, onBusyChange };
  const now = useCurrentTime();
  useEffect(() => {
    const controller = new AbortController();
    if (initialData && revision === 0) { setData(initialData); return; }
    setError('');
    lessonSurveyApi.get(bookingId, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load your lesson survey.'); });
    return () => controller.abort();
  }, [bookingId, revision, initialData]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { callbacks.current.onBusyChange?.(saving); }, [saving]);
  useEffect(() => { if (data?.survey) callbacks.current.onSubmitted?.(data.survey); }, [data?.survey]);
  useEffect(() => {
    if (mode !== 'flow') return;
    bodyRef.current?.scrollTo({ top: 0 });
    bodyRef.current?.querySelector<HTMLElement>('legend, .lesson-survey-comment-label')?.focus({ preventScroll: true });
  }, [step, mode]);

  const open = data?.eligible && data.closesAt && now < Date.parse(data.closesAt);
  const toggle = (group: 'positive' | 'improvement', id: string, checked: boolean) => {
    const update = (items: string[]) => checked ? [...items.filter(item => item !== id), id] : items.filter(item => item !== id);
    if (group === 'positive') {
      setPositive(update);
      if (checked && id !== 'other') setImprovement(items => items.filter(item => item !== id));
    } else {
      setImprovement(update);
      if (checked && id !== 'other') setPositive(items => items.filter(item => item !== id));
    }
  };
  const submit = async (event: Event) => {
    event.preventDefault();
    if (busy.current) return;
    if (!rating) { setError('Choose an overall lesson rating before submitting.'); return; }
    if (!open) { setError('The 48-hour survey window has closed.'); return; }
    if (mode === 'flow' && step < 2) { setStep(value => value + 1); setError(''); return; }
    busy.current = true; setSaving(true); setError('');
    try {
      const survey = await lessonSurveyApi.submit(bookingId, { rating, positive, improvement, comment });
      setData(previous => previous ? { ...previous, survey } : previous);
    } catch (err: any) {
      if ([403, 409].includes(err.response?.status)) setRevision(value => value + 1);
      setError(err.response?.data?.error || err.message || 'Could not submit your survey. Please try again.');
    } finally { busy.current = false; setSaving(false); }
  };
  if (data && !data.survey && ['not_ended', 'unavailable', 'absent'].includes(data.reason || '')) {
    return mode === 'inline' ? null : <p className="lesson-survey-muted">{data.reason === 'not_ended' ? 'Lesson feedback is not available yet.' : 'Lesson feedback is not available for this lesson.'}</p>;
  }
  return <section className={`student-lesson-survey${mode === 'flow' ? ' student-lesson-survey--flow' : ''}`} aria-labelledby={mode === 'inline' ? 'lesson-survey-heading' : undefined}>
    {mode === 'inline' && <header><h2 id="lesson-survey-heading"><i className="fas fa-star" aria-hidden="true" />Lesson feedback</h2><span>{data?.survey ? 'Submitted' : 'Optional'}</span></header>}
    {error && <p className="lesson-survey-error" role="alert" tabIndex={-1} ref={errorRef}>{error}
      {!data && <button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button>}</p>}
    {!data ? !error && <p role="status">Loading lesson survey...</p> : data.survey ? <div className="lesson-survey-thanks" role="status">
      <h3>Thank you for your feedback</h3><p>{data.survey.rating} / 5 - {ratingNames[data.survey.rating - 1]}</p>
      {(['positive', 'improvement'] as const).map(group => data.survey![group].length > 0 && <p key={group}><strong>{group === 'positive' ? 'What went well:' : 'What could be better:'}</strong> {data.survey![group].map(id => data.topics.find(topic => topic.id === id)?.label || id).join(', ')}</p>)}
      {data.survey.comment && <p className="lesson-survey-comment">{data.survey.comment}</p>}
    </div> : !open ? <p className="lesson-survey-muted">The 48-hour feedback window has closed.</p> : <form onSubmit={submit}>
      {mode === 'flow' && <div className="lesson-survey-step" aria-label={`Step ${step + 1} of 3`}><span>Step {step + 1} of 3</span><progress max={3} value={step + 1} aria-label="Survey progress" /></div>}
      <div className={mode === 'flow' ? 'lesson-survey-flow-body' : ''} ref={bodyRef}>
      {(mode === 'inline' || step === 0) && <fieldset className="lesson-survey-overall" disabled={saving}><legend tabIndex={mode === 'flow' ? -1 : undefined}>How was your lesson?</legend>
        <div className="lesson-survey-stars">{ratingNames.map((name, index) => <label key={name} title={`${index + 1} / 5 - ${name}`}>
          <input type="radio" name="lesson-rating" value={index + 1} checked={rating === index + 1} onChange={() => { setRating(index + 1); setError(''); }} aria-label={`${index + 1} star${index ? 's' : ''} - ${name}`} />
          <i className={`fas fa-star ${rating > index ? 'selected' : ''}`} aria-hidden="true" />
        </label>)}</div><p className="lesson-survey-muted">{rating ? ratingNames[rating - 1] : 'Overall rating'}</p>
      </fieldset>}
      {rating > 0 && <>
        {(mode === 'inline' || step === 1) &&
        <div className="lesson-survey-topics">{(['positive', 'improvement'] as const).map(group => <fieldset key={group} disabled={saving}>
          <legend tabIndex={mode === 'flow' ? -1 : undefined}><i className={`fas ${group === 'positive' ? 'fa-check-circle' : 'fa-adjust'}`} aria-hidden="true" />{group === 'positive' ? 'What went well?' : 'What could be better?'}</legend>
          {data.topics.filter(topic => group === 'improvement' || topic.positive).map(topic => <label key={topic.id}>
            <input type="checkbox" checked={(group === 'positive' ? positive : improvement).includes(topic.id)} onChange={event => toggle(group, topic.id, event.currentTarget.checked)} />
            <span>{topic.label}</span>
          </label>)}
        </fieldset>)}</div>}
        {(mode === 'inline' || step === 2) && <>
        <label className="lesson-survey-comment-label" tabIndex={mode === 'flow' ? -1 : undefined} htmlFor="lesson-survey-comment">Anything else? <span>Optional</span></label>
        <textarea id="lesson-survey-comment" value={comment} onInput={event => setComment(event.currentTarget.value)} maxLength={500} rows={3} disabled={saving} />
        <div className="lesson-survey-comment-meta"><span>Keep feedback about the lesson. Leave out names and contact details.</span><span>{comment.length}/500</span></div>
        {mode === 'flow' && <p className="lesson-survey-review">Overall rating: <strong>{rating} / 5 - {ratingNames[rating - 1]}</strong></p>}
        </>}
      </>}
      </div>
      <footer><p className="lesson-survey-muted">Submit by {new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(data.closesAt!))} JST</p>
        <div className="lesson-survey-flow-actions">
          {mode === 'flow' && step > 0 && <button type="button" className="lesson-survey-back" disabled={saving} onClick={() => { setStep(value => value - 1); setError(''); }}><ArrowLeft size={16} />Back</button>}
          <button type="submit" disabled={saving}>{mode === 'flow' && step < 2 ? <><span>Next</span><ArrowRight size={16} /></> : <><Check size={16} />{saving ? 'Submitting...' : 'Submit feedback'}</>}</button>
        </div></footer>
    </form>}
  </section>;
}
