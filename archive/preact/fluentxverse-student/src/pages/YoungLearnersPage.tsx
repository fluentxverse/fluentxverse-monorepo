import { Search, X, CircleAlert, ChevronUp, ChevronDown } from 'lucide-preact';
/**
 * YoungLearnersPage
 * Browse and select Young Learners lessons
 */
import { useEffect, useState, useMemo } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { lessonApi } from '../api/lesson.api';
import './YoungLearnersPage.css';

// ============================================================================
// TYPES
// ============================================================================

interface YoungLearnersLesson {
  id: string;
  level: number;
  unit: number;
  lessonNumber: number;
  theme: string;
  ageGroup: string;
  unitLabel: string;
  lessonTitle: string;
  mascot: string;
  backgroundColor: string;
  greeting: string;
  status: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LEVEL_NAMES = [
  'Tiny Tots',
  'Little Stars',
  'Rising Learners',
  'Bright Explorers',
  'Super Kids'
];

const MASCOTS: Record<string, { emoji: string; color: string }> = {
  foxy: { emoji: '🦊', color: '#FF6B35' },
  buddy: { emoji: '🐻', color: '#8B4513' },
  sunny: { emoji: '☀️', color: '#FFD700' },
  luna: { emoji: '🌙', color: '#9370DB' },
  pippa: { emoji: '🐧', color: '#4169E1' },
  ozzy: { emoji: '🦉', color: '#6B8E23' },
};

const THEME_EMOJIS: Record<string, string> = {
  animals: '🐾',
  colors: '🎨',
  numbers: '🔢',
  shapes: '⭐',
  family: '👨‍👩‍👧‍👦',
  food: '🍎',
  weather: '🌤️',
  body: '🖐️',
  clothes: '👕',
  nature: '🌳',
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function YoungLearnersPage() {
  const location = useLocation();
  const [lessons, setLessons] = useState<YoungLearnersLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [expandedLevels, setExpandedLevels] = useState<number[]>([1]);
  const [expandedUnits, setExpandedUnits] = useState<string[]>([]);

  useEffect(() => {
    document.title = 'Young Learners | FluentXVerse';
  }, []);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await lessonApi.getYoungLearnersLessons();
      if (result.success) {
        setLessons(result.lessons || []);
      } else {
        setError(result.error || 'Failed to load lessons');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lessons');
    } finally {
      setIsLoading(false);
    }
  };

  // Group lessons by level and unit
  const groupedLessons = useMemo(() => {
    const groups: Record<number, Record<number, YoungLearnersLesson[]>> = {};
    
    lessons.forEach(lesson => {
      const { level, unit } = lesson;
      if (!groups[level]) {
        groups[level] = {};
      }
      if (!groups[level][unit]) {
        groups[level][unit] = [];
      }
      groups[level][unit].push(lesson);
    });

    // Sort lessons within each unit
    Object.values(groups).forEach(levelGroup => {
      Object.values(levelGroup).forEach(unitLessons => {
        unitLessons.sort((a, b) => a.lessonNumber - b.lessonNumber);
      });
    });

    return groups;
  }, [lessons]);

  // Filter lessons by search query
  const filteredLessons = useMemo(() => {
    if (!searchQuery.trim()) return groupedLessons;

    const query = searchQuery.toLowerCase();
    const filtered: Record<number, Record<number, YoungLearnersLesson[]>> = {};

    Object.entries(groupedLessons).forEach(([level, units]) => {
      Object.entries(units).forEach(([unit, unitLessons]) => {
        const matchingLessons = unitLessons.filter(lesson =>
          lesson.lessonTitle.toLowerCase().includes(query) ||
          lesson.unitLabel.toLowerCase().includes(query) ||
          lesson.theme.toLowerCase().includes(query)
        );
        if (matchingLessons.length > 0) {
          if (!filtered[Number(level)]) {
            filtered[Number(level)] = {};
          }
          filtered[Number(level)][Number(unit)] = matchingLessons;
        }
      });
    });

    return filtered;
  }, [groupedLessons, searchQuery]);

  // Get available levels
  const availableLevels = useMemo(() => {
    return Object.keys(filteredLessons).map(Number).sort((a, b) => a - b);
  }, [filteredLessons]);

  // Toggle level expansion
  const toggleLevel = (level: number) => {
    setExpandedLevels(prev =>
      prev.includes(level)
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  // Toggle unit expansion
  const toggleUnit = (level: number, unit: number) => {
    const key = `${level}-${unit}`;
    setExpandedUnits(prev =>
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  // Navigate to lesson
  const openLesson = (lesson: YoungLearnersLesson) => {
    location.route(`/young-learners/lesson/${lesson.id}`);
  };

  // Count lessons per level
  const getLevelLessonCount = (level: number) => {
    if (!filteredLessons[level]) return 0;
    return Object.values(filteredLessons[level]).flat().length;
  };

  // Count lessons per unit
  const getUnitLessonCount = (level: number, unit: number) => {
    return filteredLessons[level]?.[unit]?.length || 0;
  };

  return (
    <div className="student-young-shell">
      <Header />
      <SideBar />
      
      <div className="student-young-main">
        <div className="yl-page">
          {/* Header Section */}
          <div className="yl-page-header">
            <div className="yl-header-content">
              <img src="/assets/img/home-icons/training-v1.webp" alt="" width="48" height="48" />
              <h1>Young Learners</h1>
              <p>Fun English lessons for kids! Learn vocabulary, sing songs, and read stories.</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="yl-search-container">
            <div className="yl-search-box">
              <Search size={18} aria-hidden="true" />
              <input
                type="text"
                placeholder="Search lessons by name or theme..."
                value={searchQuery}
                onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              />
              {searchQuery && (
                <button className="yl-search-clear" onClick={() => setSearchQuery('')}>
                  <X size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="yl-content">
            {isLoading ? (
              <div className="yl-loading">
                <img src="/assets/img/home-icons/training-v1.webp" alt="" width="64" height="64" />
                <p>Loading lessons...</p>
              </div>
            ) : error ? (
              <div className="yl-error">
                <CircleAlert size={18} aria-hidden="true" />
                <h3>Oops! Something went wrong</h3>
                <p>{error}</p>
                <button onClick={loadLessons}>Try Again</button>
              </div>
            ) : availableLevels.length === 0 ? (
              <div className="yl-empty">
                <img src="/assets/img/home-icons/training-v1.webp" alt="" width="64" height="64" />
                <h3>No lessons available yet</h3>
                <p>Check back soon for exciting new lessons!</p>
              </div>
            ) : (
              <div className="yl-levels-list">
                {availableLevels.map(level => {
                  const levelName = LEVEL_NAMES[level - 1] || `Level ${level}`;
                  const isExpanded = expandedLevels.includes(level);
                  const lessonCount = getLevelLessonCount(level);
                  const units = filteredLessons[level];
                  const unitNumbers = Object.keys(units).map(Number).sort((a, b) => a - b);

                  return (
                    <div key={level} className={`yl-level ${isExpanded ? 'expanded' : ''}`}>
                      <button type="button" className="yl-level-header" aria-expanded={isExpanded} onClick={() => toggleLevel(level)}>
                        <div className="yl-level-info">
                          <span className="yl-level-number">Level {level}</span>
                          <span className="yl-level-name">{levelName}</span>
                        </div>
                        <div className="yl-level-meta">
                          <span className="yl-lesson-count">{lessonCount} lessons</span>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="yl-units-list">
                          {unitNumbers.map(unit => {
                            const unitKey = `${level}-${unit}`;
                            const isUnitExpanded = expandedUnits.includes(unitKey);
                            const unitLessons = units[unit];
                            const unitLabel = unitLessons[0]?.unitLabel || `Unit ${unit}`;

                            return (
                              <div key={unit} className={`yl-unit ${isUnitExpanded ? 'expanded' : ''}`}>
                                <button type="button" className="yl-unit-header" aria-expanded={isUnitExpanded} onClick={() => toggleUnit(level, unit)}>
                                  <div className="yl-unit-info">
                                    <span className="yl-unit-number">Unit {unit}</span>
                                    <span className="yl-unit-name">{unitLabel}</span>
                                  </div>
                                  <div className="yl-unit-meta">
                                    <span className="yl-lesson-count">{getUnitLessonCount(level, unit)}</span>
                                    {isUnitExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                  </div>
                                </button>

                                {isUnitExpanded && (
                                  <div className="yl-lessons-grid">
                                    {unitLessons.map(lesson => {
                                      const mascot = MASCOTS[lesson.mascot] || MASCOTS.foxy;
                                      const themeEmoji = THEME_EMOJIS[lesson.theme] || '📚';

                                      return (
                                        <button type="button"
                                          key={lesson.id}
                                          className="yl-lesson-card"
                                          onClick={() => openLesson(lesson)}
                                        >
                                          <img className="yl-card-mascot" src="/assets/img/home-icons/training-v1.webp" alt="" width="48" height="48" />
                                          <div className="yl-card-content">
                                            <span className="yl-card-lesson">Lesson {lesson.lessonNumber}</span>
                                            <h4 className="yl-card-title">{lesson.lessonTitle}</h4>
                                            <div className="yl-card-tags">
                                              <span className="yl-card-tag theme">
                                                {lesson.theme}
                                              </span>
                                              <span className="yl-card-tag age">
                                                {lesson.ageGroup} yrs
                                              </span>
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
