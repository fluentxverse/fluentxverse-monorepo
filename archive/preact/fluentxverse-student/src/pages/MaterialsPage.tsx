import { useState, useEffect } from 'preact/hooks';
import { ArrowRight, CalendarDays, Search, X } from 'lucide-preact';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import './MaterialsPage.css';

interface Course {
  id: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  category: string;
  lessons: number;
}

const courses: Course[] = [
  {
    id: 'business-english',
    title: 'Business English',
    description: 'Professional communication, meetings, presentations, and workplace vocabulary.',
    image: '/assets/img/materials/business-english.webp',
    imageAlt: 'Briefcase, presentation chart, and microphone for Business English',
    category: 'Business',
    lessons: 24,
  },
  {
    id: 'conversational-skills',
    title: 'Conversational Skills',
    description: 'Everyday conversations, casual discussions, and natural speaking patterns.',
    image: '/assets/img/materials/conversational-skills.webp',
    imageAlt: 'Microphone and speech bubbles for conversational practice',
    category: 'Conversation',
    lessons: 30,
  },
  {
    id: 'job-interview-prep',
    title: 'Job Interview Preparation',
    description: 'Interview techniques, common questions, and confidence building.',
    image: '/assets/img/materials/job-interview-prep.webp',
    imageAlt: 'Professional suit, resume, and approval mark for interview preparation',
    category: 'Career',
    lessons: 18,
  },
  {
    id: 'travel-english',
    title: 'Travel English',
    description: 'Airport, hotel, restaurant, and tourism-related vocabulary and phrases.',
    image: '/assets/img/materials/travel-english.webp',
    imageAlt: 'Suitcase, airplane, and location marker for Travel English',
    category: 'Travel',
    lessons: 20,
  },
  {
    id: 'academic-english',
    title: 'Academic English',
    description: 'Essay writing, research presentations, and academic vocabulary.',
    image: '/assets/img/materials/academic-english.webp',
    imageAlt: 'Graduation cap, books, and globe for Academic English',
    category: 'Academic',
    lessons: 22,
  },
  {
    id: 'pronunciation',
    title: 'Pronunciation',
    description: 'Phonetics, intonation, stress patterns, and accent improvement.',
    image: '/assets/img/materials/pronunciation.webp',
    imageAlt: 'Studio microphone, headphones, and sound waves for pronunciation',
    category: 'Speaking',
    lessons: 16,
  },
  {
    id: 'grammar-improvement',
    title: 'Grammar Improvement',
    description: 'Tenses, sentence structure, common mistakes, and advanced grammar.',
    image: '/assets/img/materials/grammar-improvement.webp',
    imageAlt: 'Open notebook, correction marks, and sentence blocks for grammar practice',
    category: 'Grammar',
    lessons: 28,
  },
  {
    id: 'vocabulary-building',
    title: 'Vocabulary Building',
    description: 'Word roots, synonyms, idioms, and expanding your word bank.',
    image: '/assets/img/materials/vocabulary-building.webp',
    imageAlt: 'Open book and branching flashcards for vocabulary building',
    category: 'Vocabulary',
    lessons: 25,
  },
  {
    id: 'daily-dispatch',
    title: 'Daily Dispatch',
    description: 'Current news articles with vocabulary, comprehension questions, and discussion topics.',
    image: '/assets/img/materials/daily-dispatch.webp',
    imageAlt: 'Newspaper, globe, and broadcast microphone for Daily Dispatch',
    category: 'News',
    lessons: 0,
  }
];

const availableCourses = courses.filter(course =>
  ['business-english', 'conversational-skills', 'daily-dispatch'].includes(course.id)
);

export default function MaterialsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [collection, setCollection] = useState<'all' | 'curriculum' | 'news'>('all');

  useEffect(() => {
    document.title = 'Materials | FluentXVerse';
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleCourses = availableCourses.filter(course =>
    (collection === 'all' || (collection === 'news' ? course.id === 'daily-dispatch' : course.id !== 'daily-dispatch')) &&
    [course.title, course.description, course.category].some(value => value.toLowerCase().includes(normalizedSearch))
  );
  const resetFilters = () => { setSearchQuery(''); setCollection('all'); };

  return <>
    <SideBar />
    <div className="student-materials">
      <Header />
      <main className="materials-page">
        <div className="materials-container">
          <header className="materials-heading">
            <img className="materials-heading-art" src="/assets/img/home-icons/training-v1.webp" width={64} height={64} alt="" />
            <div><span className="materials-eyebrow">Your lesson library</span><h1>Learning materials</h1></div>
            <a className="materials-book-button" href="/browse-tutors"><CalendarDays size={16} />Book a Lesson</a>
          </header>

          <div className="materials-toolbar">
            <div className="materials-collections" aria-label="Material collection">
              {([{ id: 'all', label: 'All materials' }, { id: 'curriculum', label: 'Curriculum' }, { id: 'news', label: 'Daily Dispatch' }] as const).map(item => <button type="button" key={item.id} aria-pressed={collection === item.id} className={collection === item.id ? 'active' : ''} onClick={() => setCollection(item.id)}>{item.label}</button>)}
            </div>
            <div className="materials-search-field">
              <Search size={18} aria-hidden="true" />
              <input type="search" aria-label="Search learning materials" placeholder="Search materials..." value={searchQuery} onInput={event => setSearchQuery(event.currentTarget.value)} />
              {searchQuery && <button type="button" aria-label="Clear search" title="Clear search" onClick={() => setSearchQuery('')}><X size={16} /></button>}
            </div>
          </div>
          <p className="materials-result-count" role="status">{visibleCourses.length} {visibleCourses.length === 1 ? 'collection' : 'collections'}</p>

          {visibleCourses.length ? <div className="materials-course-grid">
            {visibleCourses.map(course => <a className="materials-course" key={course.id} href={`/materials/${course.id}`} aria-label={`Open ${course.title}`}>
              <div className="materials-course-art"><img src={course.image} alt={course.imageAlt} width={640} height={360} loading="lazy" /></div>
              <div className="materials-course-content">
                <span className="materials-course-category">{course.category}</span>
                <h2>{course.title}</h2>
                <p>{course.description}</p>
                <div className="materials-course-footer"><span>{course.id === 'daily-dispatch' ? 'Explore articles' : 'Browse lessons'}</span><ArrowRight size={18} /></div>
              </div>
            </a>)}
          </div> : <div className="materials-empty">
            <img src="/assets/img/home-icons/training-v1.webp" width={72} height={72} alt="" />
            <h2>No matching materials</h2>
            <p>{searchQuery.trim() ? `No results for "${searchQuery.trim()}".` : 'No materials in this collection.'}</p>
            <button className="materials-reset-button" type="button" onClick={resetFilters}><X size={16} />Clear filters</button>
          </div>}
        </div>
      </main>
    </div>
  </>;
}
