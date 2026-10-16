import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
import { tutorApi, type ClassroomExerciseMark } from '../api/tutor.api';
import type { MarkableExerciseItem } from '../utils/conversationalExerciseMarks';
import './ConversationalExerciseMarking.css';
interface Props {
    sessionId: string;
    lessonId: string;
    step: 'A' | 'B';
    items: MarkableExerciseItem[];
    renderPrompt?: (item: MarkableExerciseItem) => JSX.Element;
}
const plainText = (value: string) => {
    const node = document.createElement('div');
    node.innerHTML = value;
    return (node.textContent || '').replace(/\s+/g, ' ').trim();
};
export function ConversationalExerciseMarking(_props0: Props) {
    const [marks, setMarks] = createSignal<Record<number, ClassroomExerciseMark>>({});
    const [responses, setResponses] = createSignal<Record<number, string>>({});
    const [loading, setLoading] = createSignal(true);
    const [savingIndex, setSavingIndex] = createSignal<number | null>(null);
    const [error, setError] = createSignal('');
    const itemSignature = createMemo(() => _props0["items"].map(item => `${item.itemIndex}:${item.prompt}`).join('|'));
    createEffect(on(() => [_props0["sessionId"], _props0["lessonId"], _props0["step"], itemSignature()], () => {
        const _cleanup1 = untrack(() => {
            let active = true;
            setLoading(true);
            setError('');
            tutorApi.getClassroomExerciseMarks(_props0["sessionId"], _props0["lessonId"])
                .then(saved => {
                if (!active)
                    return;
                const currentItems = new Map(_props0["items"].map(item => [item.itemIndex, plainText(item.prompt)]));
                const stepMarks = saved.filter(mark => mark.step === _props0["step"] && currentItems.get(mark.itemIndex) === mark.prompt);
                setMarks(Object.fromEntries(stepMarks.map(mark => [mark.itemIndex, mark])));
                setResponses(Object.fromEntries(stepMarks.map(mark => [mark.itemIndex, mark.studentResponse])));
            })
                .catch(() => {
                if (active)
                    setError('Marks could not be loaded. Retry by reopening the lesson.');
            })
                .finally(() => {
                if (active)
                    setLoading(false);
            });
            return () => { active = false; };
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    return createMemo(() => {
        if (!_props0["items"].length)
            return null;
        const save = async (item: MarkableExerciseItem, isCorrect: boolean | null) => {
            if (savingIndex() !== null)
                return;
            setSavingIndex(item.itemIndex);
            setError('');
            try {
                const saved = await tutorApi.saveClassroomExerciseMark(_props0["sessionId"], {
                    lessonId: _props0["lessonId"],
                    step: _props0["step"],
                    itemIndex: item.itemIndex,
                    itemType: item.itemType,
                    prompt: plainText(item.prompt),
                    answerKey: plainText(item.answerKey),
                    isCorrect,
                    studentResponse: isCorrect === false ? responses()[item.itemIndex] || '' : ''
                });
                setMarks(previous => {
                    const next = { ...previous };
                    if (saved)
                        next[item.itemIndex] = saved;
                    else
                        delete next[item.itemIndex];
                    return next;
                });
                setResponses(previous => ({ ...previous, [item.itemIndex]: saved?.studentResponse || '' }));
            }
            catch {
                setError('Could not save this mark. Please try again.');
            }
            finally {
                setSavingIndex(null);
            }
        };
        const markedCount = createMemo(() => _props0["items"].filter(item => marks()[item.itemIndex]).length);
        const missedCount = createMemo(() => _props0["items"].filter(item => marks()[item.itemIndex]?.isCorrect === false).length);
        return (<div class="csp-exercise-marking csp-exercise-marking--inline" aria-label={`Step ${_props0["step"]} answer marking`}>
      <div class="csp-exercise-marking-header">
        <strong>MARK ANSWERS</strong>
        <span>{loading() ? 'Loading...' : `${markedCount()}/${_props0["items"].length} marked · ${missedCount()} missed`}</span>
      </div>
      {error() && <p class="csp-exercise-marking-error" role="alert">{error()}</p>}
      <div class="csp-exercise-marking-list">
        {_props0["items"].map(item => {
                const mark = marks()[item.itemIndex];
                const pending = loading() || savingIndex() !== null;
                const response = responses()[item.itemIndex] || '';
                const responseChanged = mark?.isCorrect === false && response !== mark.studentResponse;
                return (<div class="csp-exercise-marking-item">
              <div class="csp-exercise-marking-row">
                <span class="csp-exercise-marking-number">{item.itemIndex + 1}.</span>
                <div class="csp-exercise-marking-prompt">{_props0["renderPrompt"] ? _props0["renderPrompt"](item) : plainText(item.prompt)}</div>
                <div class="csp-exercise-marking-actions" role="group" aria-label={`Item ${item.itemIndex + 1}`}>
                  <button type="button" class={`csp-exercise-marking-button is-correct ${mark?.isCorrect === true ? 'is-selected' : ''}`} title="Mark correct; click again to clear" aria-label={`Mark item ${item.itemIndex + 1} correct`} aria-pressed={mark?.isCorrect === true} disabled={pending} onClick={() => void save(item, mark?.isCorrect === true ? null : true)}><TutorIcon name="ri-check-line"/></button>
                  <button type="button" class={`csp-exercise-marking-button is-incorrect ${mark?.isCorrect === false ? 'is-selected' : ''}`} title="Mark incorrect; click again to clear" aria-label={`Mark item ${item.itemIndex + 1} incorrect`} aria-pressed={mark?.isCorrect === false} disabled={pending} onClick={() => void save(item, mark?.isCorrect === false ? null : false)}><TutorIcon name="ri-close-line"/></button>
                </div>
              </div>
              {mark?.isCorrect === false && (<div class="csp-exercise-marking-response">
                  <input type="text" value={response} maxLength={2000} placeholder="What the student said or chose (optional)" aria-label={`Student response for item ${item.itemIndex + 1}`} onInput={event => setResponses(previous => ({ ...previous, [item.itemIndex]: event.currentTarget.value }))} onKeyDown={event => {
                            if (event.key === 'Enter' && responseChanged && !pending)
                                void save(item, false);
                        }}/>
                  <button type="button" title="Save student response" aria-label={`Save student response for item ${item.itemIndex + 1}`} disabled={!responseChanged || pending} onClick={() => void save(item, false)}><TutorIcon name="ri-save-line"/></button>
                </div>)}
            </div>);
            })}
      </div>
    </div>);
    }) as unknown as JSX.Element;
}
