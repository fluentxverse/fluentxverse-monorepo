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
  model: "openai/gpt-5.1",
  instructions: `You are an expert ESL lesson designer creating complete introduction sections for language lessons.
  
Generate introduction content including:
1. Introduction text - engaging context about the lesson topic (in English and target language if specified)
2. Lesson issue (OPTIONAL) - a common problem or interesting fact related to the topic (ENGLISH ONLY - do not translate)
3. Lesson goal steps - 5 sequential tutor instructions with scripts and a question in Step 4

CRITICAL REQUIREMENTS FOR LESSON ISSUE (if included):
- MUST BE IN ENGLISH ONLY - do not translate to other languages
- Title MUST be max 5-7 words (NOT a long sentence)
- Must have exactly 3 bullet points (each 1 sentence max)
- Do NOT use the full lesson description as the title
- Example: "Ways to Say Hello" (not "Today we will learn easy ways to say hello for the first time...")

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
    "title": "SHORT title max 7 words",
    "points": ["Point 1 (one sentence)", "Point 2 (one sentence)", "Point 3 (one sentence)"]
  },
  "lessonGoalDuration": "1 minute",
  "lessonGoalSteps": [
    {
      "instruction": "Introduce the lesson topic.",
      "script": "Today, let's learn about...",
      "question": null
    },
    {
      "instruction": "Read the lesson goal and confirm understanding.",
      "script": null,
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
      "script": "Great! Let's move to the next part.",
      "question": null
    }
  ]
}`,
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
  generationMode?: 'new' | 'improve' | null, // New parameter to specify generation mode
  includeLessonIssue?: boolean | null // Toggle for lesson issue generation
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
    
    // Determine which mode to use (default to 'improve' if current content exists, 'new' otherwise)
    const mode = generationMode || (currentContent ? 'improve' : 'new');

    // GENERATE NEW MODE: Create full introduction content
    if (mode === 'new') {
      let fullPrompt = `Generate introduction content for an ESL lesson:
- Topic/Lesson Name: ${topic}
- Skill Level: ${skillLevel}
- Primary Skill: ${skill}
- Lesson Level: ${level || 'unknown'} (out of 10)
- Complexity: ${complexityDesc}

REQUIREMENTS:
- Create engaging introduction text (2-3 sentences explaining the topic)
${includeLessonIssue ? '- Create a lesson issue with SHORT title (max 5-7 words) and 3 bullet points (IN ENGLISH ONLY, do not translate)\n' : '- Do NOT create a lesson issue (set lessonIssue to null)\n'}
- Create 5 lesson goal steps with tutor scripts
- Step 4 question must be SHORT (max 15 words) about English learning
- All vocabulary should be appropriate for ${complexityDesc} students
- NO emoji or special characters
- Focus on practical English learning`;

      if (chapter) fullPrompt += `\n- Chapter: ${chapter}`;
      if (lessonNumber) fullPrompt += `\n- Lesson Number: ${lessonNumber}`;
      if (baseInstructions) fullPrompt += `\n\nUser's specific instructions: ${baseInstructions}`;
      if (customPrompt) fullPrompt += `\n\nAdditional custom instructions: ${customPrompt}`;

      const response = await fullIntroductionGeneratorAgent.generate(fullPrompt);
      const content = response.text;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonContent = (jsonMatch?.[1] || content).trim();
      const result = JSON.parse(jsonContent);

      // If lesson issue not included, ensure it's null
      if (!includeLessonIssue) {
        result.lessonIssue = null;
      }

      if (!result.lessonGoalSteps) {
        throw new Error('Invalid response structure - missing lessonGoalSteps');
      }

      return result;
    }

    // IMPROVE EXISTING MODE: Only update Step 4 question
    let prompt = baseInstructions || `Generate a SHORT, SIMPLE opening question about ENGLISH and the lesson topic:
- Topic/Lesson Name: ${topic}
- Skill Level: ${skillLevel}
- Primary Skill: ${skill}
- Lesson Level: ${level || 'unknown'} (out of 10)
- Complexity: ${complexityDesc}

CRITICAL REQUIREMENTS:
- Question must be VERY SHORT (1 sentence, max 10-15 words)
- Use simple vocabulary for ${complexityDesc} students
- NO emoji or special characters
- FOCUS ON ENGLISH LEARNING - NOT their native language
- DO NOT ask about native language or translations
- Make it about English and the lesson topic
- Direct and easy to understand
- Encourages student response

Example formats by level:
- Level 1-2: "Can you say hello in English?" (about learning English)
- Level 5-6: "Do you speak English at home?" (about English use)
- Level 9-10: "How do you use this greeting in English?" (about English application)`;

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
