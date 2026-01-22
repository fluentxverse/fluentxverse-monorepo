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
  model: "openai/gpt-4o-mini",
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
  model: "openai/gpt-4o-mini",
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
  model: "openai/gpt-4o-mini",
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
