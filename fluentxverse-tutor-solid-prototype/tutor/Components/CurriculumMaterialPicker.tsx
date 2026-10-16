import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorIcon from "./Common/TutorIcon";
import './DispatchMaterialPicker.css';
export interface CurriculumMaterial {
    id: string;
    title: string;
    level: number;
    chapter: number;
    lesson: number;
    goal: string;
}
interface Props {
    materials: CurriculumMaterial[];
    loading: boolean;
    currentId?: string;
    onOpen: (material: CurriculumMaterial) => void;
}
export default function CurriculumMaterialPicker(_props0: Props) {
    const [level, setLevel] = createSignal('');
    const [chapter, setChapter] = createSignal('');
    const [lesson, setLesson] = createSignal('');
    const [page, setPage] = createSignal(0);
    const pageSize = 3;
    const sorted = createMemo(() => [..._props0["materials"]].sort((a, b) => a.level - b.level || a.chapter - b.chapter || a.lesson - b.lesson || a.id.localeCompare(b.id)));
    const levels = createMemo(() => [...new Set(sorted().map(item => item.level))]);
    const inLevel = createMemo(() => sorted().filter(item => !level() || item.level === Number(level())));
    const chapters = createMemo(() => [...new Set(inLevel().map(item => item.chapter))].sort((a, b) => a - b));
    const inChapter = createMemo(() => inLevel().filter(item => !chapter() || item.chapter === Number(chapter())));
    const lessons = createMemo(() => [...new Set(inChapter().map(item => item.lesson))].sort((a, b) => a - b));
    const matches = createMemo(() => inChapter().filter(item => !lesson() || item.lesson === Number(lesson())));
    const current = createMemo(() => sorted().find(item => item.id === _props0["currentId"]));
    const pages = createMemo(() => Math.max(1, Math.ceil(matches().length / pageSize)));
    const activePage = createMemo(() => Math.min(page(), pages() - 1));
    const renderMaterial = (item: CurriculumMaterial) => <div class="dp-article">
    <span class="dp-material-position">L{item.level} / Ch{item.chapter}<br />Lesson {item.lesson}</span>
    <div class="dp-article-copy"><strong title={item.goal ? `${item.title}\n${item.goal}` : item.title}>{item.title}</strong></div>
    <button type="button" class="dp-open" aria-label={`Open material: ${item.title}`} onClick={() => _props0["onOpen"](item)}><TutorIcon name="fas fa-book-open" aria-hidden="true"/><span>Open lesson</span></button>
  </div>;
    return <div class="dispatch-picker curriculum-picker">
    <section class="dp-section">
      <header class="dp-heading"><h3><TutorIcon name="fas fa-bookmark" aria-hidden="true"/>Selected material</h3><span>{current() ? `Level ${current().level}` : 'Not selected'}</span></header>
      {current() ? renderMaterial(current()) : <p class="dp-empty">No material selected from this course.</p>}
    </section>
    <section class="dp-section">
      <header class="dp-heading"><h3><TutorIcon name="fas fa-layer-group" aria-hidden="true"/>Curriculum library</h3><span>{_props0["loading"] ? 'Loading' : `${matches().length} lessons`}</span></header>
      <div class="dp-filters">
        <label>Level<select aria-label="Level" value={level()} onChange={event => { setLevel(event.currentTarget.value); setChapter(''); setLesson(''); setPage(0); }}><option value="">All levels</option>{levels().map(value => <option value={value}>Level {value}</option>)}</select></label>
        <label>Chapter<select aria-label="Chapter" value={chapter()} onChange={event => { setChapter(event.currentTarget.value); setLesson(''); setPage(0); }}><option value="">All chapters</option>{chapters().map(value => <option value={value}>Chapter {value}</option>)}</select></label>
        <label>Lesson<select aria-label="Lesson" value={lesson()} onChange={event => { setLesson(event.currentTarget.value); setPage(0); }}><option value="">All lessons</option>{lessons().map(value => <option value={value}>Lesson {value}</option>)}</select></label>
      </div>
      <div class="dp-results" aria-live="polite">
        {_props0["loading"] ? <p class="dp-empty" role="status">Loading lessons...</p> : matches().length ? matches().slice(activePage() * pageSize, (activePage() + 1) * pageSize).map(renderMaterial) : <p class="dp-empty">No lessons match these filters.</p>}
      </div>
      <footer class="dp-pagination"><span>{matches().length && !_props0["loading"] ? `${activePage() * pageSize + 1}-${Math.min((activePage() + 1) * pageSize, matches().length)} of ${matches().length}` : '0 results'}</span><div>
        <button type="button" title="Previous page" aria-label="Previous materials page" disabled={activePage() === 0 || _props0["loading"]} onClick={() => setPage(activePage() - 1)}><TutorIcon name="fas fa-chevron-left" aria-hidden="true"/></button><span>{activePage() + 1} / {pages()}</span>
        <button type="button" title="Next page" aria-label="Next materials page" disabled={activePage() + 1 >= pages() || _props0["loading"]} onClick={() => setPage(activePage() + 1)}><TutorIcon name="fas fa-chevron-right" aria-hidden="true"/></button>
      </div></footer>
    </section>
  </div>;
}
