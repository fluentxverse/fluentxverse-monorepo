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
3. Each entry must be: { "expression": "...", "definitionLine": "...", "exampleSentence": "..." }
3. The definitionLine should explain the expression with the expression itself in <strong> tags.
   Example: "To <strong>cost an arm and a leg</strong> means to be very expensive."
4. The exampleSentence should show usage in context with the expression in <strong> tags, wrapped in <em> for italics.
   Example: "<em>Staying at a five-star hotel will <strong>cost an arm and a leg</strong>.</em>"
5. Choose idiomatic expressions and phrases appropriate for the lesson level:
   - Level 1-2: 2-3 very common expressions (e.g., "nice to meet you", "how are you")
   - Level 3-4: 3-4 practical expressions and basic idioms
   - Level 5+: 4-5 idiomatic expressions and phrasal verbs
6. Respond ONLY in JSON with no extra commentary. Example:
{
  "expressions": [
    { "expression": "cost an arm and a leg", "definitionLine": "To <strong>cost an arm and a leg</strong> means to be very expensive.", "exampleSentence": "<em>Staying at a five-star hotel will <strong>cost an arm and a leg</strong>.</em>" }
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
  expressionCount?: number | null // Current expression count in editor (AI will generate this many)
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
        ? '{ "expression": "...", "definitionLine": "To <strong>...</strong> means...", "exampleSentence": "<em>...</em>", "translation": "..." }'
        : '{ "expression": "...", "definitionLine": "To <strong>...</strong> means...", "exampleSentence": "<em>...</em>" }';
      const translationReq = shouldIncludeTranslation 
        ? `6. Include ${langName} translations for each expression.`
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

      const expressions = (parsed.expressions || []).slice(0, count).map((e: any) => ({
        expression: (e.expression || '').toString(),
        definitionLine: (e.definitionLine || e.definition || '').toString(),
        exampleSentence: (e.exampleSentence || e.example || '').toString(),
        translation: shouldIncludeTranslation ? (e.translation || '').toString() : undefined,
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
