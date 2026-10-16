import type { ClassroomLessonNotes } from '../api/tutor.api';

export const STUDENT_FEEDBACK_MIN_LENGTH = 100;
export const TUTOR_HANDOFF_MAX_LENGTH = 150;

export function validateLessonFeedback(notes: Pick<ClassroomLessonNotes, 'studentComment' | 'tutorMemo'>) {
  return {
    studentFeedback: notes.studentComment.trim().length < STUDENT_FEEDBACK_MIN_LENGTH,
    tutorHandoff: notes.tutorMemo.length > TUTOR_HANDOFF_MAX_LENGTH,
  };
}

export function validateLessonNotesEditor(notes: Pick<ClassroomLessonNotes, 'materials' | 'studentComment' | 'tutorMemo'>) {
  return {
    stoppingPoints: notes.materials.filter(note => note.materialType !== 'daily-dispatch' &&
      note.completionStatus === 'in_progress' && (!note.stoppedAt?.trim() || !note.stoppedAtLabel?.trim())),
    ...validateLessonFeedback(notes),
  };
}
