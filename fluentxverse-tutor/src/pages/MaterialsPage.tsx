import { useEffect, useState } from 'preact/hooks';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import { useAuthContext } from '../context/AuthContext';
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
const categories = ['All', ...new Set(availableCourses.map(course => course.category))];

const MaterialsPage = () => {
  useEffect(() => {
    document.title = 'Materials | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCourses = availableCourses.filter(course => {
    const matchesCategory = selectedCategory === 'All' || course.category === selectedCategory;
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          course.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
        <DashboardHeader user={user || undefined} />
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
                  <p className="materials-page-subtitle">Explore our comprehensive collection of {availableCourses.length} English learning courses</p>
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

            {/* Category Tabs */}
            <div className="category-tabs">
              {categories.map((category) => (
                <button
                  key={category}
                  className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Courses Grid */}
            <div className="courses-grid">
              {filteredCourses.map((course) => (
                <button
                  type="button"
                  key={course.id}
                  className="course-card"
                  onClick={() => handleCourseClick(course.id)}
                >
                  <div className="course-artwork"><img src={course.image} alt={course.imageAlt} loading="lazy" /></div>
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
                </button>
              ))}
            </div>

            {/* Empty State */}
            {filteredCourses.length === 0 && (
              <div className="materials-empty">
                <div className="empty-icon">
                  <i className="fi-sr-search"></i>
                </div>
                <h3>No courses found</h3>
                <p>Try adjusting your search or filter criteria</p>
                <button
                  className="btn-reset"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                  }}
                >
                  <i className="fi-sr-refresh"></i>
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default MaterialsPage;
