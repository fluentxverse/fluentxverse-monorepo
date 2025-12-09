import { useEffect, useState } from 'preact/hooks';
import DashboardHeader from '@/Components/Common/DashboardHeader';
import './MaterialsPage.css';

interface Course {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  level: string;
  lessons: number;
  progress?: number;
  rating: number;
  isComingSoon?: boolean;
}

const courses: Course[] = [
  {
    id: 'intensive-conversation',
    title: 'Intensive Conversation',
    description: 'Master conversational English with intensive speaking practice and real-world scenarios.',
    icon: '💬',
    category: 'Conversation',
    level: 'Intermediate - Advanced',
    lessons: 24,
    progress: 0,
    rating: 4.8,
  },
  {
    id: 'basic-phonics',
    title: 'Basic Phonics',
    description: 'Learn the fundamentals of English pronunciation through phonics-based training.',
    icon: '🔤',
    category: 'Pronunciation',
    level: 'Beginner',
    lessons: 16,
    progress: 0,
    rating: 4.9,
  },
  {
    id: 'level-up-reading',
    title: 'Level Up Reading',
    description: 'Improve reading comprehension and speed with graded reading materials.',
    icon: '📚',
    category: 'Reading',
    level: 'All Levels',
    lessons: 32,
    progress: 0,
    rating: 4.7,
  },
  {
    id: 'discussion-writing',
    title: 'Discussion and Writing',
    description: 'Develop critical thinking and writing skills through structured discussions.',
    icon: '✍️',
    category: 'Writing',
    level: 'Intermediate - Advanced',
    lessons: 20,
    progress: 0,
    rating: 4.6,
  },
  {
    id: 'toeic-speaking',
    title: 'TOEIC Speaking Booster',
    description: 'Targeted preparation for TOEIC Speaking test with mock exams and strategies.',
    icon: '🎯',
    category: 'Test Preparation',
    level: 'Intermediate - Advanced',
    lessons: 18,
    progress: 0,
    rating: 4.9,
  },
  {
    id: 'ielts-speaking',
    title: 'IELTS Speaking Booster',
    description: 'Comprehensive IELTS Speaking preparation with band score improvement techniques.',
    icon: '🇬🇧',
    category: 'Test Preparation',
    level: 'Intermediate - Advanced',
    lessons: 22,
    progress: 0,
    rating: 4.8,
  },
  {
    id: 'toefl-speaking',
    title: 'TOEFL Speaking Booster',
    description: 'Strategic TOEFL Speaking section preparation with integrated task practice.',
    icon: '🇺🇸',
    category: 'Test Preparation',
    level: 'Advanced',
    lessons: 20,
    progress: 0,
    rating: 4.7,
  },
  {
    id: 'opic',
    title: 'OPIc',
    description: 'Oral Proficiency Interview preparation with personalized coaching strategies.',
    icon: '🎤',
    category: 'Test Preparation',
    level: 'All Levels',
    lessons: 15,
    progress: 0,
    rating: 4.8,
  },
  {
    id: 'all-the-way',
    title: 'All the Way',
    description: 'Comprehensive English course covering all skills from beginner to advanced.',
    icon: '🚀',
    category: 'General',
    level: 'All Levels',
    lessons: 48,
    progress: 0,
    rating: 4.9,
  },
  {
    id: 'daily-english',
    title: 'Daily English',
    description: 'Practical everyday English for real-life situations and conversations.',
    icon: '☀️',
    category: 'Conversation',
    level: 'Beginner - Intermediate',
    lessons: 30,
    progress: 0,
    rating: 4.7,
  },
  {
    id: 'business-essentials',
    title: 'Business Essentials',
    description: 'Professional English for business meetings, presentations, and negotiations.',
    icon: '💼',
    category: 'Business',
    level: 'Intermediate - Advanced',
    lessons: 25,
    progress: 0,
    rating: 4.8,
  },
  {
    id: 'catch-up',
    title: 'Catch Up',
    description: 'Refresher course for learners returning to English after a break.',
    icon: '🔄',
    category: 'General',
    level: 'Beginner - Intermediate',
    lessons: 12,
    progress: 0,
    rating: 4.6,
  },
  {
    id: 'special-class',
    title: 'Special Class',
    description: 'Customized lessons for specific topics or special learning needs.',
    icon: '⭐',
    category: 'General',
    level: 'All Levels',
    lessons: 10,
    progress: 0,
    rating: 4.9,
    isComingSoon: true,
  },
];

const categories = ['All', 'Conversation', 'Reading', 'Writing', 'Pronunciation', 'Test Preparation', 'Business', 'General'];

export default function MaterialsPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filteredCourses, setFilteredCourses] = useState(courses);

  useEffect(() => {
    if (selectedCategory === 'All') {
      setFilteredCourses(courses);
    } else {
      setFilteredCourses(courses.filter(course => course.category === selectedCategory));
    }
  }, [selectedCategory]);

  const handleCourseClick = (course: Course) => {
    if (course.isComingSoon) {
      return;
    }
    // Navigate to course details (to be implemented)
    console.log('Opening course:', course.id);
  };

  return (
    <div className="materials-page">
      <DashboardHeader title="Materials" />
      
      <div className="materials-container">
        <div className="materials-header">
          <div className="materials-header-content">
            <h1>Learning Materials</h1>
            <p>Explore our comprehensive collection of English learning courses</p>
          </div>
        </div>

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

        <div className="courses-grid">
          {filteredCourses.map(course => (
            <div
              key={course.id}
              className={`course-card ${course.isComingSoon ? 'coming-soon' : ''}`}
              onClick={() => handleCourseClick(course)}
            >
              {course.isComingSoon && (
                <div className="coming-soon-badge">Coming Soon</div>
              )}
              <div className="course-icon">{course.icon}</div>
              <div className="course-content">
                <h3 className="course-title">{course.title}</h3>
                <p className="course-description">{course.description}</p>
                <div className="course-meta">
                  <span className="course-level">
                    <i className="ri-bar-chart-line" /> {course.level}
                  </span>
                  <span className="course-lessons">
                    <i className="ri-book-2-line" /> {course.lessons} Lessons
                  </span>
                </div>
                <div className="course-footer">
                  <div className="course-rating">
                    <i className="ri-star-fill" />
                    <span>{course.rating.toFixed(1)}</span>
                  </div>
                  {course.progress !== undefined && course.progress > 0 && (
                    <div className="course-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                      <span>{course.progress}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
