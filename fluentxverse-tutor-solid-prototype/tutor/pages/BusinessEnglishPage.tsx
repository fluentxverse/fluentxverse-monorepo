import { createSignal, createMemo, createEffect, on, onCleanup, untrack, useContext, splitProps, mergeProps, type Accessor, type Component, type JSX } from "solid-js";
import { Portal } from "solid-js/web";
import { cssStyle, Fragment } from "../utils/cssStyle";
import TutorArt from "../Components/Common/TutorArt";
import TutorIcon from "../Components/Common/TutorIcon";
import SideBar from '../Components/IndexOne/SideBar';
import DashboardHeader from '../Components/Dashboard/DashboardHeader';
import { useAuthContext } from '../context/AuthContext';
import { lessonApi, type Lesson } from '../api/lesson.api';
import './ConversationalSkillsPage.css';
import './BusinessEnglishPage.css';
const TOTAL_LEVELS = 10;
const CHAPTERS_PER_LEVEL = 5;
const getChaptersForLevel = (level: number): number[] => level === 1 ? [1] : Array.from({ length: CHAPTERS_PER_LEVEL }, (_, i) => i + 1);
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
                overlayColor: lessonMaterial.overlayColor || ''
            }
        } as any
    };
};
export default function BusinessEnglishPage() {
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
        const _cleanup1 = untrack(() => {
            document.title = 'Business English | FluentXVerse';
        });
        if (typeof _cleanup1 === "function")
            onCleanup(_cleanup1);
    }));
    createEffect(on(() => [], () => {
        const _cleanup2 = untrack(() => {
            loadLessons();
        });
        if (typeof _cleanup2 === "function")
            onCleanup(_cleanup2);
    }));
    const loadLessons = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const result = await lessonApi.getPublishedLessonMaterials('business-english');
            if (result.success) {
                setLessons(result.lessons.map(transformLessonMaterialToLesson));
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
    const getLevelNumber = (lesson: Lesson): number => {
        const explicitLevel = (lesson.lessonData as any)?.level;
        if (typeof explicitLevel === 'number')
            return explicitLevel;
        const match = (lesson.lessonData?.header?.levelBadge || '').match(/\d+/);
        return match ? parseInt(match[0], 10) : 1;
    };
    const getChapterNumber = (lesson: Lesson): number => {
        const explicitChapter = (lesson.lessonData as any)?.chapter;
        if (typeof explicitChapter === 'number')
            return explicitChapter;
        const match = (lesson.lessonData?.header?.chapterLabel || '').match(/Chapter\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : 1;
    };
    const getLessonNumber = (lesson: Lesson): number => {
        const explicitLessonNumber = (lesson.lessonData as any)?.lessonNumber;
        if (typeof explicitLessonNumber === 'number')
            return explicitLessonNumber;
        const match = (lesson.lessonData?.header?.lessonLabel || lesson.title || '').match(/Lesson\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : 1;
    };
    const groupedLessons = createMemo(() => {
        const groups: Record<number, Record<number, Lesson[]>> = {};
        lessons().forEach((lesson) => {
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
    });
    const filteredLessons = createMemo(() => {
        let filtered = lessons();
        if (searchQuery()) {
            const query = searchQuery().toLowerCase();
            filtered = filtered.filter((lesson) => lesson.title.toLowerCase().includes(query) ||
                (lesson.lessonData?.header?.lessonLabel || '').toLowerCase().includes(query) ||
                (lesson.lessonData?.header?.goalText || '').toLowerCase().includes(query));
        }
        if (selectedLevel() !== null) {
            filtered = filtered.filter((lesson) => getLevelNumber(lesson) === selectedLevel());
        }
        if (selectedChapter() !== null) {
            filtered = filtered.filter((lesson) => getChapterNumber(lesson) === selectedChapter());
        }
        return filtered;
    });
    const getLessonCountForLevel = (level: number): number => lessons().filter((lesson) => getLevelNumber(lesson) === level).length;
    const getLessonCountForChapter = (level: number, chapter: number): number => lessons().filter((lesson) => getLevelNumber(lesson) === level && getChapterNumber(lesson) === chapter).length;
    const toggleLevel = (level: number) => {
        setExpandedLevels((prev) => prev.includes(level) ? prev.filter((item) => item !== level) : [...prev, level]);
    };
    const toggleChapter = (levelChapterKey: string) => {
        setExpandedChapters((prev) => prev.includes(levelChapterKey)
            ? prev.filter((item) => item !== levelChapterKey)
            : [...prev, levelChapterKey]);
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
    const availableChapters = createMemo(() => selectedLevel() !== null
        ? getChaptersForLevel(selectedLevel())
        : []);
    return (<>
      <SideBar />
      <div class="main-content">
        <DashboardHeader user={_state0.user || undefined}/>
        <div class="course-detail-page business-english-page">
          <div class="course-detail-container">
            <div class="course-detail-header">
              <a href="/materials" class="back-link">
                <TutorIcon name="fi-sr-angle-left"/>
                Back to Materials
              </a>
              <div class="course-hero">
                <div class="course-hero-icon"><TutorArt name="business" size={80}/></div>
                <div class="course-hero-content">
                  <span class="course-category-badge">Business</span>
                  <h1 class="course-title-main">Business English</h1>
                  <p class="course-description-main">
                    Practice workplace communication, meetings, introductions, email tone, and professional discussion skills.
                    Build confidence in real business situations with structured lesson materials.
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

            <div class="lessons-filters-section">
              <div class="filters-row">
                <div class="filter-group">
                  <label class="filter-label" for="lesson-level">Level</label>
                  <select id="lesson-level" class="filter-select" value={selectedLevel() ?? ''} onChange={(e) => {
            const val = (e.target as HTMLSelectElement).value;
            setSelectedLevel(val ? parseInt(val, 10) : null);
            setSelectedChapter(null);
        }}>
                    <option value="">All Levels</option>
                    {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map((level) => (<option value={level}>
                        Level {level} ({getLessonCountForLevel(level)} lessons)
                      </option>))}
                  </select>
                </div>

                <div class="filter-group">
                  <label class="filter-label" for="lesson-chapter">Chapter</label>
                  <select id="lesson-chapter" class="filter-select" value={selectedChapter() ?? ''} onChange={(e) => {
            const val = (e.target as HTMLSelectElement).value;
            setSelectedChapter(val ? parseInt(val, 10) : null);
        }} disabled={selectedLevel() === null}>
                    <option value="">All Chapters</option>
                    {availableChapters().map((chapter) => (<option value={chapter}>
                        Chapter {chapter} ({selectedLevel() !== null ? getLessonCountForChapter(selectedLevel(), chapter) : 0} lessons)
                      </option>))}
                  </select>
                </div>

                <div class="filter-group filter-search">
                  <label class="filter-label" for="lesson-search">Search</label>
                  <div class="lessons-search">
                    <TutorIcon name="fi-sr-search"/>
                    <input type="text" id="lesson-search" placeholder="Search lessons..." value={searchQuery()} onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}/>
                  </div>
                </div>

                {(selectedLevel() !== null || selectedChapter() !== null || searchQuery()) && (<button class="btn-clear-filters" onClick={clearFilters}>
                    <TutorIcon name="fi-sr-cross"/>
                    Clear Filters
                  </button>)}
              </div>
            </div>

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
              </div>) : selectedLevel() === null ? (<div class="lessons-grouped">
                {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map((level) => {
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
                          {getChaptersForLevel(level).map((chapter) => {
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
                                        {chapterLessons.map((lesson) => (<tr class="lesson-row" onClick={() => handleOpenLesson(lesson)}>
                                            <td class="lesson-col-number">{getLessonNumber(lesson)}</td>
                                            <td class="lesson-col-skill">{(lesson.lessonData as any)?.skill || 'Business English'}</td>
                                            <td class="lesson-col-title">{lesson.title}</td>
                                            <td class="lesson-col-goal">
                                              {lesson.lessonData?.header?.goalText || 'Professional English practice'}
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
              </div>) : (<div class="lessons-grid">
                {filteredLessons().map((lesson) => (<div class="lesson-card" onClick={() => handleOpenLesson(lesson)}>
                    <div class="lesson-thumbnail" style={cssStyle({
                    backgroundImage: lesson.lessonData?.header?.backgroundImage
                        ? `url(${lesson.lessonData.header.backgroundImage})`
                        : 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)'
                })}>
                      <div class="lesson-thumbnail-overlay">
                        <span class="level-badge">{lesson.lessonData?.header?.levelBadge || 'Level'}</span>
                      </div>
                    </div>
                    <div class="lesson-content">
                      <div class="lesson-chapter">{lesson.lessonData?.header?.chapterLabel || ''}</div>
                      <h3 class="lesson-title">{lesson.title}</h3>
                      <p class="lesson-goal">
                        {lesson.lessonData?.header?.goalText || 'Professional English practice'}
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
}
