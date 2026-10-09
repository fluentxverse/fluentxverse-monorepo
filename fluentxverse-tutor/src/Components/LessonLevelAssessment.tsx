import { ENGLISH_LEVELS } from '../data/englishLevels';
import { lessonNotesIcons } from '../data/lessonNotesIcons';

export default function LessonLevelAssessment({ value, onChange }: {
  value: number | null;
  onChange: (level: number | null) => void;
}) {
  return <section className="dispatch-notes-section lesson-level-assessment" aria-labelledby="lesson-assessment-title">
    <h3 id="lesson-assessment-title" className="dispatch-notes-label">
      <i className={lessonNotesIcons.assessment} aria-hidden="true" />English level assessment
      <span className="notes-field-optional">Optional</span>
    </h3>
    <div className="lesson-assessment-options" role="radiogroup" aria-labelledby="lesson-assessment-title">
      <label className="lesson-assessment-none">
        <input type="radio" name="lesson-english-level" checked={value === null} onChange={() => onChange(null)} />
        Not assessed
      </label>
      {ENGLISH_LEVELS.map((level, index) => <label key={level.value} className="lesson-assessment-option" data-selected={value === index + 1}>
        <input type="radio" name="lesson-english-level" checked={value === index + 1} onChange={() => onChange(index + 1)} />
        <span><strong>{level.value} - {level.label}</strong><small>{level.description}</small></span>
      </label>)}
    </div>
  </section>;
}
