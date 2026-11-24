import { lostAndFound } from './lostAndFound';
import { market } from './market';
import { onTheMove } from './onTheMove';
import type { RoadmapLesson } from './content';
import type { PublishedRoadmapLessonId } from './publication';

export const roadmapLessons = {
  ...lostAndFound,
  ...market,
  ...onTheMove,
} satisfies Record<PublishedRoadmapLessonId, RoadmapLesson>;
