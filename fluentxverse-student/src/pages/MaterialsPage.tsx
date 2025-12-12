import { useState, useEffect } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import './MaterialsPage.css';

interface Course {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  lessons: number;
  rating: number;
}

const courses: Course[] = [
  {
    id: 'business-english',
    title: 'Business English',
    description: 'Professional communication, meetings, presentations, and workplace vocabulary.',
    icon: '💼',
    category: 'Business',
    lessons: 24,
    rating: 4.8,
  },
  {
    id: 'conversational-skills',
    title: 'Conversational Skills',
    description: 'Everyday conversations, casual discussions, and natural speaking patterns.',
    icon: '💬',
    category: 'Conversation',
    lessons: 30,
    rating: 4.9,
  },
  {
    id: 'job-interview-prep',
    title: 'Job Interview Preparation',
    description: 'Interview techniques, common questions, and confidence building.',
    icon: '👔',
    category: 'Career',
    lessons: 18,
    rating: 4.8,
  },
  {
    id: 'travel-english',
    title: 'Travel English',
    description: 'Airport, hotel, restaurant, and tourism-related vocabulary and phrases.',
    icon: '✈️',
    category: 'Travel',
    lessons: 20,
    rating: 4.7,
  },
  {
    id: 'academic-english',
    title: 'Academic English',
    description: 'Essay writing, research presentations, and academic vocabulary.',
    icon: '🎓',
    category: 'Academic',
    lessons: 22,
    rating: 4.8,
  },
  {
    id: 'pronunciation',
    title: 'Pronunciation',
    description: 'Phonetics, intonation, stress patterns, and accent improvement.',
    icon: '🎤',
    category: 'Speaking',
    lessons: 16,
    rating: 4.9,
  },
  {
    id: 'grammar-improvement',
    title: 'Grammar Improvement',
    description: 'Tenses, sentence structure, common mistakes, and advanced grammar.',
    icon: '📝',
    category: 'Grammar',
    lessons: 28,
    rating: 4.7,
  },
  {
    id: 'vocabulary-building',
    title: 'Vocabulary Building',
    description: 'Word roots, synonyms, idioms, and expanding your word bank.',
    icon: '📚',
    category: 'Vocabulary',
    lessons: 25,
    rating: 4.8,
  }
];

const categories = ['All', 'Business', 'Conversation', 'Career', 'Travel', 'Academic', 'Speaking', 'Grammar', 'Vocabulary'];

export default function MaterialsPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = 'Materials | FluentXVerse';
  }, []);

  const filteredCourses = courses.filter(course => {
    const matchesCategory = selectedCategory === 'All' || course.category === selectedCategory;
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          course.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCourseClick = (courseId: string) => {
    window.location.href = `/materials/${courseId}`;
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
              <a href="/home" className="back-link">
                <i className="fas fa-arrow-left"></i>
                Back to Dashboard
              </a>
              <div className="materials-header-content">
                <h1>
                  <i className="fas fa-book-open"></i>
                  Learning Materials
                </h1>
                <p>Explore our comprehensive collection of {courses.length} English learning courses</p>
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
              {categories.map(category => (
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
              {filteredCourses.map(course => (
                <div
                  key={course.id}
                  className="course-card"
                  onClick={() => handleCourseClick(course.id)}
                >
                  <div className="course-icon">{course.icon}</div>
                  <div className="course-content">
                    <h3 className="course-title">{course.title}</h3>
                    <p className="course-description">{course.description}</p>
                    <div className="course-meta">
                      <span className="course-lessons">
                        <i className="fas fa-file-alt" /> {course.lessons} Lessons
                      </span>
                    </div>
                    <div className="course-footer">
                      <div className="course-rating">
                        <i className="fas fa-star" />
                        <span>{course.rating.toFixed(1)}</span>
                      </div>
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
