# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Driving English** is a web-based service that enables users to learn English while driving by listening to AI-powered news narration. The service reads news articles line by line in English followed by Korean translation, using voice-direct AI understanding for hands-free interaction.

## Key Features

1. **Voice-Direct AI Interaction**: Uses Gemini's audio processing for direct voice understanding without STT conversion
2. **Line-by-Line Translation**: News sentences read in English, immediately followed by Korean translation
3. **Hands-Free Operation**: All interactions via voice commands for driving safety
4. **Personalized News Curation**: AI-powered recommendation based on user interests and difficulty level
5. **Offline Capability**: PWA with caching for unstable network conditions

## Technical Architecture

### Frontend (Next.js + TypeScript)
- **Web Audio API**: Real-time audio capture and streaming
- **WebRTC**: Audio streaming to Gemini API
- **PWA**: Service workers for offline functionality
- **State Management**: Zustand for app state, React Query for server state

### AI Integration
- **Gemini Audio API**: Direct voice understanding and command processing
- **On-Device Wake Word**: Picovoice Porcupine or similar for efficient "Hey 뉴스" detection
- **Google Cloud Translation**: English to Korean translation (consider DeepL for quality)
- **Google Text-to-Speech**: Audio synthesis for news and translations
- **Pre-processing Pipeline**: Background service for translating and TTS conversion

### Backend Services
- **News Collection**: RSS feeds and News APIs
- **Pre-processing Service**: Background jobs for translation and TTS generation
- **User Management**: OAuth2 authentication
- **Data Storage**: PostgreSQL for user data and news metadata
- **Caching**: Redis for performance optimization
- **Blob Storage**: S3 or Vercel Blob for pre-generated audio files
- **Alternative Options**: Consider Cloudflare Workers, MongoDB Atlas

## Development Commands

⚠️ **중요: ERR_CONNECTION_REFUSED 방지**
- 항상 `http://127.0.0.1:3003` 사용 (localhost 금지)
- package.json의 dev 스크립트가 `-H 127.0.0.1` 포함하는지 확인

```bash
# Install dependencies
npm install

# Run development server (자동으로 127.0.0.1:3003 사용)
npm run dev

# 브라우저에서 열기
open http://127.0.0.1:3003

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run type-check
```

## Key Development Workflows

### Adding New Voice Commands
1. Update command recognition logic in `src/services/voice/commands.ts`
2. Add handler in `src/services/voice/handlers.ts`
3. Update Gemini prompt in `src/config/ai-prompts.ts`
4. Test with various pronunciations and noise levels

### Implementing News Sources
1. Add RSS parser in `src/services/news/parsers/`
2. Configure source in `src/config/news-sources.ts`
3. Implement content sanitization
4. Add source-specific metadata extraction

### Audio Processing Pipeline
1. **Input**: Web Audio API → MediaStream
2. **Processing**: Audio chunks → WebRTC → Gemini API
3. **Response**: Gemini response → Command execution
4. **Output**: TTS API → Audio playback

## Important Considerations

1. **Driving Safety First**: All UI elements must be operable without looking at screen
2. **Network Resilience**: Implement aggressive caching and offline fallbacks
3. **Audio Quality**: Optimize for car environment (noise, bluetooth latency)
4. **API Rate Limits**: Monitor Gemini Audio API usage carefully
5. **Privacy**: Audio streams should not be stored; implement proper data deletion
6. **Wake Word Privacy**: Use on-device detection to avoid constant cloud streaming
7. **Pre-processing Strategy**: Batch process news content during off-peak hours
8. **Security**: Implement SRTP for WebRTC, clear privacy policy for voice data

## Testing Guidelines

- Test in actual driving conditions (safely, with a passenger operating)
- Verify voice recognition with background noise
- Test network transitions (WiFi → cellular → offline)
- Validate audio synchronization (English → Korean timing)
- Check memory usage during long sessions

## Performance Targets

- Voice command recognition: < 1.5s response time (network conditions considered)
- News loading: < 3s initial buffering (with pre-processed content)
- Audio latency: < 500ms between English and Korean
- Offline capability: Cache last 10 articles minimum
- Wake word detection: < 200ms local response time

## Gemini CLI 연동 가이드

### 목적
사용자가 「Gemini와 상의하면서 진행해줘」 (또는 유사한 표현)라고 지시할 경우, Claude는 이후 작업을 Gemini CLI와 협력하여 진행한다.
Gemini로부터 받은 응답은 그대로 보여주고, Claude의 해설이나 통합 설명을 덧붙여 두 에이전트의 지식을 결합한다.

### 트리거
- 정규표현식: `/Gem.*상의하면서/`
- 예시:
  - 「Gem과 상의하면서 진행해줘」
  - 「이건 Gemini랑 이야기하면서 하자」

### Gemini CLI 사용법
```bash
# 기본 사용법
gemini -p "프롬프트 내용"

# 파일을 컨텍스트로 제공
gemini -p "프롬프트 내용" < input_file.md

# 여러 줄 프롬프트 (heredoc 사용)
export PROMPT="여러 줄의
프롬프트 내용"
gemini <<EOF
$PROMPT
EOF

# 주요 옵션
# -m, --model: 모델 선택 (기본: gemini-2.5-pro)
# -p, --prompt: 프롬프트 텍스트
# -d, --debug: 디버그 모드
# -y, --yolo: 자동 승인 모드
```

### 기본 흐름
1. **프롬프트 생성**: Claude는 사용자의 요구사항을 명확한 프롬프트로 정리
2. **Gemini CLI 호출**: 위의 사용법에 따라 적절한 방식으로 호출
3. **결과 통합**: Gemini의 응답을 분석하여 사용자에게 전달

## News Preprocessing and Caching System

### Database Setup
- **PostgreSQL** with Prisma ORM for persistent storage
- **Redis** for high-performance caching
- Database schemas for:
  - News sources and articles
  - Sentences with translations
  - User data and progress tracking
  - Background job management
  - Cache metadata

### Background Processing
- **Bull** job queue for reliable background processing
- Job types:
  - News fetching (every 30 minutes)
  - Article processing (translation + audio)
  - Audio pre-generation
  - Cache cleanup (daily)
- Worker processes handle jobs concurrently
- Automatic retry with exponential backoff

### Caching Strategy
- **Multi-layer caching**:
  - Redis for hot data (translations, audio URLs)
  - Database for persistent storage
  - In-memory caches for ultra-fast access
- **TTL-based expiration**:
  - Translations: 7 days
  - Audio files: 7 days
  - Article metadata: 3 days
- **Smart eviction**: LRU for memory, least-accessed for storage

### API Endpoints
- `GET /api/news/articles` - Paginated article list with filters
- `GET /api/news/articles/:id` - Single article with sentences
- `GET /api/news/recommendations` - Personalized recommendations
- `GET /api/news/statistics` - System statistics
- `POST /api/news/refresh` - Trigger news update
- `POST /api/news/process` - Process specific articles
- `GET /api/jobs/status` - Background job monitoring

### Database Commands
```bash
npm run db:generate    # Generate Prisma client
npm run db:push       # Push schema to database
npm run db:migrate    # Run migrations
npm run db:studio     # Open Prisma Studio
npm run db:seed       # Seed initial data
npm run worker        # Start background worker
```

### Environment Variables
```env
DATABASE_URL="postgresql://user:password@localhost:5432/driving_english"
REDIS_URL="redis://localhost:6379"
NEWS_API_KEY="your-api-key"
GOOGLE_APPLICATION_CREDENTIALS="path/to/credentials.json"
GEMINI_API_KEY="your-gemini-key"
JWT_SECRET="your-secret-key"
```