// Published roadmap lessons are listed here so curriculum browsing does not load lesson bodies.
export const publishedRoadmapLessons = [
  { id: 'fluent-kids-l2-u6-l4', goalTextEn: 'I can ask the school office for help, describe a lost item, and check what to do next.' },
  { id: 'fluent-kids-l2-u6-l5', goalTextEn: 'I can use a notice and follow-up questions to identify the right lost item and explain my choice.' },
] as const;

export type PublishedRoadmapLessonId = typeof publishedRoadmapLessons[number]['id'];
