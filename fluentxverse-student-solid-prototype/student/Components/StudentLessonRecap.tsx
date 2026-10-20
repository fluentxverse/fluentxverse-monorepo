import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import { ArrowLeft, ArrowRight, BookOpen, Check, Hourglass, Mic, RefreshCw, Text } from "lucide-solid";
import { lessonRecapApi, lessonCourseName, studentMaterialUrl, type StudentLessonRecap as Recap } from '../api/lessonRecap.api';
import { ENGLISH_LEVELS } from '../data/japanProfileOptions';
import './StudentLessonRecap.css';
export default function StudentLessonRecap(_props0: {
    bookingId: string;
}) {
    const [data, setData] = createSignal<Recap | null>(null);
    const [error, setError] = createSignal('');
    const [loading, setLoading] = createSignal(true);
    const [revision, setRevision] = createSignal(0);
    createEffect(on(() => [_props0["bookingId"], revision()], () => {
        const _cleanup1 = untrack(() => {
            const controller = new AbortController();
            setError('');
            setLoading(true);
            lessonRecapApi.get(_props0["bookingId"], controller.signal).then(result => { if (!controller.signal.aborted)
                setData(result); })
                .catch(() => { if (!controller.signal.aborted)
                setError('Could not load your lesson recap.'); })
                .finally(() => { if (!controller.signal.aborted)
                setLoading(false); });
            return () => controller.abort();
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [], () => {
        const _cleanup2 = untrack(() => {
            const refresh = () => setRevision(value => value + 1);
            window.addEventListener('focus', refresh);
            return () => window.removeEventListener('focus', refresh);
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    return createMemo(() => {
        if (!data())
            return <section class="student-lesson-recap"><p role={error() ? 'alert' : 'status'}>{error() || 'Loading lesson recap...'}</p>{error() && <button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button>}</section>;
        const level = createMemo(() => ENGLISH_LEVELS.find(level => level.value === `Level ${data().englishLevelAssessment}`));
        const absent = createMemo(() => data().studentAttendance === 'absent');
        return <div class="student-lesson-recap">
    <nav class="student-lesson-navigation" aria-label="Lesson navigation">
      {data().previousLessonId ? <a href={`/lesson/${encodeURIComponent(data().previousLessonId)}`}><ArrowLeft size={16}/>Previous lesson</a> : <span />}
      {data().nextLessonId && <a href={`/lesson/${encodeURIComponent(data().nextLessonId)}`}>Next lesson<ArrowRight size={16}/></a>}
    </nav>
    {error() && <p role="alert" class="student-lesson-error">{error()}<button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></p>}
    <section class="student-lesson-notes" aria-labelledby="student-recap-title" aria-busy={loading()}>
      <header class="student-lesson-section-heading"><h2 id="student-recap-title"><img class="lesson-art" src="/assets/img/home-icons/training-v1.webp" alt=""/>Lesson recap</h2>
        <button type="button" disabled={loading()} title="Refresh lesson recap" aria-label="Refresh lesson recap" onClick={() => setRevision(value => value + 1)}><RefreshCw size={17}/></button>
      </header>
      <p class="student-attendance">Attendance: <strong>{absent() ? 'Absent' : 'Present'}</strong></p>
      {data().workflow && <p class="student-lesson-muted">{absent() ? 'Student marked absent' : data().workflow.attendanceVerified ? 'Attendance verified by your tutor' : 'Attendance verification pending'} · {data().workflow.notesStatus === 'submitted' ? 'Feedback submitted' : data().workflow.notesStatus === 'changes_pending' ? 'Feedback submitted · Tutor updates pending' : data().workflow.notesStatus === 'not_required' ? 'Notes not required' : data().workflow.closed ? 'Feedback overdue · Update window closed' : 'Feedback pending'}</p>}
      {absent() ? <p class="student-lesson-muted">You were marked absent. No lesson notes are required.</p> : <>
        {data().materials.length > 0 && <section aria-labelledby="student-materials-used"><h3 id="student-materials-used">Materials used <span class="student-lesson-muted">({data().materials.length})</span></h3>
          <ol class="student-materials-summary">{data().materials.map(material => <li><strong>{material.materialTitle || 'Lesson material'}</strong><span>{lessonCourseName(material.courseId || material.materialType)}{material.materialLevel ? ` / Level ${material.materialLevel}` : ''}{material.materialChapter ? ` / Chapter ${material.materialChapter}` : ''}</span></li>)}</ol>
        </section>}
        <div class="student-material-notes-list">
        {data().materials.map(material => <article class="student-material-recap student-note-card">
          <header><div><p class="student-lesson-muted">{lessonCourseName(material.courseId || material.materialType)}{material.materialLevel ? ` / Level ${material.materialLevel}` : ''}{material.materialChapter ? ` / Chapter ${material.materialChapter}` : ''}</p><h3>{material.materialTitle || 'Lesson material'}</h3></div>
            <a href={studentMaterialUrl(material.materialType, material.materialId)} target="_blank" rel="noopener noreferrer"><BookOpen size={16}/>Review material</a>
          </header>
          <div class="student-note-card-body">
          <p class={`student-material-progress ${material.completionStatus === 'in_progress' ? 'in-progress' : ''}`}>{material.completionStatus === 'completed' ? <Check size={16}/> : <Hourglass size={16}/>}{material.completionStatus === 'completed' ? 'Completed' : material.completionStatus === 'in_progress' ? 'In progress' : 'Progress not recorded'}{material.completionStatus === 'in_progress' && <span><strong>Stopped at:</strong> {material.stoppedAtLabel || 'Not recorded'}{material.progressDetails && ` - ${material.progressDetails}`}</span>}</p>
          <div class="student-material-learning-grid">
          {material.vocabularyItems.length > 0 && <div class="student-material-vocabulary-group">
            <section class="student-recap-section vocabulary"><h4><BookOpen size={16}/>Words and phrases learned in this lesson</h4><ol>{material.vocabularyItems.map((item, index) => <li>{item.word}</li>)}</ol></section>
            <section class="student-recap-section vocabulary"><h4><BookOpen size={16}/>Vocabulary</h4><ul>{material.vocabularyItems.map((item, index) => {
                            const definition = item.definitions[item.selectedDefinitionIndex] || item.definitions[0];
                            return <li><strong>{item.word}</strong>{definition?.meaning && ` - ${definition.meaning}`}{definition?.japaneseNative && <div class="student-vocabulary-translation" lang="ja">{definition.japaneseNative}{definition.japaneseRomanized && <span lang="ja-Latn">{definition.japaneseRomanized}</span>}</div>}</li>;
                        })}</ul></section>
          </div>}
          {(material.grammarItems.length > 0 || material.pronunciationItems.length > 0) && <div class="student-material-practice-group">
          {material.grammarItems.length > 0 && <section class="student-recap-section grammar"><h4><Text size={16}/>Grammar</h4>{material.grammarItems.map((item, index) => <div class="student-grammar-pair"><p><strong>You said:</strong> {item.youSaid}</p><p><strong>Correct:</strong> {item.correct}</p></div>)}</section>}
          {material.pronunciationItems.length > 0 && <section class="student-recap-section pronunciation"><h4><Mic size={16}/>Pronunciation</h4><ul>{material.pronunciationItems.map((item, index) => <li>{item.word}{item.phonetic && ` [${item.phonetic.replace(/^\[|\]$/g, '')}]`}</li>)}</ul></section>}
          </div>}
          </div>
          </div>
        </article>)}
        </div>
        <div class="student-shared-note-grid">
        {level() && <section class="student-recap-section assessment student-note-card"><h3><img class="lesson-art" src="/assets/img/home-icons/growth-v1.webp" alt=""/>English level assessment</h3><div class="student-note-card-body"><p><strong>{level().value} - {level().label}</strong></p><p>{level().description}</p></div></section>}
        <section class="student-recap-section grammar student-note-card"><h3><img class="lesson-art" src="/assets/img/home-icons/reviews-v1.webp" alt=""/>Student feedback</h3><div class="student-note-card-body">{data().studentComment.trim() ? <p class="student-feedback-text">{data().studentComment}</p> : <p class="student-lesson-muted">{data().workflow?.notesStatus === 'not_required' ? 'No lesson feedback is required for this lesson outcome.' : data().workflow?.closed ? 'The feedback deadline has passed. Contact support if your lesson feedback is missing.' : new Date(data().startsAt).getTime() > Date.now() ? 'Your lesson feedback will appear here after the lesson.' : 'Your tutor is preparing your lesson feedback.'}</p>}</div></section>
        </div>
      </>}
    </section>
  </div>;
    }) as unknown as JSX.Element;
}
