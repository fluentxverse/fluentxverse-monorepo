import { useEffect, useState } from 'preact/hooks';
import { lessonRecapApi, type StudentLessonRecap } from '../api/lessonRecap.api';
import LessonMaterialRequest from './LessonMaterialRequest';
import LessonContinuations from './LessonContinuations';
import './StudentLessonRecap.css';

export default function StudentLessonMaterialRequest({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<Pick<StudentLessonRecap, 'materialRequest' | 'canRequestMaterial'> | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    lessonRecapApi.materialRequest(bookingId, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load your material request.'); });
    return () => controller.abort();
  }, [bookingId, revision]);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  return <div className="student-lesson-recap student-lesson-advance-request">
    {data ? <LessonMaterialRequest bookingId={bookingId} value={data.materialRequest} canRequest={data.canRequestMaterial} onChanged={materialRequest => setData(current => current && ({ ...current, materialRequest }))} />
      : <section className="student-lesson-request" aria-label="Material request"><header className="student-lesson-section-heading"><h2><i className="fi fi-sr-bookmark" aria-hidden="true" />Material request</h2></header>
        {!error && <p role="status">Loading material request...</p>}</section>}
    {error && <p className="student-lesson-error" role="alert">{error}<button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></p>}
    {data?.canRequestMaterial && <LessonContinuations bookingId={bookingId} onRequested={materialRequest => setData(current => current && ({ ...current, materialRequest }))} />}
  </div>;
}
