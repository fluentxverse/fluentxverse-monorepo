import type { ClassroomVocabularyNote, ClassroomGrammarNote, ClassroomPronunciationNote } from '../api/tutor.api';
import { lessonNotesLabels } from '../data/lessonNotesLabels';
import { lessonNotesIcons } from '../data/lessonNotesIcons';
import './NotesWidget.css';

export interface LearningNotesFieldsProps {
  vocabularyItems: ClassroomVocabularyNote[];
  grammarItems: ClassroomGrammarNote[];
  pronunciationItems: ClassroomPronunciationNote[];
  editVocabulary?: (index: number, patch: Partial<ClassroomVocabularyNote>) => void;
  editPronunciation?: (index: number, phonetic: string) => void;
  generateOnBlur?: boolean;
  addVocabularyItem: () => void;
  updateVocabularyWord: (index: number, value: string) => void;
  getVocabularyDefinition: (index: number) => void;
  removeVocabularyItem: (index: number) => void;
  selectDefinition: (index: number, definitionIndex: number) => void;
  toggleVocabularyDefinition: (index: number) => void;
  toggleVocabularyTranslation: (index: number) => void;
  sendVocabularyToChat?: (index: number) => void;
  addGrammarItem: () => void;
  updateYouSaid: (index: number, value: string) => void;
  getGrammarCorrection: (index: number) => void;
  removeGrammarItem: (index: number) => void;
  updateGrammarItem: (
    index: number,
    field: 'youSaid' | 'correct' | 'simpleExplanation' | 'technicalExplanation' | 'showExplanation',
    value: string | boolean,
  ) => void;
  toggleGrammarExplanation: (index: number) => void;
  sendGrammarToChat?: (index: number) => void;
  addPronunciationItem: () => void;
  updatePronunciationWord: (index: number, value: string) => void;
  getPronunciationFromAI: (index: number) => void;
  removePronunciationItem: (index: number) => void;
  togglePronunciationPhonetic: (index: number) => void;
  sendPronunciationToChat?: (index: number) => void;
}

export default function LearningNotesFields({
  vocabularyItems,
  grammarItems,
  pronunciationItems,
  editVocabulary,
  editPronunciation,
  generateOnBlur = true,
  addVocabularyItem,
  updateVocabularyWord,
  getVocabularyDefinition,
  removeVocabularyItem,
  selectDefinition,
  toggleVocabularyDefinition,
  toggleVocabularyTranslation,
  sendVocabularyToChat,
  addGrammarItem,
  updateYouSaid,
  getGrammarCorrection,
  removeGrammarItem,
  updateGrammarItem,
  toggleGrammarExplanation,
  sendGrammarToChat,
  addPronunciationItem,
  updatePronunciationWord,
  getPronunciationFromAI,
  removePronunciationItem,
  togglePronunciationPhonetic,
  sendPronunciationToChat,
}: LearningNotesFieldsProps) {
  return (
    <>
      <div className="dispatch-notes-section">
        <label className="dispatch-notes-label">
          <i className={lessonNotesIcons.words} aria-hidden="true" />
          {lessonNotesLabels.words}
        </label>
        <div className="vocabulary-items">
          {vocabularyItems.map((item, index) => (
            <div className="vocabulary-row" key={index}>
              {(editVocabulary || vocabularyItems.length > 1) && (
                <button
                  type="button"
                  className="vocabulary-remove-btn"
                  onClick={() => removeVocabularyItem(index)}
                  title="Remove"
                >
                  <i className="fi fi-sr-cross-small"  aria-hidden="true" />
                </button>
              )}
              <div className="vocabulary-inputs">
                <div className="vocabulary-field">
                  <span className="vocabulary-field-label">Word/Phrase:</span>
                  <div className="vocabulary-input-row">
                    <input
                      type="text"
                      className="vocabulary-word-input"
                      aria-label={`Word or phrase ${index + 1}`}
                      placeholder="Enter word or phrase..."
                      value={item.word}
                      onInput={(e) => updateVocabularyWord(index, (e.target as HTMLInputElement).value)}
                      onBlur={() =>
                        generateOnBlur && item.word.trim() && !item.definitions.length && getVocabularyDefinition(index)
                      }
                    />
                    <button
                      type="button"
                      className={`vocabulary-check-btn ${item.isLoading ? 'loading' : ''}`}
                      onClick={() => item.word.trim() && getVocabularyDefinition(index)}
                      disabled={item.isLoading || !item.word.trim()}
                      title="Get definition"
                    >
                      <i className={item.isLoading ? 'fi fi-sr-spinner' : 'fi fi-sr-refresh'}  aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="vocabulary-field">
                  <span className="vocabulary-field-label">Definition:</span>
                  <div className="vocabulary-definition-row">
                    {item.isLoading ? (
                      <div className="vocabulary-loading">
                        <i className="fi fi-sr-spinner"  aria-hidden="true" />
                        Getting definition...
                      </div>
                    ) : item.definitions.length > 0 ? (
                      <>
                        {item.showDefinition ? (
                          <div className="vocabulary-definition-content">
                            {item.definitions.length > 1 && (
                              <div className="vocabulary-definition-tabs">
                                {item.definitions.map((def, defIdx) => (
                                  <button
                                    type="button"
                                    key={defIdx}
                                    className={`vocabulary-def-tab ${item.selectedDefinitionIndex === defIdx ? 'active' : ''}`}
                                    onClick={() => selectDefinition(index, defIdx)}
                                    title={def.meaning}
                                  >
                                    {defIdx + 1}. {def.partOfSpeech || 'def'}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="vocabulary-definition-display">
                              {item.definitions[item.selectedDefinitionIndex]?.partOfSpeech && (
                                <span className="vocabulary-part-of-speech">
                                  ({item.definitions[item.selectedDefinitionIndex].partOfSpeech})
                                </span>
                              )}
                              <span className="vocabulary-meaning">
                                {item.definitions[item.selectedDefinitionIndex]?.meaning}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="vocabulary-definition-hidden">
                            <span>Definition hidden</span>
                          </div>
                        )}
                        <button
                          type="button"
                          className={`vocabulary-toggle-btn ${item.showDefinition ? 'active' : ''}`}
                          onClick={() => toggleVocabularyDefinition(index)}
                          title={item.showDefinition ? 'Hide definition' : 'Show definition'}
                        >
                          <i className={item.showDefinition ? 'fi fi-sr-eye' : 'fi fi-sr-eye-crossed'}  aria-hidden="true" />
                        </button>
                        {item.showDefinition && item.definitions[item.selectedDefinitionIndex]?.japaneseNative && (
                          <button
                            type="button"
                            className={`vocabulary-info-btn ${item.showTranslation ? 'active' : ''}`}
                            onClick={() => toggleVocabularyTranslation(index)}
                            title={item.showTranslation ? 'Hide translations' : 'Show translations'}
                          >
                            <i className="fi fi-sr-info"  aria-hidden="true" />
                          </button>
                        )}
                        {sendVocabularyToChat &&
                          item.word.trim() &&
                          item.definitions[item.selectedDefinitionIndex]?.meaning && (
                            <button
                              type="button"
                              className="vocabulary-send-btn"
                              onClick={() => sendVocabularyToChat(index)}
                              title="Send to chat"
                            >
                              <i className="fi fi-sr-paper-plane"  aria-hidden="true" />
                            </button>
                          )}
                      </>
                    ) : (
                      <div className="vocabulary-definition-placeholder">
                        Enter a word and click refresh to get definition
                      </div>
                    )}
                  </div>
                </div>
                {item.showTranslation && item.definitions[item.selectedDefinitionIndex]?.japaneseNative && (
                  <div className="vocabulary-translations">
                    {item.definitions[item.selectedDefinitionIndex].japaneseNative && (
                      <div className="vocabulary-translation-item japanese">
                        <span className="translation-flag" title="Japanese">
                          🇯🇵
                        </span>
                        <div className="translation-content">
                          <span className="translation-native" lang="ja">
                            {item.definitions[item.selectedDefinitionIndex].japaneseNative}
                          </span>
                          <span className="translation-romanized" lang="ja-Latn">
                            {item.definitions[item.selectedDefinitionIndex].japaneseRomanized}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {editVocabulary && (
                  <details className="notes-manual-edit">
                    <summary>Edit meanings and translations</summary>
                    {item.definitions.map((definition, d) => (
                      <div key={d} className="notes-meaning-editor">
                        <label className="notes-meaning-choice">
                          <input
                            type="radio"
                            name={`meaning-${index}`}
                            checked={item.selectedDefinitionIndex === d}
                            onChange={() => selectDefinition(index, d)}
                          />
                          Meaning {d + 1}
                        </label>
                        {(['meaning', 'partOfSpeech', 'japaneseNative', 'japaneseRomanized'] as const).map((field) => (
                          <label key={field}>
                            {field === 'meaning'
                              ? 'Definition'
                              : field === 'partOfSpeech'
                                ? 'Part of speech'
                                : field === 'japaneseNative'
                                  ? 'Japanese'
                                  : 'Romanized Japanese'}
                            <input
                              aria-label={field === 'meaning' ? `Definition ${index + 1}.${d + 1}` : undefined}
                              value={definition[field] || ''}
                              onInput={(event) =>
                                editVocabulary(index, {
                                  definitions: item.definitions.map((entry, j) =>
                                    j === d ? { ...entry, [field]: event.currentTarget.value } : entry,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                        <button
                          type="button"
                          title="Remove meaning"
                          aria-label={`Remove meaning ${index + 1}.${d + 1}`}
                          onClick={() =>
                            editVocabulary(index, {
                              definitions: item.definitions.filter((_, j) => j !== d),
                              selectedDefinitionIndex: Math.max(
                                0,
                                item.selectedDefinitionIndex >= d
                                  ? item.selectedDefinitionIndex - 1
                                  : item.selectedDefinitionIndex,
                              ),
                            })
                          }
                        >
                          <i className="fi fi-sr-trash" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        editVocabulary(index, { definitions: [...item.definitions, { meaning: '', partOfSpeech: '' }] })
                      }
                    >
                      <i className="fi fi-sr-plus" aria-hidden="true" />
                      Add meaning
                    </button>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="vocabulary-add-btn" onClick={addVocabularyItem}>
          <i className="fi fi-sr-plus"  aria-hidden="true" />
          Add word or phrase
        </button>
      </div>

      <div className="dispatch-notes-section">
        <label className="dispatch-notes-label">
          <i className={lessonNotesIcons.grammar} aria-hidden="true" />
          {lessonNotesLabels.grammar}
        </label>
        <div className="grammar-items">
          {grammarItems.map((item, index) => (
            <div className="grammar-row" key={index}>
              {grammarItems.length > 1 && (
                <button
                  type="button"
                  className="grammar-remove-btn"
                  onClick={() => removeGrammarItem(index)}
                  title="Remove"
                >
                  <i className="fi fi-sr-cross-small"  aria-hidden="true" />
                </button>
              )}
              <div className="grammar-inputs">
                <div className="grammar-field">
                  <span className="grammar-field-label">You said:</span>
                  <div className="grammar-input-row">
                    <textarea
                      className="grammar-input"
                      aria-label={`You said ${index + 1}`}
                      placeholder="Enter incorrect sentence..."
                      value={item.youSaid}
                      onInput={(e) => updateYouSaid(index, (e.target as HTMLTextAreaElement).value)}
                      onBlur={() =>
                        generateOnBlur && item.youSaid.trim() && !item.correct && getGrammarCorrection(index)
                      }
                      rows={1}
                    />
                    <button
                      type="button"
                      className={`grammar-check-btn ${item.isLoading ? 'loading' : ''}`}
                      onClick={() => item.youSaid.trim() && getGrammarCorrection(index)}
                      disabled={item.isLoading || !item.youSaid.trim()}
                      title="Check grammar"
                    >
                      <i className={item.isLoading ? 'fi fi-sr-spinner' : 'fi fi-sr-refresh'}  aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="grammar-field">
                  <span className="grammar-field-label">Correct:</span>
                  <div className="grammar-correct-row">
                    {item.isLoading ? (
                      <div className="grammar-loading">
                        <i className="fi fi-sr-spinner"  aria-hidden="true" />
                        Checking...
                      </div>
                    ) : (
                      <>
                        <textarea
                          className="grammar-input grammar-input-correct"
                          aria-label={`Correct ${index + 1}`}
                          placeholder="Corrected sentence..."
                          value={item.correct}
                          onInput={(e) => updateGrammarItem(index, 'correct', (e.target as HTMLTextAreaElement).value)}
                          rows={1}
                        />
                        {(item.simpleExplanation || item.technicalExplanation) && (
                          <button
                            type="button"
                            className={`grammar-info-btn ${item.showExplanation ? 'active' : ''}`}
                            onClick={() => toggleGrammarExplanation(index)}
                            title="Show explanation"
                          >
                            <i className="fi fi-sr-info"  aria-hidden="true" />
                          </button>
                        )}
                        {sendGrammarToChat && item.youSaid.trim() && item.correct.trim() && (
                          <button
                            type="button"
                            className="grammar-send-btn"
                            onClick={() => sendGrammarToChat(index)}
                            title="Send to chat"
                          >
                            <i className="fi fi-sr-paper-plane"  aria-hidden="true" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {item.showExplanation && (item.simpleExplanation || item.technicalExplanation) && (
                  <div className="grammar-explanation">
                    <div className="grammar-explanation-simple">
                      <i className="fi fi-sr-lightbulb-on"  aria-hidden="true" />
                      {item.simpleExplanation}
                    </div>
                    <div className="grammar-explanation-technical">
                      <i className="fi fi-sr-book-alt"  aria-hidden="true" />
                      {item.technicalExplanation}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="grammar-add-btn" onClick={addGrammarItem}>
          <i className="fi fi-sr-plus"  aria-hidden="true" />
          Add Grammar Note
        </button>
      </div>

      <div className="dispatch-notes-section">
        <label className="dispatch-notes-label">
          <i className={lessonNotesIcons.pronunciation} aria-hidden="true" />
          {lessonNotesLabels.pronunciation}
        </label>
        <div className="pronunciation-items">
          {pronunciationItems.map((item, index) => (
            <div className="pronunciation-row" key={index}>
              {(editPronunciation || pronunciationItems.length > 1) && (
                <button
                  type="button"
                  className="pronunciation-remove-btn"
                  onClick={() => removePronunciationItem(index)}
                  title="Remove"
                >
                  <i className="fi fi-sr-cross-small"  aria-hidden="true" />
                </button>
              )}
              <div className="pronunciation-inputs">
                <div className="pronunciation-field">
                  <span className="pronunciation-field-label">Word:</span>
                  <div className="pronunciation-input-row">
                    <input
                      type="text"
                      className="pronunciation-word-input"
                      aria-label={`Pronunciation word ${index + 1}`}
                      placeholder="Enter word..."
                      value={item.word}
                      onInput={(e) => updatePronunciationWord(index, (e.target as HTMLInputElement).value)}
                      onBlur={() =>
                        generateOnBlur && item.word.trim() && !item.phonetic && getPronunciationFromAI(index)
                      }
                    />
                    <button
                      type="button"
                      className={`pronunciation-check-btn ${item.isLoading ? 'loading' : ''}`}
                      onClick={() => item.word.trim() && getPronunciationFromAI(index)}
                      disabled={item.isLoading || !item.word.trim()}
                      title="Get pronunciation"
                    >
                      <i className={item.isLoading ? 'fi fi-sr-spinner' : 'fi fi-sr-refresh'}  aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="pronunciation-field">
                  <span className="pronunciation-field-label">Phonetic:</span>
                  <div className="pronunciation-phonetic-row">
                    {item.isLoading ? (
                      <div className="pronunciation-loading">
                        <i className="fi fi-sr-spinner"  aria-hidden="true" />
                        Getting pronunciation...
                      </div>
                    ) : item.phonetic ? (
                      <>
                        {item.showPhonetic ? (
                          <div className="pronunciation-phonetic-content">
                            <div className="pronunciation-display">
                              <span className="pronunciation-phonetic-display">{item.phonetic}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="pronunciation-phonetic-hidden">
                            <span>Pronunciation hidden</span>
                          </div>
                        )}
                        <button
                          type="button"
                          className={`pronunciation-toggle-btn ${item.showPhonetic ? 'active' : ''}`}
                          onClick={() => togglePronunciationPhonetic(index)}
                          title={item.showPhonetic ? 'Hide pronunciation' : 'Show pronunciation'}
                        >
                          <i className={item.showPhonetic ? 'fi fi-sr-eye' : 'fi fi-sr-eye-crossed'}  aria-hidden="true" />
                        </button>
                        {sendPronunciationToChat && item.word.trim() && item.phonetic && (
                          <button
                            type="button"
                            className="pronunciation-send-btn"
                            onClick={() => sendPronunciationToChat(index)}
                            title="Send to chat"
                          >
                            <i className="fi fi-sr-paper-plane"  aria-hidden="true" />
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="pronunciation-phonetic-placeholder">
                        Enter a word and click refresh to get pronunciation
                      </div>
                    )}
                  </div>
                </div>
                {editPronunciation && (
                  <label className="notes-manual-edit">
                    Edit phonetic spelling
                    <input
                      aria-label={`Phonetic ${index + 1}`}
                      value={item.phonetic}
                      onInput={(event) => editPronunciation(index, event.currentTarget.value)}
                    />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="pronunciation-add-btn" onClick={addPronunciationItem}>
          <i className="fi fi-sr-plus"  aria-hidden="true" />
          Add Pronunciation Note
        </button>
      </div>
    </>
  );
}
