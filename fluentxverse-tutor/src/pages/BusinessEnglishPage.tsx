import { useEffect, useMemo, useState } from 'preact/hooks';
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import { useAuthContext } from '../context/AuthContext';
import { lessonApi, type Lesson } from '../api/lesson.api';
import './ConversationalSkillsPage.css';
import './BusinessEnglishPage.css';

const TOTAL_LEVELS = 10;
const CHAPTERS_PER_LEVEL = 5;

const getChaptersForLevel = (level: number): number[] =>
  level === 1 ? [1] : Array.from({ length: CHAPTERS_PER_LEVEL }, (_, i) => i + 1);

const transformLessonMaterialToLesson = (lessonMaterial: any): Lesson => {
  const level = Number(lessonMaterial.level || 1);
  const chapter = Number(lessonMaterial.chapter || 1);
  const lessonNumber = Number(lessonMaterial.lessonNumber || 1);
  const chapterLabel = lessonMaterial.chapterLabel
    || (lessonMaterial.chapterName
      ? `Chapter ${chapter}: ${lessonMaterial.chapterName}`
      : `Chapter ${chapter}`);
  const lessonLabel = lessonMaterial.lessonTitle || `Lesson ${lessonNumber}: ${lessonMaterial.lessonName || 'Business English'}`;

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
    publishedAt: lessonMaterial.publishedAt || lessonMaterial.updatedAt || lessonMaterial.createdAt || null,
    currentVersion: lessonMaterial.version,
    lessonData: {
      ...lessonMaterial,
      course: lessonMaterial.course,
      skill: lessonMaterial.skill || 'Business English',
      level,
      chapter,
      lessonNumber,
      sections: lessonMaterial.sections || [],
      header: {
        levelBadge: lessonMaterial.levelBadge || `Level ${level}`,
        chapterLabel,
        lessonLabel,
        goalText: lessonMaterial.goalTextEn || lessonMaterial.goalText || '',
        goalSubtext: lessonMaterial.goalTextJp || '',
        backgroundImage: lessonMaterial.backgroundImage || '',
        overlayColor: lessonMaterial.overlayColor || '',
      },
    } as any,
  };
};

export default function BusinessEnglishPage() {
  const { user } = useAuthContext();
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

  const getLevelNumber = (lesson: Lesson): number => {
    const explicitLevel = (lesson.lessonData as any)?.level;
    if (typeof explicitLevel === 'number') return explicitLevel;
    const match = (lesson.lessonData?.header?.levelBadge || '').match(/\d+/);
    return match ? parseInt(match[0], 10) : 1;
  };

  const getChapterNumber = (lesson: Lesson): number => {
    const explicitChapter = (lesson.lessonData as any)?.chapter;
    if (typeof explicitChapter === 'number') return explicitChapter;
    const match = (lesson.lessonData?.header?.chapterLabel || '').match(/Chapter\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  };

  const getLessonNumber = (lesson: Lesson): number => {
    const explicitLessonNumber = (lesson.lessonData as any)?.lessonNumber;
    if (typeof explicitLessonNumber === 'number') return explicitLessonNumber;
    const match = (lesson.lessonData?.header?.lessonLabel || lesson.title || '').match(/Lesson\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  };

  const groupedLessons = useMemo(() => {
    const groups: Record<number, Record<number, Lesson[]>> = {};

    lessons.forEach((lesson) => {
      const level = getLevelNumber(lesson);
      const chapter = getChapterNumber(lesson);

      groups[level] ||= {};
      groups[level][chapter] ||= [];
      groups[level][chapter].push(lesson);
    });

    Object.values(groups).forEach((chapters) => {
      Object.values(chapters).forEach((lessonList) => {
        lessonList.sort((a, b) => getLessonNumber(a) - getLessonNumber(b));
      });
    });

    return groups;
  }, [lessons]);

  const filteredLessons = useMemo(() => {
    let filtered = lessons;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((lesson) =>
        lesson.title.toLowerCase().includes(query) ||
        (lesson.lessonData?.header?.lessonLabel || '').toLowerCase().includes(query) ||
        (lesson.lessonData?.header?.goalText || '').toLowerCase().includes(query)
      );
    }

    if (selectedLevel !== null) {
      filtered = filtered.filter((lesson) => getLevelNumber(lesson) === selectedLevel);
    }

    if (selectedChapter !== null) {
      filtered = filtered.filter((lesson) => getChapterNumber(lesson) === selectedChapter);
    }

    return filtered;
  }, [lessons, searchQuery, selectedLevel, selectedChapter]);

  const getLessonCountForLevel = (level: number): number =>
    lessons.filter((lesson) => getLevelNumber(lesson) === level).length;

  const getLessonCountForChapter = (level: number, chapter: number): number =>
    lessons.filter((lesson) => getLevelNumber(lesson) === level && getChapterNumber(lesson) === chapter).length;

  const toggleLevel = (level: number) => {
    setExpandedLevels((prev) =>
      prev.includes(level) ? prev.filter((item) => item !== level) : [...prev, level]
    );
  };

  const toggleChapter = (levelChapterKey: string) => {
    setExpandedChapters((prev) =>
      prev.includes(levelChapterKey)
        ? prev.filter((item) => item !== levelChapterKey)
        : [...prev, levelChapterKey]
    );
  };

  const handleOpenLesson = (lesson: Lesson) => {
    window.open(`/materials/business-english/${lesson.id}`, '_blank');
  };

  const getSectionsCount = (lesson: Lesson): number => {
    const lessonData = lesson.lessonData as any;
    const beData = lessonData?.beData || lessonData;
    const sectionCount = [
      beData?.introduce,
      beData?.present,
      beData?.understand,
      beData?.practice,
      beData?.challenge,
      beData?.discussion,
      beData?.feedback,
    ].filter(Boolean).length;

    return sectionCount || lesson.lessonData?.sections?.length || 0;
  };

  const clearFilters = () => {
    setSelectedLevel(null);
    setSelectedChapter(null);
    setSearchQuery('');
  };

  const availableChapters = selectedLevel !== null
    ? getChaptersForLevel(selectedLevel)
    : [];

  return (
    <>
      <SideBar />
      <div className="main-content">
        <DashboardHeader user={user || undefined} />
        <div className="course-detail-page business-english-page">
          <div className="course-detail-container">
            <div className="course-detail-header">
              <a href="/materials" className="back-link">
                <i className="fi-sr-angle-left"></i>
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
                      <i className="fi-sr-book-alt"></i>
                      <span>{lessons.length} Lessons Available</span>
                    </div>
                    <div className="course-stat">
                      <i className="fi-sr-layers"></i>
                      <span>{TOTAL_LEVELS} Levels • Up to {CHAPTERS_PER_LEVEL} Chapters each</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lessons-filters-section">
              <div className="filters-row">
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
                    {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map((level) => (
                      <option key={level} value={level}>
                        Level {level} ({getLessonCountForLevel(level)} lessons)
                      </option>
                    ))}
                  </select>
                </div>

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
                    {availableChapters.map((chapter) => (
                      <option key={chapter} value={chapter}>
                        Chapter {chapter} ({selectedLevel !== null ? getLessonCountForChapter(selectedLevel, chapter) : 0} lessons)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-group filter-search">
                  <label className="filter-label">Search</label>
                  <div className="lessons-search">
                    <i className="fi-sr-search"></i>
                    <input
                      type="text"
                      placeholder="Search lessons..."
                      value={searchQuery}
                      onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                    />
                  </div>
                </div>

                {(selectedLevel !== null || selectedChapter !== null || searchQuery) && (
                  <button className="btn-clear-filters" onClick={clearFilters}>
                    <i className="fi-sr-cross"></i>
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="lessons-loading">
                <div className="spinner"></div>
                <p>Loading lessons...</p>
              </div>
            ) : error ? (
              <div className="lessons-error">
                <div className="error-icon">
                  <i className="fi-sr-exclamation"></i>
                </div>
                <h3>Failed to load lessons</h3>
                <p>{error}</p>
                <button className="btn-retry" onClick={loadLessons}>
                  <i className="fi-sr-refresh"></i>
                  Try Again
                </button>
              </div>
            ) : filteredLessons.length === 0 ? (
              <div className="lessons-empty">
                <div className="empty-icon">
                  <i className="fi-sr-book-open-cover"></i>
                </div>
                {searchQuery || selectedLevel !== null ? (
                  <>
                    <h3>No lessons found</h3>
                    <p>No lessons match your filters. Try adjusting your selection.</p>
                    <button className="btn-reset" onClick={clearFilters}>
                      <i className="fi-sr-cross-circle"></i>
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
              <div className="lessons-grouped">
                {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map((level) => {
                  const levelLessons = getLessonCountForLevel(level);
                  const isExpanded = expandedLevels.includes(level);

                  return (
                    <div key={level} className={`level-group ${isExpanded ? 'expanded' : ''}`}>
                      <button className="level-header" onClick={() => toggleLevel(level)}>
                        <div className="level-info">
                          <span className="level-badge-large">Level {level}</span>
                          <span className="level-lesson-count">{levelLessons} lessons available</span>
                        </div>
                        <i className={`fi-sr-angle-small-${isExpanded ? 'up' : 'down'}`}></i>
                      </button>

                      {isExpanded && (
                        <div className="level-content">
                          {getChaptersForLevel(level).map((chapter) => {
                            const chapterKey = `${level}-${chapter}`;
                            const chapterLessons = groupedLessons[level]?.[chapter] || [];
                            const isChapterExpanded = expandedChapters.includes(chapterKey);

                            return (
                              <div key={chapterKey} className={`chapter-group ${isChapterExpanded ? 'expanded' : ''}`}>
                                <button className="chapter-header" onClick={() => toggleChapter(chapterKey)}>
                                  <div className="chapter-info">
                                    <span className="chapter-title">Chapter {chapter}</span>
                                    <span className="chapter-lesson-count">{chapterLessons.length} lessons</span>
                                  </div>
                                  <i className={`fi-sr-angle-small-${isChapterExpanded ? 'up' : 'down'}`}></i>
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
                                        {chapterLessons.map((lesson) => (
                                          <tr
                                            key={lesson.id}
                                            className="lesson-row"
                                            onClick={() => handleOpenLesson(lesson)}
                                          >
                                            <td className="lesson-col-number">{getLessonNumber(lesson)}</td>
                                            <td className="lesson-col-skill">{(lesson.lessonData as any)?.skill || 'Business English'}</td>
                                            <td className="lesson-col-title">{lesson.title}</td>
                                            <td className="lesson-col-goal">
                                              {lesson.lessonData?.header?.goalText || 'Professional English practice'}
                                            </td>
                                            <td className="lesson-col-action">
                                              <button className="btn-start-lesson">
                                                <i className="fi-sr-play"></i>
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
                                    <i className="fi-sr-clock"></i>
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
              <div className="lessons-grid">
                {filteredLessons.map((lesson) => (
                  <div key={lesson.id} className="lesson-card" onClick={() => handleOpenLesson(lesson)}>
                    <div
                      className="lesson-thumbnail"
                      style={{
                        backgroundImage: lesson.lessonData?.header?.backgroundImage
                          ? `url(${lesson.lessonData.header.backgroundImage})`
                          : 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                      }}
                    >
                      <div className="lesson-thumbnail-overlay">
                        <span className="level-badge">{lesson.lessonData?.header?.levelBadge || 'Level'}</span>
                      </div>
                    </div>
                    <div className="lesson-content">
                      <div className="lesson-chapter">{lesson.lessonData?.header?.chapterLabel || ''}</div>
                      <h3 className="lesson-title">{lesson.title}</h3>
                      <p className="lesson-goal">
                        {lesson.lessonData?.header?.goalText || 'Professional English practice'}
                      </p>
                      <div className="lesson-meta">
                        <span className="lesson-sections">
                          <i className="fi-sr-layers"></i>
                          {getSectionsCount(lesson)} sections
                        </span>
                        <span className="lesson-date">
                          <i className="fi-sr-calendar"></i>
                          {new Date(lesson.publishedAt || lesson.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="lesson-action">
                      <button className="btn-open-lesson">
                        <i className="fi-sr-play"></i>
                        Open Lesson
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
