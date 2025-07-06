# News System Implementation

## Overview
뉴스 수집 시스템이 구현되었습니다. RSS 피드와 News API를 통해 뉴스를 수집하고, 문장 단위로 분할하여 난이도를 계산합니다.

## Architecture

```
News Sources → Fetcher → Parser → Preprocessor → API Routes
     ↓           ↓         ↓           ↓             ↓
  RSS/API    Collect   Extract    Prepare      Serve to Client
```

## Components

### 1. News Types (`src/types/news.ts`)
- Article, Sentence, NewsSource 인터페이스
- 필터링 및 페이지네이션 타입
- 난이도 레벨 정의

### 2. News Sources Configuration (`src/config/news-sources.ts`)
- BBC, CNN, Reuters 등 주요 뉴스 소스
- 카테고리별 RSS 피드 URL
- 난이도 계산을 위한 단어 목록

### 3. News Fetcher (`src/services/server/news/fetcher.ts`)
- RSS 피드 파싱 (rss-parser 사용)
- News API 통합
- 멀티 소스 동시 수집
- 에러 처리 및 재시도

### 4. News Parser (`src/services/server/news/parser.ts`)
- HTML 태그 제거 및 콘텐츠 정제
- 문장 단위 분할
- 난이도 계산 알고리즘
- 키워드 추출

### 5. News Preprocessor (`src/services/server/news/preprocessor.ts`)
- 문장 품질 필터링
- 배치 처리 준비
- 번역/TTS를 위한 데이터 준비
- 필터링 및 정렬

### 6. API Routes
- `GET /api/news/latest` - 최신 뉴스 목록
- `GET /api/news/[id]` - 특정 기사 조회
- `GET /api/news/categories` - 카테고리 목록
- `POST /api/news/refresh` - 뉴스 업데이트

## Features

### Difficulty Calculation
- 단어 수 기반
- 문장 길이 기반
- 일반 단어 비율 기반
- 3단계: beginner, intermediate, advanced

### Content Cleaning
- HTML 태그 제거
- 특수 문자 정리
- URL 제거
- 광고 문구 제거

### Sentence Splitting
- 마침표, 느낌표, 물음표 기준
- 약어 처리 (Mr., Dr., etc.)
- 최소 문장 길이 검증

## API Usage Examples

### Get Latest News
```bash
GET /api/news/latest?category=technology&difficulty=intermediate&page=1&limit=10
```

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Article Title",
      "summary": "Article summary...",
      "difficulty": "intermediate",
      "wordCount": 450,
      "sentences": [
        {
          "id": "uuid",
          "text": "First sentence.",
          "order": 0,
          "difficulty": "intermediate"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Get Categories
```bash
GET /api/news/categories
```

Response:
```json
{
  "categories": [
    { "id": "world", "name": "World News" },
    { "id": "business", "name": "Business" },
    { "id": "technology", "name": "Technology" }
  ]
}
```

## Next Steps

1. **Database Integration**
   - Store parsed articles in PostgreSQL
   - Implement caching with Redis
   - Track article processing status

2. **Translation Integration**
   - Connect to Google Translation API
   - Batch translation processing
   - Store translations with articles

3. **TTS Integration**
   - Generate audio files for sentences
   - Store in S3/Blob storage
   - Track audio generation status

4. **Scheduling**
   - Implement cron jobs for regular updates
   - Background job queue for processing
   - Rate limiting for external APIs

## Configuration

### Environment Variables
```env
NEWS_API_KEY=your-newsapi-key
GOOGLE_CLOUD_PROJECT=your-project
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### Adding New Sources
1. Add source to `NEWS_SOURCES` array
2. Specify RSS/API type
3. Set update interval
4. Enable/disable as needed

## Performance Considerations

- Batch processing for efficiency
- Concurrent fetching with limits
- Caching parsed articles
- Pagination for large datasets
- Background processing for heavy tasks