import { useEffect, useRef, useState } from 'preact/hooks';
import type {
  ClassroomNotesRecord,
  ClassroomVocabularyNote,
  ClassroomGrammarNote,
  ClassroomPronunciationNote,
} from '../api/tutor.api';
import { client } from '../api/utils';
import LearningNotesFields from './LearningNotesFields';

const wordNote = (): ClassroomVocabularyNote => ({
  word: '',
  definitions: [],
  selectedDefinitionIndex: 0,
  isLoading: false,
  showDefinition: true,
  showTranslation: true,
});
const grammarNote = (): ClassroomGrammarNote => ({
  youSaid: '',
  correct: '',
  simpleExplanation: '',
  technicalExplanation: '',
  isLoading: false,
  showExplanation: true,
});
const pronunciationNote = (): ClassroomPronunciationNote => ({
  word: '',
  phonetic: '',
  isLoading: false,
  showPhonetic: true,
});
type Group = 'vocabularyItems' | 'grammarItems' | 'pronunciationItems';
type Item = ClassroomVocabularyNote | ClassroomGrammarNote | ClassroomPronunciationNote;

export default function LessonEditorLearningFields({
  note,
  disabled,
  onChange,
}: {
  note: ClassroomNotesRecord;
  disabled: boolean;
  onChange: (update: (note: ClassroomNotesRecord) => ClassroomNotesRecord) => void;
}) {
  const latest = useRef({ note, disabled, onChange });
  latest.current = { note, disabled, onChange };
  const requests = useRef(new Map<string, AbortController>());
  const [error, setError] = useState('');
  useEffect(
    () => () => {
      if (!requests.current.size) return;
      requests.current.forEach((controller) => controller.abort());
      requests.current.clear();
      latest.current.onChange((previous) => ({
        ...previous,
        vocabularyItems: previous.vocabularyItems.map((item) => ({ ...item, isLoading: false })),
        grammarItems: previous.grammarItems.map((item) => ({ ...item, isLoading: false })),
        pronunciationItems: previous.pronunciationItems.map((item) => ({ ...item, isLoading: false })),
      }));
    },
    [],
  );
  const change = (group: Group, index: number, patch: Partial<Item>) => {
    if (latest.current.disabled) return;
    const request = requests.current.get(`${group}:${index}`);
    request?.abort();
    requests.current.delete(`${group}:${index}`);
    latest.current.onChange((previous) => ({
      ...previous,
      [group]: previous[group].map((item, i) => (i === index ? { ...item, ...patch, isLoading: false } : item)),
    }));
  };
  const remove = (group: Group, index: number) => {
    if (latest.current.disabled) return;
    // Index changes invalidate outstanding responses for this group.
    for (const [id, controller] of requests.current)
      if (id.startsWith(group + ':')) {
        controller.abort();
        requests.current.delete(id);
      }
    latest.current.onChange((previous) => ({
      ...previous,
      [group]: previous[group].filter((_, i) => i !== index).map((item) => ({ ...item, isLoading: false })),
    }));
  };
  const add = (group: Group, item: Item) => {
    if (!latest.current.disabled)
      latest.current.onChange((previous) => ({ ...previous, [group]: [...previous[group], item] }));
  };
  const generate = async (group: Group, index: number) => {
    if (latest.current.disabled) return;
    const item = latest.current.note[group][index];
    const text =
      group === 'grammarItems' ? (item as ClassroomGrammarNote).youSaid : (item as ClassroomVocabularyNote).word;
    const id = `${group}:${index}`;
    if (!text?.trim() || item.isLoading || requests.current.has(id)) return;
    const controller = new AbortController();
    requests.current.set(id, controller);
    setError('');
    const apply = (patch: Partial<Item>) => {
      if (controller.signal.aborted || latest.current.disabled || requests.current.get(id) !== controller) return;
      latest.current.onChange((previous) => ({
        ...previous,
        [group]: previous[group].map((current, i) => {
          const currentText =
            group === 'grammarItems'
              ? (current as ClassroomGrammarNote).youSaid
              : (current as ClassroomVocabularyNote).word;
          return i === index && currentText === text ? { ...current, ...patch, isLoading: false } : current;
        }),
      }));
    };
    latest.current.onChange((previous) => ({
      ...previous,
      [group]: previous[group].map((current, i) => (i === index ? { ...current, isLoading: true } : current)),
    }));
    try {
      const path =
        group === 'vocabularyItems'
          ? 'vocabulary-definition'
          : group === 'grammarItems'
            ? 'grammar-check'
            : 'pronunciation';
      const { data } = await client.post(`/ai/${path}`, group === 'grammarItems' ? { text } : { word: text }, {
        signal: controller.signal,
      });
      if (group === 'vocabularyItems')
        apply({
          definitions: data.definitions || [],
          selectedDefinitionIndex: 0,
          showDefinition: true,
          showTranslation: true,
        });
      else if (group === 'grammarItems')
        apply({
          correct: data.corrected || text,
          simpleExplanation: data.simpleExplanation || 'No correction needed.',
          technicalExplanation: data.technicalExplanation || 'No correction needed.',
          showExplanation: true,
        });
      else apply({ phonetic: data.phonetic || '', showPhonetic: true });
    } catch {
      if (!controller.signal.aborted && !latest.current.disabled) {
        apply({});
        setError('Could not generate this note. Try again or edit it manually.');
      }
    } finally {
      if (requests.current.get(id) === controller) requests.current.delete(id);
    }
  };
  return (
    <>
      {error && (
        <p className="lne-error" role="alert">
          {error}
        </p>
      )}
      <LearningNotesFields
        {...note}
        generateOnBlur={false}
        addVocabularyItem={() => add('vocabularyItems', wordNote())}
        updateVocabularyWord={(index, word) =>
          change('vocabularyItems', index, {
            word,
            definitions: [],
            selectedDefinitionIndex: 0,
            showDefinition: true,
            showTranslation: true,
          })
        }
        getVocabularyDefinition={(index) => generate('vocabularyItems', index)}
        removeVocabularyItem={(index) => remove('vocabularyItems', index)}
        selectDefinition={(index, selectedDefinitionIndex) =>
          change('vocabularyItems', index, { selectedDefinitionIndex })
        }
        toggleVocabularyDefinition={(index) =>
          change('vocabularyItems', index, { showDefinition: !note.vocabularyItems[index].showDefinition })
        }
        toggleVocabularyTranslation={(index) =>
          change('vocabularyItems', index, { showTranslation: !note.vocabularyItems[index].showTranslation })
        }
        editVocabulary={(index, patch) => change('vocabularyItems', index, patch)}
        addGrammarItem={() => add('grammarItems', grammarNote())}
        updateYouSaid={(index, youSaid) => change('grammarItems', index, { youSaid })}
        getGrammarCorrection={(index) => generate('grammarItems', index)}
        removeGrammarItem={(index) => remove('grammarItems', index)}
        updateGrammarItem={(index, field, value) => change('grammarItems', index, { [field]: value })}
        toggleGrammarExplanation={(index) =>
          change('grammarItems', index, { showExplanation: !note.grammarItems[index].showExplanation })
        }
        addPronunciationItem={() => add('pronunciationItems', pronunciationNote())}
        updatePronunciationWord={(index, word) =>
          change('pronunciationItems', index, { word, phonetic: '', showPhonetic: true })
        }
        getPronunciationFromAI={(index) => generate('pronunciationItems', index)}
        removePronunciationItem={(index) => remove('pronunciationItems', index)}
        togglePronunciationPhonetic={(index) =>
          change('pronunciationItems', index, { showPhonetic: !note.pronunciationItems[index].showPhonetic })
        }
        editPronunciation={(index, phonetic) => change('pronunciationItems', index, { phonetic, showPhonetic: true })}
      />
    </>
  );
}
