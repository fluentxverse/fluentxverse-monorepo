import { lostAndFound } from './lostAndFound';
import { market } from './market';
import { onTheMove } from './onTheMove';
import { dayOut } from './dayOut';
import { clubFair } from './clubFair';
import type { RoadmapLesson } from './content';
import type { PublishedRoadmapLessonId } from './publication';

export const roadmapLessons = {
  ...lostAndFound,
  ...market,
  ...onTheMove,
  ...dayOut,
  ...clubFair,
} satisfies Record<PublishedRoadmapLessonId, RoadmapLesson>;
