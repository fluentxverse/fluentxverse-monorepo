import { useEffect, useState } from 'preact/hooks';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import { useAuthContext } from '../context/AuthContext';
import './MaterialsPage.css';

interface Course {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  lessonCount: number;
  category: 'core' | 'specialized' | 'exam-prep';
}

const COURSES: Course[] = [
  {
    id: 'business-english',
    title: 'Business English',
    description: 'Professional communication, meetings, presentations, and workplace vocabulary',
    icon: 'fas fa-briefcase',
    color: '#0245ae',
    bgColor: '#e0f2fe',
    lessonCount: 24,
    category: 'core'
  },
  {
    id: 'conversational-skills',
    title: 'Conversational Skills',
    description: 'Everyday conversations, casual discussions, and natural speaking patterns',
    icon: 'fas fa-comments',
    color: '#059669',
    bgColor: '#d1fae5',
    lessonCount: 30,
    category: 'core'
  },
  {
    id: 'job-interview-prep',
    title: 'Job Interview Preparation',
    description: 'Interview techniques, common questions, and confidence building',
    icon: 'fas fa-user-tie',
    color: '#7c3aed',
    bgColor: '#ede9fe',
    lessonCount: 18,
    category: 'specialized'
  },
  {
    id: 'travel-english',
    title: 'Travel English',
    description: 'Airport, hotel, restaurant, and tourism-related vocabulary and phrases',
    icon: 'fas fa-plane-departure',
    color: '#f59e0b',
    bgColor: '#fef3c7',
    lessonCount: 20,
    category: 'specialized'
  },
  {
    id: 'academic-english',
    title: 'Academic English',
    description: 'Essay writing, research presentations, and academic vocabulary',
    icon: 'fas fa-graduation-cap',
    color: '#dc2626',
    bgColor: '#fee2e2',
    lessonCount: 22,
    category: 'specialized'
  },
  {
    id: 'pronunciation',
    title: 'Pronunciation',
    description: 'Phonetics, intonation, stress patterns, and accent improvement',
    icon: 'fas fa-microphone-alt',
    color: '#ec4899',
    bgColor: '#fce7f3',
    lessonCount: 16,
    category: 'core'
  },
  {
    id: 'grammar-improvement',
    title: 'Grammar Improvement',
    description: 'Tenses, sentence structure, common mistakes, and advanced grammar',
    icon: 'fas fa-spell-check',
    color: '#0891b2',
    bgColor: '#cffafe',
    lessonCount: 28,
    category: 'core'
  },
  {
    id: 'vocabulary-building',
    title: 'Vocabulary Building',
    description: 'Word roots, synonyms, idioms, and expanding your word bank',
    icon: 'fas fa-book-open',
    color: '#ea580c',
    bgColor: '#ffedd5',
    lessonCount: 25,
    category: 'core'
  }
];

const MaterialsPage = () => {
  useEffect(() => {
    document.title = 'Materials | FluentXVerse';
  }, []);

  const { user } = useAuthContext();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'core' | 'specialized' | 'exam-prep'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCourses = COURSES.filter(course => {
    const matchesCategory = selectedCategory === 'all' || course.category === selectedCategory;
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          course.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCourseClick = (courseId: string) => {
    // Navigate to course detail page (can be implemented later)
    window.location.href = `/materials/${courseId}`;
  };

  return (
    <>
      <SideBar />
      <div className="main-content">
        <DashboardHeader user={user || undefined} />
        <div className="materials-page">
          <div className="container">
            {/* Page Header */}
            <div className="materials-page-header">
              <div className="materials-page-title">
                <div className="materials-icon-wrapper">
                  <i className="fas fa-book"></i>
                </div>
                <div>
                  <h1>Teaching Materials</h1>
                  <p>{COURSES.length} courses available</p>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="materials-controls">
              <div className="materials-search">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchQuery}
                  onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                />
              </div>
              <div className="materials-filters">
                {[
                  { key: 'all', label: 'All Courses', icon: 'fas fa-th-large' },
                  { key: 'core', label: 'Core', icon: 'fas fa-star' },
                  { key: 'specialized', label: 'Specialized', icon: 'fas fa-bullseye' },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    className={`filter-btn ${selectedCategory === filter.key ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(filter.key as any)}
                  >
                    <i className={filter.icon}></i>
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Courses Grid */}
            <div className="materials-grid">
              {filteredCourses.map((course) => (
                <div
                  key={course.id}
                  className="material-card"
                  onClick={() => handleCourseClick(course.id)}
                >
                  <div
                    className="material-card-icon"
                    style={{ backgroundColor: course.bgColor, color: course.color }}
                  >
                    <i className={course.icon}></i>
                  </div>
                  <div className="material-card-content">
                    <h3 className="material-card-title">{course.title}</h3>
                    <p className="material-card-description">{course.description}</p>
                    <div className="material-card-meta">
                      <span className="lesson-count">
                        <i className="fas fa-file-alt"></i>
                        {course.lessonCount} lessons
                      </span>
                      <span className={`category-badge ${course.category}`}>
                        {course.category === 'core' ? 'Core' : 
                         course.category === 'specialized' ? 'Specialized' : 'Exam Prep'}
                      </span>
                    </div>
                  </div>
                  <div className="material-card-arrow">
                    <i className="fas fa-chevron-right"></i>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State */}
            {filteredCourses.length === 0 && (
              <div className="materials-empty">
                <div className="empty-icon">
                  <i className="fas fa-search"></i>
                </div>
                <h3>No courses found</h3>
                <p>Try adjusting your search or filter criteria</p>
                <button
                  className="btn-reset"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                >
                  <i className="fas fa-redo"></i>
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
