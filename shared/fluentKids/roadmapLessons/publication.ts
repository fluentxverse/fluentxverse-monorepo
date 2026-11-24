// Published roadmap lessons are listed here so curriculum browsing does not load lesson bodies.
export const publishedRoadmapLessons = [
  { id: 'fluent-kids-l2-u6-l4', goalTextEn: 'I can ask the school office for help, describe a lost item, and check what to do next.' },
  { id: 'fluent-kids-l2-u6-l5', goalTextEn: 'I can use a notice and follow-up questions to identify the right lost item and explain my choice.' },
  { id: 'fluent-kids-l2-u7-l1', goalTextEn: 'I can make a shopping list and say what we need for a picnic.' },
  { id: 'fluent-kids-l2-u7-l2', goalTextEn: 'I can read prices and ask how much an item costs.' },
  { id: 'fluent-kids-l2-u7-l3', goalTextEn: 'I can ask how many we need and change an order when the number of people changes.' },
  { id: 'fluent-kids-l2-u7-l4', goalTextEn: 'I can add prices and choose an order that fits a budget.' },
  { id: 'fluent-kids-l2-u7-l5', goalTextEn: 'I can make a list, ask prices, and confirm a picnic order within a budget.' },
  { id: 'fluent-kids-l2-u8-l1', goalTextEn: 'I can ask how someone gets to a place and describe how I get there.' },
  { id: 'fluent-kids-l2-u8-l2', goalTextEn: 'I can find a bus number, its destination, and its departure time on a timetable.' },
  { id: 'fluent-kids-l2-u8-l3', goalTextEn: 'I can choose a bus by checking the destination, departure time, and arrival time.' },
  { id: 'fluent-kids-l2-u8-l4', goalTextEn: 'I can explain that I missed a bus and ask about the next one.' },
  { id: 'fluent-kids-l2-u8-l5', goalTextEn: 'I can compare travel options, choose one that arrives on time, and confirm a backup plan.' },
] as const;

export type PublishedRoadmapLessonId = typeof publishedRoadmapLessons[number]['id'];
