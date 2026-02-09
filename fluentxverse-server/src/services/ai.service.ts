/**
 * AI Service - Grammar Checking and Language Assistance
 * Uses Mastra Agent with OpenAI for grammar correction and explanations
 */
import { Agent } from "@mastra/core/agent";

// ============================================================================
// HELPERS
// ============================================================================

/** Strip em dashes (—) and en dashes (–) from AI output, replacing with regular dashes */
function sanitizeAIText(text: string): string {
  return text.replace(/—/g, '-').replace(/–/g, '-');
}

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
  model: "openai/gpt-5.2",
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
  model: "openai/gpt-5.2",
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
  model: "openai/gpt-5.2",
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
  model: "openai/gpt-5.2",
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
  model: 'openai/gpt-5.2',
  instructions: `You are an expert ESL vocabulary curriculum designer. Generate vocabulary that students DON'T already know - things they need to LEARN, not words everyone knows.

=== CRITICAL: AVOID OBVIOUS WORDS ===
NEVER generate basic words that ALL English learners already know:
- ❌ "hello", "hi", "bye", "goodbye" (everyone knows these)
- ❌ "name", "friend", "teacher" (too basic)
- ❌ "say hello", "say goodbye" (obvious)
- ❌ "yes", "no", "please", "thank you" (universal)
- ❌ Single pronouns or fragments (I, you, I'm, you're)

=== WHAT TO GENERATE INSTEAD ===
Generate USEFUL phrases and vocabulary that TEACH something new:

1. COMPLETE QUESTION PATTERNS (40% of items):
   - "How are you doing?" (not just "how are you")
   - "What's your name?" (complete question)
   - "Where are you from?"
   - "What do you do?" (asking about job/occupation)
   - "How do you spell that?"

2. COMPLETE RESPONSE PATTERNS (30% of items):
   - "I'm from [country]" 
   - "Nice to meet you too"
   - "I'm doing well, thanks"
   - "My name is..." / "You can call me..."
   - "I work as a..."

3. SITUATIONAL PHRASES students need to learn (30% of items):
   - "Let me introduce myself"
   - "Have we met before?"
   - "It's a pleasure to meet you" (formal)
   - "See you around"
   - "Keep in touch"

=== LEVEL GUIDELINES ===
- Level 1-2 (Beginner): Common but complete phrases
  ✓ "How are you doing?", "Nice to meet you too", "I'm from...", "What's your name?"
  
- Level 3-4 (Intermediate): More varied expressions
  ✓ "It's a pleasure", "Let me introduce myself", "How do you know each other?"
  
- Level 5+ (Advanced): Formal/nuanced expressions
  ✓ "How do you do?", "Allow me to introduce myself", "We've crossed paths before"

=== OUTPUT FORMAT ===
Return ONLY valid JSON:
{
  "vocabulary": [
    { "word": "How are you doing?", "partOfSpeech": "phrase", "meaning": "Friendly way to ask about someone's condition" },
    { "word": "Nice to meet you too", "partOfSpeech": "phrase", "meaning": "Response when someone says nice to meet you" },
    { "word": "I'm from...", "partOfSpeech": "phrase", "meaning": "Used to tell someone your country or city" },
    { "word": "What do you do?", "partOfSpeech": "phrase", "meaning": "Asking about someone's job or occupation" }
  ]
}

REMEMBER: If a 5-year-old knows the word, DON'T include it. Generate phrases that TEACH something useful!`
});

// ============================================================================
// AI AGENT FOR EXPRESSIONS LISTS (Learn -> Step A Expressions)
// ============================================================================

const expressionsListAgent = new Agent({
  name: 'Expressions List Generator',
  model: 'openai/gpt-5.2',
  instructions: `You are an expert ESL expressions curriculum designer. Generate USEFUL idiomatic expressions, phrasal verbs, and set phrases that students need to LEARN - not basic phrases everyone knows.

=== CRITICAL: AVOID OBVIOUS EXPRESSIONS ===
NEVER generate basic expressions that ALL English learners already know:
- ❌ "nice to meet you", "how are you", "thank you very much"
- ❌ "good morning", "good night", "see you later"
- ❌ "I'm sorry", "excuse me", "you're welcome"
- ❌ Any phrase a beginner would learn in their first week

=== WHAT TO GENERATE INSTEAD ===
Generate expressions that TEACH something new and interesting:

1. IDIOMATIC EXPRESSIONS (phrases with non-literal meanings):
   - "break the ice" (start a conversation in an awkward situation)
   - "hit it off" (immediately become friends)
   - "get along with" (have a good relationship)
   - "make a good impression" (create a positive first image)

2. PHRASAL VERBS (verb + preposition combinations):
   - "warm up to someone" (gradually start to like someone)
   - "open up" (share personal feelings)
   - "reach out to" (contact someone)
   - "catch up with" (talk after not seeing someone)

3. CONVERSATIONAL EXPRESSIONS:
   - "I didn't catch your name" (polite way to ask name again)
   - "What brings you here?" (why are you at this event)
   - "How do you two know each other?" (asking about relationships)
   - "It's on the tip of my tongue" (almost remembering something)

4. SOCIAL EXPRESSIONS:
   - "Let's keep in touch" (stay connected after meeting)
   - "Feel free to..." (giving permission politely)
   - "I'm looking forward to..." (expressing anticipation)
   - "It was lovely meeting you" (formal goodbye)

=== LEVEL GUIDELINES ===
- Level 1-2: Common but NON-OBVIOUS expressions
  ✓ "break the ice", "get along with", "I didn't catch that"
  
- Level 3-4: More nuanced expressions and phrasal verbs
  ✓ "hit it off", "warm up to", "make small talk"
  
- Level 5+: Sophisticated idioms and subtle expressions
  ✓ "rub someone the wrong way", "have a lot in common", "strike up a conversation"

=== OUTPUT FORMAT ===
Each expression needs:
- definitionLine: Explain with expression in <strong> tags
- exampleSentence: Real usage in <em> tags with expression in <strong> tags
- translation: PLAIN TEXT translation of the explanation (NO HTML)

Example:
{
  "expressions": [
    {
      "expression": "break the ice",
      "definitionLine": "To <strong>break the ice</strong> means to do or say something to make people feel more comfortable in a social situation.",
      "exampleSentence": "<em>I told a joke to <strong>break the ice</strong> at the party.</em>",
      "translation": "社交的な場面で人々をリラックスさせるために何かをしたり言ったりすること。"
    }
  ]
}

REMEMBER: If students learned it in their first English class, DON'T include it!`
});

// ============================================================================
// AI AGENT FOR STEP B: SPEAK YOUR MIND
// ============================================================================

const speakYourMindAgent = new Agent({
  name: 'Speak Your Mind Generator',
  model: 'openai/gpt-5.2',
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
  model: 'openai/gpt-5.2',
  instructions: `You are an expert ESL grammar teacher. Generate a "Grammar Tip" section that teaches USEFUL grammar patterns related to the lesson topic.

=== IMPORTANT RULES ===
1. Generate 2-3 different grammar explanations (not just one!)
2. Example sentences should be SIMPLE, STANDALONE sentences - NOT dialogues
3. Do NOT use "A:" or "B:" in examples - just write clean sentences

=== EXAMPLE FORMAT (CORRECT) ===
{
  "grammarTip": {
    "explanations": [
      {
        "ruleText": "Use <em>Nice to meet you</em> when meeting someone for the FIRST time.",
        "ruleTranslation": "初めて会う人には「Nice to meet you」を使います。",
        "examples": [
          { "sentence": "<strong>Nice to meet you</strong>, Sarah!", "translation": "はじめまして、サラ！" },
          { "sentence": "It's <strong>nice to meet you</strong> finally.", "translation": "やっとお会いできてうれしいです。" }
        ]
      },
      {
        "ruleText": "Use <em>Nice to see you</em> when meeting someone you ALREADY know.",
        "ruleTranslation": "すでに知っている人には「Nice to see you」を使います。",
        "examples": [
          { "sentence": "<strong>Nice to see you</strong> again!", "translation": "また会えてうれしい！" },
          { "sentence": "It's always <strong>nice to see you</strong>.", "translation": "いつも会えてうれしいです。" }
        ]
      }
    ]
  }
}

=== WRONG FORMAT (DO NOT DO THIS) ===
❌ "sentence": "A: Hi! B: Nice to meet you." (No dialogue format!)
❌ Only generating 1 explanation (Generate 2-3!)

=== OUTPUT REQUIREMENTS ===
- Generate 2-3 grammar explanations per request
- Each explanation needs 2-3 example sentences
- Examples must be simple standalone sentences (NOT dialogues)
- ruleText/sentence can use <em> and <strong> HTML tags
- ruleTranslation/translation must be PLAIN TEXT only (no HTML)
- Make the grammar RELEVANT to the lesson topic`
});

// ============================================================================
// AI AGENT FOR STEP B: PRONUNCIATION
// ============================================================================

const stepBPronunciationAgent = new Agent({
  name: 'Pronunciation Lesson Generator',
  model: 'openai/gpt-5.2',
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
- EVERY dialogue line MUST contain actual spoken words. Never create a line that only has an action or emotion like "(laughs)" or "(smiles)" with no dialogue.
- If you want to include an action/emotion, append it to a line that also has spoken dialogue, e.g. "That's hilarious! (laughs)" with isAction: false. Or place the action inline within the spoken text.
- Only set isAction: true for stage directions that genuinely have NO spoken words AND are essential to the scene (this should be extremely rare — avoid it whenever possible).
- NEVER make the dialogue about spelling, names, introductions at a desk, auditions, or check-ins. The dialogue topic must NOT revolve around meeting someone new and exchanging names. Instead, create scenarios like: hanging out with a friend, planning a trip, talking about weekend plans, discussing food, shopping, giving directions, etc. Even if the lesson expressions include greetings like "Nice to meet you" or "How do you spell that?", weave them naturally into a more interesting scenario — do NOT build the entire scene around introductions or spelling.
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
      { "speaker": "Character1", "text": "Ha, that's so true! I totally agree.", "isAction": false }
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

CRITICAL RULE - READ CAREFULLY:
- Names may appear in sentences only where they make logical sense (e.g., self-introductions like "My name is ..."). But NEVER have a speaker ask about something they already stated (e.g., asking to spell their own name).
  - NEVER: "My name is Ji-ho. Can you tell me the spelling of Ji-ho?" (Ji-ho already knows their own name)
  - CORRECT: "My name is Jihyun. <u>How do you spell your name?</u>" (asking the other person)
  - CORRECT: "<u>Can you tell me the spelling of your name?</u>"
- Use a DIVERSE MIX of names from different backgrounds: Korean (e.g., Jihyun, Minho, Soyeon), Vietnamese (e.g., Linh, Minh, Hoa, Tuan, Mai), and Japanese (e.g., Yuki, Haruto, Sakura, Ren, Aoi). Do NOT use only Korean names.
- Every sentence must make logical sense from the speaker's perspective. The speaker should never ask about something they already know.

IMPORTANT GUIDELINES:
- Create clear, context-appropriate sentences that need rephrasing
- The sentences should use slightly awkward, wordy, or unnatural phrasing so it makes sense to rephrase them with a better expression
- Use <u> tags to underline the SPECIFIC PART of the sentence that should be rephrased
  - If only part of the sentence needs rephrasing, underline just that part
  - If the entire sentence is one short phrase that needs rephrasing, underline the whole sentence
- The example sentence and answer should also use <u> tags on the part being rephrased
- Write PLAIN, SIMPLE sentences only:
  - NO parenthetical scene descriptions like "(at the office)" or "(while cooking)"
  - NO "Name asks:" or "Name says:" prefixes like "Jiwoo asks: Where are you from?"
  - NO dialogue attribution of any kind
  - NO pronouns (like "that", "this", "it") without a clear reference within the same sentence. Each sentence must be self-contained and understandable on its own.
  - NO narrative or descriptive context before the sentence. Write ONLY what the person actually says.
    - WRONG: "Min-jun bowed slightly. I'm pleased to meet you for the first time."
    - WRONG: "Seo-yeon looked worried. How is your life these days?"
    - CORRECT: "<u>I'm pleased to meet you for the first time.</u>"
    - CORRECT: "<u>How is your life these days?</u>"
  - Just write a standalone sentence as if someone is naturally speaking
- The number of expressions in the word box must EXACTLY match the number of exercise items. If there are 4 sentences, provide exactly 4 expressions - one per sentence. No extras.
- Provide example with original sentence and rephrased version
- Generate answer key for tutor reference

EXAMPLES:
- WRONG sentence: "I'm happy to meet you." (no underline - student doesn't know what to rephrase)
- CORRECT sentence: "<u>I'm happy to meet you.</u>" (underlined part gets rephrased)
- CORRECT sentence: "<u>What place are you from?</u>" (whole short sentence underlined)
- CORRECT example: "ex. <u>How are you today?</u>" → "How are you doing?"

Respond ONLY in JSON format:
{
  "exerciseData": {
    "stepAType": "rephrase",
    "instructions": "Rephrase the underlined part of the sentences using the expressions in the box.",
    "instructionsTranslation": "Translation of instructions",
    "showExpressions": true,
    "expressions": ["expression 1", "expression 2", "expression 3"],
    "showExample": true,
    "exampleSentence": "ex. <u>How are you today?</u>",
    "exampleAnswer": "How are you doing?",
    "exerciseItems": [
      { "sentence": "<u>I'm happy to meet you.</u>" },
      { "sentence": "<u>I'm happy to meet you too.</u>" },
      { "sentence": "<u>What place are you from?</u>" }
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
  } | null, // Story data for K-Drama style generation
  currentLearnData?: {
    steps?: Array<{
      id: string;
      label: string;
      items?: Array<{
        foreign: string;
        foreignLabel?: string;
        native: string;
        audio?: string;
        image?: string;
      }>;
    }>;
    stepBType?: string | {
      format?: string;
      type?: string;
      items?: Array<{
        foreign: string;
        foreignLabel?: string;
        native: string;
        audio?: string;
        image?: string;
      }>;
    };
    grammarTip?: {
      title?: string;
      content?: string;
      items?: Array<{
        pattern?: string;
        explanation?: string;
        example?: string;
      }>;
    };
  } | null // Learn section data for cross-section cohesion
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
    
    // Build context from Learn section for cross-section cohesion (Apply, Exercise, Mission)
    const buildLearnContext = (): string => {
      if (!currentLearnData) return '';
      
      const parts: string[] = [];
      
      // Extract vocabulary items from Step A
      if (currentLearnData.steps && currentLearnData.steps.length > 0) {
        const vocabularyItems: string[] = [];
        const expressionItems: string[] = [];
        
        for (const step of currentLearnData.steps) {
          if (step.items && step.items.length > 0) {
            const isVocabulary = step.label.toLowerCase().includes('vocab');
            const isExpression = step.label.toLowerCase().includes('express');
            
            for (const item of step.items) {
              if (isVocabulary) {
                vocabularyItems.push(`- ${item.foreign} (${item.native})`);
              } else if (isExpression) {
                expressionItems.push(`- ${item.foreign} (${item.native})`);
              } else {
                // Default to vocabulary if label doesn't specify
                vocabularyItems.push(`- ${item.foreign} (${item.native})`);
              }
            }
          }
        }
        
        if (vocabularyItems.length > 0) {
          parts.push(`VOCABULARY FROM LEARN SECTION:\n${vocabularyItems.join('\n')}`);
        }
        if (expressionItems.length > 0) {
          parts.push(`EXPRESSIONS FROM LEARN SECTION:\n${expressionItems.join('\n')}`);
        }
      }
      
      // Extract Step B items (Speak Your Mind, Grammar Tip, Pronunciation)
      // stepBType can be a string or an object with items
      if (typeof currentLearnData.stepBType === 'object' && currentLearnData.stepBType?.items && currentLearnData.stepBType.items.length > 0) {
        const stepBItems = currentLearnData.stepBType.items
          .map(item => `- ${item.foreign} (${item.native})`)
          .join('\n');
        const stepBTypeStr = currentLearnData.stepBType.type || '';
        const stepBLabel = stepBTypeStr === 'speak-your-mind' ? 'SPEAK YOUR MIND PHRASES' :
                          stepBTypeStr === 'pronunciation' ? 'PRONUNCIATION FOCUS' :
                          'ADDITIONAL ITEMS';
        parts.push(`${stepBLabel} FROM LEARN SECTION:\n${stepBItems}`);
      }
      
      // Extract Grammar Tip - handle both content string and items array formats
      if (currentLearnData.grammarTip?.title) {
        let grammarContent = '';
        
        if (currentLearnData.grammarTip.content) {
          grammarContent = `Explanation: ${currentLearnData.grammarTip.content}`;
        } else if (currentLearnData.grammarTip.items && currentLearnData.grammarTip.items.length > 0) {
          grammarContent = currentLearnData.grammarTip.items
            .map(item => {
              const parts = [];
              if (item.pattern) parts.push(`Pattern: ${item.pattern}`);
              if (item.explanation) parts.push(`Explanation: ${item.explanation}`);
              if (item.example) parts.push(`Example: ${item.example}`);
              return parts.join('\n');
            })
            .join('\n\n');
        }
        
        if (grammarContent) {
          parts.push(`GRAMMAR RULE FROM LEARN SECTION:
Title: ${currentLearnData.grammarTip.title}
${grammarContent}

IMPORTANT: Create content that allows students to PRACTICE this grammar pattern. The exercises and scenarios should require using this grammar structure.`);
        }
      }
      
      if (parts.length === 0) return '';
      
      return `
=== CROSS-SECTION COHESION (IMPORTANT!) ===
The student has already learned the following vocabulary, expressions, and grammar rules in the LEARN section.
Your generated content should help them PRACTICE and APPLY what they learned.

${parts.join('\n\n')}

INSTRUCTIONS FOR COHESION:
1. Use the vocabulary and expressions from above naturally in dialogues and scenarios
2. If a grammar rule is provided, create sentences/questions that require using that grammar pattern
3. Don't just repeat the items - create realistic situations where students must use them
4. The goal is reinforcement through practice, not repetition of definitions
`;
    };
    
    const learnContext = buildLearnContext();
    
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
        ? `6. Include ${langName} translations for each vocabulary item.`
        : '';
      
      let prompt = `[Variation ID: ${variationSeed}] Generate exactly ${count} USEFUL vocabulary items that students need to LEARN.

=== LESSON CONTEXT ===
Topic: "${topic}"
Lesson Goal: "${lessonGoal || 'General English practice'}"
Level: ${level || 1} (${complexityDesc})

=== CRITICAL: WHAT NOT TO GENERATE ===
DO NOT include basic words everyone already knows:
- ❌ "hello", "hi", "bye", "goodbye", "name", "friend"
- ❌ "yes", "no", "please", "thank you"
- ❌ Single words that are obvious

=== WHAT TO GENERATE ===
Generate COMPLETE PHRASES that teach something useful:
- ✓ Question patterns: "What's your name?", "Where are you from?", "What do you do?"
- ✓ Response patterns: "Nice to meet you too", "I'm from...", "I work as..."
- ✓ Situational phrases: "Let me introduce myself", "Have we met before?"

Every item should make a student think "Oh, THAT'S how you say that in English!"

=== REQUIREMENTS ===
1. Focus on COMPLETE, USEFUL phrases - not single obvious words.
2. Match complexity to Level ${level || 1} (${complexityDesc}).
3. Meanings must be concise (max 10 words).
4. Each item must teach something NEW to the student.
${translationReq}

Return ONLY JSON:
{ "vocabulary": [ ${vocabFormat} ] }`;

      if (customPrompt) prompt += `\n\nAdditional context: ${customPrompt}`;

      const resp = await vocabularyListAgent.generate(prompt);
      const text = resp.text || '';
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonContent = sanitizeAIText((jsonMatch?.[1] || text).trim());
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
      
      let prompt = `[Variation ID: ${variationSeed}] Generate exactly ${count} USEFUL expressions that students need to LEARN.

=== LESSON CONTEXT ===
Topic: "${topic}"
Lesson Goal: "${lessonGoal || 'General English practice'}"
Level: ${level || 1} (${complexityDesc})

=== CRITICAL: WHAT NOT TO GENERATE ===
DO NOT include basic expressions everyone already knows:
- ❌ "nice to meet you", "how are you", "thank you"
- ❌ "good morning", "see you later", "excuse me"
- ❌ Any phrase learned in the first week of English class

=== WHAT TO GENERATE ===
Generate INTERESTING expressions that teach something new:
- ✓ Idioms: "break the ice", "hit it off", "make a good impression"
- ✓ Phrasal verbs: "warm up to", "reach out to", "catch up with"
- ✓ Useful phrases: "I didn't catch your name", "What brings you here?"

Every expression should make a student think "Oh, THAT'S how native speakers say that!"

=== FORMAT REQUIREMENTS ===
1. definitionLine: Explain the expression with it wrapped in <strong> tags
2. exampleSentence: Show real usage in <em> tags with expression in <strong> tags
3. Make examples feel natural - like real conversations
${translationReq}

Return ONLY JSON:
{ "expressions": [ ${exprFormat} ] }`;

      if (customPrompt) prompt += `\n\nAdditional context: ${customPrompt}`;

      const resp = await expressionsListAgent.generate(prompt);
      const text = resp.text || '';
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonContent = sanitizeAIText((jsonMatch?.[1] || text).trim());
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
      
      let basePrompt = `Generate Step B content for an ESL lesson.
- Topic: ${topic}
- Lesson Goal: ${lessonGoal || ''}
- Level: ${level || 'unknown'} (complexity: ${complexityDesc})${translationLangInstruction}`;

      if (customPrompt) basePrompt += `\nAdditional instructions: ${customPrompt}`;

      if (stepBType === 'speak-your-mind') {
        const resp = await speakYourMindAgent.generate(basePrompt);
        const text = resp.text || '';
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonContent = sanitizeAIText((jsonMatch?.[1] || text).trim());
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
        // Create a more specific prompt for grammar tips
        const grammarPrompt = `Generate a Grammar Tip for an ESL lesson about "${topic}".

Lesson Goal: ${lessonGoal || 'General English practice'}
Level: ${level || 1} (${complexityDesc})
${shouldIncludeTranslation ? `Include ${langName} translations for rule explanations and examples.` : 'Do NOT include translations.'}

=== REQUIREMENTS ===
1. Generate 2-3 different grammar explanations (NOT just one!)
2. Each explanation needs 2-3 example sentences
3. Example sentences must be SIMPLE STANDALONE sentences - NOT dialogues
4. Do NOT use "A:" or "B:" format in examples - just write clean sentences

Create grammar rules that help students achieve the lesson goal. The grammar should be DIRECTLY USEFUL for the topic.
${customPrompt ? `Additional notes: ${customPrompt}` : ''}`;

        const resp = await grammarTipAgent.generate(grammarPrompt);
        const text = resp.text || '';
        console.log('Grammar Tip raw response:', text); // Debug log
        
        // Try to extract JSON - handle both with and without code blocks
        let jsonContent = text;
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonContent = jsonMatch[1].trim();
        } else {
          // Try to find raw JSON object
          const rawJsonMatch = text.match(/\{[\s\S]*\}/);
          if (rawJsonMatch) {
            jsonContent = sanitizeAIText(rawJsonMatch[0]);
          }
        }
        
        let parsed: any = { grammarTip: {} };
        try {
          parsed = JSON.parse(jsonContent);
          console.log('Grammar Tip parsed:', JSON.stringify(parsed, null, 2)); // Debug log
        } catch (e) {
          console.error('Failed to parse grammar-tip response:', text);
          console.error('Attempted to parse:', jsonContent);
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
        const resp = await stepBPronunciationAgent.generate(basePrompt);
        const text = resp.text || '';
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonContent = sanitizeAIText((jsonMatch?.[1] || text).trim());
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
${learnContext}
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
6. EVERY line must contain actual spoken dialogue. Do NOT create lines that only contain actions or emotions like "(laughs)" with no spoken words. If you want to show emotion, weave it into the spoken text (e.g. "Ha, that's amazing!").${storyContext ? '\n7. Use the STORY MODE characters and setting for the dialogue scene.' : ''}` : ''}
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
      const jsonContent = sanitizeAIText((jsonMatch?.[1] || text).trim());
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
      const jsonContent = sanitizeAIText(jsonMatch ? jsonMatch[0] : text);
      
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
    console.log('[EXERCISE DEBUG] exerciseType:', exerciseType, '| exerciseStep:', exerciseStep, '| condition:', !!(exerciseType && exerciseStep));
    if (exerciseType && exerciseStep) {
      console.log('[EXERCISE DEBUG] Entered exercise generation block');
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
${learnContext}
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
      console.log('[EXERCISE DEBUG] Raw AI response length:', text.length);
      console.log('[EXERCISE DEBUG] Raw AI response (first 500 chars):', text.substring(0, 500));
      
      // Parse JSON from response - try code fence extraction first, then raw JSON
      let parsed: any = {};
      const codeFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const rawJsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonContent = sanitizeAIText(
        codeFenceMatch?.[1]?.trim() || (rawJsonMatch ? rawJsonMatch[0] : text)
      );
      console.log('[EXERCISE DEBUG] JSON extraction method:', codeFenceMatch ? 'code-fence' : (rawJsonMatch ? 'raw-json' : 'fallback'));
      
      try {
        parsed = JSON.parse(jsonContent);
        console.log('[EXERCISE DEBUG] JSON parsed successfully, keys:', Object.keys(parsed));
      } catch (e) {
        console.error('[EXERCISE DEBUG] Failed to parse exercise response:', text);
        console.error('[EXERCISE DEBUG] Parse error:', e);
      }

      // Handle both wrapped and unwrapped response formats
      const exercise = parsed.exerciseData || parsed || {};
      
      console.log('[EXERCISE DEBUG] Exercise type:', exerciseType, '| Parsed data keys:', Object.keys(exercise));
      console.log('[EXERCISE DEBUG] exerciseItems:', exercise.exerciseItems?.length, '| chooseItems:', exercise.chooseItems?.length, '| changeItems:', exercise.changeItems?.length, '| items:', exercise.items?.length);
      
      // Extract items from AI response - check multiple possible field names
      const extractItems = (data: any, primaryKey: string): any[] => {
        // Check the primary key first
        if (data[primaryKey]?.length > 0) return data[primaryKey];
        // Check common fallback keys
        if (data.items?.length > 0) return data.items;
        if (data.exerciseItems?.length > 0) return data.exerciseItems;
        if (data.chooseItems?.length > 0) return data.chooseItems;
        if (data.changeItems?.length > 0) return data.changeItems;
        if (data.sentences?.length > 0) return data.sentences;
        if (data.questions?.length > 0) return data.questions;
        return [];
      };

      // Get the appropriate items based on exercise type
      const rephraseItems = exerciseType === 'rephrase' ? extractItems(exercise, 'exerciseItems') : [];
      const chooseItemsArr = exerciseType === 'choose' ? extractItems(exercise, 'chooseItems') : [];
      const changeItemsArr = exerciseType === 'change' ? extractItems(exercise, 'changeItems') : [];
      
      console.log('[EXERCISE DEBUG] Final items count - rephrase:', rephraseItems.length, 'choose:', chooseItemsArr.length, 'change:', changeItemsArr.length);
      console.log('[EXERCISE DEBUG] Returning exerciseData with step:', exerciseStep, 'type:', exerciseType);
      
      // Build the answer key from the answers array
      const answersArr = (exercise.answers || []).slice(0, itemCount).map((answer: any) => ({
        text: typeof answer === 'string' ? answer : (answer.text || answer.answer || ''),
      }));
      
      // Build tutor steps and inject answerKey into the appropriate step
      const rawTutorSteps = (exercise.tutorSteps || []).map((step: any) => ({
        instruction: step.instruction || '',
        scripts: step.scripts || [],
        tips: step.tips || [],
        // Use undefined (not []) when empty, so the "Add Answer Key" button shows in the editor
        answerKey: step.answerKey?.length > 0 ? step.answerKey : undefined,
      }));
      
      // For Step A exercises, inject the answer key into the tutor steps
      // Find the best step to attach it to (one that mentions answers/corrections/repeat)
      // or add a dedicated answer key step
      if (exerciseStep === 'stepA' && answersArr.length > 0 && rawTutorSteps.length > 0) {
        // Look for a step that mentions checking answers, correcting, or repeating with remaining
        const answerStepIdx = rawTutorSteps.findIndex((s: any) => 
          /repeat|remaining|correct|answer|check|rephrase|choose|change/i.test(s.instruction)
        );
        
        if (answerStepIdx >= 0 && (!rawTutorSteps[answerStepIdx].answerKey || rawTutorSteps[answerStepIdx].answerKey.length === 0)) {
          // Inject into the matching step
          rawTutorSteps[answerStepIdx].answerKey = answersArr;
        } else {
          // No matching step found or it already has answers - insert a dedicated step before the last one (transition step)
          const insertIdx = Math.max(rawTutorSteps.length - 1, 0);
          rawTutorSteps.splice(insertIdx, 0, {
            instruction: 'Check the student\'s answers.',
            scripts: [],
            tips: [{ text: 'Correct any mistakes and explain briefly.' }],
            answerKey: answersArr,
          });
        }
      }
      
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
          answers: answersArr,
          // Tutor steps (with answerKey injected)
          tutorSteps: rawTutorSteps,
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
${learnContext}
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
      const jsonContent = sanitizeAIText(jsonMatch ? jsonMatch[0] : text);
      
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
    console.log('[GENERATION DEBUG] Fell through to introduction generation. exerciseType:', exerciseType, 'exerciseStep:', exerciseStep, 'missionType:', missionType, 'generateTrivia:', generateTrivia, 'applyType:', applyType, 'learnType:', learnType);
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
      const jsonContent = sanitizeAIText((jsonMatch?.[1] || content).trim());
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
    const jsonContent = sanitizeAIText((jsonMatch?.[1] || content).trim());

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

// ============================================================================
// EPISODE SUMMARY AGENT
// ============================================================================

const episodeSummaryAgent = new Agent({
  name: "Episode Summary Generator",
  instructions: `You are a K-drama story writer creating summaries for an immersive language learning experience.
Given story context and mission content from a lesson, create:
1. A CURRENT EPISODE SUMMARY: What happened in this episode (2-3 sentences, past tense, engaging)
2. A NEXT EPISODE HOOK: A teaser for what might happen next (1-2 sentences, intriguing, cliffhanger-style)

The summary should:
- Focus on character interactions and emotional moments
- Reference the actual content from the mission scenarios
- Maintain the K-drama storytelling style
- Be concise but evocative

Return ONLY valid JSON:
{
  "currentEpisodeSummary": "...",
  "nextEpisodeHook": "..."
}`,
  model: "openai/gpt-4.1-mini",
});

// ============================================================================
// GENERATE EPISODE SUMMARY
// ============================================================================

export interface EpisodeSummaryResult {
  currentEpisodeSummary: string;
  nextEpisodeHook: string;
}

export const generateEpisodeSummary = async (
  storyData: {
    storyTitle: string;
    characters: Array<{ name: string; role: string; description: string }>;
    setting: string;
    previousSummary: string;
    currentPlotPoints: string[];
  },
  missionContent: {
    situation: string;
    instruction: string;
    questions?: Array<{ question: string }>;
    topics?: Array<{ title: string; questions: string[] }>;
  },
  lessonTopic: string
): Promise<EpisodeSummaryResult> => {
  try {
    const characterList = storyData.characters
      .map(c => `- ${c.name} (${c.role}): ${c.description}`)
      .join('\n');

    const plotPoints = storyData.currentPlotPoints
      .map((p, i) => `${i + 1}. ${p}`)
      .join('\n');

    const questionsContext = missionContent.questions
      ? missionContent.questions.map(q => `- ${q.question}`).join('\n')
      : missionContent.topics
        ? missionContent.topics.map(t => `${t.title}: ${t.questions.join(', ')}`).join('\n')
        : 'General practice scenarios';

    const prompt = `Create an episode summary for this K-drama style language lesson:

EPISODE TITLE: "${storyData.storyTitle}"
SETTING: ${storyData.setting}
LESSON TOPIC: ${lessonTopic}

CHARACTERS:
${characterList || 'Various characters in typical daily scenarios'}

PREVIOUS EPISODE:
${storyData.previousSummary || 'This is the beginning of the story.'}

PLOT POINTS FOR THIS EPISODE:
${plotPoints || 'General interaction around the lesson topic'}

MISSION SCENARIO:
Situation: ${missionContent.situation || 'Practice scenario'}
Student Task: ${missionContent.instruction || 'Complete the roleplay'}

PRACTICE CONTENT:
${questionsContext}

Now write:
1. A summary of what happened in THIS episode (2-3 sentences)
2. A hook/teaser for the NEXT episode (1-2 sentences)

Make it dramatic and engaging like a K-drama recap!`;

    const response = await episodeSummaryAgent.generate(prompt);
    const text = response.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonContent = sanitizeAIText(jsonMatch ? jsonMatch[0] : text);

    let result: EpisodeSummaryResult = {
      currentEpisodeSummary: '',
      nextEpisodeHook: '',
    };

    try {
      const parsed = JSON.parse(jsonContent);
      result.currentEpisodeSummary = parsed.currentEpisodeSummary || '';
      result.nextEpisodeHook = parsed.nextEpisodeHook || '';
    } catch (e) {
      console.error('Failed to parse episode summary response:', text);
      // Fallback - try to extract content
      result.currentEpisodeSummary = `In this episode, the student practiced ${lessonTopic} scenarios in ${storyData.setting || 'various settings'}.`;
      result.nextEpisodeHook = 'What new adventures await in the next lesson?';
    }

    return result;
  } catch (error) {
    console.error('Failed to generate episode summary:', error);
    throw error;
  }
};
