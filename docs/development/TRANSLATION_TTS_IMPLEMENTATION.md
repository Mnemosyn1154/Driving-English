# Translation and TTS Implementation

## Overview
Gemini API를 최대한 활용한 번역 및 TTS 시스템이 구현되었습니다.

## Architecture

```
Article → Gemini Translation → Google TTS → Audio Files
           ↓                     ↓
    Context-aware         SSML Generation
    Translation          (via Gemini)
```

## Key Features

### 1. Gemini-powered Translation
- **Context-aware translation**: 전체 기사 맥락을 고려한 번역
- **Consistency check**: 용어 일관성 유지
- **Quality review**: 자동 번역 품질 검토
- **Batch processing**: 동시 다중 번역 처리

### 2. Enhanced TTS with Gemini
- **SSML generation**: Gemini가 생성한 SSML로 발음 개선
- **Adaptive speed**: 학습자를 위한 속도 조절
- **Natural pauses**: 문장 구조에 따른 자연스러운 쉼
- **Emphasis handling**: 중요 단어 강조

### 3. Caching System
- **Translation cache**: 동일 텍스트 재번역 방지
- **Audio cache**: 생성된 오디오 파일 재사용
- **LRU eviction**: 효율적인 캐시 관리

## Implementation Details

### Gemini Translator (`src/services/server/translation/geminiTranslator.ts`)
```typescript
// Context-aware article translation
const translations = await translator.translateArticleWithConsistency(
  article.title,
  article.summary,
  article.sentences
);

// Quality review
const review = await translator.reviewTranslation(
  original,
  translation
);
```

### TTS Service (`src/services/server/tts/textToSpeech.ts`)
```typescript
// Generate SSML with Gemini
const ssml = await ttsService.generateSSML(text, 'ko');

// Synthesize with optimal settings
const audio = await ttsService.synthesize({
  text: ssml,
  language: 'ko',
  speed: 0.9, // Slower for learners
  ssml: true
});
```

### Gemini Prompts (`src/config/gemini-prompts.ts`)
- **Translation prompts**: 뉴스 번역에 최적화
- **Review prompts**: 번역 품질 검토
- **SSML prompts**: 발음 개선을 위한 마크업

## API Endpoints

### Translation API
```bash
# Single translation
POST /api/translate
{
  "text": "The market showed strong growth",
  "type": "sentence",
  "sourceLanguage": "en",
  "targetLanguage": "ko"
}

# Batch translation
PUT /api/translate
{
  "requests": [
    { "id": "1", "text": "...", "type": "sentence" },
    { "id": "2", "text": "...", "type": "sentence" }
  ]
}
```

### TTS API
```bash
# Single TTS
POST /api/tts
{
  "text": "안녕하세요",
  "language": "ko",
  "speed": 0.9,
  "ssml": true
}

# Batch TTS
PUT /api/tts
{
  "requests": [
    { "id": "1", "text": "...", "language": "en" },
    { "id": "2", "text": "...", "language": "ko" }
  ]
}
```

### Article Processing
```bash
POST /api/news/process
{
  "id": "article_123",
  "title": "Breaking News",
  "sentences": [...]
}
```

## Gemini Integration Benefits

1. **Superior Translation Quality**
   - Full context understanding
   - Consistent terminology
   - Natural Korean expressions

2. **Enhanced Audio Output**
   - Better pronunciation via SSML
   - Natural speech patterns
   - Learner-friendly pacing

3. **Intelligent Processing**
   - Automatic quality checks
   - Context-aware decisions
   - Error recovery

## Performance Optimizations

1. **Parallel Processing**
   - Concurrent API calls with limits
   - Batch operations
   - Queue management

2. **Caching Strategy**
   - Translation cache: 24 hours
   - Audio cache: 7 days
   - Popular content preloading

3. **Resource Management**
   - API rate limiting
   - Cost optimization
   - Error retry logic

## Configuration

### Environment Variables
```env
GEMINI_API_KEY=your-gemini-api-key
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
AUDIO_STORAGE_URL=/audio
```

### Gemini Model Settings
```typescript
{
  model: 'gemini-pro',
  temperature: 0.3,      // Low for consistency
  maxOutputTokens: 4096,
  topK: 40,
  topP: 0.95
}
```

## Next Steps

1. **Storage Integration**
   - Implement S3/GCS for audio files
   - CDN distribution
   - Automatic cleanup

2. **Advanced Features**
   - Multi-voice support
   - Emotion detection
   - Speed ramping

3. **Analytics**
   - Translation accuracy metrics
   - Audio usage statistics
   - Cost tracking