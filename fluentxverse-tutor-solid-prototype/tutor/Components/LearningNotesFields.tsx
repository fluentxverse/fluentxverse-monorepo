import { Index } from "solid-js";
import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
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
    updateGrammarItem: (index: number, field: 'youSaid' | 'correct' | 'simpleExplanation' | 'technicalExplanation' | 'showExplanation', value: string | boolean) => void;
    toggleGrammarExplanation: (index: number) => void;
    sendGrammarToChat?: (index: number) => void;
    addPronunciationItem: () => void;
    updatePronunciationWord: (index: number, value: string) => void;
    getPronunciationFromAI: (index: number) => void;
    removePronunciationItem: (index: number) => void;
    togglePronunciationPhonetic: (index: number) => void;
    sendPronunciationToChat?: (index: number) => void;
}
export default function LearningNotesFields(_props0: LearningNotesFieldsProps) {
    return (<>
      <div class="dispatch-notes-section">
        <label class="dispatch-notes-label">
          <TutorIcon name={lessonNotesIcons.words} aria-hidden="true"/>
          {lessonNotesLabels.words}
        </label>
        <div class="vocabulary-items">
          {<Index each={_props0["vocabularyItems"]}>{(item, index) => (<div class="vocabulary-row">
              {(_props0["editVocabulary"] || _props0["vocabularyItems"].length > 1) && (<button type="button" class="vocabulary-remove-btn" onClick={() => _props0["removeVocabularyItem"](index)} title="Remove">
                  <TutorIcon name="fi fi-sr-cross-small" aria-hidden="true"/>
                </button>)}
              <div class="vocabulary-inputs">
                <div class="vocabulary-field">
                  <span class="vocabulary-field-label">Word/Phrase:</span>
                  <div class="vocabulary-input-row">
                    <input type="text" class="vocabulary-word-input" aria-label={`Word or phrase ${index + 1}`} placeholder="Enter word or phrase..." value={item().word} onInput={(e) => _props0["updateVocabularyWord"](index, (e.target as HTMLInputElement).value)} onBlur={() => (_props0["generateOnBlur"] === undefined ? true : _props0["generateOnBlur"]) && item().word.trim() && !item().definitions.length && _props0["getVocabularyDefinition"](index)}/>
                    <button type="button" class={`vocabulary-check-btn ${item().isLoading ? 'loading' : ''}`} onClick={() => item().word.trim() && _props0["getVocabularyDefinition"](index)} disabled={item().isLoading || !item().word.trim()} title="Get definition">
                      <TutorIcon name={item().isLoading ? 'fi fi-sr-spinner' : 'fi fi-sr-refresh'} aria-hidden="true"/>
                    </button>
                  </div>
                </div>
                <div class="vocabulary-field">
                  <span class="vocabulary-field-label">Definition:</span>
                  <div class="vocabulary-definition-row">
                    {item().isLoading ? (<div class="vocabulary-loading">
                        <TutorIcon name="fi fi-sr-spinner" aria-hidden="true"/>
                        Getting definition...
                      </div>) : item().definitions.length > 0 ? (<>
                        {item().showDefinition ? (<div class="vocabulary-definition-content">
                            {item().definitions.length > 1 && (<div class="vocabulary-definition-tabs">
                                {<Index each={item().definitions}>{(def, defIdx) => (<button type="button" class={`vocabulary-def-tab ${item().selectedDefinitionIndex === defIdx ? 'active' : ''}`} onClick={() => _props0["selectDefinition"](index, defIdx)} title={def().meaning}>
                                    {defIdx + 1}. {def().partOfSpeech || 'def'}
                                  </button>)}</Index>}
                              </div>)}
                            <div class="vocabulary-definition-display">
                              {item().definitions[item().selectedDefinitionIndex]?.partOfSpeech && (<span class="vocabulary-part-of-speech">
                                  ({item().definitions[item().selectedDefinitionIndex].partOfSpeech})
                                </span>)}
                              <span class="vocabulary-meaning">
                                {item().definitions[item().selectedDefinitionIndex]?.meaning}
                              </span>
                            </div>
                          </div>) : (<div class="vocabulary-definition-hidden">
                            <span>Definition hidden</span>
                          </div>)}
                        <button type="button" class={`vocabulary-toggle-btn ${item().showDefinition ? 'active' : ''}`} onClick={() => _props0["toggleVocabularyDefinition"](index)} title={item().showDefinition ? 'Hide definition' : 'Show definition'}>
                          <TutorIcon name={item().showDefinition ? 'fi fi-sr-eye' : 'fi fi-sr-eye-crossed'} aria-hidden="true"/>
                        </button>
                        {item().showDefinition && item().definitions[item().selectedDefinitionIndex]?.japaneseNative && (<button type="button" class={`vocabulary-info-btn ${item().showTranslation ? 'active' : ''}`} onClick={() => _props0["toggleVocabularyTranslation"](index)} title={item().showTranslation ? 'Hide translations' : 'Show translations'}>
                            <TutorIcon name="fi fi-sr-info" aria-hidden="true"/>
                          </button>)}
                        {_props0["sendVocabularyToChat"] &&
                item().word.trim() &&
                item().definitions[item().selectedDefinitionIndex]?.meaning && (<button type="button" class="vocabulary-send-btn" onClick={() => _props0["sendVocabularyToChat"](index)} title="Send to chat">
                              <TutorIcon name="fi fi-sr-paper-plane" aria-hidden="true"/>
                            </button>)}
                      </>) : (<div class="vocabulary-definition-placeholder">
                        Enter a word and click refresh to get definition
                      </div>)}
                  </div>
                </div>
                {item().showTranslation && item().definitions[item().selectedDefinitionIndex]?.japaneseNative && (<div class="vocabulary-translations">
                    {item().definitions[item().selectedDefinitionIndex].japaneseNative && (<div class="vocabulary-translation-item japanese">
                        <span class="translation-flag" title="Japanese">
                          🇯🇵
                        </span>
                        <div class="translation-content">
                          <span class="translation-native" lang="ja">
                            {item().definitions[item().selectedDefinitionIndex].japaneseNative}
                          </span>
                          <span class="translation-romanized" lang="ja-Latn">
                            {item().definitions[item().selectedDefinitionIndex].japaneseRomanized}
                          </span>
                        </div>
                      </div>)}
                  </div>)}
                {_props0["editVocabulary"] && (<details class="notes-manual-edit">
                    <summary>Edit meanings and translations</summary>
                    {<Index each={item().definitions}>{(definition, d) => (<div class="notes-meaning-editor">
                        <label class="notes-meaning-choice">
                          <input type="radio" name={`meaning-${index}`} checked={item().selectedDefinitionIndex === d} onChange={() => _props0["selectDefinition"](index, d)}/>
                          Meaning {d + 1}
                        </label>
                        {<Index each={(['meaning', 'partOfSpeech', 'japaneseNative', 'japaneseRomanized'] as const)}>{(field) => (<label>
                            {field() === 'meaning'
                ? 'Definition'
                : field() === 'partOfSpeech'
                    ? 'Part of speech'
                    : field() === 'japaneseNative'
                        ? 'Japanese'
                        : 'Romanized Japanese'}
                            <input aria-label={field() === 'meaning' ? `Definition ${index + 1}.${d + 1}` : undefined} value={definition()[field()] || ''} onInput={(event) => _props0["editVocabulary"](index, {
                definitions: item().definitions.map((entry, j) => j === d ? { ...entry, [field()]: event.currentTarget.value } : entry)
            })}/>
                          </label>)}</Index>}
                        <button type="button" title="Remove meaning" aria-label={`Remove meaning ${index + 1}.${d + 1}`} onClick={() => _props0["editVocabulary"](index, {
                definitions: item().definitions.filter((_, j) => j !== d),
                selectedDefinitionIndex: Math.max(0, item().selectedDefinitionIndex >= d
                    ? item().selectedDefinitionIndex - 1
                    : item().selectedDefinitionIndex)
            })}>
                          <TutorIcon name="fi fi-sr-trash" aria-hidden="true"/>
                        </button>
                      </div>)}</Index>}
                    <button type="button" onClick={() => _props0["editVocabulary"](index, { definitions: [...item().definitions, { meaning: '', partOfSpeech: '' }] })}>
                      <TutorIcon name="fi fi-sr-plus" aria-hidden="true"/>
                      Add meaning
                    </button>
                  </details>)}
              </div>
            </div>)}</Index>}
        </div>
        <button type="button" class="vocabulary-add-btn" onClick={_props0["addVocabularyItem"]}>
          <TutorIcon name="fi fi-sr-plus" aria-hidden="true"/>
          Add word or phrase
        </button>
      </div>

      <div class="dispatch-notes-section">
        <label class="dispatch-notes-label">
          <TutorIcon name={lessonNotesIcons.grammar} aria-hidden="true"/>
          {lessonNotesLabels.grammar}
        </label>
        <div class="grammar-items">
          {<Index each={_props0["grammarItems"]}>{(item, index) => (<div class="grammar-row">
              {_props0["grammarItems"].length > 1 && (<button type="button" class="grammar-remove-btn" onClick={() => _props0["removeGrammarItem"](index)} title="Remove">
                  <TutorIcon name="fi fi-sr-cross-small" aria-hidden="true"/>
                </button>)}
              <div class="grammar-inputs">
                <div class="grammar-field">
                  <span class="grammar-field-label">You said:</span>
                  <div class="grammar-input-row">
                    <textarea class="grammar-input" aria-label={`You said ${index + 1}`} placeholder="Enter incorrect sentence..." value={item().youSaid} onInput={(e) => _props0["updateYouSaid"](index, (e.target as HTMLTextAreaElement).value)} onBlur={() => (_props0["generateOnBlur"] === undefined ? true : _props0["generateOnBlur"]) && item().youSaid.trim() && !item().correct && _props0["getGrammarCorrection"](index)} rows={1}/>
                    <button type="button" class={`grammar-check-btn ${item().isLoading ? 'loading' : ''}`} onClick={() => item().youSaid.trim() && _props0["getGrammarCorrection"](index)} disabled={item().isLoading || !item().youSaid.trim()} title="Check grammar">
                      <TutorIcon name={item().isLoading ? 'fi fi-sr-spinner' : 'fi fi-sr-refresh'} aria-hidden="true"/>
                    </button>
                  </div>
                </div>
                <div class="grammar-field">
                  <span class="grammar-field-label">Correct:</span>
                  <div class="grammar-correct-row">
                    {item().isLoading ? (<div class="grammar-loading">
                        <TutorIcon name="fi fi-sr-spinner" aria-hidden="true"/>
                        Checking...
                      </div>) : (<>
                        <textarea class="grammar-input grammar-input-correct" aria-label={`Correct ${index + 1}`} placeholder="Corrected sentence..." value={item().correct} onInput={(e) => _props0["updateGrammarItem"](index, 'correct', (e.target as HTMLTextAreaElement).value)} rows={1}/>
                        {(item().simpleExplanation || item().technicalExplanation) && (<button type="button" class={`grammar-info-btn ${item().showExplanation ? 'active' : ''}`} onClick={() => _props0["toggleGrammarExplanation"](index)} title="Show explanation">
                            <TutorIcon name="fi fi-sr-info" aria-hidden="true"/>
                          </button>)}
                        {_props0["sendGrammarToChat"] && item().youSaid.trim() && item().correct.trim() && (<button type="button" class="grammar-send-btn" onClick={() => _props0["sendGrammarToChat"](index)} title="Send to chat">
                            <TutorIcon name="fi fi-sr-paper-plane" aria-hidden="true"/>
                          </button>)}
                      </>)}
                  </div>
                </div>
                {item().showExplanation && (item().simpleExplanation || item().technicalExplanation) && (<div class="grammar-explanation">
                    <div class="grammar-explanation-simple">
                      <TutorIcon name="fi fi-sr-lightbulb-on" aria-hidden="true"/>
                      {item().simpleExplanation}
                    </div>
                    <div class="grammar-explanation-technical">
                      <TutorIcon name="fi fi-sr-book-alt" aria-hidden="true"/>
                      {item().technicalExplanation}
                    </div>
                  </div>)}
              </div>
            </div>)}</Index>}
        </div>
        <button type="button" class="grammar-add-btn" onClick={_props0["addGrammarItem"]}>
          <TutorIcon name="fi fi-sr-plus" aria-hidden="true"/>
          Add Grammar Note
        </button>
      </div>

      <div class="dispatch-notes-section">
        <label class="dispatch-notes-label">
          <TutorIcon name={lessonNotesIcons.pronunciation} aria-hidden="true"/>
          {lessonNotesLabels.pronunciation}
        </label>
        <div class="pronunciation-items">
          {<Index each={_props0["pronunciationItems"]}>{(item, index) => (<div class="pronunciation-row">
              {(_props0["editPronunciation"] || _props0["pronunciationItems"].length > 1) && (<button type="button" class="pronunciation-remove-btn" onClick={() => _props0["removePronunciationItem"](index)} title="Remove">
                  <TutorIcon name="fi fi-sr-cross-small" aria-hidden="true"/>
                </button>)}
              <div class="pronunciation-inputs">
                <div class="pronunciation-field">
                  <span class="pronunciation-field-label">Word:</span>
                  <div class="pronunciation-input-row">
                    <input type="text" class="pronunciation-word-input" aria-label={`Pronunciation word ${index + 1}`} placeholder="Enter word..." value={item().word} onInput={(e) => _props0["updatePronunciationWord"](index, (e.target as HTMLInputElement).value)} onBlur={() => (_props0["generateOnBlur"] === undefined ? true : _props0["generateOnBlur"]) && item().word.trim() && !item().phonetic && _props0["getPronunciationFromAI"](index)}/>
                    <button type="button" class={`pronunciation-check-btn ${item().isLoading ? 'loading' : ''}`} onClick={() => item().word.trim() && _props0["getPronunciationFromAI"](index)} disabled={item().isLoading || !item().word.trim()} title="Get pronunciation">
                      <TutorIcon name={item().isLoading ? 'fi fi-sr-spinner' : 'fi fi-sr-refresh'} aria-hidden="true"/>
                    </button>
                  </div>
                </div>
                <div class="pronunciation-field">
                  <span class="pronunciation-field-label">Phonetic:</span>
                  <div class="pronunciation-phonetic-row">
                    {item().isLoading ? (<div class="pronunciation-loading">
                        <TutorIcon name="fi fi-sr-spinner" aria-hidden="true"/>
                        Getting pronunciation...
                      </div>) : item().phonetic ? (<>
                        {item().showPhonetic ? (<div class="pronunciation-phonetic-content">
                            <div class="pronunciation-display">
                              <span class="pronunciation-phonetic-display">{item().phonetic}</span>
                            </div>
                          </div>) : (<div class="pronunciation-phonetic-hidden">
                            <span>Pronunciation hidden</span>
                          </div>)}
                        <button type="button" class={`pronunciation-toggle-btn ${item().showPhonetic ? 'active' : ''}`} onClick={() => _props0["togglePronunciationPhonetic"](index)} title={item().showPhonetic ? 'Hide pronunciation' : 'Show pronunciation'}>
                          <TutorIcon name={item().showPhonetic ? 'fi fi-sr-eye' : 'fi fi-sr-eye-crossed'} aria-hidden="true"/>
                        </button>
                        {_props0["sendPronunciationToChat"] && item().word.trim() && item().phonetic && (<button type="button" class="pronunciation-send-btn" onClick={() => _props0["sendPronunciationToChat"](index)} title="Send to chat">
                            <TutorIcon name="fi fi-sr-paper-plane" aria-hidden="true"/>
                          </button>)}
                      </>) : (<div class="pronunciation-phonetic-placeholder">
                        Enter a word and click refresh to get pronunciation
                      </div>)}
                  </div>
                </div>
                {_props0["editPronunciation"] && (<label class="notes-manual-edit">
                    Edit phonetic spelling
                    <input aria-label={`Phonetic ${index + 1}`} value={item().phonetic} onInput={(event) => _props0["editPronunciation"](index, event.currentTarget.value)}/>
                  </label>)}
              </div>
            </div>)}</Index>}
        </div>
        <button type="button" class="pronunciation-add-btn" onClick={_props0["addPronunciationItem"]}>
          <TutorIcon name="fi fi-sr-plus" aria-hidden="true"/>
          Add Pronunciation Note
        </button>
      </div>
    </>);
}
