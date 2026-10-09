import { useEffect, useState } from 'preact/hooks';
import { tutorApi } from '../api/tutor.api';
import './LessonMaterialRequest.css';

type Request = Awaited<ReturnType<typeof tutorApi.getStudentLessonRequest>>;
export default function LessonMaterialRequest({ studentId, sessionId }: { studentId: string; sessionId: string }) {
  const [request, setRequest] = useState<Request>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    tutorApi.getStudentLessonRequest(studentId, sessionId).then(result => { if (!cancelled) setRequest(result); })
      .catch(() => { if (!cancelled) setError('Could not load the material request.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId, sessionId, revision]);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  const course = request?.courseId === 'daily-dispatch' ? 'Daily Dispatch' : request?.courseId === 'business-english' ? 'Business English' : 'Conversational Skills';
  const url = request?.courseId === 'daily-dispatch' ? `/materials/daily-dispatch/${encodeURIComponent(request.lessonId)}`
    : request?.courseId === 'conversational-skills' ? `/materials/conversational-skills/${encodeURIComponent(request.lessonId)}` : `/lesson/view?id=${encodeURIComponent(request?.lessonId || '')}`;
  return <section className="lesson-advance-material-request" aria-labelledby="lesson-material-request-title" aria-busy={loading}>
    <header><h2 id="lesson-material-request-title"><span className="lesson-section-icon"><i className="fi fi-sr-bookmark" aria-hidden="true" /></span>This lesson's material request</h2>
      <button type="button" disabled={loading} title="Refresh material request" aria-label="Refresh material request" onClick={() => setRevision(value => value + 1)}><i className="fi fi-sr-refresh" aria-hidden="true" /></button></header>
    {error ? <p role="alert">{error}</p> : request ? <div className="lesson-advance-material-content"><div><p>{course}{request.level ? ` / Level ${request.level}` : ''}{request.chapter ? ` / Chapter ${request.chapter}` : ''}</p><strong>{request.title}</strong>{request.goal && <p>{request.goal}</p>}</div><a href={url} target="_blank" rel="noopener noreferrer"><i className="fas fa-book-open" aria-hidden="true" />View material</a></div>
      : <p role="status">{loading ? 'Loading material request...' : 'No material requested for this lesson.'}</p>}
  </section>;
}
