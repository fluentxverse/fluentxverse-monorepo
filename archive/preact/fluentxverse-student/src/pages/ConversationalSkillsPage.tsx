import { useEffect, useState } from 'preact/hooks';
import { lessonApi, type Lesson } from '../api/lesson.api';
import CourseLibrary from '../Components/Materials/MaterialLibrary';

const formatLevelBadge = (lesson: any): string => {
  if (lesson.levelBadge && /\d+/.test(String(lesson.levelBadge))) {
    return String(lesson.levelBadge);
  }

  return lesson.level ? `Level ${lesson.level}` : String(lesson.levelBadge || 'All Levels');
};

const formatChapterLabel = (lesson: any): string => {
  if (lesson.chapterLabel) {
    return String(lesson.chapterLabel);
  }

  return lesson.chapter ? `Chapter ${lesson.chapter}${lesson.chapterName ? `: ${lesson.chapterName}` : ''}` : '';
};

export default function ConversationalSkillsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { document.title = 'Conversational Skills | FluentXVerse'; loadLessons(); }, []);

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
          parentId: null,
          forkOf: null,
          isFork: false,
          createdBy: l.createdBy || '',
          createdByName: l.createdByName || null,
          storagePath: '',
          createdAt: l.createdAt || l.updatedAt || new Date().toISOString(),
          updatedAt: l.updatedAt || l.publishedAt || l.createdAt || new Date().toISOString(),
          publishedAt: l.publishedAt || l.updatedAt || null,
          lessonData: {
            level: Number(l.level) || 1,
            chapter: Number(l.chapter) || 1,
            lessonNumber: Number(l.lessonNumber) || 1,
            skill: l.skill || 'speaking',
            chapterName: l.chapterName || '',
            lessonName: l.lessonName || '',
            backgroundImage: l.backgroundImage || '',
            sections: [
              l.introductionData,
              l.learnData,
              l.stepBData,
              l.applyData,
              l.exerciseData,
              l.missionData,
              l.missionData2,
              l.missionData3,
              l.feedbackData,
            ].filter(Boolean),
            header: {
              levelBadge: formatLevelBadge(l),
              chapterLabel: formatChapterLabel(l),
              lessonLabel: l.lessonTitle || `Lesson ${l.lessonNumber}: ${l.lessonName}`,
              goalText: l.goalTextEn || '',
              goalSubtext: l.goalTextJp || '',
              overlayColor: l.overlayColor || '',
              backgroundImage: l.backgroundImage || '',
            }
          }
        }));
        setLessons(transformedLessons as Lesson[]);
      } else {
        setError(result.error || 'Failed to load lessons');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lessons');
    } finally {
      setIsLoading(false);
    }
  };

  return <CourseLibrary course="conversational-skills" lessons={lessons} loading={isLoading} error={error} retry={loadLessons} />;
}
