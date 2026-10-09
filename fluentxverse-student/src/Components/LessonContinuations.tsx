import { useEffect, useState } from 'preact/hooks';
import { client } from '../api/utils';
import { lessonRecapApi, type LessonMaterialRequest } from '../api/lessonRecap.api';
interface Continuation { materialId: string; materialType: string; materialTitle: string; stoppedAtLabel: string; }
export default function LessonContinuations({ bookingId, onRequested }: { bookingId: string; onRequested: (value: LessonMaterialRequest | null) => void }) {
  const [items, setItems] = useState<Continuation[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    client.get(`/lesson-workflow/student/${encodeURIComponent(bookingId)}/continuations`).then(({ data }) => { if (!cancelled) { setItems(data.data || []); setError(''); } })
      .catch(() => { if (!cancelled) setError('Could not load unfinished materials.'); });
    return () => { cancelled = true; };
  }, [bookingId, revision]);
  return <div className="student-lesson-continuations">
    {error && <p role="alert">{error}<button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
    {items.map(item => <div key={item.materialId}><strong>{item.materialTitle}</strong><p>Previously stopped at: {item.stoppedAtLabel}</p><button type="button" disabled={saving} onClick={async () => {
      setSaving(true); setError('');
      try { onRequested(await lessonRecapApi.request(bookingId, item.materialType, item.materialId)); }
      catch (err: any) { setError(err.response?.data?.error || 'Could not request this material.'); }
      finally { setSaving(false); }
    }}><i className="fas fa-book-open" aria-hidden="true" />Continue previous material</button></div>)}
  </div>;
}
