export const studentTutorIssues = [
  { value: 'no_show', label: 'Tutor did not join the classroom' },
  { value: 'late_join', label: 'Tutor joined late' },
  { value: 'left_early', label: 'Tutor left early or ended the lesson early' },
  { value: 'unresponsive', label: 'Tutor was unavailable or unresponsive during the lesson' },
  { value: 'audio_video', label: "Tutor's audio or video was not working" },
  { value: 'lesson_preferences', label: 'Tutor did not follow my lesson preferences or material request' },
  { value: 'unclear_explanations', label: "Tutor's explanations or corrections were unclear" },
  { value: 'inappropriate_behavior', label: 'Tutor behaved inappropriately or disrespectfully' },
  { value: 'other', label: 'Other tutor-related issue' },
] as const;
export type StudentTutorIssue = typeof studentTutorIssues[number]['value'];
