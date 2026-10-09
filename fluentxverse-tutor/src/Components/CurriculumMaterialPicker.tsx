import { useMemo, useState } from 'preact/hooks';
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

export default function CurriculumMaterialPicker({ materials, loading, currentId, onOpen }: Props) {
  const [level, setLevel] = useState('');
  const [chapter, setChapter] = useState('');
  const [lesson, setLesson] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 3;
  const sorted = useMemo(() => [...materials].sort((a, b) => a.level - b.level || a.chapter - b.chapter || a.lesson - b.lesson || a.id.localeCompare(b.id)), [materials]);
  const levels = [...new Set(sorted.map(item => item.level))];
  const inLevel = sorted.filter(item => !level || item.level === Number(level));
  const chapters = [...new Set(inLevel.map(item => item.chapter))].sort((a, b) => a - b);
  const inChapter = inLevel.filter(item => !chapter || item.chapter === Number(chapter));
  const lessons = [...new Set(inChapter.map(item => item.lesson))].sort((a, b) => a - b);
  const matches = inChapter.filter(item => !lesson || item.lesson === Number(lesson));
  const current = sorted.find(item => item.id === currentId);
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const activePage = Math.min(page, pages - 1);

  const renderMaterial = (item: CurriculumMaterial) => <div className="dp-article" key={item.id}>
    <span className="dp-material-position">L{item.level} / Ch{item.chapter}<br />Lesson {item.lesson}</span>
    <div className="dp-article-copy"><strong title={item.goal ? `${item.title}\n${item.goal}` : item.title}>{item.title}</strong></div>
    <button type="button" className="dp-open" aria-label={`Open material: ${item.title}`} onClick={() => onOpen(item)}><i className="fas fa-book-open" aria-hidden="true" /><span>Open lesson</span></button>
  </div>;

  return <div className="dispatch-picker curriculum-picker">
    <section className="dp-section">
      <header className="dp-heading"><h3><i className="fas fa-bookmark" aria-hidden="true" />Selected material</h3><span>{current ? `Level ${current.level}` : 'Not selected'}</span></header>
      {current ? renderMaterial(current) : <p className="dp-empty">No material selected from this course.</p>}
    </section>
    <section className="dp-section">
      <header className="dp-heading"><h3><i className="fas fa-layer-group" aria-hidden="true" />Curriculum library</h3><span>{loading ? 'Loading' : `${matches.length} lessons`}</span></header>
      <div className="dp-filters">
        <label>Level<select aria-label="Level" value={level} onChange={event => { setLevel(event.currentTarget.value); setChapter(''); setLesson(''); setPage(0); }}><option value="">All levels</option>{levels.map(value => <option value={value} key={value}>Level {value}</option>)}</select></label>
        <label>Chapter<select aria-label="Chapter" value={chapter} onChange={event => { setChapter(event.currentTarget.value); setLesson(''); setPage(0); }}><option value="">All chapters</option>{chapters.map(value => <option value={value} key={value}>Chapter {value}</option>)}</select></label>
        <label>Lesson<select aria-label="Lesson" value={lesson} onChange={event => { setLesson(event.currentTarget.value); setPage(0); }}><option value="">All lessons</option>{lessons.map(value => <option value={value} key={value}>Lesson {value}</option>)}</select></label>
      </div>
      <div className="dp-results" aria-live="polite">
        {loading ? <p className="dp-empty" role="status">Loading lessons...</p> : matches.length ? matches.slice(activePage * pageSize, (activePage + 1) * pageSize).map(renderMaterial) : <p className="dp-empty">No lessons match these filters.</p>}
      </div>
      <footer className="dp-pagination"><span>{matches.length && !loading ? `${activePage * pageSize + 1}-${Math.min((activePage + 1) * pageSize, matches.length)} of ${matches.length}` : '0 results'}</span><div>
        <button type="button" title="Previous page" aria-label="Previous materials page" disabled={activePage === 0 || loading} onClick={() => setPage(activePage - 1)}><i className="fas fa-chevron-left" aria-hidden="true" /></button><span>{activePage + 1} / {pages}</span>
        <button type="button" title="Next page" aria-label="Next materials page" disabled={activePage + 1 >= pages || loading} onClick={() => setPage(activePage + 1)}><i className="fas fa-chevron-right" aria-hidden="true" /></button>
      </div></footer>
    </section>
  </div>;
}
