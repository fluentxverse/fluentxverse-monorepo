import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
import { ENGLISH_LEVELS } from '../data/englishLevels';
import { lessonNotesIcons } from '../data/lessonNotesIcons';
export default function LessonLevelAssessment(_props0: {
    value: number | null;
    onChange: (level: number | null) => void;
}) {
    return <section class="dispatch-notes-section lesson-level-assessment" aria-labelledby="lesson-assessment-title">
    <h3 id="lesson-assessment-title" class="dispatch-notes-label">
      <TutorIcon name={lessonNotesIcons.assessment} aria-hidden="true"/>English level assessment
      <span class="notes-field-optional">Optional</span>
    </h3>
    <div class="lesson-assessment-options" role="radiogroup" aria-labelledby="lesson-assessment-title">
      <label class="lesson-assessment-none">
        <input type="radio" name="lesson-english-level" checked={_props0["value"] === null} onChange={() => _props0["onChange"](null)}/>
        Not assessed
      </label>
      {ENGLISH_LEVELS.map((level, index) => <label class="lesson-assessment-option" data-selected={_props0["value"] === index + 1}>
        <input type="radio" name="lesson-english-level" checked={_props0["value"] === index + 1} onChange={() => _props0["onChange"](index + 1)}/>
        <span><strong>{level.value} - {level.label}</strong><small>{level.description}</small></span>
      </label>)}
    </div>
  </section>;
}
