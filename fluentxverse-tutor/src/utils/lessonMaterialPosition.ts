import type { ClassroomNotesRecord } from '../api/tutor.api';

export function lessonMaterialPosition(note: Pick<ClassroomNotesRecord, 'materialType' | 'materialLevel' | 'materialChapter'>): string {
  if (note.materialType !== 'conversational-skills') return '';
  return [[note.materialLevel, 'Level'], [note.materialChapter, 'Chapter']].flatMap(([value, label]) =>
    typeof value === 'number' && Number.isInteger(value) && value > 0 ? [`${label} ${value}`] : [],
  ).join(' \u00b7 ');
}
