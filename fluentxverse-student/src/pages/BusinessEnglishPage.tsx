import { useEffect, useState, useMemo } from 'preact/hooks';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { type Lesson } from '../api/lesson.api';
import { lessonApi } from '../api/lesson.api';
import './BusinessEnglishPage.css';

// Constants for course structure
const TOTAL_LEVELS = 10;
const CHAPTERS_PER_LEVEL = 5;
/** Level 1 has only 1 chapter; all other levels have 5 */
const getChaptersForLevel = (level: number): number[] =>
  level === 1 ? [1] : Array.from({ length: CHAPTERS_PER_LEVEL }, (_, i) => i + 1);

const transformLessonMaterialToLesson = (lessonMaterial: any): Lesson => {
  const chapterLabel = lessonMaterial.chapterLabel
    || (lessonMaterial.chapterName
      ? `Chapter ${lessonMaterial.chapter}: ${lessonMaterial.chapterName}`
      : `Chapter ${lessonMaterial.chapter}`);
  const lessonLabel = lessonMaterial.lessonTitle || `Lesson ${lessonMaterial.lessonNumber}: ${lessonMaterial.lessonName}`;

  return {
    id: lessonMaterial.id,
    title: lessonLabel,
    slug: lessonMaterial.id,
    status: 'published',
    parentId: null,
    forkOf: null,
    isFork: false,
    createdBy: lessonMaterial.createdBy || '',
    createdByName: lessonMaterial.createdByName || null,
    storagePath: '',
    createdAt: lessonMaterial.createdAt || '',
    updatedAt: lessonMaterial.updatedAt || '',
    publishedAt: lessonMaterial.updatedAt || null,
    lessonData: {
      course: lessonMaterial.course,
      skill: lessonMaterial.skill,
      sections: lessonMaterial.sections,
      header: {
        levelBadge: `Level ${lessonMaterial.level || 1}`,
        chapterLabel,
        lessonLabel,
        goalText: lessonMaterial.goalTextEn || '',
        goalSubtext: lessonMaterial.goalTextJp || '',
        backgroundImage: lessonMaterial.backgroundImage || '',
        overlayColor: lessonMaterial.overlayColor || '',
      }
    } as Lesson['lessonData'],
    currentVersion: lessonMaterial.version,
  };
};

export default function BusinessEnglishPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [expandedLevels, setExpandedLevels] = useState<number[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);

  useEffect(() => {
    document.title = 'Business English | FluentXVerse';
  }, []);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await lessonApi.getPublishedLessonMaterials('business-english');
      if (result.success) {
        setLessons(result.lessons.map(transformLessonMaterialToLesson));
      } else {
        setError(result.error || 'Failed to load lessons');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lessons');
    } finally {
      setIsLoading(false);
    }
  };

  // Parse level number from lesson header (e.g., "LEVEL 1" -> 1)
  const getLevelNumber = (lesson: Lesson): number => {
    const levelBadge = lesson.lessonData?.header?.levelBadge || '';
    const match = levelBadge.match(/\d+/);
    return match ? parseInt(match[0], 10) : 1;
  };

  // Parse chapter number from lesson header (e.g., "Chapter 1: ..." -> 1)
  const getChapterNumber = (lesson: Lesson): number => {
    const chapterLabel = lesson.lessonData?.header?.chapterLabel || '';
    const match = chapterLabel.match(/Chapter\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  };

  // Parse lesson number from title or label (e.g., "Lesson 1: ..." -> 1)
  const getLessonNumber = (lesson: Lesson): number => {
    const lessonLabel = lesson.lessonData?.header?.lessonLabel || lesson.title || '';
    const match = lessonLabel.match(/Lesson\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  };

  // Group lessons by level and chapter
  const groupedLessons = useMemo(() => {
    const groups: Record<number, Record<number, Lesson[]>> = {};
    
    lessons.forEach(lesson => {
      const level = getLevelNumber(lesson);
      const chapter = getChapterNumber(lesson);
      
      if (!groups[level]) {
        groups[level] = {};
      }
      if (!groups[level][chapter]) {
        groups[level][chapter] = [];
      }
      groups[level][chapter].push(lesson);
    });

    // Sort lessons within each chapter by lesson number
    Object.values(groups).forEach(chapters => {
      Object.values(chapters).forEach(lessonList => {
        lessonList.sort((a, b) => getLessonNumber(a) - getLessonNumber(b));
      });
    });

    return groups;
  }, [lessons]);

  // Filter lessons based on search and selections
  const filteredLessons = useMemo(() => {
    let filtered = lessons;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lesson =>
        lesson.title.toLowerCase().includes(query) ||
        (lesson.lessonData?.header?.lessonLabel || '').toLowerCase().includes(query) ||
        (lesson.lessonData?.header?.goalText || '').toLowerCase().includes(query)
      );
    }

    if (selectedLevel !== null) {
      filtered = filtered.filter(lesson => getLevelNumber(lesson) === selectedLevel);
    }

    if (selectedChapter !== null) {
      filtered = filtered.filter(lesson => getChapterNumber(lesson) === selectedChapter);
    }

    return filtered;
  }, [lessons, searchQuery, selectedLevel, selectedChapter]);

  // Get lesson counts per level
  const getLessonCountForLevel = (level: number): number => {
    return lessons.filter(lesson => getLevelNumber(lesson) === level).length;
  };

  // Get lesson counts per chapter in a level
  const getLessonCountForChapter = (level: number, chapter: number): number => {
    return lessons.filter(lesson => 
      getLevelNumber(lesson) === level && getChapterNumber(lesson) === chapter
    ).length;
  };

  const toggleLevel = (level: number) => {
    setExpandedLevels(prev => 
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const toggleChapter = (levelChapterKey: string) => {
    setExpandedChapters(prev =>
      prev.includes(levelChapterKey) 
        ? prev.filter(k => k !== levelChapterKey) 
        : [...prev, levelChapterKey]
    );
  };

  const handleOpenLesson = (lesson: Lesson) => {
    window.open(`/materials/business-english/${lesson.id}`, '_blank');
  };

  const getLevelFromHeader = (lesson: Lesson): string => {
    return lesson.lessonData?.header?.levelBadge || 'Level 1';
  };

  const getChapterFromHeader = (lesson: Lesson): string => {
    return lesson.lessonData?.header?.chapterLabel || '';
  };

  const getSectionsCount = (lesson: Lesson): number => {
    const beData = (lesson as any)?.beData || (lesson as any)?.lessonData?.beData;
    const sectionCount = [
      beData?.introduce,
      beData?.present,
      beData?.understand,
      beData?.practice,
      beData?.challenge,
      beData?.discussion,
      beData?.feedback,
    ].filter(Boolean).length;

    return sectionCount || lesson.lessonData?.sections?.length || 7;
  };

  const clearFilters = () => {
    setSelectedLevel(null);
    setSelectedChapter(null);
    setSearchQuery('');
  };

  // Get available chapters for selected level
  const availableChapters = selectedLevel !== null 
    ? getChaptersForLevel(selectedLevel)
    : [];

  return (
    <>
      <SideBar />
      <div className="main-content">
        <Header />
        <div className="course-detail-page">
          <div className="course-detail-container">
            {/* Page Header */}
            <div className="course-detail-header">
              <a href="/materials" className="back-link">
                <i className="fas fa-chevron-left"></i>
                Back to Materials
              </a>
              <div className="course-hero">
                <div className="course-hero-icon">💼</div>
                <div className="course-hero-content">
                  <span className="course-category-badge">Business</span>
                  <h1 className="course-title-main">Business English</h1>
                  <p className="course-description-main">
                    Practice workplace communication, meetings, introductions, email tone, and professional discussion skills.
                    Build confidence in real business situations with structured lesson materials.
                  </p>
                  <div className="course-stats-row">
                    <div className="course-stat">
                      <i className="fas fa-book"></i>
                      <span>{lessons.length} Lessons Available</span>
                    </div>
                    <div className="course-stat">
                      <i className="fas fa-layer-group"></i>
                      <span>{TOTAL_LEVELS} Levels • Up to {CHAPTERS_PER_LEVEL} Chapters each</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters Section */}
            <div className="lessons-filters-section">
              <div className="filters-row">
                {/* Level Dropdown */}
                <div className="filter-group">
                  <label className="filter-label">Level</label>
                  <select 
                    className="filter-select"
                    value={selectedLevel ?? ''}
                    onChange={(e) => {
                      const val = (e.target as HTMLSelectElement).value;
                      setSelectedLevel(val ? parseInt(val, 10) : null);
                      setSelectedChapter(null);
                    }}
                  >
                    <option value="">All Levels</option>
                    {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map(level => (
                      <option key={level} value={level}>
                        Level {level} ({getLessonCountForLevel(level)} lessons)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chapter Dropdown */}
                <div className="filter-group">
                  <label className="filter-label">Chapter</label>
                  <select 
                    className="filter-select"
                    value={selectedChapter ?? ''}
                    onChange={(e) => {
                      const val = (e.target as HTMLSelectElement).value;
                      setSelectedChapter(val ? parseInt(val, 10) : null);
                    }}
                    disabled={selectedLevel === null}
                  >
                    <option value="">All Chapters</option>
                    {availableChapters.map(chapter => (
                      <option key={chapter} value={chapter}>
                        Chapter {chapter} ({selectedLevel !== null ? getLessonCountForChapter(selectedLevel, chapter) : 0} lessons)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search */}
                <div className="filter-group filter-search">
                  <label className="filter-label">Search</label>
                  <div className="lessons-search">
                    <i className="fas fa-search"></i>
                    <input
                      type="text"
                      placeholder="Search lessons..."
                      value={searchQuery}
                      onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                    />
                  </div>
                </div>

                {/* Clear Filters */}
                {(selectedLevel !== null || selectedChapter !== null || searchQuery) && (
                  <button className="btn-clear-filters" onClick={clearFilters}>
                    <i className="fas fa-times"></i>
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Lessons List */}
            {isLoading ? (
              <div className="lessons-loading">
                <div className="spinner"></div>
                <p>Loading lessons...</p>
              </div>
            ) : error ? (
              <div className="lessons-error">
                <div className="error-icon">
                  <i className="fas fa-exclamation-circle"></i>
                </div>
                <h3>Failed to load lessons</h3>
                <p>{error}</p>
                <button className="btn-retry" onClick={loadLessons}>
                  <i className="fas fa-redo"></i>
                  Try Again
                </button>
              </div>
            ) : filteredLessons.length === 0 ? (
              <div className="lessons-empty">
                <div className="empty-icon">
                  <i className="fas fa-book-open"></i>
                </div>
                {searchQuery || selectedLevel !== null ? (
                  <>
                    <h3>No lessons found</h3>
                    <p>No lessons match your filters. Try adjusting your selection.</p>
                    <button className="btn-reset" onClick={clearFilters}>
                      <i className="fas fa-times-circle"></i>
                      Clear Filters
                    </button>
                  </>
                ) : (
                  <>
                    <h3>No published lessons yet</h3>
                    <p>There are no lessons available for this course yet. Check back later!</p>
                  </>
                )}
              </div>
            ) : selectedLevel === null ? (
              /* Grouped View - Show levels with expandable chapters */
              <div className="lessons-grouped">
                {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map(level => {
                  const levelLessons = getLessonCountForLevel(level);
                  const isExpanded = expandedLevels.includes(level);
                  
                  return (
                    <div key={level} className={`level-group ${isExpanded ? 'expanded' : ''}`}>
                      <button 
                        className="level-header"
                        onClick={() => toggleLevel(level)}
                      >
                        <div className="level-info">
                          <span className="level-badge-large">Level {level}</span>
                          <span className="level-lesson-count">{levelLessons} lessons available</span>
                        </div>
                        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                      </button>
                      
                      {isExpanded && (
                        <div className="level-content">
                          {getChaptersForLevel(level).map(chapter => {
                            const chapterKey = `${level}-${chapter}`;
                            const chapterLessons = groupedLessons[level]?.[chapter] || [];
                            const isChapterExpanded = expandedChapters.includes(chapterKey);
                            
                            return (
                              <div key={chapterKey} className={`chapter-group ${isChapterExpanded ? 'expanded' : ''}`}>
                                <button 
                                  className="chapter-header"
                                  onClick={() => toggleChapter(chapterKey)}
                                >
                                  <div className="chapter-info">
                                    <span className="chapter-title">Chapter {chapter}</span>
                                    <span className="chapter-lesson-count">{chapterLessons.length} lessons</span>
                                  </div>
                                  <i className={`fas fa-chevron-${isChapterExpanded ? 'up' : 'down'}`}></i>
                                </button>
                                
                                {isChapterExpanded && chapterLessons.length > 0 && (
                                  <div className="chapter-lessons">
                                    <table className="lessons-table">
                                      <thead>
                                        <tr>
                                          <th>Lesson</th>
                                          <th>Skill</th>
                                          <th>Title</th>
                                          <th>Goal</th>
                                          <th></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {chapterLessons.map(lesson => (
                                          <tr
                                            key={lesson.id}
                                            className="lesson-row"
                                            onClick={() => handleOpenLesson(lesson)}
                                          >
                                            <td className="lesson-col-number">
                                              {getLessonNumber(lesson)}
                                            </td>
                                            <td className="lesson-col-skill">
                                              {(lesson.lessonData as any)?.skill || 'Business English'}
                                            </td>
                                            <td className="lesson-col-title">
                                              {lesson.title}
                                            </td>
                                            <td className="lesson-col-goal">
                                              {lesson.lessonData?.header?.goalText || 'Professional English practice'}
                                            </td>
                                            <td className="lesson-col-action">
                                              <button className="btn-start-lesson">
                                                <i className="fas fa-play"></i>
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                
                                {isChapterExpanded && chapterLessons.length === 0 && (
                                  <div className="chapter-empty">
                                    <i className="fas fa-clock"></i>
                                    <span>Coming soon</span>
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
            ) : (
              /* Grid View - When level is selected */
              <div className="lessons-grid">
                {filteredLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="lesson-card"
                    onClick={() => handleOpenLesson(lesson)}
                  >
                    <div 
                      className="lesson-thumbnail"
                      style={{
                        backgroundImage: lesson.lessonData?.header?.backgroundImage 
                          ? `url(${lesson.lessonData.header.backgroundImage})`
                          : 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)'
                      }}
                    >
                      <div className="lesson-thumbnail-overlay">
                        <span className="level-badge">{getLevelFromHeader(lesson)}</span>
                      </div>
                    </div>
                    <div className="lesson-content">
                      <div className="lesson-chapter">{getChapterFromHeader(lesson)}</div>
                      <h3 className="lesson-title">{lesson.title}</h3>
                      <p className="lesson-goal">
                        {lesson.lessonData?.header?.goalText || 'Professional English practice'}
                      </p>
                      <div className="lesson-meta">
                        <span className="lesson-sections">
                          <i className="fas fa-layer-group"></i>
                          {getSectionsCount(lesson)} sections
                        </span>
                        <span className="lesson-date">
                          <i className="fas fa-calendar-alt"></i>
                          {new Date(lesson.publishedAt || lesson.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="lesson-action">
                      <button className="btn-open-lesson">
                        <i className="fas fa-play"></i>
                        Start Lesson
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
