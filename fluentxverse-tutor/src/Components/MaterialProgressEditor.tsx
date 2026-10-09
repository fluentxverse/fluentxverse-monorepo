import type { ClassroomMaterialProgress, ClassroomNotesRecord } from '../api/tutor.api';
import './NotesWidget.css';
import { lessonNotesIcons } from '../data/lessonNotesIcons';

type Progress = Pick<ClassroomNotesRecord, 'completionStatus' | 'stoppedAt' | 'stoppedAtLabel' | 'progressDetails'>;

export default function MaterialProgressEditor({
  materialType,
  progress,
  context,
  loading,
  onChange,
  onRetry,
  required = false,
  error = '',
}: {
  materialType: string;
  progress: Progress;
  context: ClassroomMaterialProgress | null;
  loading: boolean;
  onChange: (patch: Partial<Progress>) => void;
  onRetry: () => void;
  required?: boolean;
  error?: string;
}) {
  const sections = context?.sections || [];
  return (
    <section className="lesson-material-progress-editor" aria-label="Material progress">
      <label className="dispatch-notes-label">
        <i className={lessonNotesIcons.progress} aria-hidden="true" />
        Material progress
      </label>
      {materialType === 'daily-dispatch' ? (
        <div className="lesson-material-completed">
          <i className={lessonNotesIcons.completed} aria-hidden="true" />
          Completed
        </div>
      ) : (
        <>
          <div className="lesson-progress-status" role="group" aria-label="Completion status">
            {(['in_progress', 'completed'] as const).map((status) => (
              <button
                type="button"
                aria-pressed={progress.completionStatus === status}
                key={status}
                onClick={() =>
                  onChange({
                    completionStatus: status,
                    ...(status === 'completed' ? { stoppedAt: null, stoppedAtLabel: null, progressDetails: '' } : {}),
                  })
                }
              >
                <i
                  className={status === 'completed' ? lessonNotesIcons.completed : lessonNotesIcons.inProgress}
                  aria-hidden="true"
                />
                {status === 'completed' ? 'Completed' : 'In progress'}
              </button>
            ))}
          </div>
          {progress.completionStatus !== 'completed' && (
            <>
              <label htmlFor="material-stopped-at">Stopped at{required && <span className="notes-field-optional"> (Required)</span>}</label>
              <select
                id="material-stopped-at"
                value={progress.stoppedAt || ''}
                disabled={!context}
                aria-required={required}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'lesson-stopping-point-error' : undefined}
                onChange={(event) => {
                  const id = event.currentTarget.value;
                  onChange({
                    stoppedAt: id || null,
                    stoppedAtLabel: sections.find((section) => section.id === id)?.label || null,
                  });
                }}
              >
                <option value="">Select a stopping point</option>
                {progress.stoppedAt && !sections.some((section) => section.id === progress.stoppedAt) && (
                  <option value={progress.stoppedAt}>{progress.stoppedAtLabel || progress.stoppedAt}</option>
                )}
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
              {error && <p id="lesson-stopping-point-error" className="notes-field-error">{error}</p>}
              <label htmlFor="material-progress-details">Progress details</label>
              <input
                id="material-progress-details"
                value={progress.progressDetails || ''}
                maxLength={2000}
                placeholder="Question, activity, or next step..."
                onInput={(event) => onChange({ progressDetails: event.currentTarget.value })}
              />
            </>
          )}
          {!context && !loading && (
            <div className="lesson-progress-context-error" role="status">
              Section list unavailable
              <button
                type="button"
                title="Reload material sections"
                aria-label="Reload material sections"
                onClick={onRetry}
              >
                <i className="fi fi-sr-refresh" aria-hidden="true" />
              </button>
            </div>
          )}
          {context?.previous && (
            <p className="lesson-progress-previous">
              <i className="fi fi-sr-time-past" aria-hidden="true" />
              Previous lesson:{' '}
              {context.previous.completionStatus === 'completed'
                ? 'Completed'
                : context.previous.stoppedAtLabel || 'In progress'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
