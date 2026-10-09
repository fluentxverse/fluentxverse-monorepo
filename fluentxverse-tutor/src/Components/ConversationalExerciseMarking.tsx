import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { tutorApi, type ClassroomExerciseMark } from '../api/tutor.api';
import type { MarkableExerciseItem } from '../utils/conversationalExerciseMarks';
import './ConversationalExerciseMarking.css';

interface Props {
  sessionId: string;
  lessonId: string;
  step: 'A' | 'B';
  items: MarkableExerciseItem[];
  renderPrompt?: (item: MarkableExerciseItem) => ComponentChildren;
}

const plainText = (value: string) => {
  const node = document.createElement('div');
  node.innerHTML = value;
  return (node.textContent || '').replace(/\s+/g, ' ').trim();
};

export function ConversationalExerciseMarking({ sessionId, lessonId, step, items, renderPrompt }: Props) {
  const [marks, setMarks] = useState<Record<number, ClassroomExerciseMark>>({});
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const itemSignature = items.map(item => `${item.itemIndex}:${item.prompt}`).join('|');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    tutorApi.getClassroomExerciseMarks(sessionId, lessonId)
      .then(saved => {
        if (!active) return;
        const currentItems = new Map(items.map(item => [item.itemIndex, plainText(item.prompt)]));
        const stepMarks = saved.filter(mark => mark.step === step && currentItems.get(mark.itemIndex) === mark.prompt);
        setMarks(Object.fromEntries(stepMarks.map(mark => [mark.itemIndex, mark])));
        setResponses(Object.fromEntries(stepMarks.map(mark => [mark.itemIndex, mark.studentResponse])));
      })
      .catch(() => {
        if (active) setError('Marks could not be loaded. Retry by reopening the lesson.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [sessionId, lessonId, step, itemSignature]);

  if (!items.length) return null;

  const save = async (item: MarkableExerciseItem, isCorrect: boolean | null) => {
    if (savingIndex !== null) return;
    setSavingIndex(item.itemIndex);
    setError('');
    try {
      const saved = await tutorApi.saveClassroomExerciseMark(sessionId, {
        lessonId,
        step,
        itemIndex: item.itemIndex,
        itemType: item.itemType,
        prompt: plainText(item.prompt),
        answerKey: plainText(item.answerKey),
        isCorrect,
        studentResponse: isCorrect === false ? responses[item.itemIndex] || '' : '',
      });
      setMarks(previous => {
        const next = { ...previous };
        if (saved) next[item.itemIndex] = saved;
        else delete next[item.itemIndex];
        return next;
      });
      setResponses(previous => ({ ...previous, [item.itemIndex]: saved?.studentResponse || '' }));
    } catch {
      setError('Could not save this mark. Please try again.');
    } finally {
      setSavingIndex(null);
    }
  };

  const markedCount = items.filter(item => marks[item.itemIndex]).length;
  const missedCount = items.filter(item => marks[item.itemIndex]?.isCorrect === false).length;

  return (
    <div className="csp-exercise-marking csp-exercise-marking--inline" aria-label={`Step ${step} answer marking`}>
      <div className="csp-exercise-marking-header">
        <strong>MARK ANSWERS</strong>
        <span>{loading ? 'Loading...' : `${markedCount}/${items.length} marked · ${missedCount} missed`}</span>
      </div>
      {error && <p className="csp-exercise-marking-error" role="alert">{error}</p>}
      <div className="csp-exercise-marking-list">
        {items.map(item => {
          const mark = marks[item.itemIndex];
          const pending = loading || savingIndex !== null;
          const response = responses[item.itemIndex] || '';
          const responseChanged = mark?.isCorrect === false && response !== mark.studentResponse;
          return (
            <div className="csp-exercise-marking-item" key={`${step}-${item.itemIndex}`}>
              <div className="csp-exercise-marking-row">
                <span className="csp-exercise-marking-number">{item.itemIndex + 1}.</span>
                <div className="csp-exercise-marking-prompt">{renderPrompt ? renderPrompt(item) : plainText(item.prompt)}</div>
                <div className="csp-exercise-marking-actions" role="group" aria-label={`Item ${item.itemIndex + 1}`}>
                  <button
                    type="button"
                    className={`csp-exercise-marking-button is-correct ${mark?.isCorrect === true ? 'is-selected' : ''}`}
                    title="Mark correct; click again to clear"
                    aria-label={`Mark item ${item.itemIndex + 1} correct`}
                    aria-pressed={mark?.isCorrect === true}
                    disabled={pending}
                    onClick={() => void save(item, mark?.isCorrect === true ? null : true)}
                  ><i className="ri-check-line" /></button>
                  <button
                    type="button"
                    className={`csp-exercise-marking-button is-incorrect ${mark?.isCorrect === false ? 'is-selected' : ''}`}
                    title="Mark incorrect; click again to clear"
                    aria-label={`Mark item ${item.itemIndex + 1} incorrect`}
                    aria-pressed={mark?.isCorrect === false}
                    disabled={pending}
                    onClick={() => void save(item, mark?.isCorrect === false ? null : false)}
                  ><i className="ri-close-line" /></button>
                </div>
              </div>
              {mark?.isCorrect === false && (
                <div className="csp-exercise-marking-response">
                  <input
                    type="text"
                    value={response}
                    maxLength={2000}
                    placeholder="What the student said or chose (optional)"
                    aria-label={`Student response for item ${item.itemIndex + 1}`}
                    onInput={event => setResponses(previous => ({ ...previous, [item.itemIndex]: event.currentTarget.value }))}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && responseChanged && !pending) void save(item, false);
                    }}
                  />
                  <button
                    type="button"
                    title="Save student response"
                    aria-label={`Save student response for item ${item.itemIndex + 1}`}
                    disabled={!responseChanged || pending}
                    onClick={() => void save(item, false)}
                  ><i className="ri-save-line" /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
