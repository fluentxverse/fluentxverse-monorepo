import { lessonNotesLabels } from '../data/lessonNotesLabels';
import { lessonNotesIcons } from '../data/lessonNotesIcons';
import { STUDENT_FEEDBACK_MIN_LENGTH, TUTOR_HANDOFF_MAX_LENGTH } from '../utils/lessonNotesValidation';
import './NotesWidget.css';

export default function LessonFeedbackFields({
  studentComment,
  tutorMemo,
  setStudentComment,
  setTutorMemo,
  disabled,
  required = false,
  feedbackError = '',
  handoffError = '',
  privacyReminder = false,
}: {
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
  return (
    <>
      <div className="dispatch-notes-section">
        <label className="dispatch-notes-label">
          <i className={lessonNotesIcons.studentFeedback} aria-hidden="true" />
          {lessonNotesLabels.studentFeedback}
          {required && <span className="notes-field-optional">Required</span>}
        </label>
        {privacyReminder && <p id="lesson-feedback-privacy" className="lesson-feedback-privacy" role="note">
          <i className="fi fi-sr-info" aria-hidden="true" />Keep feedback focused on the lesson and greet the student with "Hello!". Never include the student's name or other personal information.
        </p>}
        <textarea
          className="dispatch-notes-textarea dispatch-notes-textarea--tall"
          aria-label="Student feedback"
          aria-required={required}
          aria-invalid={Boolean(feedbackError)}
          aria-describedby={['lesson-feedback-count', feedbackError ? 'lesson-feedback-error' : '', privacyReminder ? 'lesson-feedback-privacy' : ''].filter(Boolean).join(' ')}
          maxLength={20000}
          placeholder="Feedback the student can review after this lesson..."
          value={studentComment}
          disabled={disabled}
          onInput={(e) => setStudentComment((e.target as HTMLTextAreaElement).value)}
        />
        <p id="lesson-feedback-count" className="notes-character-count">{studentComment.trim().length} characters / {STUDENT_FEEDBACK_MIN_LENGTH} minimum</p>
        {feedbackError && <p id="lesson-feedback-error" className="notes-field-error">{feedbackError}</p>}
      </div>

      <div className="dispatch-notes-section">
        <label className="dispatch-notes-label">
          <i className={lessonNotesIcons.tutorHandoff} aria-hidden="true" />
          {lessonNotesLabels.tutorHandoff}
        </label>
        <textarea
          className="dispatch-notes-textarea dispatch-notes-textarea--tall"
          aria-label="Tutor handoff"
          aria-invalid={Boolean(handoffError)}
          aria-describedby={['lesson-handoff-count', handoffError ? 'lesson-handoff-error' : ''].filter(Boolean).join(' ')}
          maxLength={TUTOR_HANDOFF_MAX_LENGTH}
          placeholder="Notes for the next tutor (not shared with the student)..."
          value={tutorMemo}
          disabled={disabled}
          onInput={(e) => setTutorMemo((e.target as HTMLTextAreaElement).value)}
        />
        <p id="lesson-handoff-count" className="notes-character-count">{tutorMemo.length} / {TUTOR_HANDOFF_MAX_LENGTH} characters (optional)</p>
        {handoffError && <p id="lesson-handoff-error" className="notes-field-error">{handoffError}</p>}
      </div>
    </>
  );
}
