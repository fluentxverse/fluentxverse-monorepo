import { createSignal, createMemo, onMount, type Component } from 'solid-js';
import { ChevronDown, Search } from 'lucide-solid';
import './QualificationsFields.css';

export interface Qualifications {
  schoolAttended: string;
  educationalAttainment: string;
  major: string;
  teachingExperience: string;
  teachingQualifications: string[];
}
export const emptyQualifications = (): Qualifications => ({ schoolAttended: '', educationalAttainment: '', major: '', teachingExperience: '', teachingQualifications: [] });
const attainments = ['High school or equivalent', 'Some college', 'Associate degree', "Bachelor's degree", "Master's degree", 'Doctoral degree'];
const experiences = ['No experience', 'Less than 1 year', '1 to 3 years', '3 to 5 years', '5 to 10 years', 'More than 10 years'];
const qualifications = ['COTE Certified', 'FLT Certified', 'RSA-CELTA Certified', 'TEFL/TESL Certified', 'Education major', 'Professionally trained'];

const QualificationsFields: Component<{ value: Qualifications; onChange: (value: Qualifications) => void; id: string }> = props => {
  const [schools, setSchools] = createSignal<{ text: string; value: string }[]>([]);
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');
  let trigger: HTMLButtonElement | undefined;
  let search: HTMLInputElement | undefined;
  onMount(() => { void import('../../data/univ.json').then(data => setSchools(data.default.universitiesAndColleges)); });
  const filtered = createMemo(() => schools().filter(school => school.text.toLowerCase().includes(query().trim().toLowerCase())).slice(0, 50));
  const update = <K extends keyof Qualifications>(key: K, value: Qualifications[K]) => props.onChange({ ...props.value, [key]: value });
  const close = () => { setOpen(false); setQuery(''); trigger?.focus(); };
  return <div class="qualification-fields">
    <div class="qualification-field">
      <label id={`${props.id}-school-label`}>School attended</label>
      <button type="button" class="qualification-school-trigger" role="combobox" aria-labelledby={`${props.id}-school-label`} aria-expanded={open()} aria-controls={`${props.id}-schools`} aria-haspopup="listbox" ref={trigger}
        onClick={() => { setOpen(!open()); if (open()) queueMicrotask(() => search?.focus()); }} onKeyDown={event => { if (event.key === 'Escape') close(); }}>
        <span>{props.value.schoolAttended || 'Select your school'}</span><ChevronDown size={16}/>
      </button>
      {open() && <div class="qualification-school-panel" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
        <div class="qualification-school-search"><Search size={16}/><input ref={search} aria-label="Search schools" value={query()} onInput={event => setQuery(event.currentTarget.value)} placeholder="Search schools..."/></div>
        <div id={`${props.id}-schools`} class="qualification-school-options" role="listbox" aria-label="Schools">
          {filtered().map(school => <button type="button" role="option" aria-selected={props.value.schoolAttended === school.text} onClick={() => { update('schoolAttended', school.text); close(); }}>{school.text}</button>)}
          {!filtered().length && <p>{schools().length ? 'No schools found' : 'Loading schools...'}</p>}
        </div>
      </div>}
    </div>
    <div class="qualification-field"><label for={`${props.id}-attainment`}>Educational attainment</label><select id={`${props.id}-attainment`} value={props.value.educationalAttainment} onChange={event => update('educationalAttainment', event.currentTarget.value)}><option value="">Select attainment</option>{attainments.map(value => <option>{value}</option>)}</select></div>
    <div class="qualification-field"><label for={`${props.id}-degree`}>Degree or field of study</label><input id={`${props.id}-degree`} value={props.value.major} maxLength={200} onInput={event => update('major', event.currentTarget.value)} placeholder="Enter degree or field of study"/></div>
    <div class="qualification-field"><label for={`${props.id}-experience`}>Teaching experience</label><select id={`${props.id}-experience`} value={props.value.teachingExperience} onChange={event => update('teachingExperience', event.currentTarget.value)}><option value="">Select experience</option>{experiences.map(value => <option>{value}</option>)}</select></div>
    <fieldset class="qualification-checkboxes"><legend>Teaching qualifications</legend>{qualifications.map(value => <label><input type="checkbox" checked={props.value.teachingQualifications.includes(value)} onChange={event => update('teachingQualifications', event.currentTarget.checked ? [...props.value.teachingQualifications, value] : props.value.teachingQualifications.filter(item => item !== value))}/><span>{value}</span></label>)}</fieldset>
  </div>;
};
export default QualificationsFields;
