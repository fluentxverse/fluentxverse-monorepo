import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../../utils/cssStyle";
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronUp, Search, X, RotateCw, BookOpen, Info } from "lucide-solid";
import Header from '../Header/Header';
import SideBar from '../IndexOne/SideBar';
import type { Lesson } from '../../api/lesson.api';
import { mediaUrl } from '../../utils/mediaUrl';
import './MaterialLibrary.css';
export function MaterialLibraryShell(_props0: {
    title: string;
    category: string;
    description: string;
    art: string;
    children: JSX.Element;
}) {
    return <><SideBar /><div class="student-library"><Header />
    <main class="library-page"><div class="library-container">
      <a class="library-back" href="/materials"><ArrowLeft size={16}/>Back to Materials</a>
      <header class="library-heading">
        <img class="library-heading-art" src={`/assets/img/home-icons/${_props0["art"]}-v1.${_props0["art"] === 'dispatch' ? 'png' : 'webp'}`} alt="" width="64" height="64"/>
        <div><span class="library-eyebrow">{_props0["category"]}</span><h1>{_props0["title"]}</h1><p>{_props0["description"]}</p></div>
      </header>
      {_props0["children"]}
    </div></main>
  </div></>;
}
export function LibraryState(_props1: {
    loading?: boolean;
    error?: string | null;
    retry?: () => void;
    empty?: string;
    clear?: () => void;
}) {
    return <div class="library-state" role={_props1["error"] ? 'alert' : 'status'}>
    <img src="/assets/img/home-icons/training-v1.webp" alt="" width="64" height="64"/>
    <h2>{_props1["loading"] ? 'Loading materials…' : _props1["error"] ? 'Unable to load materials' : _props1["empty"] || 'No materials yet'}</h2>
    {_props1["error"] && <p>{_props1["error"]}</p>}
    {_props1["error"] && _props1["retry"] && <button class="library-button" onClick={_props1["retry"]}><RotateCw size={16}/>Try again</button>}
    {_props1["clear"] && <button class="library-button" onClick={_props1["clear"]}><X size={16}/>Clear filters</button>}
  </div>;
}
function lessonNumber(lesson: Lesson, field: 'level' | 'chapter' | 'lessonNumber') {
    const data = lesson.lessonData as Lesson['lessonData'] & {
        level?: number;
        chapter?: number;
        lessonNumber?: number;
    };
    if (Number(data?.[field]) > 0)
        return Number(data[field]);
    const text = field === 'level' ? data?.header?.levelBadge : field === 'chapter' ? data?.header?.chapterLabel : data?.header?.lessonLabel || lesson.title;
    return Number(text?.match(/\d+/)?.[0]) || 1;
}
export default function CourseLibrary(_props2: {
    course: 'business-english' | 'conversational-skills';
    lessons: Lesson[];
    loading: boolean;
    error: string | null;
    retry: () => void;
}) {
    const business = createMemo(() => _props2["course"] === 'business-english');
    const [search, setSearch] = createSignal('');
    const [level, setLevel] = createSignal('');
    const [chapter, setChapter] = createSignal('');
    const [expandedLevels, setExpandedLevels] = createSignal<number[]>([]);
    const [expandedChapters, setExpandedChapters] = createSignal<string[]>([]);
    const filtered = createMemo(() => _props2["lessons"].filter(lesson => {
        const query = search().trim().toLowerCase();
        return (!level() || lessonNumber(lesson, 'level') === Number(level()))
            && (!chapter() || lessonNumber(lesson, 'chapter') === Number(chapter()))
            && (!query || `${lesson.title} ${lesson.lessonData?.header?.goalText || ''} ${lesson.lessonData?.header?.lessonLabel || ''}`.toLowerCase().includes(query));
    }).sort((a, b) => lessonNumber(a, 'level') - lessonNumber(b, 'level') || lessonNumber(a, 'chapter') - lessonNumber(b, 'chapter') || lessonNumber(a, 'lessonNumber') - lessonNumber(b, 'lessonNumber')));
    const active = createMemo(() => !!(search() || level() || chapter()));
    const clear = () => { setSearch(''); setLevel(''); setChapter(''); };
    const toggleLevel = (value: number) => setExpandedLevels(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
    const toggleChapter = (value: string) => setExpandedChapters(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
    const chapters = (value: number) => Array.from({ length: value === 1 ? 1 : 5 }, (_, i) => i + 1);
    const count = (value: number) => _props2["lessons"].filter(lesson => lessonNumber(lesson, 'level') === value).length;
    const renderLessons = (items: Lesson[]) => <div class="library-lesson-grid">{items.map(lesson => {
            const content = <>
      {lesson.lessonData?.header?.backgroundImage && <div class="library-lesson-cover"><img src={mediaUrl(lesson.lessonData.header.backgroundImage)} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }}/></div>}
      <div class="library-lesson-content">
      <div class="library-lesson-meta">Level {lessonNumber(lesson, 'level')} · Chapter {lessonNumber(lesson, 'chapter')}</div>
      <h3>{lesson.title}</h3>
      <p>{lesson.lessonData?.header?.goalText || (business() ? 'Professional English practice' : 'English conversation practice')}</p>
      <div class="library-lesson-footer"><span>{business() ? 'Preview unavailable' : 'Open lesson'}</span>{business() ? <BookOpen size={18}/> : <ArrowUpRight size={18}/>}</div>
      </div>
    </>;
            return business() ? <article class="library-lesson">{content}</article>
                : <a class="library-lesson" href={`/materials/${_props2["course"]}/${encodeURIComponent(lesson.id)}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${lesson.title}`}>{content}</a>;
        })}</div>;
    return <MaterialLibraryShell title={business() ? 'Business English' : 'Conversational Skills'} category="Curriculum" art={business() ? 'training' : 'community'} description={business() ? 'Build confidence in meetings, workplace conversations, and professional discussions.' : 'Practice everyday conversations and build confidence speaking English.'}>
    <div class="library-overview"><span>{_props2["loading"] ? '—' : _props2["lessons"].length} lessons available</span><span>10 levels</span><span>Up to 5 chapters per level</span></div>
    {business() && <p class="library-notice"><Info size={17}/>Lesson previews are temporarily unavailable.</p>}
    <div class="library-toolbar">
      <label class="library-field">Level<select aria-label="Level" value={level()} onChange={event => { setLevel(event.currentTarget.value); setChapter(''); }}><option value="">All levels</option>{Array.from({ length: 10 }, (_, i) => i + 1).map(value => <option value={value}>Level {value} ({count(value)})</option>)}</select></label>
      <label class="library-field">Chapter<select aria-label="Chapter" disabled={!level()} value={chapter()} onChange={event => setChapter(event.currentTarget.value)}><option value="">All chapters</option>{chapters(Number(level())).map(value => <option value={value}>Chapter {value}</option>)}</select></label>
      <label class="library-field library-search-label">Search<div class="library-search"><Search size={18}/><input type="search" aria-label="Search lessons" placeholder="Search lessons" value={search()} onInput={event => setSearch(event.currentTarget.value)}/>{search() && <button title="Clear search" aria-label="Clear search" onClick={() => setSearch('')}><X size={16}/></button>}</div></label>
      {active() && <button class="library-icon-button" aria-label="Clear filters" title="Clear filters" onClick={clear}><X size={18}/></button>}
    </div>
    {_props2["loading"] || _props2["error"] ? <LibraryState loading={_props2["loading"]} error={_props2["loading"] ? null : _props2["error"]} retry={_props2["retry"]}/> : !filtered().length ? <LibraryState empty={active() ? 'No matching lessons' : 'No published lessons yet'} clear={active() ? clear : undefined}/> : <>
      <p class="library-result-count" aria-live="polite">{filtered().length} {filtered().length === 1 ? 'lesson' : 'lessons'}{active() ? ' found' : ' available'}</p>
      {active() ? renderLessons(filtered()) : <div class="library-levels">{Array.from({ length: 10 }, (_, i) => i + 1).map(value => {
                    const expanded = expandedLevels().includes(value);
                    return <section class="library-level">
          <button class="library-level-toggle" aria-expanded={expanded} aria-controls={`library-level-${value}`} onClick={() => toggleLevel(value)}>
            <img src="/assets/img/home-icons/training-v1.webp" alt="" width="40" height="40"/><strong>Level {value}</strong><span>{count(value)} lessons</span>{expanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
          </button>
          {expanded && <div class="library-chapters" id={`library-level-${value}`}>{chapters(value).map(number => {
                                const key = `${value}-${number}`, open = expandedChapters().includes(key);
                                const items = filtered().filter(lesson => lessonNumber(lesson, 'level') === value && lessonNumber(lesson, 'chapter') === number);
                                return <div class="library-chapter">
              <button class="library-chapter-toggle" aria-expanded={open} aria-controls={`library-chapter-${key}`} onClick={() => toggleChapter(key)}><strong>Chapter {number}</strong><span>{items.length} lessons</span>{open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>
              {open && <div id={`library-chapter-${key}`}>{items.length ? renderLessons(items) : <p class="library-chapter-empty">No published lessons yet.</p>}</div>}
            </div>;
                            })}</div>}
        </section>;
                })}</div>}
    </>}
  </MaterialLibraryShell>;
}
