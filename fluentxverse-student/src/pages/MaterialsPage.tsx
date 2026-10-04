import { useState, useEffect } from 'preact/hooks';
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

export default function MaterialsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = 'Materials | FluentXVerse';
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleCourses = courses.filter(course =>
    course.title.toLowerCase().includes(normalizedSearch) ||
    course.description.toLowerCase().includes(normalizedSearch)
  );

  const handleCourseClick = (courseId: string) => {
    if (courseId === 'daily-dispatch') {
      window.location.href = '/materials/daily-dispatch';
    } else {
      window.location.href = `/materials/${courseId}`;
    }
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <div className="materials-page">
          <div className="materials-container">
            {/* Header */}
            <div className="materials-header">
              <div className="materials-header-left">
                <div className="materials-page-icon">
                  <i className="fas fa-book-open"></i>
                </div>
                <div>
                  <h1 className="materials-page-title">Learning Materials</h1>
                  <p className="materials-page-subtitle">Explore our comprehensive collection of {courses.length} English learning courses</p>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="materials-search">
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              />
            </div>

            {/* Courses Grid */}
            <div className="courses-grid">
              {visibleCourses.map(course => (
                <div
                  key={course.id}
                  className="course-card"
                  onClick={() => handleCourseClick(course.id)}
                >
                  <div className="course-artwork">
                    <img src={course.image} alt={course.imageAlt} loading="lazy" />
                  </div>
                  <div className="course-content">
                    <h3 className="course-title">{course.title}</h3>
                    <p className="course-description">{course.description}</p>
                    <div className="course-meta">
                      <span className="course-lessons">
                        <i className="fas fa-file-alt" /> {course.lessons} Lessons
                      </span>
                    </div>
                    <div className="course-footer">
                      <span className="course-category">{course.category}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
