/**
 * AI Service - Grammar Checking and Language Assistance
 * Uses Mastra Agent with OpenAI for grammar correction and explanations
 */
import { Agent } from "@mastra/core/agent";

// ============================================================================
// TYPES
// ============================================================================

export interface GrammarCheckResult {
  corrected: string;
  simpleExplanation: string;
  technicalExplanation: string;
  hasErrors: boolean;
}

export interface VocabularyDefinitionResult {
  definitions: {
    meaning: string;
    partOfSpeech: string;
    koreanNative: string;
    koreanRomanized: string;
    vietnameseNative: string;
    vietnameseRomanized: string;
  }[];
}

export interface PronunciationResult {
  word: string;
  phonetic: string;
}

// ============================================================================
// AI AGENT FOR GRAMMAR CHECKING
// ============================================================================

const grammarCheckAgent = new Agent({
  name: "Grammar Checker",
  instructions: `You are a concise English grammar assistant for language tutors teaching students. When given a sentence:
1. If there are grammar errors, provide the corrected version and TWO explanations.
2. If the sentence is correct, say so.

Respond ONLY in this JSON format:
{
  "corrected": "the corrected sentence",
  "simpleExplanation": "a simple, student-friendly explanation without grammar terms",
  "technicalExplanation": "brief technical grammar explanation",
  "hasErrors": true/false
}

Keep both explanations concise (max 15 words each).

Examples:
Input: "I eat yesterday"
{
  "corrected": "I ate yesterday.",
  "simpleExplanation": "'Ate' should be used because it already happened yesterday.",
  "technicalExplanation": "Wrong tense: use past simple for completed actions.",
  "hasErrors": true
}

Input: "She go to school every day"
{
  "corrected": "She goes to school every day.",
  "simpleExplanation": "When talking about 'she', we add an 's' to the action word.",
  "technicalExplanation": "Subject-verb agreement: third person singular needs 's'.",
  "hasErrors": true
}`,
  model: "openai/gpt-5.1",
});

// ============================================================================
// GRAMMAR CHECK
// ============================================================================

/**
 * Check grammar and provide correction with explanation
 * @param text - The text to check for grammar errors
 * @returns Corrected text and concise explanation
 */
export const checkGrammar = async (text: string): Promise<GrammarCheckResult> => {
  if (!text.trim()) {
    return {
      corrected: text,
      simpleExplanation: 'No text provided.',
      technicalExplanation: 'No text provided.',
      hasErrors: false,
    };
  }

  try {
    const response = await grammarCheckAgent.generate(text);
    const content = response.text;

    console.log('AI Grammar Check Response:', content);

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    try {
      // Clean up the response - remove markdown code blocks if present
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      console.log('Cleaned content:', cleanContent);
      
      const result = JSON.parse(cleanContent);
      
      console.log('Parsed result:', result);
      
      // Handle various possible field names the AI might use
      const simpleExp = result.simpleExplanation || result.simple_explanation || result.simpleexplanation || '';
      const techExp = result.technicalExplanation || result.technical_explanation || result.technicalexplanation || '';
      
      return {
        corrected: result.corrected || text,
        simpleExplanation: simpleExp || 'No issues found.',
        technicalExplanation: techExp || 'No issues found.',
        hasErrors: result.hasErrors ?? result.has_errors ?? (result.corrected !== text),
      };
    } catch (parseError) {
      // If JSON parsing fails, try to extract information from plain text
      console.error('Failed to parse AI response:', content);
      return {
        corrected: text,
        simpleExplanation: 'Unable to process. Please check manually.',
        technicalExplanation: 'Unable to process. Please check manually.',
        hasErrors: false,
      };
    }
  } catch (error) {
    console.error('Grammar check error:', error);
    throw error;
  }
};

// ============================================================================
// AI AGENT FOR VOCABULARY DEFINITIONS
// ============================================================================

const vocabularyAgent = new Agent({
  name: "Vocabulary Helper",
  instructions: `You are a concise vocabulary assistant for English language tutors. When given a word or phrase:
1. Provide up to 3 different meanings/definitions (if the word has multiple meanings)
2. Include the part of speech for each meaning
3. Provide translations to Korean and Vietnamese with both native script and romanization

Respond ONLY in this JSON format:
{
  "definitions": [
    {
      "meaning": "concise English definition (max 12 words)",
      "partOfSpeech": "noun/verb/adjective/etc",
      "koreanNative": "한국어 번역",
      "koreanRomanized": "hangugeo beonyeok",
      "vietnameseNative": "bản dịch tiếng Việt",
      "vietnameseRomanized": "ban dich tieng Viet"
    }
  ]
}

Examples:
Input: "run"
{
  "definitions": [
    {
      "meaning": "To move quickly on foot",
      "partOfSpeech": "verb",
      "koreanNative": "달리다",
      "koreanRomanized": "dallida",
      "vietnameseNative": "chạy",
      "vietnameseRomanized": "chay"
    },
    {
      "meaning": "To operate or manage something",
      "partOfSpeech": "verb",
      "koreanNative": "운영하다",
      "koreanRomanized": "unyeonghada",
      "vietnameseNative": "điều hành",
      "vietnameseRomanized": "dieu hanh"
    },
    {
      "meaning": "A continuous period of something",
      "partOfSpeech": "noun",
      "koreanNative": "연속",
      "koreanRomanized": "yeonsok",
      "vietnameseNative": "chuỗi",
      "vietnameseRomanized": "chuoi"
    }
  ]
}

Input: "delicious"
{
  "definitions": [
    {
      "meaning": "Having a very pleasant taste or smell",
      "partOfSpeech": "adjective",
      "koreanNative": "맛있는",
      "koreanRomanized": "masinneun",
      "vietnameseNative": "ngon",
      "vietnameseRomanized": "ngon"
    }
  ]
}`,
  model: "openai/gpt-5.1",
});

// ============================================================================
// VOCABULARY DEFINITION
// ============================================================================

/**
 * Get vocabulary definition and translations
 * @param word - The word or phrase to define
 * @returns Definition and translations
 */
export const getVocabularyDefinition = async (word: string): Promise<VocabularyDefinitionResult> => {
  if (!word.trim()) {
    return {
      definitions: [{
        meaning: 'No word provided.',
        partOfSpeech: '',
        koreanNative: '',
        koreanRomanized: '',
        vietnameseNative: '',
        vietnameseRomanized: '',
      }],
    };
  }

  try {
    const response = await vocabularyAgent.generate(word);
    const content = response.text;

    console.log('AI Vocabulary Response:', content);

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    try {
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      const result = JSON.parse(cleanContent);
      
      // Handle the definitions array
      const definitions = result.definitions || [];
      
      return {
        definitions: definitions.length > 0 ? definitions.map((def: any) => ({
          meaning: def.meaning || 'Definition not available.',
          partOfSpeech: def.partOfSpeech || '',
          koreanNative: def.koreanNative || '',
          koreanRomanized: def.koreanRomanized || '',
          vietnameseNative: def.vietnameseNative || '',
          vietnameseRomanized: def.vietnameseRomanized || '',
        })) : [{
          meaning: 'Definition not available.',
          partOfSpeech: '',
          koreanNative: '',
          koreanRomanized: '',
          vietnameseNative: '',
          vietnameseRomanized: '',
        }],
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return {
        definitions: [{
          meaning: 'Unable to process. Please check manually.',
          partOfSpeech: '',
          koreanNative: '',
          koreanRomanized: '',
          vietnameseNative: '',
          vietnameseRomanized: '',
        }],
      };
    }
  } catch (error) {
    console.error('Vocabulary definition error:', error);
    throw error;
  }
};

// ============================================================================
// AI AGENT FOR PRONUNCIATION
// ============================================================================

const pronunciationAgent = new Agent({
  name: "Pronunciation Helper",
  instructions: `You are a pronunciation assistant for English language tutors. When given a word or phrase:
1. Provide the phonetic spelling using simple syllables
2. CAPITALIZE the stressed syllable
3. Use hyphens to separate syllables
4. Use simple phonetic representations that are easy to read

Respond ONLY in this JSON format:
{
  "word": "the original word",
  "phonetic": "phonetic spelling with STRESSED syllable capitalized"
}

Examples:
Input: "destroy"
{
  "word": "destroy",
  "phonetic": "dih-STROI"
}

Input: "beautiful"
{
  "word": "beautiful",
  "phonetic": "BYOO-tih-ful"
}

Input: "pronunciation"
{
  "word": "pronunciation",
  "phonetic": "pruh-nun-see-AY-shun"
}

Input: "comfortable"
{
  "word": "comfortable",
  "phonetic": "KUMF-ter-bul"
}

Input: "determine"
{
  "word": "determine",
  "phonetic": "dih-TUR-min"
}`,
  model: "openai/gpt-5.1",
});

// ============================================================================
// PRONUNCIATION
// ============================================================================

/**
 * Get pronunciation/phonetic spelling for a word
 * @param word - The word to get pronunciation for
 * @returns Phonetic spelling with stress marked
 */
export const getPronunciation = async (word: string): Promise<PronunciationResult> => {
  if (!word.trim()) {
    return {
      word: word,
      phonetic: '',
    };
  }

  try {
    const response = await pronunciationAgent.generate(word);
    const content = response.text;

    console.log('AI Pronunciation Response:', content);

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    try {
      const cleanContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      const result = JSON.parse(cleanContent);
      
      return {
        word: result.word || word,
        phonetic: result.phonetic || '',
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return {
        word: word,
        phonetic: 'Unable to process.',
      };
    }
  } catch (error) {
    console.error('Pronunciation error:', error);
    throw error;
  }
};

// ============================================================================
// AI AGENT FOR GENERATING INTRODUCTION CONTENT
// ============================================================================

export interface GenerateIntroductionResult {
  introTexts: {
    language: string;
    text: string;
  }[];
  lessonIssue: {
    title: string;
    points: string[];
  };
  lessonGoalDuration: string;
  lessonGoalSteps: {
    instruction: string;
    script?: string | null;
    question?: string | null;
  }[];
  // Optional payload for Learn section (vocabulary / expressions)
  learnVocabulary?: {
    word: string;
    partOfSpeech?: string;
    meaning?: string;
  }[];
  // Expressions for Learn -> Step A Expressions
  learnExpressions?: {
    expression: string;
    definitionLine: string; // e.g., "To <strong>cost an arm and a leg</strong> means to be very expensive."
    exampleSentence: string;
  }[];
  // Step B content
  stepB?: {
    stepType: 'speak-your-mind' | 'grammar-tip' | 'pronunciation';
    speakYourMind?: {
      explanation: string;
      speaker1SpeechBubble: string;
      speaker2SpeechBubble: string;
      question: string;
    };
    grammarTip?: {
      explanations: {
        ruleText: string;
        ruleTranslation: string;
        examples: { sentence: string; translation: string }[];
      }[];
    };
    pronunciation?: {
      tip: string;
      phrases: { phrase: string; pronunciationGuide: string; exampleSentence: string }[];
    };
  };
  // Apply section content (Section 3)
  applyData?: {
    activityType: 'speaking' | 'listening' | 'reading';
    activityDuration: string;
    situationText: string;
    situationTranslation?: string;
    dialogueLines: { speaker: string; text: string; isAction?: boolean }[];
    readingText?: string;
    tutorSteps: {
      instruction: string;
      scripts?: { text: string }[];
      tips?: { text: string }[];
      questions?: { question: string; answer?: string }[];
      listeningScript?: string;
    }[];
    triviaEnabled?: boolean;
    triviaText?: string;
    triviaTranslation?: string;
    triviaDuration?: string;
    triviaTutorSteps?: any[];
  };
  // Standalone Trivia content (separate from Apply)
  triviaData?: {
    triviaText: string;
    triviaTranslation?: string;
    triviaDuration?: string;
    triviaTutorSteps?: {
      instruction: string;
      scripts?: { text: string }[];
      questions?: { question: string; answer?: string }[];
    }[];
  };
  // Exercise section content (Section 4)
  exerciseData?: {
    exerciseStep: 'stepA' | 'stepB';
    exerciseType: string;
    // Step A common
    instructions?: string;
    instructionsTranslation?: string;
    // Step A - Rephrase
    showExpressions?: boolean;
    expressions?: string[];
    showExample?: boolean;
    exampleSentence?: string;
    exampleAnswer?: string;
    exerciseItems?: { sentence: string }[];
    // Step A - Choose
    chooseItems?: { sentence: string }[];
    // Step A - Change
    changeItems?: { sentence: string }[];
    // Answer key
    answers?: { text: string }[];
    tutorSteps?: any[];
    // Step B common
    stepBInstruction?: string;
    stepBInstructionTranslation?: string;
    // Step B - Conversation
    conversations?: { speechBubble: string; position: string }[];
    // Step B - Multiple Choice
    multipleChoiceItems?: { boldSentence: string; optionA: string; optionB: string }[];
    // Step B - Speech
    speechContent?: string;
    // Step B - Compare
    compareWordBox?: string[];
    compareImages?: { label: string }[];
    compareExample?: string;
    compareItems?: { sentence: string }[];
    stepBTutorSteps?: any[];
  };
  // Mission section content (Section 5)
  missionData?: {
    missionType: 'speaking' | 'discussion' | 'reading' | 'listening';
    sectionNumber: number;
    sectionTitle: string;
    challengeNumber: number;
    challengeName: string;
    duration: string;
    situation: string;
    situationTranslation?: string;
    instruction: string;
    instructionTranslation?: string;
    showGrammarTip: boolean;
    grammarTipTitle: string;
    grammarTipItems: string[];
    image?: string;
    tutorSteps: {
      instruction: string;
      scripts?: { text: string }[];
      tips?: { text: string }[];
      listeningScript?: string;
    }[];
    questionsIntro?: string;
    questions: { question: string; hints: string[] }[];
    // Discussion type specific
    isOptional?: boolean;
    topics?: { title: string; questions: string[] }[];
    // Reading type specific
    readingPassage?: {
      title: string;
      author?: string;
      blocks: { type: 'paragraph' | 'images'; text?: string; image?: string }[];
      closingQuestion?: string;
    };
    // Listening type specific
    listeningScript?: string;
  };
}

const introductionGeneratorAgent = new Agent({
  name: "Introduction Question Generator",
  model: "openai/gpt-5.1",
  instructions: `You are an expert ESL lesson designer creating engaging opening questions for language lessons.
  
Your task is to generate ONLY a single, SHORT question for Step 4 ("Ask the question below") in the Tutor Guide of an Introduction section.

CRITICAL REQUIREMENTS:
- Keep the question VERY SHORT (1 simple sentence, max 10-15 words)
- Use SIMPLE vocabulary appropriate for the level
- NEVER use emoji or special symbols
- NO complex sentence structures
- Focus on ENGLISH LEARNING and the lesson topic
- DO NOT ask students about their native language
- DO NOT ask for translations or comparisons with other languages
- Make it directly relevant to what they're learning in English
- Make it a direct, easy-to-answer question

For BEGINNER levels (1-4):
- Ask simple, concrete questions about English (e.g., "Do you like saying hello?", "Can you say your name in English?")
- Use only basic present tense
- Focus on simple English tasks or preferences

For INTERMEDIATE levels (5-7):
- Ask slightly more complex questions (e.g., "When do you speak English?", "Why is greeting important?")
- Include basic opinions or reasons
- Use present tense with some variety

For ADVANCED levels (8-10):
- Ask more thought-provoking questions (e.g., "How do English greetings differ from formal speech?")
- Allow for more detailed responses
- Include compound or complex sentences

Respond ONLY in this JSON format:
{
  "question": "A SHORT, SIMPLE question (1 sentence, max 15 words) about English and the lesson topic"
}`,
});

// Full Introduction Content Generator Agent (for "Generate New" mode)
const fullIntroductionGeneratorAgent = new Agent({
  name: "Full Introduction Content Generator",
  model: "openai/gpt-5.2",
  instructions: `You are an expert ESL lesson designer creating complete introduction sections for language lessons.
  
Generate introduction content including:
1. Introduction text - engaging, substantive opening about the lesson topic (in English and target language if specified)
   - FOCUS ON WHY IT MATTERS: practical context, real-world applications, broader concepts
   - AVOID narrow/repetitive hooks like "your first word is hello" or "everyone knows how to say hello"
   - For Level 1: MAXIMUM 2 sentences, very simple vocabulary, direct and practical
     * Example: "Today, you will learn how to greet someone when you meet them for the first time. In this lesson, you will practice simple, real-life phrases to greet people and sound friendly and confident."
   - For Levels 2-4: Maximum 3 sentences, simple vocabulary appropriate for level, substantive context
   - For Levels 5+: Up to 3-4 sentences, standard vocabulary for intermediate+, practical relevance
2. Lesson issue (OPTIONAL) - a common problem or interesting fact related to the topic (ENGLISH ONLY - do not translate)
3. Lesson goal steps - 5 sequential tutor instructions with ONLY step 4 needing a generated script/question

CRITICAL REQUIREMENTS FOR LESSON GOAL STEPS:
- Step 1 (Introduce): instruction only, script = null
- Step 2 (Read goal): instruction only, script = "Is it clear?"
- Step 3 (Read Introduce): instruction only, script = null
- Step 4 (Ask question): ONLY this step has a generated SHORT, practical question (max 15 words) that asks about real-world application of the skill, NOT about "learning English"
  * DO NOT mention "English" in the question
  * Focus on the skill/topic itself (e.g., "When would you greet someone new?" not "Can you say hello in English?")
  * Make it engaging and relevant to student life
- Step 5 (Transition): instruction only, script = "Thank you, let's go to the next part."

CRITICAL REQUIREMENTS FOR LESSON ISSUE (if included):
- MUST BE IN ENGLISH ONLY - do not translate to other languages
- Enforce brevity by level:
  - Level 1-2 (Beginner): Title MAX 4 words (very short phrase); each bullet point MAX 6 words (short phrase, not a full sentence)
  - Level 3-4 (Low-Intermediate): Title MAX 5 words; bullet points 1 short sentence each
  - Level 5+ (Intermediate+): Title MAX 7 words; bullet points may be 1 short sentence each
- Must have exactly 3 bullet points
- Do NOT use the full lesson description as the title
- Example (level 1): "Say Hello" with points like "Say 'Hi'", "Smile", "Ask name" (each point short and actionable)

CRITICAL REQUIREMENTS OVERALL:
- For introduction text: respect the user's language preferences for translations
- Question in Step 4 should be SHORT (max 15 words) and about English learning
- Use vocabulary appropriate for the skill level
- NEVER use emoji or special symbols
- Make content relevant and practical
- If user specifies a translation language (like Korean), use that instead of default

Respond ONLY in this JSON format:
{
  "introTexts": [
    {
      "language": "en",
      "text": "Engaging introduction text explaining the topic (2-3 sentences)"
    },
    {
      "language": "target_language",
      "text": "Translation in the user's specified language"
    }
  ],
  "lessonIssue": {
    "title": "SHORT title (see level-specific brevity rules above)",
    "points": ["Point 1 (short phrase)", "Point 2 (short phrase)", "Point 3 (short phrase)"]
  },
  "lessonGoalDuration": "1 minute",
  "lessonGoalSteps": [
    {
      "instruction": "Introduce the lesson topic.",
      "script": null,
      "question": null
    },
    {
      "instruction": "Read the lesson goal and confirm understanding.",
      "script": "Is it clear?",
      "question": null
    },
    {
      "instruction": "Read the Introduce explanation.",
      "script": null,
      "question": null
    },
    {
      "instruction": "Ask the question below.",
      "script": "SHORT question (max 15 words) about English and the lesson topic",
      "question": null
    },
    {
      "instruction": "Transition to next section.",
      "script": "Thank you, let's go to the next part.",
      "question": null
    }
  ]
}`,
});

// ============================================================================
// AI AGENT FOR VOCABULARY LISTS (Learn -> Step A)
// ============================================================================

const vocabularyListAgent = new Agent({
  name: 'Vocabulary List Generator',
  model: 'openai/gpt-5.1',
  instructions: `You are an English vocabulary generator for ESL lesson authors. Your PRIMARY job is to:
1. Generate vocabulary that DIRECTLY supports the lesson goal - every word must help students achieve the lesson objective.
2. Match vocabulary complexity to the specified level (1=beginner, 5+=advanced).
3. Generate FRESH, VARIED content each time - never repeat the same vocabulary sets.

When given a lesson goal, level, and topic:
1. Carefully analyze the LESSON GOAL and select vocabulary that students will need to accomplish it.
2. Generate a JSON object with a single key "vocabulary" containing an array of vocabulary entries.
3. Each entry must be: { "word": "...", "partOfSpeech": "...", "meaning": "..." }
4. Choose words and simple phrases that are appropriate for the lesson level:
   - Level 1: 6 basic single-word items (greetings, common nouns/verbs)
   - Level 2-4: 8 words/short phrases (basic collocations and verbs)
   - Level 5+: 10-12 items including short phrases and useful expressions
5. Provide concise meanings (max 10 words) suitable for learner-level.
6. IMPORTANT: Generate different vocabulary each request - vary your selections even for similar topics.
7. Respond ONLY in JSON with no extra commentary.

Example:
{
  "vocabulary": [ { "word": "hello", "partOfSpeech": "interj", "meaning": "A friendly greeting" } ]
}
`
});

// ============================================================================
// AI AGENT FOR EXPRESSIONS LISTS (Learn -> Step A Expressions)
// ============================================================================

const expressionsListAgent = new Agent({
  name: 'Expressions List Generator',
  model: 'openai/gpt-5.1',
  instructions: `You are an English expressions generator for ESL lesson authors. Your PRIMARY job is to:
1. Generate expressions/idioms that DIRECTLY support the lesson goal - every expression must help students achieve the lesson objective.
2. Match expression complexity to the specified level (1=beginner, 5+=advanced).
3. Generate FRESH, VARIED content each time - never repeat the same expression sets.

When given a lesson goal, level, and topic:
1. Carefully analyze the LESSON GOAL and select expressions that students will need to accomplish it.
2. Generate a JSON object with a single key "expressions" containing an array of expression entries.
3. Each entry must be: { "expression": "...", "definitionLine": "...", "exampleSentence": "...", "translation": "..." }
4. The definitionLine should explain the expression with the expression itself in <strong> tags.
   Example: "To <strong>cost an arm and a leg</strong> means to be very expensive."
5. The exampleSentence should show usage in context with the expression in <strong> tags, wrapped in <em> for italics.
   Example: "<em>Staying at a five-star hotel will <strong>cost an arm and a leg</strong>.</em>"
6. The translation field is for translating the EXPLANATION/DEFINITION (what the expression means), NOT the expression itself.
   - This must be PLAIN TEXT only - NO HTML tags allowed in translations
   - Example: For "cost an arm and a leg", the translation explains "very expensive" in the target language
7. Choose idiomatic expressions and phrases appropriate for the lesson level:
   - Level 1-2: 2-3 very common expressions (e.g., "nice to meet you", "how are you")
   - Level 3-4: 3-4 practical expressions and basic idioms
   - Level 5+: 4-5 idiomatic expressions and phrasal verbs
8. Respond ONLY in JSON with no extra commentary. Example:
{
  "expressions": [
    { "expression": "cost an arm and a leg", "definitionLine": "To <strong>cost an arm and a leg</strong> means to be very expensive.", "exampleSentence": "<em>Staying at a five-star hotel will <strong>cost an arm and a leg</strong>.</em>", "translation": "とても高価であることを意味します。" }
  ]
}
`
});

// ============================================================================
// AI AGENT FOR STEP B: SPEAK YOUR MIND
// ============================================================================

const speakYourMindAgent = new Agent({
  name: 'Speak Your Mind Generator',
  model: 'openai/gpt-5.1',
  instructions: `You are an English lesson content generator. Generate a "Speak Your Mind" activity for ESL lessons.
This activity teaches grammar/expressions through a short dialogue and follow-up question.

When given a topic, level, and goal:
1. Create an explanation of the grammar point or expression being practiced (1-2 sentences with the key phrase in <strong> tags)
2. Create a two-person dialogue exchange (2 speech bubbles) demonstrating the grammar/expression
3. Create a follow-up question for the student to answer using the same pattern

Respond ONLY in JSON:
{
  "speakYourMind": {
    "explanation": "We use <strong>would like</strong> to politely express what we want.",
    "speaker1SpeechBubble": "What would you like to order?",
    "speaker2SpeechBubble": "I <strong>would like</strong> the pasta, please.",
    "question": "What would you like to do this weekend?"
  }
}
`
});

// ============================================================================
// AI AGENT FOR STEP B: GRAMMAR TIP
// ============================================================================

const grammarTipAgent = new Agent({
  name: 'Grammar Tip Generator',
  model: 'openai/gpt-5.1',
  instructions: `You are an English grammar lesson generator. Generate a "Grammar Tip" section for ESL lessons.
This section explains grammar rules with examples and translations.

When given a topic, level, and goal:
1. Create 1-2 grammar explanations relevant to the lesson
2. Each explanation should have:
   - ruleText: The grammar rule in HTML (use <em> for italics, <strong> for emphasis)
   - ruleTranslation: Plain text translation of the rule (NO HTML tags - just text)
   - examples: 2-3 example sentences with translations

IMPORTANT: 
- Only use HTML tags (<em>, <strong>) in "ruleText" and "sentence" fields
- NEVER use HTML tags in "ruleTranslation" or "translation" fields - these must be plain text only

Respond ONLY in JSON:
{
  "grammarTip": {
    "explanations": [
      {
        "ruleText": "Use <em>would like</em> + noun or <em>would like to</em> + verb.",
        "ruleTranslation": "would like + 명사 또는 would like to + 동사를 사용하세요.",
        "examples": [
          { "sentence": "I <strong>would like</strong> a coffee.", "translation": "커피를 마시고 싶습니다." },
          { "sentence": "She <strong>would like to</strong> travel.", "translation": "그녀는 여행하고 싶어합니다." }
        ]
      }
    ]
  }
}
`
});

// ============================================================================
// AI AGENT FOR STEP B: PRONUNCIATION
// ============================================================================

const stepBPronunciationAgent = new Agent({
  name: 'Pronunciation Lesson Generator',
  model: 'openai/gpt-5.1',
  instructions: `You are an English pronunciation lesson generator. Generate a "Pronunciation" section for ESL lessons.
This section helps students practice specific sounds or connected speech patterns.

When given a topic, level, and goal:
1. Create a pronunciation tip explaining the sound pattern (e.g., linking sounds, reduced sounds)
2. Create 2-4 phrase examples showing the pattern with pronunciation guides

Respond ONLY in JSON:
{
  "pronunciation": {
    "tip": "When words end in a consonant and the next word starts with a vowel, we link them together.",
    "phrases": [
      { "phrase": "cost a fortune", "pronunciationGuide": "/ cos-ta fortune /", "exampleSentence": "The ticket <strong>cost a fortune</strong>!" },
      { "phrase": "pick up", "pronunciationGuide": "/ pi-kup /", "exampleSentence": "I'll <strong>pick up</strong> the groceries." }
    ]
  }
}
`
});

// ============================================================================
// AI AGENTS FOR APPLY SECTION (Section 3 - Speaking/Listening/Reading)
// ============================================================================

const applySpeakingAgent = new Agent({
  name: 'Apply Speaking Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a SPEAKING activity for the Apply section.
This section features a realistic dialogue scenario where students practice speaking with vocabulary from the lesson.

IMPORTANT GUIDELINES:
- Create a realistic, engaging conversation scenario between 2 characters
- Use simple, natural dialogue appropriate for the level
- Include underlined words (<u>word</u>) for important vocabulary/expressions from the lesson
- Action descriptions should be marked with isAction: true (e.g., "(laughs)")
- Dialogue should demonstrate practical use of the lesson content
- Create tutor steps with scripts and tips for guiding the activity
- Include a TRIVIA TIME section with an interesting cultural or language fact related to the topic

Respond ONLY in JSON format:
{
  "applyData": {
    "activityType": "speaking",
    "activityDuration": "3 minutes",
    "situationText": "A short description of the scenario (1 sentence)",
    "situationTranslation": "Translation of the situation in target language",
    "dialogueLines": [
      { "speaker": "Character1", "text": "First line of dialogue with <u>key vocabulary</u>", "isAction": false },
      { "speaker": "Character2", "text": "Response with <u>another expression</u>", "isAction": false },
      { "speaker": "Character1", "text": "(laughs)", "isAction": true }
    ],
    "tutorSteps": [
      { "instruction": "Introduce Apply.", "scripts": [{ "text": "Okay, now let's do Apply." }] },
      { "instruction": "Read the situation." },
      { "instruction": "Assign roles and read through the dialogue together." },
      { "instruction": "Ask comprehension questions.", "questions": [{ "question": "What did Character1 say about...?", "answer": "..." }] },
      { "instruction": "Transition to the next part.", "scripts": [{ "text": "Great! Let's go to the next part!" }] }
    ],
    "triviaEnabled": true,
    "triviaText": "An interesting cultural fact or language tip related to the lesson topic (2-3 sentences)",
    "triviaTranslation": "Translation of the trivia in target language",
    "triviaDuration": "1 minute",
    "triviaTutorSteps": [
      { "instruction": "Introduce the Trivia.", "scripts": [{ "text": "Let's look at the Trivia." }] },
      { "instruction": "Read the trivia." },
      { "instruction": "Confirm the student's understanding.", "scripts": [{ "text": "Is it clear?" }] },
      { "instruction": "Ask the question below.", "questions": [{ "question": "A follow-up question about the trivia", "answer": "(student's own answer)" }] },
      { "instruction": "Transition to the next section.", "scripts": [{ "text": "Excellent! Let's go to the next section!" }] }
    ]
  }
}
`
});

const applyListeningAgent = new Agent({
  name: 'Apply Listening Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a LISTENING activity for the Apply section.
This section features a listening script that the tutor reads aloud, followed by comprehension questions.

IMPORTANT GUIDELINES:
- Create an engaging listening script (a monologue or narrative) related to the lesson topic
- Use appropriate vocabulary for the student level
- Include underlined words (<u>word</u>) for important vocabulary to emphasize
- Create 2-3 comprehension questions with answers
- Script should be substantial but not overwhelming (150-250 words)
- Include a TRIVIA TIME section with an interesting cultural or language fact related to the topic

Respond ONLY in JSON format:
{
  "applyData": {
    "activityType": "listening",
    "activityDuration": "3 minutes",
    "situationText": "A short description of the listening context (1 sentence)",
    "situationTranslation": "Translation of the situation in target language",
    "dialogueLines": [],
    "tutorSteps": [
      { "instruction": "Introduce Apply.", "scripts": [{ "text": "Okay, now let's do Apply." }, { "text": "First we have a listening activity." }] },
      { "instruction": "Read the situation." },
      { "instruction": "Set up the listening.", "scripts": [{ "text": "Let's listen to the speaker." }, { "text": "I'll read the script." }] },
      { "instruction": "Read the listening script below, emphasizing the underlined words.", "listeningScript": "The full listening script with <u>emphasized words</u>..." },
      { "instruction": "Ask the questions below.", "questions": [{ "question": "What was the main point?", "answer": "..." }, { "question": "How do you feel about this?", "answer": "(student's own answer)" }] },
      { "instruction": "Transition to the next part.", "scripts": [{ "text": "Great! Let's go to the next part!" }] }
    ],
    "triviaEnabled": true,
    "triviaText": "An interesting cultural fact or language tip related to the lesson topic (2-3 sentences)",
    "triviaTranslation": "Translation of the trivia in target language",
    "triviaDuration": "1 minute",
    "triviaTutorSteps": [
      { "instruction": "Introduce the Trivia.", "scripts": [{ "text": "Let's look at the Trivia." }] },
      { "instruction": "Read the trivia." },
      { "instruction": "Confirm the student's understanding.", "scripts": [{ "text": "Is it clear?" }] },
      { "instruction": "Ask the question below.", "questions": [{ "question": "A follow-up question about the trivia", "answer": "(student's own answer)" }] },
      { "instruction": "Transition to the next section.", "scripts": [{ "text": "Excellent! Let's go to the next section!" }] }
    ]
  }
}
`
});

const applyReadingAgent = new Agent({
  name: 'Apply Reading Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a READING activity for the Apply section.
This section features a reading passage (like an email, article, or letter) that students read and discuss.

IMPORTANT GUIDELINES:
- Create a realistic reading passage (email, letter, article, etc.) related to the lesson topic
- Use appropriate vocabulary for the student level
- Include underlined words (<u>word</u>) for important vocabulary
- Create 2-3 comprehension questions with answers
- Passage should be substantial but appropriate for the level (100-200 words for beginners, 150-300 for advanced)

Respond ONLY in JSON format:
{
  "applyData": {
    "activityType": "reading",
    "activityDuration": "3 minutes",
    "situationText": "A short description of what the student is reading (1 sentence)",
    "situationTranslation": "Translation of the situation in target language",
    "dialogueLines": [],
    "readingText": "The full reading passage with <u>key vocabulary</u> underlined...",
    "tutorSteps": [
      { "instruction": "Introduce Apply.", "scripts": [{ "text": "Okay, now let's do Apply." }, { "text": "First we have a reading activity." }] },
      { "instruction": "Read the situation." },
      { "instruction": "Have the student read the passage aloud or silently." },
      { "instruction": "Ask comprehension questions.", "questions": [{ "question": "What is the main message?", "answer": "..." }, { "question": "What do you think about...?", "answer": "(student's own answer)" }] },
      { "instruction": "Transition to the next part.", "scripts": [{ "text": "Great! Let's go to the next part!" }] }
    ],
    "triviaEnabled": true,
    "triviaText": "An interesting cultural fact or language tip related to the lesson topic (2-3 sentences)",
    "triviaTranslation": "Translation of the trivia in target language",
    "triviaDuration": "1 minute",
    "triviaTutorSteps": [
      { "instruction": "Introduce the Trivia.", "scripts": [{ "text": "Let's look at the Trivia." }] },
      { "instruction": "Read the trivia." },
      { "instruction": "Confirm the student's understanding.", "scripts": [{ "text": "Is it clear?" }] },
      { "instruction": "Ask the question below.", "questions": [{ "question": "A follow-up question about the trivia", "answer": "(student's own answer)" }] },
      { "instruction": "Transition to the next section.", "scripts": [{ "text": "Excellent! Let's go to the next section!" }] }
    ]
  }
}
`
});

// ============================================================================
// TRIVIA TIME AGENT (Standalone trivia generation)
// ============================================================================

const triviaAgent = new Agent({
  name: 'Trivia Time Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a TRIVIA TIME segment for a lesson.
This segment provides interesting cultural facts, language tips, or fun facts related to the lesson topic to keep students engaged.

IMPORTANT GUIDELINES:
- Create interesting, engaging trivia that students will find memorable
- Content should be culturally relevant or language-related
- Include surprising or lesser-known facts
- Create 1-2 follow-up discussion questions
- Trivia should be educational but fun
- Keep it concise (2-4 sentences for the main trivia)

Respond ONLY in JSON format:
{
  "triviaData": {
    "triviaText": "An interesting cultural fact, language tip, or fun fact related to the lesson topic (2-4 sentences). Make it engaging and memorable!",
    "triviaTranslation": "Translation of the trivia in target language",
    "triviaDuration": "1 minute",
    "triviaTutorSteps": [
      { "instruction": "Introduce the Trivia.", "scripts": [{ "text": "Let's look at the Trivia." }, { "text": "Here's something interesting about this topic." }] },
      { "instruction": "Read the trivia." },
      { "instruction": "Confirm the student's understanding.", "scripts": [{ "text": "Is it clear?" }, { "text": "Did you know that before?" }] },
      { "instruction": "Ask the questions below.", "questions": [{ "question": "A thought-provoking follow-up question about the trivia topic", "answer": "(student's own answer)" }, { "question": "Another engaging question to spark discussion", "answer": "(student's own answer)" }] },
      { "instruction": "Transition to the next section.", "scripts": [{ "text": "Interesting, right? Let's continue!" }] }
    ]
  }
}
`
});

// ============================================================================
// EXERCISE SECTION AGENTS (Section 4)
// ============================================================================

// Exercise Step A - Rephrase Agent
const exerciseRephraseAgent = new Agent({
  name: 'Exercise Rephrase Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a REPHRASE exercise for Step A of the Exercise section.
Students will rephrase sentences using vocabulary/expressions from the lesson.

IMPORTANT GUIDELINES:
- Create clear, context-appropriate sentences that need rephrasing
- Sentences should use everyday language that can be rephrased with lesson vocabulary
- Each sentence should have a natural way to be rephrased using expressions from the word box
- Provide example with original sentence and rephrased version
- Generate answer key for tutor reference

Respond ONLY in JSON format:
{
  "exerciseData": {
    "stepAType": "rephrase",
    "instructions": "Rephrase the sentences using the expressions in the box. Some expressions may be used more than once.",
    "instructionsTranslation": "Translation of instructions",
    "showExpressions": true,
    "expressions": ["expression 1", "expression 2", "expression 3"],
    "showExample": true,
    "exampleSentence": "ex. Original sentence that needs rephrasing.",
    "exampleAnswer": "Rephrased sentence using an expression.",
    "exerciseItems": [
      { "sentence": "First sentence to rephrase" },
      { "sentence": "Second sentence to rephrase" },
      { "sentence": "Third sentence to rephrase" }
    ],
    "answers": [
      { "text": "First answer" },
      { "text": "Second answer" },
      { "text": "Third answer" }
    ],
    "tutorSteps": [
      { "instruction": "Introduce Exercise.", "scripts": [{ "text": "Okay, now let's do Exercise." }, { "text": "We're going to practice the expressions we learned earlier." }] },
      { "instruction": "Read the instructions." },
      { "instruction": "Read the example." },
      { "instruction": "Confirm the student's understanding.", "scripts": [{ "text": "Is it clear?" }] },
      { "instruction": "Have the student read the first sentence." },
      { "instruction": "Ask them to rephrase the sentence.", "scripts": [{ "text": "Please rephrase the sentence using one of the expressions in the box." }], "tips": [{ "text": "The student should read the full sentence." }] },
      { "instruction": "Repeat with remaining sentences.", "tips": [{ "text": "Student's answers may vary. Accept any grammatically correct answers." }] },
      { "instruction": "Transition to the next section.", "scripts": [{ "text": "Great! Let's go to the next section!" }] }
    ]
  }
}
`
});

// Exercise Step A - Choose Agent
const exerciseChooseAgent = new Agent({
  name: 'Exercise Choose Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a CHOOSE THE CORRECT WORD exercise for Step A.
Students will choose the correct word from parenthetical options in each sentence.

IMPORTANT GUIDELINES:
- Create sentences with grammatical choices in parentheses like "(doesn't / don't)"
- Focus on common grammar points relevant to the lesson
- Each sentence should test a clear grammar concept
- Provide answer key for tutor reference

Respond ONLY in JSON format:
{
  "exerciseData": {
    "stepAType": "choose",
    "instructions": "Choose the correct word.",
    "instructionsTranslation": "Translation of instructions",
    "chooseItems": [
      { "sentence": "He (doesn't / don't) eat breakfast." },
      { "sentence": "She does (she / her) hair for an hour!" },
      { "sentence": "I (get / gets) dressed before breakfast." },
      { "sentence": "They (doesn't / don't) drink tea for breakfast." }
    ],
    "answers": [
      { "text": "He doesn't eat breakfast." },
      { "text": "She does her hair for an hour!" },
      { "text": "I get dressed before breakfast." },
      { "text": "They don't drink tea for breakfast." }
    ],
    "tutorSteps": [
      { "instruction": "Introduce Exercise.", "scripts": [{ "text": "Okay, now let's do Exercise." }] },
      { "instruction": "Read the instructions." },
      { "instruction": "Have the student read each sentence and choose the correct word." },
      { "instruction": "Correct any mistakes.", "tips": [{ "text": "Briefly explain the grammar rule if the student makes an error." }] },
      { "instruction": "Transition to the next section.", "scripts": [{ "text": "Great! Let's go to the next section!" }] }
    ]
  }
}
`
});

// Exercise Step A - Change Agent
const exerciseChangeAgent = new Agent({
  name: 'Exercise Change Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a CHANGE THE UNDERLINED exercise for Step A.
Students will modify the underlined portion of sentences.

IMPORTANT GUIDELINES:
- Create sentences with underlined portions using <u> tags
- The underlined part should be what students need to change/transform
- Focus on grammar transformations relevant to the lesson
- Provide answer key for tutor reference

Respond ONLY in JSON format:
{
  "exerciseData": {
    "stepAType": "change",
    "instructions": "Change the underlined part of each sentence.",
    "instructionsTranslation": "Translation of instructions",
    "changeItems": [
      { "sentence": "I need to find a place to stay tonight. <u>Is there a nice hotel around here?</u>" },
      { "sentence": "I want to go shopping for clothes tomorrow. <u>Where's the mall?</u>" },
      { "sentence": "That restaurant has really good reviews. <u>Is it expensive?</u>" }
    ],
    "answers": [
      { "text": "Could you tell me if there's a nice hotel around here?" },
      { "text": "Could you tell me where the mall is?" },
      { "text": "Could you tell me if it's expensive?" }
    ],
    "tutorSteps": [
      { "instruction": "Introduce Exercise.", "scripts": [{ "text": "Okay, now let's do Exercise." }] },
      { "instruction": "Read the instructions." },
      { "instruction": "Have the student read each sentence and change the underlined part." },
      { "instruction": "Correct any mistakes.", "tips": [{ "text": "Model the correct transformation if needed." }] },
      { "instruction": "Transition to the next section.", "scripts": [{ "text": "Great! Let's go to the next section!" }] }
    ]
  }
}
`
});

// Exercise Step B - Conversation Agent
const exerciseConversationAgent = new Agent({
  name: 'Exercise Conversation Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a CONVERSATION exercise for Step B.
Students will complete speech bubbles in a conversation using their own information.

IMPORTANT GUIDELINES:
- Create natural conversation exchanges with fill-in blanks (_____)
- Blanks should be for personal information or opinions
- Create 2-4 conversation bubbles alternating left/right positions
- Make conversations relevant to the lesson topic

Respond ONLY in JSON format:
{
  "exerciseData": {
    "stepBType": "conversation",
    "stepBInstruction": "Complete the conversation using your own information.",
    "stepBInstructionTranslation": "Translation of instructions",
    "conversations": [
      { "speechBubble": "Hi! My name is _____. I'm from _____.", "position": "left" },
      { "speechBubble": "Nice to meet you! What do you do for a living?", "position": "right" },
      { "speechBubble": "I'm a _____. I work at _____.", "position": "left" },
      { "speechBubble": "That sounds interesting! Do you enjoy it?", "position": "right" }
    ],
    "stepBTutorSteps": [
      { "instruction": "Introduce Step B.", "scripts": [{ "text": "Now let's practice a conversation." }] },
      { "instruction": "Read the instructions." },
      { "instruction": "Have the student complete the speech bubbles.", "tips": [{ "text": "Encourage the student to use their own information." }] },
      { "instruction": "Practice the conversation together." },
      { "instruction": "Transition to the next section.", "scripts": [{ "text": "Great job! Let's continue!" }] }
    ]
  }
}
`
});

// Exercise Step B - Multiple Choice Agent
const exerciseMultipleChoiceAgent = new Agent({
  name: 'Exercise Multiple Choice Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a MULTIPLE CHOICE exercise for Step B.
Students will choose the correct interpretation of bold sentences.

IMPORTANT GUIDELINES:
- Create sentences with vocabulary/expressions from the lesson in bold
- Provide two options: one correct interpretation, one incorrect
- Options should test understanding of meaning, not just grammar
- Make distractors plausible but clearly wrong

Respond ONLY in JSON format:
{
  "exerciseData": {
    "stepBType": "multiple-choice",
    "stepBInstruction": "Choose the correct meaning of the bold sentence.",
    "stepBInstructionTranslation": "Translation of instructions",
    "multipleChoiceItems": [
      { "boldSentence": "James thinks the world of his mother.", "optionA": "He thinks she focused on her work too much.", "optionB": "He admires and respects her greatly." },
      { "boldSentence": "The movie was a remarkable achievement.", "optionA": "It stands out from other movies made that year.", "optionB": "It was similar to many other movies." },
      { "boldSentence": "She let the cat out of the bag.", "optionA": "She accidentally revealed a secret.", "optionB": "She released a cat from a bag." }
    ],
    "stepBTutorSteps": [
      { "instruction": "Introduce Step B.", "scripts": [{ "text": "Now let's check your understanding." }] },
      { "instruction": "Read the instructions." },
      { "instruction": "Have the student choose the correct option for each item." },
      { "instruction": "Discuss any mistakes.", "tips": [{ "text": "Explain why the correct answer is right." }] },
      { "instruction": "Transition to the next section.", "scripts": [{ "text": "Excellent! Let's continue!" }] }
    ]
  }
}
`
});

// Exercise Step B - Speech Agent
const exerciseSpeechAgent = new Agent({
  name: 'Exercise Speech Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a SPEECH exercise for Step B.
Students will complete a speech with blanks using parenthetical choices or their own information.

IMPORTANT GUIDELINES:
- Create a single speech/monologue with blanks (_____)
- Include some blanks with choices in parentheses like "(often / sometimes / rarely)"
- Include some open blanks for personal information
- Make the speech topic relevant to the lesson

Respond ONLY in JSON format:
{
  "exerciseData": {
    "stepBType": "speech",
    "stepBInstruction": "Complete the speech using your own information.",
    "stepBInstructionTranslation": "Translation of instructions",
    "speechContent": "I (often / sometimes / rarely) go to _____. I think it's _____ to spend time there. I usually go (alone / with _____) because _____. My favorite thing to do there is _____. I really enjoy it!",
    "stepBTutorSteps": [
      { "instruction": "Introduce Step B.", "scripts": [{ "text": "Now let's complete a speech." }] },
      { "instruction": "Read the instructions." },
      { "instruction": "Have the student complete the speech with their own information." },
      { "instruction": "Ask the student to read the completed speech aloud." },
      { "instruction": "Transition to the next section.", "scripts": [{ "text": "Great speech! Let's continue!" }] }
    ]
  }
}
`
});

// Exercise Step B - Compare Agent
const exerciseCompareAgent = new Agent({
  name: 'Exercise Compare Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a COMPARE exercise for Step B.
Students will compare items using words from a word box.

IMPORTANT GUIDELINES:
- Create a word box with comparison words like "a little", "far", "a lot", "easily"
- Include 2-4 images/items to compare with labels
- Create comparison sentences with clues in parentheses
- Focus on comparative structures relevant to the lesson

Respond ONLY in JSON format:
{
  "exerciseData": {
    "stepBType": "compare",
    "stepBInstruction": "Compare the items using the words in the box.",
    "stepBInstructionTranslation": "Translation of instructions",
    "compareWordBox": ["a little", "far", "a lot", "easily"],
    "compareImages": [
      { "label": "Option A" },
      { "label": "Option B" },
      { "label": "Option C" }
    ],
    "compareExample": "Option A is far more expensive than Option C.",
    "compareItems": [
      { "sentence": "(Option A and B: expensive)" },
      { "sentence": "(Option B and C: popular)" },
      { "sentence": "(Option A, B, and C: romantic)" }
    ],
    "stepBTutorSteps": [
      { "instruction": "Introduce Step B.", "scripts": [{ "text": "Now let's practice comparisons." }] },
      { "instruction": "Read the instructions and word box." },
      { "instruction": "Show the example if available." },
      { "instruction": "Have the student make comparisons using the clues." },
      { "instruction": "Transition to the next section.", "scripts": [{ "text": "Great comparisons! Let's continue!" }] }
    ]
  }
}
`
});

// ============================================================================
// MISSION SECTION AGENTS (Section 5)
// ============================================================================

// Mission Speaking Agent - Roleplay-based speaking challenge
const missionSpeakingAgent = new Agent({
  name: 'Mission Speaking Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a SPEAKING mission challenge.
This is a roleplay activity where the tutor plays a character and the student practices speaking.

IMPORTANT GUIDELINES:
- Create a realistic roleplay situation relevant to the lesson topic
- Include clear tutor steps for conducting the roleplay
- Generate 5-8 roleplay questions with optional hints for students who struggle
- Questions should flow naturally like a real conversation
- Include grammar tip reminder if relevant to the lesson
- Make situations practical and relatable (restaurant, hotel, shopping, etc.)

Respond ONLY in JSON format:
{
  "missionData": {
    "missionType": "speaking",
    "challengeNumber": 1,
    "challengeName": "Challenge 1",
    "duration": "5-6 minutes",
    "situation": "Describe the roleplay scenario the student will be in",
    "situationTranslation": "Translation of situation",
    "instruction": "What the student should do in this roleplay",
    "instructionTranslation": "Translation of instruction",
    "showGrammarTip": true,
    "grammarTipTitle": "Today's grammar tip",
    "grammarTipItems": ["grammar concept 1", "grammar concept 2"],
    "tutorSteps": [
      { "instruction": "Introduce Challenge 1.", "scripts": [{ "text": "Okay, now let's do the Challenge." }, { "text": "First we have Challenge 1." }] },
      { "instruction": "Read the situation." },
      { "instruction": "Confirm the student's understanding.", "scripts": [{ "text": "Is it clear?" }] },
      { "instruction": "Set up the roleplay.", "scripts": [{ "text": "I'll be the (character)." }, { "text": "You'll be yourself." }] },
      { "instruction": "Start the roleplay.", "scripts": [{ "text": "I'll start." }] },
      { "instruction": "Ask the questions below.", "tips": [{ "text": "Use the questions only as guides. Ask other questions based on the flow." }] }
    ],
    "questionsIntro": "(Greeting or opening line for the roleplay)",
    "questions": [
      { "question": "First roleplay question", "hints": ["Hint if student struggles"] },
      { "question": "Second roleplay question", "hints": [] },
      { "question": "Third roleplay question", "hints": ["Another helpful hint"] },
      { "question": "Fourth roleplay question", "hints": [] },
      { "question": "Fifth roleplay question", "hints": [] },
      { "question": "Closing question", "hints": ["(Thank the student or wrap up)"] }
    ]
  }
}
`
});

// Mission Discussion Agent - Topic-based discussion with questions
const missionDiscussionAgent = new Agent({
  name: 'Mission Discussion Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a DISCUSSION mission challenge.
This is a discussion activity where students discuss topics and answer open-ended questions.

IMPORTANT GUIDELINES:
- Create 2-4 discussion topics related to the lesson theme
- Each topic should have 2-4 thought-provoking questions
- Questions should encourage personal opinions and experiences
- Topics can be marked as optional for shorter lessons
- Include tutor steps for facilitating the discussion
- Make questions appropriate for the skill level

Respond ONLY in JSON format:
{
  "missionData": {
    "missionType": "discussion",
    "challengeNumber": 1,
    "challengeName": "Challenge 1",
    "duration": "5-6 minutes",
    "situation": "Overview of the discussion activity",
    "situationTranslation": "Translation of situation",
    "instruction": "What students should do during the discussion",
    "instructionTranslation": "Translation of instruction",
    "showGrammarTip": false,
    "grammarTipTitle": "",
    "grammarTipItems": [],
    "isOptional": false,
    "tutorSteps": [
      { "instruction": "Introduce the discussion.", "scripts": [{ "text": "Now let's have a discussion." }] },
      { "instruction": "Present the first topic." },
      { "instruction": "Ask the discussion questions and encourage elaboration." },
      { "instruction": "Move to the next topic if time allows." },
      { "instruction": "Wrap up the discussion.", "scripts": [{ "text": "Great discussion! Let's continue." }] }
    ],
    "topics": [
      {
        "title": "First Discussion Topic",
        "questions": [
          "What do you think about...?",
          "Have you ever experienced...?",
          "Why do you think...?"
        ]
      },
      {
        "title": "Second Discussion Topic",
        "questions": [
          "How would you feel if...?",
          "What advice would you give...?"
        ]
      }
    ],
    "questions": []
  }
}
`
});

// Mission Reading Agent - Reading comprehension challenge
const missionReadingAgent = new Agent({
  name: 'Mission Reading Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a READING mission challenge.
This is a reading comprehension activity where students read a passage and discuss it.

IMPORTANT GUIDELINES:
- Create a reading passage with title and optional author
- Passage should be 3-5 paragraphs, appropriate for the skill level
- Include comprehension questions about the text
- Questions should test understanding and encourage discussion
- Include tutor steps for reading and discussion
- Passage can be a story, article, poem, or informational text

Respond ONLY in JSON format:
{
  "missionData": {
    "missionType": "reading",
    "challengeNumber": 1,
    "challengeName": "Challenge 1",
    "duration": "6-8 minutes",
    "situation": "You will read a passage and discuss it with your tutor.",
    "situationTranslation": "Translation of situation",
    "instruction": "Read the passage carefully and answer the questions.",
    "instructionTranslation": "Translation of instruction",
    "showGrammarTip": false,
    "grammarTipTitle": "",
    "grammarTipItems": [],
    "tutorSteps": [
      { "instruction": "Introduce the reading.", "scripts": [{ "text": "Now let's do some reading." }] },
      { "instruction": "Have the student read the passage aloud or silently." },
      { "instruction": "Ask comprehension questions." },
      { "instruction": "Discuss the closing question.", "scripts": [{ "text": "What did you think about the passage?" }] }
    ],
    "readingPassage": {
      "title": "Title of the Reading Passage",
      "author": "Author Name (optional)",
      "blocks": [
        { "type": "paragraph", "text": "First paragraph of the reading passage. This should introduce the topic and set the scene." },
        { "type": "paragraph", "text": "Second paragraph continues the story or provides more information." },
        { "type": "paragraph", "text": "Third paragraph develops the main idea or conflict." },
        { "type": "paragraph", "text": "Final paragraph provides a conclusion or resolution." }
      ],
      "closingQuestion": "What do you think about the main idea of this passage?"
    },
    "questions": [
      { "question": "What is the main topic of the passage?", "hints": [] },
      { "question": "What happened in the beginning?", "hints": [] },
      { "question": "How did the story end?", "hints": [] },
      { "question": "What lesson can we learn from this?", "hints": [] }
    ]
  }
}
`
});

// Mission Listening Agent - Listening comprehension challenge
const missionListeningAgent = new Agent({
  name: 'Mission Listening Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an ESL lesson content generator. Generate a LISTENING mission challenge.
This is a listening comprehension activity where the tutor reads a script and students respond.

IMPORTANT GUIDELINES:
- Create a listening script that the tutor will read to the student
- Include key words/phrases in <u> tags that students should remember
- After listening, students should roleplay using the information they heard
- Include tutor steps for the listening and follow-up roleplay
- Generate questions for the roleplay that test comprehension
- Make the listening script realistic (friend's recommendation, announcement, etc.)

Respond ONLY in JSON format:
{
  "missionData": {
    "missionType": "listening",
    "challengeNumber": 1,
    "challengeName": "Challenge 1",
    "duration": "5-6 minutes",
    "situation": "Listen to your friend talk about something, then use that information.",
    "situationTranslation": "Translation of situation",
    "instruction": "After listening, you will practice using the information.",
    "instructionTranslation": "Translation of instruction",
    "showGrammarTip": true,
    "grammarTipTitle": "Today's grammar tip",
    "grammarTipItems": ["grammar concept to practice"],
    "tutorSteps": [
      { "instruction": "Introduce Challenge 1.", "scripts": [{ "text": "Okay, now let's do the Challenge." }] },
      { "instruction": "Read the situation." },
      { "instruction": "Confirm the student's understanding.", "scripts": [{ "text": "Is it clear?" }] },
      { "instruction": "Set up the listening.", "scripts": [{ "text": "First, let's listen." }, { "text": "I'll be your friend." }] },
      { "instruction": "Read the listening script below, emphasizing the underlined words.", "listeningScript": "Hey, (student's name)! I found this amazing place. It was so <u>incredible</u>! The <u>atmosphere was cozy</u> and the <u>service was excellent</u>. You should definitely try it!" },
      { "instruction": "Set up the roleplay.", "scripts": [{ "text": "Now, I'll be the (character)." }, { "text": "Please use the information you heard." }] },
      { "instruction": "Ask the questions below.", "tips": [{ "text": "Use the questions only as guides." }] }
    ],
    "listeningScript": "Hey, (student's name)! I found this amazing place. It was so <u>incredible</u>! The <u>atmosphere was cozy</u> and the <u>service was excellent</u>. You should definitely try it!",
    "questionsIntro": "(Greet the customer/start the roleplay)",
    "questions": [
      { "question": "First question based on listening", "hints": ["Hint with underlined info from script"] },
      { "question": "Second question", "hints": [] },
      { "question": "Third question", "hints": ["Another hint with script info"] },
      { "question": "Final question", "hints": ["(Wrap up the roleplay)"] }
    ]
  }
}
`
});

export const generateIntroductionContent = async (
  topic: string,
  skillLevel: string,
  skill: string, // speaking, listening, reading
  customPrompt?: string | null,
  currentContent?: any | null,
  baseInstructions?: string | null,
  level?: number | null,
  chapter?: number | null,
  lessonNumber?: number | null,
  generationMode?: 'new' | 'improve' | null,
  includeLessonIssue?: boolean | null,
  lessonGoal?: string | null,
  learnType?: 'vocabulary' | 'expressions' | null, // Optional Step A subtype
  stepBType?: 'speak-your-mind' | 'grammar-tip' | 'pronunciation' | null, // Optional Step B type
  includeTranslation?: boolean | null, // Whether to include translations
  translationLanguage?: 'japanese' | 'korean' | 'vietnamese' | 'chinese' | null, // Translation language
  vocabularyCount?: number | null, // Current vocabulary count in editor (AI will generate this many)
  expressionCount?: number | null, // Current expression count in editor (AI will generate this many)
  applyType?: 'speaking' | 'listening' | 'reading' | null, // Apply activity type
  dialogueLineCount?: number | null, // Current dialogue line count in editor
  generateTrivia?: boolean | null, // Whether to generate standalone trivia content
  exerciseType?: string | null, // Exercise type (rephrase/choose/change or conversation/multiple-choice/speech/compare)
  exerciseStep?: 'stepA' | 'stepB' | null, // Exercise step (A or B)
  exerciseItemCount?: number | null, // Current exercise item count in editor
  missionType?: 'speaking' | 'discussion' | 'reading' | 'listening' | null, // Mission type
  missionQuestionCount?: number | null, // Current mission question count in editor
  isMission2?: boolean | null, // Whether this is mission 2 (challenge 2)
  storyData?: {
    enabled: boolean;
    storyTitle: string;
    characters: Array<{
      id: string;
      name: string;
      koreanName?: string;
      role: 'main' | 'supporting' | 'minor';
      description: string;
      personality?: string;
    }>;
    setting: string;
    previousSummary: string;
    currentPlotPoints: string[];
    storyNotes: string;
  } | null // Story data for K-Drama style generation
): Promise<GenerateIntroductionResult> => {
  try {
    // Map lesson level (1-10) to complexity descriptor
    const getComplexityLevel = (level?: number | null): string => {
      if (!level) return 'beginner to intermediate';
      if (level <= 2) return 'very simple and beginner-friendly';
      if (level <= 4) return 'simple beginner level';
      if (level <= 6) return 'intermediate level';
      if (level <= 8) return 'intermediate to advanced level';
      return 'advanced level';
    };

    const complexityDesc = getComplexityLevel(level);
    
    // Generate a variation seed to encourage different responses each time
    const variationSeed = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    
    // Build story context string for K-Drama style generation
    const buildStoryContext = (): string => {
      if (!storyData?.enabled) return '';
      
      const characterList = storyData.characters
        .map(c => `- ${c.name}${c.koreanName ? ` (${c.koreanName})` : ''}: ${c.role} character. ${c.description}${c.personality ? ` Personality: ${c.personality}` : ''}`)
        .join('\n');
      
      const plotPoints = storyData.currentPlotPoints
        .map((p, i) => `${i + 1}. ${p}`)
        .join('\n');
      
      return `
=== K-DRAMA STORY MODE (IMPORTANT!) ===
You are creating content for an immersive K-drama style learning experience.
The student interacts with the story characters but is NOT the protagonist.

Episode Title: "${storyData.storyTitle || 'Untitled Episode'}"
Setting: ${storyData.setting || 'Not specified'}

CHARACTERS:
${characterList || 'No characters defined yet - create appropriate characters based on the topic.'}

PREVIOUS EPISODE SUMMARY:
${storyData.previousSummary || 'This is the beginning of the story.'}

PLOT POINTS FOR THIS EPISODE:
${plotPoints || 'No specific plot points - create an engaging scenario based on the topic.'}

STORY NOTES:
${storyData.storyNotes || 'None'}

INSTRUCTIONS:
1. Use the characters defined above in dialogues and scenarios
2. Continue the story naturally from where the previous episode left off
3. Follow the plot points to create dramatic, engaging content
4. Make dialogues natural and emotionally engaging like a K-drama
5. The student's role is to interact with characters (ordering food, asking questions, etc.)
6. Include dramatic moments, misunderstandings, or emotional beats appropriate to the topic
`;
    };
    
    const storyContext = buildStoryContext();
    
    // Determine if translations should be included and which language
    const shouldIncludeTranslation = includeTranslation !== false; // Default to true
    const langName = {
      japanese: 'Japanese',
      korean: 'Korean',
      vietnamese: 'Vietnamese',
      chinese: 'Chinese (Simplified)',
    }[translationLanguage || 'japanese'] || 'Japanese';
    
    // If the request is specifically for Learn -> Vocabulary, generate a level-appropriate list
    if (learnType === 'vocabulary') {
      // Use provided vocabulary count if available, otherwise use level-based default
      const defaultVocabCount = (lvl?: number | null) => {
        const n = lvl || 1;
        if (n <= 1) return 6;
        if (n <= 4) return 8;
        return 10;
      };

      // If user has items in editor, use that count; otherwise use level-based default
      const count = vocabularyCount && vocabularyCount > 0 ? vocabularyCount : defaultVocabCount(level);
      const vocabFormat = shouldIncludeTranslation 
        ? '{ "word": "...", "partOfSpeech": "...", "meaning": "...", "translation": "..." }'
        : '{ "word": "...", "partOfSpeech": "...", "meaning": "..." }';
      const translationReq = shouldIncludeTranslation 
        ? `5. Include ${langName} translations for each vocabulary item.`
        : '';
      
      let prompt = `[Variation ID: ${variationSeed}] Generate exactly ${count} FRESH vocabulary items.

=== LESSON CONTEXT (IMPORTANT - vocabulary must support this goal) ===
Lesson Goal: "${lessonGoal || 'General English practice'}"
Topic: ${topic}
Level: ${level || 1} (${complexityDesc})

=== REQUIREMENTS ===
1. Choose vocabulary that students will NEED to achieve the lesson goal above.
2. Match complexity to Level ${level || 1} (${complexityDesc}).
3. Generate DIFFERENT words than previous requests - be creative and varied.
4. Meanings must be concise (max 10 words).
${translationReq}

Return ONLY JSON:
{ "vocabulary": [ ${vocabFormat} ] }`;

      if (customPrompt) prompt += `\nAdditional instructions: ${customPrompt}`;

      const resp = await vocabularyListAgent.generate(prompt);
      const text = resp.text || '';
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonContent = (jsonMatch?.[1] || text).trim();
      let parsed: any = { vocabulary: [] };
      try {
        parsed = JSON.parse(jsonContent);
      } catch (e) {
        console.error('Failed to parse vocabulary list response:', text);
        const lines = text.split(/\n+/).map((l: string) => l.trim()).filter(Boolean);
        parsed.vocabulary = lines.slice(0, count).map((l: string) => ({ word: l, partOfSpeech: '', meaning: '' }));
      }

      // Slice to the exact count requested to ensure we don't return more items than the editor has
      const vocab = (parsed.vocabulary || []).slice(0, count).map((v: any) => ({
        word: (v.word || '').toString(),
        partOfSpeech: (v.partOfSpeech || v.pos || '').toString(),
        meaning: (v.meaning || v.definition || '').toString(),
        translation: shouldIncludeTranslation ? (v.translation || '').toString() : undefined,
      }));

      return {
        introTexts: [],
        lessonIssue: { title: '', points: [] },
        lessonGoalDuration: '1 minute',
        lessonGoalSteps: [],
        learnVocabulary: vocab,
      };
    }

    // If the request is specifically for Learn -> Expressions, generate expressions list
    if (learnType === 'expressions') {
      // Use provided expression count if available, otherwise use level-based default
      const defaultExprCount = (lvl?: number | null) => {
        const n = lvl || 1;
        if (n <= 2) return 3;
        if (n <= 4) return 4;
        return 5;
      };

      // If user has items in editor, use that count; otherwise use level-based default
      const count = expressionCount && expressionCount > 0 ? expressionCount : defaultExprCount(level);
      const exprFormat = shouldIncludeTranslation 
        ? '{ "expression": "...", "definitionLine": "To <strong>...</strong> means...", "exampleSentence": "<em>...</em>", "translation": "plain text translation of the definition/explanation" }'
        : '{ "expression": "...", "definitionLine": "To <strong>...</strong> means...", "exampleSentence": "<em>...</em>" }';
      const translationReq = shouldIncludeTranslation 
        ? `6. Include ${langName} translations of the DEFINITION/EXPLANATION (NOT the expression itself) in the "translation" field. The translation must be PLAIN TEXT only - NO HTML tags.`
        : '';
      
      let prompt = `[Variation ID: ${variationSeed}] Generate exactly ${count} FRESH expressions/idioms.

=== LESSON CONTEXT (IMPORTANT - expressions must support this goal) ===
Lesson Goal: "${lessonGoal || 'General English practice'}"
Topic: ${topic}
Level: ${level || 1} (${complexityDesc})

=== REQUIREMENTS ===
1. Choose expressions that students will NEED to achieve the lesson goal above.
2. Match complexity to Level ${level || 1} (${complexityDesc}).
3. Generate DIFFERENT expressions than previous requests - be creative and varied.
4. definitionLine must include the expression wrapped in <strong> tags.
5. exampleSentence must be wrapped in <em> tags with the expression in <strong> tags.
${translationReq}

Return ONLY JSON:
{ "expressions": [ ${exprFormat} ] }`;

      if (customPrompt) prompt += `\nAdditional instructions: ${customPrompt}`;

      const resp = await expressionsListAgent.generate(prompt);
      const text = resp.text || '';
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonContent = (jsonMatch?.[1] || text).trim();
      let parsed: any = { expressions: [] };
      try {
        parsed = JSON.parse(jsonContent);
      } catch (e) {
        console.error('Failed to parse expressions list response:', text);
        parsed.expressions = [];
      }

      // Helper to strip HTML tags from translation fields (translations should be plain text)
      const stripHtml = (html: string) => html?.replace(/<[^>]*>/g, '') || '';

      const expressions = (parsed.expressions || []).slice(0, count).map((e: any) => ({
        expression: (e.expression || '').toString(),
        definitionLine: (e.definitionLine || e.definition || '').toString(),
        exampleSentence: (e.exampleSentence || e.example || '').toString(),
        translation: shouldIncludeTranslation ? stripHtml((e.translation || '').toString()) : undefined,
      }));

      return {
        introTexts: [],
        lessonIssue: { title: '', points: [] },
        lessonGoalDuration: '1 minute',
        lessonGoalSteps: [],
        learnExpressions: expressions,
      };
    }

    // If the request is for Step B content, generate based on stepBType
    if (stepBType) {
      const translationLangInstruction = shouldIncludeTranslation 
        ? `\n- Include ${langName} translations where applicable`
        : '\n- Do NOT include translations';
      
      let prompt = `Generate Step B content for an ESL lesson.
- Topic: ${topic}
- Lesson Goal: ${lessonGoal || ''}
- Level: ${level || 'unknown'} (complexity: ${complexityDesc})${translationLangInstruction}`;

      if (customPrompt) prompt += `\nAdditional instructions: ${customPrompt}`;

      if (stepBType === 'speak-your-mind') {
        const resp = await speakYourMindAgent.generate(prompt);
        const text = resp.text || '';
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonContent = (jsonMatch?.[1] || text).trim();
        let parsed: any = { speakYourMind: {} };
        try {
          parsed = JSON.parse(jsonContent);
        } catch (e) {
          console.error('Failed to parse speak-your-mind response:', text);
        }

        const sym = parsed.speakYourMind || {};
        return {
          introTexts: [],
          lessonIssue: { title: '', points: [] },
          lessonGoalDuration: '1 minute',
          lessonGoalSteps: [],
          stepB: {
            stepType: 'speak-your-mind',
            speakYourMind: {
              explanation: sym.explanation || '',
              speaker1SpeechBubble: sym.speaker1SpeechBubble || '',
              speaker2SpeechBubble: sym.speaker2SpeechBubble || '',
              question: sym.question || '',
            },
          },
        };
      }

      if (stepBType === 'grammar-tip') {
        const resp = await grammarTipAgent.generate(prompt);
        const text = resp.text || '';
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonContent = (jsonMatch?.[1] || text).trim();
        let parsed: any = { grammarTip: {} };
        try {
          parsed = JSON.parse(jsonContent);
        } catch (e) {
          console.error('Failed to parse grammar-tip response:', text);
        }

        // Helper to strip HTML tags from translation fields
        const stripHtml = (html: string) => html?.replace(/<[^>]*>/g, '') || '';

        const gt = parsed.grammarTip || {};
        return {
          introTexts: [],
          lessonIssue: { title: '', points: [] },
          lessonGoalDuration: '1 minute',
          lessonGoalSteps: [],
          stepB: {
            stepType: 'grammar-tip',
            grammarTip: {
              explanations: (gt.explanations || []).map((exp: any) => ({
                ruleText: exp.ruleText || '', // Keep HTML for rule text (rendered with RichTextInput)
                ruleTranslation: stripHtml(exp.ruleTranslation || ''), // Strip HTML from translation
                examples: (exp.examples || []).map((ex: any) => ({
                  sentence: ex.sentence || '', // Keep HTML for sentence (rendered with RichTextInput)
                  translation: stripHtml(ex.translation || ''), // Strip HTML from translation
                })),
              })),
            },
          },
        };
      }

      if (stepBType === 'pronunciation') {
        const resp = await stepBPronunciationAgent.generate(prompt);
        const text = resp.text || '';
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonContent = (jsonMatch?.[1] || text).trim();
        let parsed: any = { pronunciation: {} };
        try {
          parsed = JSON.parse(jsonContent);
        } catch (e) {
          console.error('Failed to parse pronunciation response:', text);
        }

        const pron = parsed.pronunciation || {};
        return {
          introTexts: [],
          lessonIssue: { title: '', points: [] },
          lessonGoalDuration: '1 minute',
          lessonGoalSteps: [],
          stepB: {
            stepType: 'pronunciation',
            pronunciation: {
              tip: pron.tip || '',
              phrases: (pron.phrases || []).map((p: any) => ({
                phrase: p.phrase || '',
                pronunciationGuide: p.pronunciationGuide || '',
                exampleSentence: p.exampleSentence || '',
              })),
            },
          },
        };
      }
    }

    // ========================================================================
    // APPLY SECTION GENERATION (Section 3)
    // ========================================================================
    if (applyType) {
      // Determine dialogue line count for speaking activities
      const defaultDialogueCount = (lvl?: number | null) => {
        const n = lvl || 1;
        if (n <= 2) return 6;
        if (n <= 4) return 8;
        if (n <= 6) return 10;
        return 12;
      };

      const dialogueCount = dialogueLineCount && dialogueLineCount > 0 ? dialogueLineCount : defaultDialogueCount(level);

      const translationInstruction = shouldIncludeTranslation
        ? `Include ${langName} translations for situationTranslation field.`
        : 'Do NOT include situationTranslation (leave it empty).';

      let applyPrompt = `[Variation ID: ${variationSeed}] Generate an ${applyType.toUpperCase()} activity for the Apply section.
${storyContext}
=== LESSON CONTEXT ===
Topic: ${topic}
Lesson Goal: "${lessonGoal || 'General English practice'}"
Level: ${level || 1} (${complexityDesc})
Skill Level: ${skillLevel}

=== REQUIREMENTS ===
1. Create content that helps students APPLY what they learned to achieve the lesson goal.
2. Match complexity to Level ${level || 1} (${complexityDesc}).
3. ${translationInstruction}
4. Use underlined words (<u>word</u>) for key vocabulary from the lesson.
${applyType === 'speaking' ? `5. Create exactly ${dialogueCount} dialogue lines between 2 characters.
6. Include some action lines like "(laughs)" or "(smiles)" marked with isAction: true.${storyContext ? '\n7. Use the STORY MODE characters and setting for the dialogue scene.' : ''}` : ''}
${applyType === 'listening' ? `5. Create a substantial listening script (150-250 words) that the tutor will read aloud.\n6. Include 2-3 comprehension questions with answers.${storyContext ? '\n7. Incorporate the STORY MODE characters and plot into the listening narrative.' : ''}` : ''}
${applyType === 'reading' ? `5. Create a reading passage (email, letter, or article) appropriate for the level.\n6. Include 2-3 comprehension questions with answers.${storyContext ? '\n7. Make the reading content relate to the STORY MODE characters and plot.' : ''}` : ''}

Return ONLY JSON in the format specified.`;

      if (customPrompt) applyPrompt += `\n\nAdditional instructions: ${customPrompt}`;

      let agent;
      if (applyType === 'speaking') {
        agent = applySpeakingAgent;
      } else if (applyType === 'listening') {
        agent = applyListeningAgent;
      } else {
        agent = applyReadingAgent;
      }

      const resp = await agent.generate(applyPrompt);
      const text = resp.text || '';
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonContent = (jsonMatch?.[1] || text).trim();
      let parsed: any = { applyData: {} };
      try {
        parsed = JSON.parse(jsonContent);
      } catch (e) {
        console.error('Failed to parse apply response:', text);
      }

      const apply = parsed.applyData || {};
      
      return {
        introTexts: [],
        lessonIssue: { title: '', points: [] },
        lessonGoalDuration: '1 minute',
        lessonGoalSteps: [],
        applyData: {
          activityType: applyType,
          activityDuration: apply.activityDuration || '3 minutes',
          situationText: apply.situationText || '',
          situationTranslation: shouldIncludeTranslation ? (apply.situationTranslation || '') : '',
          dialogueLines: (apply.dialogueLines || []).slice(0, dialogueCount).map((line: any) => ({
            speaker: line.speaker || '',
            text: line.text || '',
            isAction: line.isAction || false,
          })),
          readingText: apply.readingText || '',
          tutorSteps: (apply.tutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            tips: step.tips || [],
            questions: step.questions || [],
            listeningScript: step.listeningScript || '',
          })),
          // Trivia Time content
          triviaEnabled: apply.triviaEnabled !== false, // Default to true
          triviaText: apply.triviaText || '',
          triviaTranslation: shouldIncludeTranslation ? (apply.triviaTranslation || '') : '',
          triviaDuration: apply.triviaDuration || '1 minute',
          triviaTutorSteps: (apply.triviaTutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            questions: step.questions || [],
          })),
        },
      };
    }

    // ========================================================================
    // STANDALONE TRIVIA GENERATION
    // ========================================================================
    if (generateTrivia) {
      let triviaPrompt = `[Variation ID: ${variationSeed}] Generate a TRIVIA TIME segment for an ESL lesson.

CONTEXT:
- Lesson Topic: ${topic}
- Skill Level: ${skillLevel}
- Lesson Skill: ${skill}
${lessonGoal ? `- Lesson Goal: ${lessonGoal}` : ''}
${level ? `- Level: ${level} (${complexityDesc})` : ''}
${chapter ? `- Chapter: ${chapter}` : ''}
${lessonNumber ? `- Lesson Number: ${lessonNumber}` : ''}

REQUIREMENTS:
1. Create an interesting cultural fact, language tip, or fun fact related to the lesson topic.
2. Make it engaging and memorable - something students will want to share.
3. Keep it educational but fun (2-4 sentences).
4. Include thought-provoking follow-up questions for discussion.
${shouldIncludeTranslation ? `5. Include translation in ${langName}.` : '5. Do NOT include translations.'}

${customPrompt ? `ADDITIONAL NOTES: ${customPrompt}` : ''}
${baseInstructions ? `BASE INSTRUCTIONS: ${baseInstructions}` : ''}`;

      const triviaResponse = await triviaAgent.generate(triviaPrompt);
      const text = typeof triviaResponse.text === 'string' ? triviaResponse.text : '';
      
      // Parse JSON from response
      let parsed: any = {};
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonContent = jsonMatch ? jsonMatch[0] : text;
      
      try {
        parsed = JSON.parse(jsonContent);
      } catch (e) {
        console.error('Failed to parse trivia response:', text);
      }

      const trivia = parsed.triviaData || {};
      
      return {
        introTexts: [],
        lessonIssue: { title: '', points: [] },
        lessonGoalDuration: '1 minute',
        lessonGoalSteps: [],
        triviaData: {
          triviaText: trivia.triviaText || '',
          triviaTranslation: shouldIncludeTranslation ? (trivia.triviaTranslation || '') : '',
          triviaDuration: trivia.triviaDuration || '1 minute',
          triviaTutorSteps: (trivia.triviaTutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            questions: step.questions || [],
          })),
        },
      };
    }

    // ========================================================================
    // EXERCISE SECTION GENERATION (Section 4)
    // ========================================================================
    if (exerciseType && exerciseStep) {
      const itemCount = exerciseItemCount || 4; // Default to 4 items
      
      let exerciseAgent: Agent;
      let exercisePrompt = '';
      
      // Select appropriate agent based on exercise type and step
      if (exerciseStep === 'stepA') {
        if (exerciseType === 'rephrase') {
          exerciseAgent = exerciseRephraseAgent;
        } else if (exerciseType === 'choose') {
          exerciseAgent = exerciseChooseAgent;
        } else {
          exerciseAgent = exerciseChangeAgent;
        }
      } else {
        // Step B
        if (exerciseType === 'conversation') {
          exerciseAgent = exerciseConversationAgent;
        } else if (exerciseType === 'multiple-choice') {
          exerciseAgent = exerciseMultipleChoiceAgent;
        } else if (exerciseType === 'speech') {
          exerciseAgent = exerciseSpeechAgent;
        } else {
          exerciseAgent = exerciseCompareAgent;
        }
      }

      exercisePrompt = `[Variation ID: ${variationSeed}] Generate a ${exerciseType.toUpperCase()} exercise for ${exerciseStep === 'stepA' ? 'Step A' : 'Step B'} of the Exercise section.
${storyContext}
CONTEXT:
- Lesson Topic: ${topic}
- Skill Level: ${skillLevel}
- Lesson Skill: ${skill}
${lessonGoal ? `- Lesson Goal: ${lessonGoal}` : ''}
${level ? `- Level: ${level} (${complexityDesc})` : ''}
${chapter ? `- Chapter: ${chapter}` : ''}
${lessonNumber ? `- Lesson Number: ${lessonNumber}` : ''}

REQUIREMENTS:
1. Create exactly ${itemCount} exercise items${exerciseStep === 'stepA' ? ' with answer key' : ''}.
2. Content should reinforce vocabulary and grammar from the lesson.
3. Difficulty should match the level (${complexityDesc}).
4. Make exercises practical and relevant to the lesson topic.
${shouldIncludeTranslation ? `5. Include translations in ${langName} for instructions.` : '5. Do NOT include translations.'}
${storyContext ? '6. Use scenarios and dialogues involving the STORY MODE characters.' : ''}

${customPrompt ? `ADDITIONAL NOTES: ${customPrompt}` : ''}
${baseInstructions ? `BASE INSTRUCTIONS: ${baseInstructions}` : ''}`;

      const exerciseResponse = await exerciseAgent.generate(exercisePrompt);
      const text = typeof exerciseResponse.text === 'string' ? exerciseResponse.text : '';
      
      // Parse JSON from response
      let parsed: any = {};
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonContent = jsonMatch ? jsonMatch[0] : text;
      
      try {
        parsed = JSON.parse(jsonContent);
      } catch (e) {
        console.error('Failed to parse exercise response:', text);
      }

      // Handle both wrapped and unwrapped response formats
      const exercise = parsed.exerciseData || parsed || {};
      
      console.log('Exercise type:', exerciseType);
      console.log('Parsed exercise data keys:', Object.keys(exercise));
      console.log('changeItems:', exercise.changeItems);
      console.log('chooseItems:', exercise.chooseItems);
      console.log('exerciseItems:', exercise.exerciseItems);
      console.log('items:', exercise.items);
      
      // Extract items from AI response - check multiple possible field names
      const extractItems = (data: any, primaryKey: string): any[] => {
        // Check the primary key first
        if (data[primaryKey]?.length > 0) return data[primaryKey];
        // Check common fallback keys
        if (data.items?.length > 0) return data.items;
        if (data.exerciseItems?.length > 0) return data.exerciseItems;
        if (data.sentences?.length > 0) return data.sentences;
        return [];
      };

      // Get the appropriate items based on exercise type
      const rephraseItems = exerciseType === 'rephrase' ? extractItems(exercise, 'exerciseItems') : [];
      const chooseItemsArr = exerciseType === 'choose' ? extractItems(exercise, 'chooseItems') : [];
      const changeItemsArr = exerciseType === 'change' ? extractItems(exercise, 'changeItems') : [];
      
      return {
        introTexts: [],
        lessonIssue: { title: '', points: [] },
        lessonGoalDuration: '1 minute',
        lessonGoalSteps: [],
        exerciseData: {
          exerciseStep: exerciseStep,
          exerciseType: exerciseType,
          // Step A common fields
          instructions: exercise.instructions || '',
          instructionsTranslation: shouldIncludeTranslation ? (exercise.instructionsTranslation || '') : '',
          // Step A - Rephrase fields
          showExpressions: exercise.showExpressions || false,
          expressions: exercise.expressions || [],
          showExample: exercise.showExample || false,
          exampleSentence: exercise.exampleSentence || '',
          exampleAnswer: exercise.exampleAnswer || '',
          exerciseItems: rephraseItems.slice(0, itemCount).map((item: any) => ({
            sentence: typeof item === 'string' ? item : (item.sentence || item.text || ''),
          })),
          // Step A - Choose fields
          chooseItems: chooseItemsArr.slice(0, itemCount).map((item: any) => ({
            sentence: typeof item === 'string' ? item : (item.sentence || item.text || ''),
          })),
          // Step A - Change fields
          changeItems: changeItemsArr.slice(0, itemCount).map((item: any) => ({
            sentence: typeof item === 'string' ? item : (item.sentence || item.text || ''),
          })),
          // Answer key
          answers: (exercise.answers || []).slice(0, itemCount).map((answer: any) => ({
            text: typeof answer === 'string' ? answer : (answer.text || answer.answer || ''),
          })),
          // Tutor steps
          tutorSteps: (exercise.tutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            tips: step.tips || [],
            answerKey: step.answerKey || [],
          })),
          // Step B common fields
          stepBInstruction: exercise.stepBInstruction || '',
          stepBInstructionTranslation: shouldIncludeTranslation ? (exercise.stepBInstructionTranslation || '') : '',
          // Step B - Conversation fields
          conversations: (exercise.conversations || []).map((conv: any) => ({
            speechBubble: conv.speechBubble || '',
            position: conv.position || 'left',
          })),
          // Step B - Multiple Choice fields
          multipleChoiceItems: (exercise.multipleChoiceItems || []).map((item: any) => ({
            boldSentence: item.boldSentence || '',
            optionA: item.optionA || '',
            optionB: item.optionB || '',
          })),
          // Step B - Speech fields
          speechContent: exercise.speechContent || '',
          // Step B - Compare fields
          compareWordBox: exercise.compareWordBox || [],
          compareImages: (exercise.compareImages || []).map((img: any) => ({
            label: img.label || '',
          })),
          compareExample: exercise.compareExample || '',
          compareItems: (exercise.compareItems || []).map((item: any) => ({
            sentence: item.sentence || '',
          })),
          // Step B tutor steps
          stepBTutorSteps: (exercise.stepBTutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            tips: step.tips || [],
          })),
        },
      };
    }

    // ========================================================================
    // MISSION SECTION GENERATION (Section 5)
    // ========================================================================
    if (missionType) {
      const questionCount = missionQuestionCount || 6; // Default to 6 questions
      const challengeNum = isMission2 ? 2 : 1; // Challenge 1 or 2
      
      let missionAgent: Agent;
      
      // Select appropriate agent based on mission type
      if (missionType === 'speaking') {
        missionAgent = missionSpeakingAgent;
      } else if (missionType === 'discussion') {
        missionAgent = missionDiscussionAgent;
      } else if (missionType === 'reading') {
        missionAgent = missionReadingAgent;
      } else {
        missionAgent = missionListeningAgent;
      }

      const missionPrompt = `[Variation ID: ${variationSeed}] Generate a ${missionType.toUpperCase()} mission CHALLENGE ${challengeNum} for Section 5 (Mission).
${storyContext}
CONTEXT:
- Lesson Topic: ${topic}
- Skill Level: ${skillLevel}
- Lesson Skill: ${skill}
- Challenge Number: ${challengeNum}
${lessonGoal ? `- Lesson Goal: ${lessonGoal}` : ''}
${level ? `- Level: ${level} (${complexityDesc})` : ''}
${chapter ? `- Chapter: ${chapter}` : ''}
${lessonNumber ? `- Lesson Number: ${lessonNumber}` : ''}

REQUIREMENTS:
1. Create a ${missionType} challenge appropriate for the skill level.
2. ${missionType === 'speaking' || missionType === 'listening' ? `Generate exactly ${questionCount} roleplay questions with helpful hints.` : missionType === 'discussion' ? 'Generate 2-4 discussion topics with 2-4 questions each.' : 'Generate a reading passage with 4-6 comprehension questions.'}
3. Content should reinforce vocabulary and grammar from the lesson.
4. Difficulty should match the level (${complexityDesc}).
5. Make the scenario realistic and practical for language learners.
6. This is Challenge ${challengeNum}${isMission2 ? ' - create a DIFFERENT scenario from Challenge 1 with varied content and situations' : ''}.
${shouldIncludeTranslation ? `7. Include translations in ${langName} for situation and instruction.` : '7. Do NOT include translations.'}
${storyContext ? '8. The roleplay scenario should advance the STORY MODE plot and involve the characters.' : ''}

${customPrompt ? `ADDITIONAL NOTES: ${customPrompt}` : ''}
${baseInstructions ? `BASE INSTRUCTIONS: ${baseInstructions}` : ''}`;

      const missionResponse = await missionAgent.generate(missionPrompt);
      const text = typeof missionResponse.text === 'string' ? missionResponse.text : '';
      
      // Parse JSON from response
      let parsed: any = {};
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonContent = jsonMatch ? jsonMatch[0] : text;
      
      try {
        parsed = JSON.parse(jsonContent);
      } catch (e) {
        console.error('Failed to parse mission response:', text);
      }

      const mission = parsed.missionData || {};
      
      return {
        introTexts: [],
        lessonIssue: { title: '', points: [] },
        lessonGoalDuration: '1 minute',
        lessonGoalSteps: [],
        missionData: {
          missionType: missionType,
          sectionNumber: 5,
          sectionTitle: 'MISSION',
          challengeNumber: challengeNum,
          challengeName: mission.challengeName || `Challenge ${challengeNum}`,
          duration: mission.duration || '5-6 minutes',
          situation: mission.situation || '',
          situationTranslation: shouldIncludeTranslation ? (mission.situationTranslation || '') : '',
          instruction: mission.instruction || '',
          instructionTranslation: shouldIncludeTranslation ? (mission.instructionTranslation || '') : '',
          showGrammarTip: mission.showGrammarTip || false,
          grammarTipTitle: mission.grammarTipTitle || "Today's grammar tip",
          grammarTipItems: mission.grammarTipItems || [],
          image: '',
          tutorSteps: (mission.tutorSteps || []).map((step: any) => ({
            instruction: step.instruction || '',
            scripts: step.scripts || [],
            tips: step.tips || [],
            listeningScript: step.listeningScript || '',
          })),
          questionsIntro: mission.questionsIntro || '',
          questions: (mission.questions || []).slice(0, questionCount).map((q: any) => ({
            question: q.question || '',
            hints: q.hints || [],
          })),
          // Discussion type specific
          isOptional: mission.isOptional || false,
          topics: (mission.topics || []).map((topic: any) => ({
            title: topic.title || '',
            questions: topic.questions || [],
          })),
          // Reading type specific
          readingPassage: mission.readingPassage ? {
            title: mission.readingPassage.title || '',
            author: mission.readingPassage.author || '',
            blocks: (mission.readingPassage.blocks || []).map((block: any) => ({
              type: block.type || 'paragraph',
              text: block.text || '',
              image: block.image || '',
            })),
            closingQuestion: mission.readingPassage.closingQuestion || '',
          } : undefined,
          // Listening type specific
          listeningScript: mission.listeningScript || '',
        },
      };
    }
    
    // Determine which mode to use (default to 'improve' if current content exists, 'new' otherwise)
    const mode = generationMode || (currentContent ? 'improve' : 'new');

    // GENERATE NEW MODE: Create full introduction content
    if (mode === 'new') {
      // Build translation instructions
      const translationInstruction = shouldIncludeTranslation 
        ? `- INCLUDE TRANSLATIONS: Generate introTexts with BOTH English AND ${langName} translations
  * First object: { "language": "en", "text": "English intro..." }
  * Second object: { "language": "${translationLanguage || 'japanese'}", "text": "${langName} translation..." }`
        : `- Generate introTexts with ONLY English (no translations)
  * Single object: { "language": "en", "text": "English intro..." }`;

      let fullPrompt = `Generate introduction content for an ESL lesson:
- Topic/Lesson Name: ${topic}
- Skill Level: ${skillLevel}
- Primary Skill: ${skill}
- Lesson Level: ${level || 'unknown'} (out of 10)
- Complexity: ${complexityDesc}

REQUIREMENTS:
- Create engaging introduction text (2-3 sentences explaining the topic)
${translationInstruction}
${includeLessonIssue ? '- Create a lesson issue with SHORT title (max 5-7 words) and 3 bullet points (IN ENGLISH ONLY, do not translate)\n' : '- Do NOT create a lesson issue (set lessonIssue to null)\n'}
- Create 5 lesson goal steps with tutor scripts
- Step 4 question must be SHORT (max 15 words) about English learning
- All vocabulary should be appropriate for ${complexityDesc} students
- NO emoji or special characters
- Focus on practical English learning
- IMPORTANT: Base the intro on the lesson GOAL/OBJECTIVE, not just the lesson name
${lessonGoal ? `- Lesson Goal: ${lessonGoal}` : ''}`;

      if (chapter) fullPrompt += `\n- Chapter: ${chapter}`;
      if (lessonNumber) fullPrompt += `\n- Lesson Number: ${lessonNumber}`;
      if (baseInstructions) fullPrompt += `\n\nUser's specific instructions: ${baseInstructions}`;
      if (customPrompt) fullPrompt += `\n\nAdditional custom instructions: ${customPrompt}`;

      const response = await fullIntroductionGeneratorAgent.generate(fullPrompt);
      const content = response.text;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonContent = (jsonMatch?.[1] || content).trim();
      const result = JSON.parse(jsonContent);

      // Post-process introTexts to enforce level-based brevity
      if (result.introTexts && Array.isArray(result.introTexts)) {
        const truncateSentences = (text: string, maxSentences: number) => {
          if (!text) return '';
          const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
          return sentences
            .slice(0, maxSentences)
            .join(' ')
            .trim()
            .replace(/\s+/g, ' ');
        };

        const levelNum = level || 0;
        const maxSentences = levelNum === 1 ? 2 : levelNum <= 4 ? 3 : 4;

        result.introTexts = result.introTexts.map((item: any) => ({
          ...item,
          text: truncateSentences(item.text || '', maxSentences),
        }));
      }

      // Post-process lessonIssue to enforce brevity and English-only constraints for low levels
      const containsCJK = (s?: string | null) => !!s && /[\u3040-\u30ff\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(s);
      const cleanPhrase = (s: string) => s
        .replace(/^\s+|\s+$/g, '')
        .replace(/^(Today (you|we) will (learn|practice)\b[,\s:]*)/i, '')
        .replace(/^In this lesson[,\s]*/i, '')
        .replace(/[.?!]$/g, '')
        .replace(/\s+/g, ' ');
      const shortenToWords = (s: string, maxWords: number) => {
        if (!s) return '';
        const words = cleanPhrase(s).split(/\s+/).filter(Boolean);
        if (words.length <= maxWords) return words.join(' ');
        return words.slice(0, maxWords).join(' ');
      };

      if (!includeLessonIssue) {
        result.lessonIssue = null;
      } else if (result.lessonIssue) {
        // Normalize title and points
        const li = result.lessonIssue;
        // If the model returned non-Latin (CJK) or long phrasing, fallback to topic-based short title
        const levelNum = level || 0;

        if (containsCJK(li.title)) {
          // Fallback: derive short title from topic
          li.title = shortenToWords(topic || 'Lesson', Math.max(3, Math.min(4, levelNum <= 2 ? 4 : 7)));
        }

        if (levelNum <= 2) {
          if (levelNum === 1) {
            // Level 1: enforce a single short sentence and remove bullet points
            const source = li.title || (li.points && li.points[0]) || topic || 'Say hello';
            const firstSentence = cleanPhrase(source).split(/[\.\?!]/)[0] || source;
            li.title = shortenToWords(firstSentence, 8); // single short sentence (<= 8 words)
            li.title = li.title.replace(/[\.\?!]$/g, '');
            li.points = [];
          } else {
            // Level 2: very short title + short phrase points
            li.title = shortenToWords(cleanPhrase(li.title || ''), 4);
            li.points = (li.points || []).slice(0, 3).map((p: string) => {
              const short = shortenToWords(p || '', 6);
              return cleanPhrase(short);
            });
          }
        } else if (levelNum <= 4) {
          li.title = shortenToWords(cleanPhrase(li.title || ''), 5);
          li.points = (li.points || []).slice(0, 3).map((p: string) => cleanPhrase(p || ''));
        } else {
          li.title = shortenToWords(cleanPhrase(li.title || ''), 7);
          li.points = (li.points || []).slice(0, 3).map((p: string) => cleanPhrase(p || ''));
        }

        // Ensure English-only (basic guard): if any CJK chars remain, replace with topic-based fallback
        if (containsCJK(li.title) || li.points.some((p: string) => containsCJK(p))) {
          li.title = shortenToWords(topic || 'Lesson', Math.max(2, Math.min(4, levelNum <= 2 ? 4 : 7)));
          // Friendly, generic short points
          li.points = ['Say "Hi"', 'Smile', 'Ask name'];
        }

        // Final cleanup: remove trailing punctuation
        li.title = li.title.replace(/[.?!]$/g, '');
        li.points = li.points.map((p: string) => p.replace(/[.?!]$/g, ''));

        result.lessonIssue = li;
      }

      if (!result.lessonGoalSteps) {
        throw new Error('Invalid response structure - missing lessonGoalSteps');
      }

      // Enforce fixed scripts for steps 1, 2, 3, 5; only step 4 has generated script
      if (result.lessonGoalSteps && result.lessonGoalSteps.length >= 5) {
        result.lessonGoalSteps[0].script = null; // Step 1: no script
        result.lessonGoalSteps[1].script = "Is it clear?"; // Step 2: fixed script
        result.lessonGoalSteps[2].script = null; // Step 3: no script
        // Step 4 keeps its generated question script
        result.lessonGoalSteps[4].script = "Thank you, let's go to the next part."; // Step 5: fixed script
      }

      return result;
    }

    // IMPROVE EXISTING MODE: Only update Step 4 question
    let prompt = baseInstructions || `Generate a SHORT, practical opening question about the lesson topic:
- Topic/Lesson Name: ${topic}
- Skill Level: ${skillLevel}
- Primary Skill: ${skill}
- Lesson Level: ${level || 'unknown'} (out of 10)
- Complexity: ${complexityDesc}

CRITICAL REQUIREMENTS:
- Question must be VERY SHORT (1 sentence, max 10-15 words)
- DO NOT mention "English" or "learning" in the question
- Focus on real-world application of the skill, not about learning the language
- Make it practical and relevant to student life
- Use simple vocabulary for ${complexityDesc} students
- NO emoji or special characters
- Direct and easy to understand
- Encourages student response

Example formats by level (focus on the skill, not "English"):
- Level 1-2: "When would you greet someone new?" (practical scenario)
- Level 5-6: "How do you greet people you meet?" (real-world application)
- Level 9-10: "What greeting would you use in different situations?" (contextual use)`;

    // Add lesson context
    prompt += `\n\nLesson Context:
- Topic/Lesson Name: ${topic}
- Skill Level: ${skillLevel}
- Primary Skill: ${skill}
- Lesson Level: ${level || 'unknown'} (on scale of 1-10)
- Target Complexity: ${complexityDesc}`;

    if (chapter) prompt += `\n- Chapter: ${chapter}`;
    if (lessonNumber) prompt += `\n- Lesson Number: ${lessonNumber}`;

    // Add custom instructions if provided
    if (customPrompt) {
      prompt += `\n\nAdditional instructions from user: ${customPrompt}`;
    }

    const response = await introductionGeneratorAgent.generate(prompt);
    const content = response.text;

    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonContent = (jsonMatch?.[1] || content).trim();

    const result = JSON.parse(jsonContent);

    // Validate the response has the question field
    if (!result.question) {
      throw new Error('Invalid response structure - missing question field');
    }

    // Return the structure expected by the frontend, with the question as script in Step 4
    // If we have current content, preserve it and only update the Step 4 script
    if (currentContent && currentContent.lessonGoalSteps && currentContent.lessonGoalSteps.length >= 4) {
      return {
        introTexts: currentContent.introTexts || [],
        lessonIssue: currentContent.lessonIssue || { title: '', points: [] },
        lessonGoalDuration: currentContent.lessonGoalDuration || '1 minute',
        lessonGoalSteps: currentContent.lessonGoalSteps.map((step: any, index: number) => 
          index === 3 // Step 4 is at index 3 (0-indexed)
            ? { ...step, script: result.question }
            : step
        ),
      };
    }

    // If no current content, create a minimal structure with the question as script in Step 4
    return {
      introTexts: [],
      lessonIssue: { title: '', points: [] },
      lessonGoalDuration: '1 minute',
      lessonGoalSteps: [
        { instruction: 'Introduce the lesson topic.', script: null, question: null },
        { instruction: 'Read the lesson goal and ask if it\'s clear.', script: null, question: null },
        { instruction: 'Read the Introduce explanation.', script: null, question: null },
        { instruction: 'Ask the question below.', script: result.question, question: null },
        { instruction: 'Transition to the next section.', script: null, question: null },
      ],
    };
  } catch (error) {
    console.error('Failed to generate introduction content:', error);
    throw error;
  }
};
