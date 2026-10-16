import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
import { lessonNotesLabels } from '../data/lessonNotesLabels';
import { lessonNotesIcons } from '../data/lessonNotesIcons';
import { STUDENT_FEEDBACK_MIN_LENGTH, TUTOR_HANDOFF_MAX_LENGTH } from '../utils/lessonNotesValidation';
import './NotesWidget.css';
export default function LessonFeedbackFields(_props0: {
    studentComment: string;
    tutorMemo: string;
    setStudentComment: (value: string) => void;
    setTutorMemo: (value: string) => void;
    disabled: boolean;
    required?: boolean;
    feedbackError?: string;
    handoffError?: string;
    privacyReminder?: boolean;
}) {
    return (<>
      <div class="dispatch-notes-section">
        <label class="dispatch-notes-label">
          <TutorIcon name={lessonNotesIcons.studentFeedback} aria-hidden="true"/>
          {lessonNotesLabels.studentFeedback}
          {(_props0["required"] === undefined ? false : _props0["required"]) && <span class="notes-field-optional">Required</span>}
        </label>
        {(_props0["privacyReminder"] === undefined ? false : _props0["privacyReminder"]) && <p id="lesson-feedback-privacy" class="lesson-feedback-privacy" role="note">
          <TutorIcon name="fi fi-sr-info" aria-hidden="true"/>Keep feedback focused on the lesson and greet the student with "Hello!". Never include the student's name or other personal information.
        </p>}
        <textarea class="dispatch-notes-textarea dispatch-notes-textarea--tall" aria-label="Student feedback" aria-required={_props0["required"] === undefined ? false : _props0["required"]} aria-invalid={Boolean(_props0["feedbackError"] === undefined ? '' : _props0["feedbackError"])} aria-describedby={['lesson-feedback-count', (_props0["feedbackError"] === undefined ? '' : _props0["feedbackError"]) ? 'lesson-feedback-error' : '', (_props0["privacyReminder"] === undefined ? false : _props0["privacyReminder"]) ? 'lesson-feedback-privacy' : ''].filter(Boolean).join(' ')} maxLength={20000} placeholder="Feedback the student can review after this lesson..." value={_props0["studentComment"]} disabled={_props0["disabled"]} onInput={(e) => _props0["setStudentComment"]((e.target as HTMLTextAreaElement).value)}/>
        <p id="lesson-feedback-count" class="notes-character-count">{_props0["studentComment"].trim().length} characters / {STUDENT_FEEDBACK_MIN_LENGTH} minimum</p>
        {(_props0["feedbackError"] === undefined ? '' : _props0["feedbackError"]) && <p id="lesson-feedback-error" class="notes-field-error">{_props0["feedbackError"] === undefined ? '' : _props0["feedbackError"]}</p>}
      </div>

      <div class="dispatch-notes-section">
        <label class="dispatch-notes-label">
          <TutorIcon name={lessonNotesIcons.tutorHandoff} aria-hidden="true"/>
          {lessonNotesLabels.tutorHandoff}
        </label>
        <textarea class="dispatch-notes-textarea dispatch-notes-textarea--tall" aria-label="Tutor handoff" aria-invalid={Boolean(_props0["handoffError"] === undefined ? '' : _props0["handoffError"])} aria-describedby={['lesson-handoff-count', (_props0["handoffError"] === undefined ? '' : _props0["handoffError"]) ? 'lesson-handoff-error' : ''].filter(Boolean).join(' ')} maxLength={TUTOR_HANDOFF_MAX_LENGTH} placeholder="Notes for the next tutor (not shared with the student)..." value={_props0["tutorMemo"]} disabled={_props0["disabled"]} onInput={(e) => _props0["setTutorMemo"]((e.target as HTMLTextAreaElement).value)}/>
        <p id="lesson-handoff-count" class="notes-character-count">{_props0["tutorMemo"].length} / {TUTOR_HANDOFF_MAX_LENGTH} characters (optional)</p>
        {(_props0["handoffError"] === undefined ? '' : _props0["handoffError"]) && <p id="lesson-handoff-error" class="notes-field-error">{_props0["handoffError"] === undefined ? '' : _props0["handoffError"]}</p>}
      </div>
    </>);
}
