/**
 * Gemini API Prompts Configuration
 */

import { GeminiPromptOptions } from '@/types/translation';

// System prompts for different tasks
export const GEMINI_SYSTEM_PROMPTS = {
  newsTranslator: `You are a professional news translator specializing in English to Korean translation.
Your translations should:
- Maintain the formal tone appropriate for news articles
- Accurately translate technical terms and proper nouns
- Use natural Korean expressions while preserving the original meaning
- Keep consistent terminology throughout the article
- Preserve the structure and flow of the original text

Important guidelines:
- For names of people and places, keep the original English in parentheses after the Korean transliteration
- For technical terms, provide the Korean translation followed by the English term in parentheses on first use
- Maintain paragraph breaks and formatting
- Do not add explanations or commentary unless specifically requested`,

  translationReviewer: `You are an expert translation reviewer for English-Korean news translations.
Review translations for:
- Accuracy of meaning
- Natural Korean expression
- Appropriate formality level
- Consistent terminology
- Technical term correctness

Provide specific suggestions for improvement when needed.`,

  ssmlGenerator: `You are an expert in creating SSML (Speech Synthesis Markup Language) for Korean and English text.
Generate SSML markup to:
- Improve pronunciation accuracy
- Add appropriate pauses at sentence boundaries
- Emphasize important words
- Handle abbreviations and numbers correctly
- Adjust speaking rate for complex sentences

Focus on making the audio output natural and easy to understand for language learners.`,
};

// Translation prompt templates
export const TRANSLATION_PROMPTS = {
  // Full article translation
  article: (text: string, options?: GeminiPromptOptions) => `
Translate the following news article from English to Korean.

${options?.includeExamples ? getTranslationExamples() : ''}

Article to translate:
"""
${text}
"""

Provide only the Korean translation without any additional commentary.`,

  // Sentence-by-sentence translation
  sentence: (text: string, context?: string) => `
Translate the following sentence from English to Korean.
${context ? `Context: This sentence is from a news article about: ${context}` : ''}

Sentence: "${text}"

Provide only the Korean translation.`,

  // Title translation
  title: (text: string) => `
Translate the following news article title from English to Korean.
The translation should be concise and capture the main point.

Title: "${text}"

Provide only the Korean translation.`,

  // Summary translation
  summary: (text: string) => `
Translate the following news article summary from English to Korean.
Maintain the informative tone while being concise.

Summary: "${text}"

Provide only the Korean translation.`,
};

// Translation review prompts
export const REVIEW_PROMPTS = {
  accuracy: (original: string, translation: string) => `
Review this English to Korean translation for accuracy and naturalness.

Original English:
"${original}"

Korean Translation:
"${translation}"

Evaluate:
1. Is the meaning accurately conveyed?
2. Does it sound natural in Korean?
3. Are there any errors or awkward expressions?

Provide your assessment and any suggested improvements.
Format your response as JSON:
{
  "isAccurate": boolean,
  "confidence": number (0-1),
  "issues": string[],
  "suggestions": string[]
}`,

  consistency: (translations: Array<{original: string, translated: string}>) => `
Review these translations for consistency in terminology and style.

Translations:
${translations.map((t, i) => `
${i + 1}. Original: "${t.original}"
   Korean: "${t.translated}"
`).join('\n')}

Check if technical terms, names, and key concepts are translated consistently.
List any inconsistencies found.`,
};

// SSML generation prompts
export const SSML_PROMPTS = {
  korean: (text: string) => `
Generate SSML markup for the following Korean text to improve pronunciation and naturalness.

Text: "${text}"

Add appropriate:
- Pauses between sentences and at commas
- Emphasis for important words
- Phoneme tags for potentially ambiguous pronunciations
- Say-as tags for numbers, dates, and abbreviations

Return only the SSML markup.`,

  english: (text: string) => `
Generate SSML markup for the following English text optimized for Korean learners.

Text: "${text}"

Add:
- Slower speech rate for complex sentences
- Clear pauses between phrases
- Emphasis on key vocabulary
- Phoneme tags for difficult pronunciations

Return only the SSML markup.`,
};

// Helper functions
function getTranslationExamples(): string {
  return `
Examples of good translations:

1. English: "The stock market saw significant gains today."
   Korean: "주식 시장이 오늘 상당한 상승세를 보였습니다."

2. English: "Scientists discovered a new species of butterfly."
   Korean: "과학자들이 새로운 나비 종을 발견했습니다."

3. English: "The CEO announced quarterly earnings."
   Korean: "CEO가 분기 실적을 발표했습니다."
`;
}

// Prompt configuration based on options
export function buildTranslationPrompt(
  text: string,
  type: 'article' | 'sentence' | 'title' | 'summary',
  options?: GeminiPromptOptions
): string {
  const basePrompt = TRANSLATION_PROMPTS[type](text, options);
  
  let modifiedPrompt = basePrompt;
  
  if (options?.formalityLevel && options.formalityLevel !== 'formal') {
    modifiedPrompt += `\nUse ${options.formalityLevel} language style.`;
  }
  
  if (options?.technicalTermHandling === 'explain') {
    modifiedPrompt += `\nFor technical terms, provide brief explanations in parentheses.`;
  }
  
  if (options?.targetAudience && options.targetAudience !== 'general') {
    modifiedPrompt += `\nAdapt the translation for ${options.targetAudience} level Korean learners.`;
  }
  
  return modifiedPrompt;
}

// Gemini API configuration
export const GEMINI_CONFIG = {
  defaultModel: 'gemini-1.5-flash',
  translation: {
    temperature: 0.3, // Lower for more consistent translations
    maxOutputTokens: 4096,
    topK: 40,
    topP: 0.95,
  },
  review: {
    temperature: 0.2, // Even lower for review tasks
    maxOutputTokens: 1024,
    topK: 20,
    topP: 0.9,
  },
  ssml: {
    temperature: 0.4,
    maxOutputTokens: 2048,
    topK: 30,
    topP: 0.9,
  },
};