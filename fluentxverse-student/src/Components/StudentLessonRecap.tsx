import { useEffect, useState } from 'preact/hooks';
import { lessonRecapApi, lessonCourseName, studentMaterialUrl, type StudentLessonRecap as Recap } from '../api/lessonRecap.api';
import { ENGLISH_LEVELS } from '../data/japanProfileOptions';
import './StudentLessonRecap.css';

export default function StudentLessonRecap({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<Recap | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(''); setLoading(true);
    lessonRecapApi.get(bookingId, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load your lesson recap.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [bookingId, revision]);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  if (!data) return <section className="student-lesson-recap"><p role={error ? 'alert' : 'status'}>{error || 'Loading lesson recap...'}</p>{error && <button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button>}</section>;
  const level = ENGLISH_LEVELS.find(level => level.value === `Level ${data.englishLevelAssessment}`);
  const absent = data.studentAttendance === 'absent';
  return <div className="student-lesson-recap">
    <nav className="student-lesson-navigation" aria-label="Lesson navigation">
      {data.previousLessonId ? <a href={`/lesson/${encodeURIComponent(data.previousLessonId)}`}><i className="fas fa-arrow-left" aria-hidden="true" />Previous lesson</a> : <span />}
      {data.nextLessonId && <a href={`/lesson/${encodeURIComponent(data.nextLessonId)}`}>Next lesson<i className="fas fa-arrow-right" aria-hidden="true" /></a>}
    </nav>
    {error && <p role="alert" className="student-lesson-error">{error}<button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></p>}
    <section className="student-lesson-notes" aria-labelledby="student-recap-title" aria-busy={loading}>
      <header className="student-lesson-section-heading"><h2 id="student-recap-title"><i className="fas fa-newspaper" aria-hidden="true" />Lesson recap</h2>
        <button type="button" disabled={loading} title="Refresh lesson recap" aria-label="Refresh lesson recap" onClick={() => setRevision(value => value + 1)}><i className="fi fi-sr-refresh" aria-hidden="true" /></button>
      </header>
      <p className="student-attendance">Attendance: <strong>{absent ? 'Absent' : 'Present'}</strong></p>
      {data.workflow && <p className="student-lesson-muted">{absent ? 'Student marked absent' : data.workflow.attendanceVerified ? 'Attendance verified by your tutor' : 'Attendance verification pending'} · {data.workflow.notesStatus === 'submitted' ? 'Feedback submitted' : data.workflow.notesStatus === 'changes_pending' ? 'Feedback submitted · Tutor updates pending' : data.workflow.notesStatus === 'not_required' ? 'Notes not required' : data.workflow.closed ? 'Feedback overdue · Update window closed' : 'Feedback pending'}</p>}
      {absent ? <p className="student-lesson-muted">You were marked absent. No lesson notes are required.</p> : <>
        {data.materials.length > 0 && <section aria-labelledby="student-materials-used"><h3 id="student-materials-used">Materials used <span className="student-lesson-muted">({data.materials.length})</span></h3>
          <ol className="student-materials-summary">{data.materials.map(material => <li key={`${material.materialType}:${material.materialId}`}><strong>{material.materialTitle || 'Lesson material'}</strong><span>{lessonCourseName(material.courseId || material.materialType)}{material.materialLevel ? ` / Level ${material.materialLevel}` : ''}{material.materialChapter ? ` / Chapter ${material.materialChapter}` : ''}</span></li>)}</ol>
        </section>}
        <div className="student-material-notes-list">
        {data.materials.map(material => <article key={`${material.materialType}:${material.materialId}`} className="student-material-recap student-note-card">
          <header><div><p className="student-lesson-muted">{lessonCourseName(material.courseId || material.materialType)}{material.materialLevel ? ` / Level ${material.materialLevel}` : ''}{material.materialChapter ? ` / Chapter ${material.materialChapter}` : ''}</p><h3>{material.materialTitle || 'Lesson material'}</h3></div>
            <a href={studentMaterialUrl(material.materialType, material.materialId)} target="_blank" rel="noopener noreferrer"><i className="fas fa-book-open" aria-hidden="true" />Review material</a>
          </header>
          <div className="student-note-card-body">
          <p className={`student-material-progress ${material.completionStatus === 'in_progress' ? 'in-progress' : ''}`}><i className={material.completionStatus === 'completed' ? 'fi fi-sr-check' : 'fi fi-sr-hourglass-end'} aria-hidden="true" />{material.completionStatus === 'completed' ? 'Completed' : material.completionStatus === 'in_progress' ? 'In progress' : 'Progress not recorded'}{material.completionStatus === 'in_progress' && <span><strong>Stopped at:</strong> {material.stoppedAtLabel || 'Not recorded'}{material.progressDetails && ` - ${material.progressDetails}`}</span>}</p>
          <div className="student-material-learning-grid">
          {material.vocabularyItems.length > 0 && <div className="student-material-vocabulary-group">
            <section className="student-recap-section vocabulary"><h4><i className="fi fi-sr-book-alt" aria-hidden="true" />Words and phrases learned in this lesson</h4><ol>{material.vocabularyItems.map((item, index) => <li key={index}>{item.word}</li>)}</ol></section>
            <section className="student-recap-section vocabulary"><h4><i className="fi fi-sr-book-alt" aria-hidden="true" />Vocabulary</h4><ul>{material.vocabularyItems.map((item, index) => {
              const definition = item.definitions[item.selectedDefinitionIndex] || item.definitions[0];
              return <li key={index}><strong>{item.word}</strong>{definition?.meaning && ` - ${definition.meaning}`}{definition?.japaneseNative && <div className="student-vocabulary-translation" lang="ja">{definition.japaneseNative}{definition.japaneseRomanized && <span lang="ja-Latn">{definition.japaneseRomanized}</span>}</div>}</li>;
            })}</ul></section>
          </div>}
          {(material.grammarItems.length > 0 || material.pronunciationItems.length > 0) && <div className="student-material-practice-group">
          {material.grammarItems.length > 0 && <section className="student-recap-section grammar"><h4><i className="fi fi-sr-text" aria-hidden="true" />Grammar</h4>{material.grammarItems.map((item, index) => <div className="student-grammar-pair" key={index}><p><strong>You said:</strong> {item.youSaid}</p><p><strong>Correct:</strong> {item.correct}</p></div>)}</section>}
          {material.pronunciationItems.length > 0 && <section className="student-recap-section pronunciation"><h4><i className="fi fi-sr-microphone" aria-hidden="true" />Pronunciation</h4><ul>{material.pronunciationItems.map((item, index) => <li key={index}>{item.word}{item.phonetic && ` [${item.phonetic.replace(/^\[|\]$/g, '')}]`}</li>)}</ul></section>}
          </div>}
          </div>
          </div>
        </article>)}
        </div>
        <div className="student-shared-note-grid">
        {level && <section className="student-recap-section assessment student-note-card"><h3><i className="fi fi-sr-chart-histogram" aria-hidden="true" />English level assessment</h3><div className="student-note-card-body"><p><strong>{level.value} - {level.label}</strong></p><p>{level.description}</p></div></section>}
        <section className="student-recap-section grammar student-note-card"><h3><i className="fas fa-comment-dots" aria-hidden="true" />Student feedback</h3><div className="student-note-card-body">{data.studentComment.trim() ? <p className="student-feedback-text">{data.studentComment}</p> : <p className="student-lesson-muted">{data.workflow?.notesStatus === 'not_required' ? 'No lesson feedback is required for this lesson outcome.' : data.workflow?.closed ? 'The feedback deadline has passed. Contact support if your lesson feedback is missing.' : new Date(data.startsAt).getTime() > Date.now() ? 'Your lesson feedback will appear here after the lesson.' : 'Your tutor is preparing your lesson feedback.'}</p>}</div></section>
        </div>
      </>}
    </section>
  </div>;
}
