# Translation and TTS System Implementation Request

Please help implement the translation and TTS system using Gemini API as much as possible.

## Requirements:

### 1. Gemini-based Translation Service (src/services/server/translation/geminiTranslator.ts)
- Use Gemini API for English to Korean translation
- Optimize prompts for news content translation
- Handle batch translation efficiently
- Preserve context and maintain consistency
- Support sentence-level and full article translation

### 2. Gemini-powered TTS Service (src/services/server/tts/geminiTTS.ts)
- Explore if Gemini can generate audio directly
- If not, use Google Cloud Text-to-Speech as fallback
- Generate natural-sounding speech for both English and Korean
- Support SSML for better pronunciation
- Implement audio file caching

### 3. Translation Quality Enhancement with Gemini
- Use Gemini to review and improve translations
- Context-aware translation for news articles
- Handle idioms and cultural references
- Maintain formal news tone

### 4. Gemini Prompt Engineering for Translation
- Design optimal prompts for news translation
- Include examples for consistency
- Handle technical terms appropriately
- Preserve names and proper nouns

## Gemini API Capabilities to Explore:

1. **Translation with Gemini Pro**
   - Can Gemini translate full articles while maintaining context?
   - How to optimize for Korean language nuances?
   - Best practices for batch processing?

2. **Audio Generation**
   - Can Gemini generate audio files directly?
   - If not, can it generate SSML markup for better TTS?
   - Can it suggest pronunciation guides?

3. **Translation Review**
   - Can Gemini review and improve its own translations?
   - How to ensure consistency across sentences?
   - Can it adapt difficulty level for learners?

## Implementation Files Needed:

1. src/services/server/translation/geminiTranslator.ts
2. src/services/server/tts/textToSpeech.ts
3. src/services/server/translation/translationCache.ts
4. src/config/gemini-prompts.ts
5. src/types/translation.ts

## Example Gemini Prompts to Test:

### For Translation:
```
You are a professional news translator specializing in English to Korean translation.
Translate the following news article maintaining:
- Formal news tone
- Accurate technical terms
- Natural Korean expressions
- Consistent terminology throughout

Article: [ARTICLE_TEXT]

Provide the translation in the same structure as the original.
```

### For Translation Review:
```
Review this English to Korean translation for accuracy and naturalness.
Suggest improvements if needed.

Original: [ENGLISH_TEXT]
Translation: [KOREAN_TEXT]

Focus on:
- Accuracy of meaning
- Natural Korean expression
- Appropriate formality level
- Technical term correctness
```

Please provide implementation guidance focusing on maximizing Gemini API usage.