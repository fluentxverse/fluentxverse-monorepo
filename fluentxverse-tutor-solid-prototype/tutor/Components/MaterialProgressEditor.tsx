import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
import type { ClassroomMaterialProgress, ClassroomNotesRecord } from '../api/tutor.api';
import './NotesWidget.css';
import { lessonNotesIcons } from '../data/lessonNotesIcons';
type Progress = Pick<ClassroomNotesRecord, 'completionStatus' | 'stoppedAt' | 'stoppedAtLabel' | 'progressDetails'>;
export default function MaterialProgressEditor(_props0: {
    materialType: string;
    progress: Progress;
    context: ClassroomMaterialProgress | null;
    loading: boolean;
    onChange: (patch: Partial<Progress>) => void;
    onRetry: () => void;
    required?: boolean;
    error?: string;
}) {
    const sections = createMemo(() => _props0["context"]?.sections || []);
    return (<section class="lesson-material-progress-editor" aria-label="Material progress">
      <label class="dispatch-notes-label">
        <TutorIcon name={lessonNotesIcons.progress} aria-hidden="true"/>
        Material progress
      </label>
      {_props0["materialType"] === 'daily-dispatch' ? (<div class="lesson-material-completed">
          <TutorIcon name={lessonNotesIcons.completed} aria-hidden="true"/>
          Completed
        </div>) : (<>
          <div class="lesson-progress-status" role="group" aria-label="Completion status">
            {(['in_progress', 'completed'] as const).map((status) => (<button type="button" aria-pressed={_props0["progress"].completionStatus === status} onClick={() => _props0["onChange"]({
                    completionStatus: status,
                    ...(status === 'completed' ? { stoppedAt: null, stoppedAtLabel: null, progressDetails: '' } : {})
                })}>
                <TutorIcon name={status === 'completed' ? lessonNotesIcons.completed : lessonNotesIcons.inProgress} aria-hidden="true"/>
                {status === 'completed' ? 'Completed' : 'In progress'}
              </button>))}
          </div>
          {_props0["progress"].completionStatus !== 'completed' && (<>
              <label for="material-stopped-at">Stopped at{(_props0["required"] === undefined ? false : _props0["required"]) && <span class="notes-field-optional"> (Required)</span>}</label>
              <select id="material-stopped-at" value={_props0["progress"].stoppedAt || ''} disabled={!_props0["context"]} aria-required={_props0["required"] === undefined ? false : _props0["required"]} aria-invalid={Boolean(_props0["error"] === undefined ? '' : _props0["error"])} aria-describedby={(_props0["error"] === undefined ? '' : _props0["error"]) ? 'lesson-stopping-point-error' : undefined} onChange={(event) => {
                    const id = event.currentTarget.value;
                    _props0["onChange"]({
                        stoppedAt: id || null,
                        get stoppedAtLabel() {
                            return sections().find((section) => section.id === id)?.label || null;
                        }
                    });
                }}>
                <option value="">Select a stopping point</option>
                {_props0["progress"].stoppedAt && !sections().some((section) => section.id === _props0["progress"].stoppedAt) && (<option value={_props0["progress"].stoppedAt}>{_props0["progress"].stoppedAtLabel || _props0["progress"].stoppedAt}</option>)}
                {sections().map((section) => (<option value={section.id}>
                    {section.label}
                  </option>))}
              </select>
              {(_props0["error"] === undefined ? '' : _props0["error"]) && <p id="lesson-stopping-point-error" class="notes-field-error">{_props0["error"] === undefined ? '' : _props0["error"]}</p>}
              <label for="material-progress-details">Progress details</label>
              <input id="material-progress-details" value={_props0["progress"].progressDetails || ''} maxLength={2000} placeholder="Question, activity, or next step..." onInput={(event) => _props0["onChange"]({ progressDetails: event.currentTarget.value })}/>
            </>)}
          {!_props0["context"] && !_props0["loading"] && (<div class="lesson-progress-context-error" role="status">
              Section list unavailable
              <button type="button" title="Reload material sections" aria-label="Reload material sections" onClick={_props0["onRetry"]}>
                <TutorIcon name="fi fi-sr-refresh" aria-hidden="true"/>
              </button>
            </div>)}
          {_props0["context"]?.previous && (<p class="lesson-progress-previous">
              <TutorIcon name="fi fi-sr-time-past" aria-hidden="true"/>
              Previous lesson:{' '}
              {_props0["context"].previous.completionStatus === 'completed'
                    ? 'Completed'
                    : _props0["context"].previous.stoppedAtLabel || 'In progress'}
            </p>)}
        </>)}
    </section>);
}
