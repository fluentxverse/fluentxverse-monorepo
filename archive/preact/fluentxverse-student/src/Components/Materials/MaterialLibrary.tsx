import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { ArrowLeft, ArrowUpRight, ChevronDown, ChevronUp, Search, X, RotateCw, BookOpen, Info } from 'lucide-preact';
import Header from '../Header/Header';
import SideBar from '../IndexOne/SideBar';
import type { Lesson } from '../../api/lesson.api';
import { mediaUrl } from '../../utils/mediaUrl';
import './MaterialLibrary.css';

export function MaterialLibraryShell({ title, category, description, art, children }: {
  title: string; category: string; description: string; art: string; children: ComponentChildren;
}) {
  return <><SideBar /><div className="student-library"><Header />
    <main className="library-page"><div className="library-container">
      <a className="library-back" href="/materials"><ArrowLeft size={16} />Back to Materials</a>
      <header className="library-heading">
        <img className="library-heading-art" src={`/assets/img/home-icons/${art}-v1.${art === 'dispatch' ? 'png' : 'webp'}`} alt="" width="64" height="64" />
        <div><span className="library-eyebrow">{category}</span><h1>{title}</h1><p>{description}</p></div>
      </header>
      {children}
    </div></main>
  </div></>;
}

export function LibraryState({ loading, error, retry, empty, clear }: {
  loading?: boolean; error?: string | null; retry?: () => void; empty?: string; clear?: () => void;
}) {
  return <div className="library-state" role={error ? 'alert' : 'status'}>
    <img src="/assets/img/home-icons/training-v1.webp" alt="" width="64" height="64" />
    <h2>{loading ? 'Loading materials…' : error ? 'Unable to load materials' : empty || 'No materials yet'}</h2>
    {error && <p>{error}</p>}
    {error && retry && <button className="library-button" onClick={retry}><RotateCw size={16} />Try again</button>}
    {clear && <button className="library-button" onClick={clear}><X size={16} />Clear filters</button>}
  </div>;
}

function lessonNumber(lesson: Lesson, field: 'level' | 'chapter' | 'lessonNumber') {
  const data = lesson.lessonData as Lesson['lessonData'] & { level?: number; chapter?: number; lessonNumber?: number };
  if (Number(data?.[field]) > 0) return Number(data[field]);
  const text = field === 'level' ? data?.header?.levelBadge : field === 'chapter' ? data?.header?.chapterLabel : data?.header?.lessonLabel || lesson.title;
  return Number(text?.match(/\d+/)?.[0]) || 1;
}

export default function CourseLibrary({ course, lessons, loading, error, retry }: {
  course: 'business-english' | 'conversational-skills'; lessons: Lesson[]; loading: boolean;
  error: string | null; retry: () => void;
}) {
  const business = course === 'business-english';
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [chapter, setChapter] = useState('');
  const [expandedLevels, setExpandedLevels] = useState<number[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const filtered = useMemo(() => lessons.filter(lesson => {
    const query = search.trim().toLowerCase();
    return (!level || lessonNumber(lesson, 'level') === Number(level))
      && (!chapter || lessonNumber(lesson, 'chapter') === Number(chapter))
      && (!query || `${lesson.title} ${lesson.lessonData?.header?.goalText || ''} ${lesson.lessonData?.header?.lessonLabel || ''}`.toLowerCase().includes(query));
  }).sort((a, b) => lessonNumber(a, 'level') - lessonNumber(b, 'level') || lessonNumber(a, 'chapter') - lessonNumber(b, 'chapter') || lessonNumber(a, 'lessonNumber') - lessonNumber(b, 'lessonNumber')), [lessons, search, level, chapter]);
  const active = !!(search || level || chapter);
  const clear = () => { setSearch(''); setLevel(''); setChapter(''); };
  const toggleLevel = (value: number) => setExpandedLevels(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  const toggleChapter = (value: string) => setExpandedChapters(prev => prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]);
  const chapters = (value: number) => Array.from({ length: value === 1 ? 1 : 5 }, (_, i) => i + 1);
  const count = (value: number) => lessons.filter(lesson => lessonNumber(lesson, 'level') === value).length;
  const renderLessons = (items: Lesson[]) => <div className="library-lesson-grid">{items.map(lesson => {
    const content = <>
      {lesson.lessonData?.header?.backgroundImage && <div className="library-lesson-cover"><img src={mediaUrl(lesson.lessonData.header.backgroundImage)} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /></div>}
      <div className="library-lesson-content">
      <div className="library-lesson-meta">Level {lessonNumber(lesson, 'level')} · Chapter {lessonNumber(lesson, 'chapter')}</div>
      <h3>{lesson.title}</h3>
      <p>{lesson.lessonData?.header?.goalText || (business ? 'Professional English practice' : 'English conversation practice')}</p>
      <div className="library-lesson-footer"><span>{business ? 'Preview unavailable' : 'Open lesson'}</span>{business ? <BookOpen size={18} /> : <ArrowUpRight size={18} />}</div>
      </div>
    </>;
    return business ? <article key={lesson.id} className="library-lesson">{content}</article>
      : <a key={lesson.id} className="library-lesson" href={`/materials/${course}/${encodeURIComponent(lesson.id)}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${lesson.title}`}>{content}</a>;
  })}</div>;
  return <MaterialLibraryShell title={business ? 'Business English' : 'Conversational Skills'} category="Curriculum" art={business ? 'training' : 'community'} description={business ? 'Build confidence in meetings, workplace conversations, and professional discussions.' : 'Practice everyday conversations and build confidence speaking English.'}>
    <div className="library-overview"><span>{loading ? '—' : lessons.length} lessons available</span><span>10 levels</span><span>Up to 5 chapters per level</span></div>
    {business && <p className="library-notice"><Info size={17} />Lesson previews are temporarily unavailable.</p>}
    <div className="library-toolbar">
      <label className="library-field">Level<select aria-label="Level" value={level} onChange={event => { setLevel(event.currentTarget.value); setChapter(''); }}><option value="">All levels</option>{Array.from({ length: 10 }, (_, i) => i + 1).map(value => <option key={value} value={value}>Level {value} ({count(value)})</option>)}</select></label>
      <label className="library-field">Chapter<select aria-label="Chapter" disabled={!level} value={chapter} onChange={event => setChapter(event.currentTarget.value)}><option value="">All chapters</option>{chapters(Number(level)).map(value => <option key={value} value={value}>Chapter {value}</option>)}</select></label>
      <label className="library-field library-search-label">Search<div className="library-search"><Search size={18} /><input type="search" aria-label="Search lessons" placeholder="Search lessons" value={search} onInput={event => setSearch(event.currentTarget.value)} />{search && <button title="Clear search" aria-label="Clear search" onClick={() => setSearch('')}><X size={16} /></button>}</div></label>
      {active && <button className="library-icon-button" aria-label="Clear filters" title="Clear filters" onClick={clear}><X size={18} /></button>}
    </div>
    {loading || error ? <LibraryState loading={loading} error={loading ? null : error} retry={retry} /> : !filtered.length ? <LibraryState empty={active ? 'No matching lessons' : 'No published lessons yet'} clear={active ? clear : undefined} /> : <>
      <p className="library-result-count" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'lesson' : 'lessons'}{active ? ' found' : ' available'}</p>
      {active ? renderLessons(filtered) : <div className="library-levels">{Array.from({ length: 10 }, (_, i) => i + 1).map(value => {
        const expanded = expandedLevels.includes(value);
        return <section className="library-level" key={value}>
          <button className="library-level-toggle" aria-expanded={expanded} aria-controls={`library-level-${value}`} onClick={() => toggleLevel(value)}>
            <img src="/assets/img/home-icons/training-v1.webp" alt="" width="40" height="40" /><strong>Level {value}</strong><span>{count(value)} lessons</span>{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {expanded && <div className="library-chapters" id={`library-level-${value}`}>{chapters(value).map(number => {
            const key = `${value}-${number}`, open = expandedChapters.includes(key);
            const items = filtered.filter(lesson => lessonNumber(lesson, 'level') === value && lessonNumber(lesson, 'chapter') === number);
            return <div key={key} className="library-chapter">
              <button className="library-chapter-toggle" aria-expanded={open} aria-controls={`library-chapter-${key}`} onClick={() => toggleChapter(key)}><strong>Chapter {number}</strong><span>{items.length} lessons</span>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
              {open && <div id={`library-chapter-${key}`}>{items.length ? renderLessons(items) : <p className="library-chapter-empty">No published lessons yet.</p>}</div>}
            </div>;
          })}</div>}
        </section>;
      })}</div>}
    </>}
  </MaterialLibraryShell>;
}
