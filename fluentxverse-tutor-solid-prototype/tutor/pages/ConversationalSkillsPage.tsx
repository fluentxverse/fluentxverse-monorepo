import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorArt from "../Components/Common/TutorArt";
import TutorIcon from "../Components/Common/TutorIcon";
import { useLocation } from "../routing";
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import { useAuthContext } from '../context/AuthContext';
import { lessonApi, type Lesson } from '../api/lesson.api';
import './ConversationalSkillsPage.css';
// Constants for course structure
const TOTAL_LEVELS = 10;
const CHAPTERS_PER_LEVEL = 5;
const LESSONS_PER_CHAPTER = 10;
/** Level 1 has only 1 chapter; all other levels have 5 */
const getChaptersForLevel = (level: number): number[] => level === 1 ? [1] : Array.from({ length: CHAPTERS_PER_LEVEL }, (_, i) => i + 1);
const ConversationalSkillsPage = () => {
    const _state0 = useAuthContext();
    const [lessons, setLessons] = createSignal<Lesson[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [error, setError] = createSignal<string | null>(null);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [selectedLevel, setSelectedLevel] = createSignal<number | null>(null);
    const [selectedChapter, setSelectedChapter] = createSignal<number | null>(null);
    const [expandedLevels, setExpandedLevels] = createSignal<number[]>([]);
    const [expandedChapters, setExpandedChapters] = createSignal<string[]>([]);
    createEffect(on(() => [], () => {
        const _cleanup2 = untrack(() => {
            document.title = 'Conversational Skills | FluentXVerse';
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    createEffect(on(() => [], () => {
        const _cleanup3 = untrack(() => {
            loadLessons();
        });
        if (typeof _cleanup3 === "function")
            onCleanup(_cleanup3);
    }));
    const loadLessons = async () => {
        try {
            setIsLoading(true);
            setError(null);
            // Use lesson-materials endpoint for conversational-skills (Memgraph storage)
            const result = await lessonApi.getPublishedLessonMaterials('conversational-skills');
            if (result.success) {
                // Transform lesson-materials format to match expected Lesson format
                const transformedLessons = result.lessons.map((l: any) => ({
                    id: l.id,
                    title: l.lessonTitle || `Lesson ${l.lessonNumber}: ${l.lessonName}`,
                    slug: l.id,
                    status: 'published' as const,
                    publishedAt: l.publishedAt || l.updatedAt || l.createdAt,
                    updatedAt: l.updatedAt || l.createdAt,
                    lessonData: {
                        level: l.level,
                        chapter: l.chapter,
                        lessonNumber: l.lessonNumber,
                        skill: l.skill,
                        header: {
                            levelBadge: l.levelBadge,
                            chapterLabel: l.chapterLabel,
                            lessonLabel: l.lessonTitle,
                            goalText: l.goalTextEn || ''
                        }
                    }
                }));
                setLessons(transformedLessons as unknown as Lesson[]);
            }
            else {
                setError(result.error || 'Failed to load lessons');
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load lessons');
        }
        finally {
            setIsLoading(false);
        }
    };
    // Parse level number from lesson header (e.g., "LEVEL 1" -> 1)
    const getLevelNumber = (lesson: Lesson): number => {
        const explicitLevel = (lesson.lessonData as any)?.level;
        if (typeof explicitLevel === 'number')
            return explicitLevel;
        const idLevel = lesson.id?.match(/-L(\d+)-/i);
        if (idLevel)
            return parseInt(idLevel[1], 10);
        const levelBadge = lesson.lessonData?.header?.levelBadge || '';
        const match = levelBadge.match(/\d+/);
        return match ? parseInt(match[0], 10) : 1;
    };
    // Parse chapter number from lesson header (e.g., "Chapter 1: ..." -> 1)
    const getChapterNumber = (lesson: Lesson): number => {
        const explicitChapter = (lesson.lessonData as any)?.chapter;
        if (typeof explicitChapter === 'number')
            return explicitChapter;
        const idChapter = lesson.id?.match(/-C(\d+)-/i);
        if (idChapter)
            return parseInt(idChapter[1], 10);
        const chapterLabel = lesson.lessonData?.header?.chapterLabel || '';
        const match = chapterLabel.match(/Chapter\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : 1;
    };
    // Parse lesson number from title or label (e.g., "Lesson 1: ..." -> 1)
    const getLessonNumber = (lesson: Lesson): number => {
        const explicitLessonNumber = (lesson.lessonData as any)?.lessonNumber;
        if (typeof explicitLessonNumber === 'number')
            return explicitLessonNumber;
        const idLessonNumber = lesson.id?.match(/-C\d+-(\d+)-/i);
        if (idLessonNumber)
            return parseInt(idLessonNumber[1], 10);
        const lessonLabel = lesson.lessonData?.header?.lessonLabel || lesson.title || '';
        const match = lessonLabel.match(/Lesson\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : 1;
    };
    // Group lessons by level and chapter
    const groupedLessons = createMemo(() => {
        const groups: Record<number, Record<number, Lesson[]>> = {};
        lessons().forEach(lesson => {
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
    });
    // Filter lessons based on search and selections
    const filteredLessons = createMemo(() => {
        let filtered = lessons();
        if (searchQuery()) {
            const query = searchQuery().toLowerCase();
            filtered = filtered.filter(lesson => lesson.title.toLowerCase().includes(query) ||
                (lesson.lessonData?.header?.lessonLabel || '').toLowerCase().includes(query) ||
                (lesson.lessonData?.header?.goalText || '').toLowerCase().includes(query));
        }
        if (selectedLevel() !== null) {
            filtered = filtered.filter(lesson => getLevelNumber(lesson) === selectedLevel());
        }
        if (selectedChapter() !== null) {
            filtered = filtered.filter(lesson => getChapterNumber(lesson) === selectedChapter());
        }
        return filtered;
    });
    // Get lesson counts per level
    const getLessonCountForLevel = (level: number): number => {
        return lessons().filter(lesson => getLevelNumber(lesson) === level).length;
    };
    // Get lesson counts per chapter in a level
    const getLessonCountForChapter = (level: number, chapter: number): number => {
        return lessons().filter(lesson => getLevelNumber(lesson) === level && getChapterNumber(lesson) === chapter).length;
    };
    const toggleLevel = (level: number) => {
        setExpandedLevels(prev => prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]);
    };
    const toggleChapter = (levelChapterKey: string) => {
        setExpandedChapters(prev => prev.includes(levelChapterKey)
            ? prev.filter(k => k !== levelChapterKey)
            : [...prev, levelChapterKey]);
    };
    const _state1 = useLocation();
    const handleOpenLesson = (lesson: Lesson) => {
        window.open(`/materials/conversational-skills/${lesson.id}`, '_blank');
    };
    const getLevelFromHeader = (lesson: Lesson): string => {
        return lesson.lessonData?.header?.levelBadge || 'All Levels';
    };
    const getChapterFromHeader = (lesson: Lesson): string => {
        return lesson.lessonData?.header?.chapterLabel || '';
    };
    const getSectionsCount = (lesson: Lesson): number => {
        return lesson.lessonData?.sections?.length || 0;
    };
    const clearFilters = () => {
        setSelectedLevel(null);
        setSelectedChapter(null);
        setSearchQuery('');
    };
    // Get available chapters for selected level
    const availableChapters = createMemo(() => selectedLevel() !== null
        ? getChaptersForLevel(selectedLevel())
        : []);
    return (<>
      <SideBar />
      <div class="main-content">
        <DashboardHeader user={_state0.user || undefined}/>
        <div class="course-detail-page">
          <div class="course-detail-container">
            {/* Page Header */}
            <div class="course-detail-header">
              <a href="/materials" class="back-link">
                <TutorIcon name="fi-sr-angle-left"/>
                Back to Materials
              </a>
              <div class="course-hero">
                <div class="course-hero-icon"><TutorArt name="community" size={80}/></div>
                <div class="course-hero-content">
                  <span class="course-category-badge">Conversation</span>
                  <h1 class="course-title-main">Conversational Skills</h1>
                  <p class="course-description-main">
                    Master everyday conversations, casual discussions, and natural speaking patterns. 
                    These materials will help your students communicate confidently in any situation.
                  </p>
                  <div class="course-stats-row">
                    <div class="course-stat">
                      <TutorIcon name="fi-sr-book-alt"/>
                      <span>{lessons().length} Lessons Available</span>
                    </div>
                    <div class="course-stat">
                      <TutorIcon name="fi-sr-layers"/>
                      <span>{TOTAL_LEVELS} Levels • Up to {CHAPTERS_PER_LEVEL} Chapters each</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters Section */}
            <div class="lessons-filters-section">
              <div class="filters-row">
                {/* Level Dropdown */}
                <div class="filter-group">
                  <label class="filter-label" for="lesson-level">Level</label>
                  <select id="lesson-level" class="filter-select" value={selectedLevel() ?? ''} onChange={(e) => {
            const val = (e.target as HTMLSelectElement).value;
            setSelectedLevel(val ? parseInt(val, 10) : null);
            setSelectedChapter(null);
        }}>
                    <option value="">All Levels</option>
                    {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map(level => (<option value={level}>
                        Level {level} ({getLessonCountForLevel(level)} lessons)
                      </option>))}
                  </select>
                </div>

                {/* Chapter Dropdown */}
                <div class="filter-group">
                  <label class="filter-label" for="lesson-chapter">Chapter</label>
                  <select id="lesson-chapter" class="filter-select" value={selectedChapter() ?? ''} onChange={(e) => {
            const val = (e.target as HTMLSelectElement).value;
            setSelectedChapter(val ? parseInt(val, 10) : null);
        }} disabled={selectedLevel() === null}>
                    <option value="">All Chapters</option>
                    {availableChapters().map(chapter => (<option value={chapter}>
                        Chapter {chapter} ({selectedLevel() !== null ? getLessonCountForChapter(selectedLevel(), chapter) : 0} lessons)
                      </option>))}
                  </select>
                </div>

                {/* Search */}
                <div class="filter-group filter-search">
                  <label class="filter-label" for="lesson-search">Search</label>
                  <div class="lessons-search">
                    <TutorIcon name="fi-sr-search"/>
                    <input type="text" id="lesson-search" placeholder="Search lessons..." value={searchQuery()} onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}/>
                  </div>
                </div>

                {/* Clear Filters */}
                {(selectedLevel() !== null || selectedChapter() !== null || searchQuery()) && (<button class="btn-clear-filters" onClick={clearFilters}>
                    <TutorIcon name="fi-sr-cross"/>
                    Clear Filters
                  </button>)}
              </div>
            </div>

            {/* Lessons List */}
            {isLoading() ? (<div class="lessons-loading">
                <div class="spinner"></div>
                <p>Loading lessons...</p>
              </div>) : error() ? (<div class="lessons-error">
                <div class="error-icon">
                  <TutorIcon name="fi-sr-exclamation"/>
                </div>
                <h3>Failed to load lessons</h3>
                <p>{error()}</p>
                <button class="btn-retry" onClick={loadLessons}>
                  <TutorIcon name="fi-sr-refresh"/>
                  Try Again
                </button>
              </div>) : filteredLessons().length === 0 ? (<div class="lessons-empty">
                <div class="empty-icon">
                  <TutorIcon name="fi-sr-book-open-cover"/>
                </div>
                {searchQuery() || selectedLevel() !== null ? (<>
                    <h3>No lessons found</h3>
                    <p>No lessons match your filters. Try adjusting your selection.</p>
                    <button class="btn-reset" onClick={clearFilters}>
                      <TutorIcon name="fi-sr-cross-circle"/>
                      Clear Filters
                    </button>
                  </>) : (<>
                    <h3>No published lessons yet</h3>
                    <p>There are no lessons available for this course yet. Check back later!</p>
                  </>)}
              </div>) : selectedLevel() === null ? (
        /* Grouped View - Show levels with expandable chapters */
        <div class="lessons-grouped">
                {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map(level => {
                const levelLessons = getLessonCountForLevel(level);
                const isExpanded = expandedLevels().includes(level);
                return (<div class={`level-group ${isExpanded ? 'expanded' : ''}`}>
                      <button class="level-header" onClick={() => toggleLevel(level)}>
                        <div class="level-info">
                          <span class="level-badge-large">Level {level}</span>
                          <span class="level-lesson-count">{levelLessons} lessons available</span>
                        </div>
                        <TutorIcon name={`fi-sr-angle-small-${isExpanded ? 'up' : 'down'}`}/>
                      </button>
                      
                      {isExpanded && (<div class="level-content">
                          {getChaptersForLevel(level).map(chapter => {
                            const chapterKey = `${level}-${chapter}`;
                            const chapterLessons = groupedLessons()[level]?.[chapter] || [];
                            const isChapterExpanded = expandedChapters().includes(chapterKey);
                            return (<div class={`chapter-group ${isChapterExpanded ? 'expanded' : ''}`}>
                                <button class="chapter-header" onClick={() => toggleChapter(chapterKey)}>
                                  <div class="chapter-info">
                                    <span class="chapter-title">Chapter {chapter}</span>
                                    <span class="chapter-lesson-count">{chapterLessons.length} lessons</span>
                                  </div>
                                  <TutorIcon name={`fi-sr-angle-small-${isChapterExpanded ? 'up' : 'down'}`}/>
                                </button>
                                
                                {isChapterExpanded && chapterLessons.length > 0 && (<div class="chapter-lessons">
                                    <table class="lessons-table">
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
                                        {chapterLessons.map(lesson => (<tr class="lesson-row" onClick={() => handleOpenLesson(lesson)}>
                                            <td class="lesson-col-number">
                                              {getLessonNumber(lesson)}
                                            </td>
                                            <td class="lesson-col-skill">
                                              {(lesson.lessonData as any)?.skill || 'Speaking'}
                                            </td>
                                            <td class="lesson-col-title">
                                              {lesson.title}
                                            </td>
                                            <td class="lesson-col-goal">
                                              {lesson.lessonData?.header?.goalText || 'English conversation practice'}
                                            </td>
                                            <td class="lesson-col-action">
                                              <button class="btn-start-lesson">
                                                <TutorIcon name="fi-sr-play"/>
                                              </button>
                                            </td>
                                          </tr>))}
                                      </tbody>
                                    </table>
                                  </div>)}
                                
                                {isChapterExpanded && chapterLessons.length === 0 && (<div class="chapter-empty">
                                    <TutorIcon name="fi-sr-clock"/>
                                    <span>Coming soon</span>
                                  </div>)}
                              </div>);
                        })}
                        </div>)}
                    </div>);
            })}
              </div>) : (
        /* Grid View - When level is selected */
        <div class="lessons-grid">
                {filteredLessons().map((lesson) => (<div class="lesson-card" onClick={() => handleOpenLesson(lesson)}>
                    <div class="lesson-thumbnail" style={cssStyle({
                    backgroundImage: lesson.lessonData?.header?.backgroundImage
                        ? `url(${lesson.lessonData.header.backgroundImage})`
                        : 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)'
                })}>
                      <div class="lesson-thumbnail-overlay">
                        <span class="level-badge">{getLevelFromHeader(lesson)}</span>
                      </div>
                    </div>
                    <div class="lesson-content">
                      <div class="lesson-chapter">{getChapterFromHeader(lesson)}</div>
                      <h3 class="lesson-title">{lesson.title}</h3>
                      <p class="lesson-goal">
                        {lesson.lessonData?.header?.goalText || 'English conversation practice'}
                      </p>
                      <div class="lesson-meta">
                        <span class="lesson-sections">
                          <TutorIcon name="fi-sr-layers"/>
                          {getSectionsCount(lesson)} sections
                        </span>
                        <span class="lesson-date">
                          <TutorIcon name="fi-sr-calendar"/>
                          {new Date(lesson.publishedAt || lesson.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div class="lesson-action">
                      <button class="btn-open-lesson">
                        <TutorIcon name="fi-sr-play"/>
                        Open Lesson
                      </button>
                    </div>
                  </div>))}
              </div>)}
          </div>
        </div>
      </div>
    </>);
};
export default ConversationalSkillsPage;
