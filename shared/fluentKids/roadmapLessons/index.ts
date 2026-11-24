import { lostAndFound } from './lostAndFound';
import type { RoadmapLesson } from './content';
import type { PublishedRoadmapLessonId } from './publication';

export const roadmapLessons = {
  ...lostAndFound,
} satisfies Record<PublishedRoadmapLessonId, RoadmapLesson>;
