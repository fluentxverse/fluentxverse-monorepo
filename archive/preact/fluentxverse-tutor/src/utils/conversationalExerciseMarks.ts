export interface MarkableExerciseItem {
  step: 'A' | 'B';
  itemIndex: number;
  itemType: string;
  prompt: string;
  answerKey: string;
}

interface TextItem { sentence: string }
interface AnswerItem { text: string }
interface TutorStep { answerKey?: AnswerItem[] }

export interface ExerciseForMarking {
  stepAType?: 'rephrase' | 'choose' | 'change';
  exerciseItems?: TextItem[];
  chooseItems?: TextItem[];
  changeItems?: TextItem[];
  answers?: AnswerItem[];
  tutorSteps?: TutorStep[];
  hasStepB?: boolean;
  stepBType?: 'conversation' | 'multiple-choice' | 'speech' | 'compare';
  conversations?: { speechBubble: string }[];
  multipleChoiceItems?: { boldSentence: string; optionA: string; optionB: string }[];
  speechContent?: string;
  compareItems?: TextItem[];
  stepBTutorSteps?: TutorStep[];
}

const keysFromSteps = (steps?: TutorStep[]) =>
  (steps || []).flatMap(step => step.answerKey || []).map(item => item.text);

export function getMarkableExerciseItems(data: ExerciseForMarking): { A: MarkableExerciseItem[]; B: MarkableExerciseItem[] } {
  const stepAType = data.stepAType || 'rephrase';
  const stepAItems = stepAType === 'choose'
    ? data.chooseItems || []
    : stepAType === 'change'
      ? data.changeItems || []
      : data.exerciseItems || [];
  const stepAKeys = data.answers?.length
    ? data.answers.map(item => item.text)
    : keysFromSteps(data.tutorSteps);
  const A = stepAItems.map((item, itemIndex) => ({
    step: 'A' as const,
    itemIndex,
    itemType: stepAType,
    prompt: item.sentence,
    answerKey: stepAKeys[itemIndex] || '',
  }));

  if (!data.hasStepB) return { A, B: [] };
  const stepBType = data.stepBType || 'conversation';
  const stepBPrompts = stepBType === 'multiple-choice'
    ? (data.multipleChoiceItems || []).map(item => `${item.boldSentence}\nA. ${item.optionA}\nB. ${item.optionB}`)
    : stepBType === 'compare'
      ? (data.compareItems || []).map(item => item.sentence)
      : stepBType === 'speech'
        ? data.speechContent ? [data.speechContent] : []
        : (data.conversations || []).map(item => item.speechBubble);
  const stepBKeys = keysFromSteps(data.stepBTutorSteps);
  const B = stepBPrompts.map((prompt, itemIndex) => ({
    step: 'B' as const,
    itemIndex,
    itemType: stepBType,
    prompt,
    answerKey: stepBKeys[itemIndex] || '',
  }));
  return { A, B };
}
