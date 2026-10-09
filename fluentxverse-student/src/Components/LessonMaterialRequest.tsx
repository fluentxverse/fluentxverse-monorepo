import { useEffect, useRef, useState } from 'preact/hooks';
import { BookOpen, X } from 'lucide-preact';
import { lessonApi } from '../api/lesson.api';
import { lessonRecapApi, lessonCourseName, studentMaterialUrl, type LessonMaterialRequest as MaterialRequest } from '../api/lessonRecap.api';
import DispatchMaterialPicker from './DispatchMaterialPicker';
import CurriculumMaterialPicker, { type CurriculumMaterial } from './CurriculumMaterialPicker';

export default function LessonMaterialRequest({ bookingId, value, canRequest, onChanged }: {
  bookingId: string; value: MaterialRequest | null; canRequest: boolean;
  onChanged: (request: MaterialRequest | null) => void;
}) {
  const [course, setCourse] = useState(value?.courseId || 'conversational-skills');
  const [choosing, setChoosing] = useState(false);
  const [materials, setMaterials] = useState<CurriculumMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [libraryError, setLibraryError] = useState('');
  const [revision, setRevision] = useState(0);
  const [saved, setSaved] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (choosing && canRequest) dialog.current?.showModal();
    if (!canRequest) setChoosing(false);
  }, [choosing, canRequest]);

  useEffect(() => {
    if (!choosing || course === 'daily-dispatch') return;
    let cancelled = false;
    setLoading(true); setLibraryError(''); setMaterials([]);
    lessonApi.getPublishedLessonMaterials(course).then(result => {
      if (!result.success) throw new Error('Could not load the material library.');
      if (!cancelled) setMaterials(result.lessons.map(item => ({ id: item.id,
        title: `Lesson ${item.lessonNumber || 1}: ${item.lessonName || 'Lesson'}`,
        level: Number(item.level) || 1, chapter: Number(item.chapter) || 1,
        lesson: Number(item.lessonNumber) || 1, goal: item.goalTextEn || '' })));
    }).catch(() => { if (!cancelled) setLibraryError('Could not load materials. Please try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [course, choosing, revision]);

  const select = async (selectedCourse: string | null, materialId?: string) => {
    if (saving || !canRequest) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const result = await lessonRecapApi.request(bookingId, selectedCourse, materialId);
      onChanged(result); setChoosing(false); setSaved(true);
    } catch (err: any) { setError(err?.response?.data?.error || err.message || 'Could not save your request.'); }
    finally { setSaving(false); }
  };

  return <><section className="student-lesson-request" aria-labelledby="student-material-request-title">
    <header className="student-lesson-section-heading"><h2 id="student-material-request-title"><i className="fi fi-sr-bookmark" aria-hidden="true" />Material request</h2>
      {canRequest && <button type="button" disabled={saving} onClick={() => { setChoosing(true); setSaved(false); setError(''); }}><i className="fas fa-book-open" aria-hidden="true" />{value ? 'Change material' : 'Choose material'}</button>}
    </header>
    {value ? <div className="student-request-selected">
      <div><p>{lessonCourseName(value.courseId)}{value.level ? ` / Level ${value.level}` : ''}{value.chapter ? ` / Chapter ${value.chapter}` : ''}</p>
        <strong>{value.title}</strong>
      </div>
      <div className="student-request-actions"><a href={studentMaterialUrl(value.courseId, value.lessonId)} target="_blank" rel="noopener noreferrer"><i className="fas fa-book-open" aria-hidden="true" />Preview material</a>
        {canRequest && <button type="button" title="Clear material request" aria-label="Clear material request" disabled={saving} onClick={() => void select(null)}><i className="fi fi-sr-trash" aria-hidden="true" /></button>}</div>
    </div> : <p className="student-lesson-muted">{canRequest ? 'No material requested yet.' : 'No advance material request.'}</p>}
    {saved && <p className="student-request-saved" role="status">{value ? 'Material request saved for your tutor.' : 'Material request cleared.'}</p>}
    {error && !choosing && <p className="student-lesson-error" role="alert">{error}</p>}
  </section>
    {choosing && canRequest && <dialog ref={dialog} className="student-lesson-recap student-material-request-dialog" aria-labelledby="student-material-library-title" onCancel={event => { event.preventDefault(); if (!saving) setChoosing(false); }}>
      <header className="student-material-library-heading"><h2 id="student-material-library-title"><BookOpen size={19} />Select lesson material</h2><button type="button" aria-label="Close material library" title="Close material library" disabled={saving} onClick={() => setChoosing(false)} autoFocus><X size={20} /></button></header>
      <div className="student-material-library-body">
      {error && <p className="student-lesson-error" role="alert">{error}</p>}
      <fieldset disabled={saving} className="student-request-library">
      <label className="student-request-course">Course<select aria-label="Course" value={course} onChange={event => setCourse(event.currentTarget.value)}>
        <option value="conversational-skills">Conversational Skills</option><option value="business-english">Business English</option><option value="daily-dispatch">Daily Dispatch</option>
      </select></label>
      {course === 'daily-dispatch' ? <DispatchMaterialPicker actionLabel="Request article" onOpen={article => void select(course, article.id)} />
        : libraryError ? <div role="alert" className="student-lesson-error">{libraryError}<button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></div>
          : <CurriculumMaterialPicker key={course} actionLabel="Request lesson" materials={materials} loading={loading} currentId={value?.courseId === course ? value.lessonId : undefined} onOpen={material => void select(course, material.id)} />}
      {saving && <p role="status">Saving material request...</p>}
      </fieldset>
      </div>
    </dialog>}
  </>;
}
