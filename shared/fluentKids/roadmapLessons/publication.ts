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
  { id: 'fluent-kids-l3-u1-l1', goalTextEn: 'I can find an activity, a time, and a cost on a place card.' },
  { id: 'fluent-kids-l3-u1-l2', goalTextEn: 'I can compare two places using the same details from both cards.' },
  { id: 'fluent-kids-l3-u1-l3', goalTextEn: 'I can recommend a place and give a reason that meets a group’s needs.' },
  { id: 'fluent-kids-l3-u1-l4', goalTextEn: 'I can put activities in time order and agree on a change to a schedule.' },
  { id: 'fluent-kids-l3-u1-l5', goalTextEn: 'I can present an outing with a reason, a cost, and a schedule, then answer a question.' },
  { id: 'fluent-kids-l3-u2-l1', goalTextEn: 'I can find what a club does and when and where it meets.' },
  { id: 'fluent-kids-l3-u2-l2', goalTextEn: 'I can ask a friend about their interests and find a club activity that matches.' },
  { id: 'fluent-kids-l3-u2-l3', goalTextEn: 'I can ask a club member about activities and meeting details, then check one answer.' },
  { id: 'fluent-kids-l3-u2-l4', goalTextEn: 'I can recommend a club using a friend’s interests and free days.' },
  { id: 'fluent-kids-l3-u2-l5', goalTextEn: 'I can interview a friend, find a club that fits, and share its meeting details.' },
] as const;

export type PublishedRoadmapLessonId = typeof publishedRoadmapLessons[number]['id'];
