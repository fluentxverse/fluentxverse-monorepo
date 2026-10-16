import type { ClassroomVocabularyNote } from '../api/tutor.api';

export function getLessonVocabularyMeaning(
  item: Partial<Pick<ClassroomVocabularyNote, 'definitions' | 'selectedDefinitionIndex'>>,
): string {
  const definitions = item.definitions || [];
  const selectedIndex = Number.isInteger(item.selectedDefinitionIndex) ? item.selectedDefinitionIndex! : 0;
  const index = Math.min(Math.max(selectedIndex, 0), Math.max(definitions.length - 1, 0));
  return definitions[index]?.meaning?.trim() || 'No definition recorded.';
}
