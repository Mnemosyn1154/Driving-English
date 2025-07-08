# 뉴스 시스템 구현 계획

## 개요
현재 뉴스 로딩 성능 문제를 해결하고, 사용자 개인화 RSS 피드 및 음성 검색 기능을 구현하는 통합 계획

## 1. 현재 문제점 분석

### 1.1 성능 병목 지점
- **Redis 연결 실패**: 계속되는 연결 오류로 인한 지연
- **Supabase 캐시 오버헤드**: DB를 캐시로 사용하면서 추가 네트워크 지연
- **관계 데이터 과다 로딩**: 불필요한 sentences 데이터 조회
- **isProcessed 필터**: 새로 수집한 기사들이 표시되지 않음

### 1.2 현재 뉴스 로딩 흐름
```
Client (NewsList.tsx)
    ↓ GET /api/news/articles
API Route (route.ts)
    ↓ NewsService.getArticles()
NewsService
    ↓ Cache 확인 (Supabase)
    ↓ Prisma DB 조회
    ↓ 관계 데이터 포함
    ↓ 결과 캐싱
Response
```

## 2. 성능 개선 계획

### 2.1 즉시 적용 가능한 개선사항
```typescript
// 1. isProcessed 필터 제거
const filters = {
  // isProcessed: searchParams.get('isProcessed') !== 'false', // 제거
  category: searchParams.get('category'),
  // ...
}

// 2. 관계 데이터 최소화
const articles = await prisma.article.findMany({
  where,
  include: {
    source: { select: { name: true } },
    // sentences 제거 - 필요시에만 로드
  },
  // ...
})

// 3. Mock 모드 활성화 (개발용)
// .env.local
USE_MOCK=true
```

### 2.2 캐시 시스템 간소화
```typescript
// 간단한 인메모리 캐시 구현
class SimpleMemoryCache {
  private cache = new Map<string, { data: any; expires: number }>();
  
  get(key: string) {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }
  
  set(key: string, data: any, ttlSeconds: number) {
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000)
    });
  }
}
```

## 3. 개인화 RSS 피드 구현

### 3.1 데이터베이스 스키마 확장
```prisma
// 사용자별 RSS 피드
model UserRssFeed {
  id        String   @id @default(uuid())
  userId    String
  name      String
  url       String
  category  String?
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, url])
}

// 사용자 검색 키워드
model UserKeyword {
  id        String   @id @default(uuid())
  userId    String
  keyword   String
  weight    Float    @default(1.0) // 중요도
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, keyword])
  @@index([keyword])
}

// 사용자 카테고리 선호도
model UserCategoryPreference {
  id         String   @id @default(uuid())
  userId     String
  category   String
  preference Float    @default(1.0)
  
  user       User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, category])
}
```

### 3.2 개인화된 RSS 수집
```typescript
// 사용자별 RSS 피드 수집
async function fetchUserFeeds(userId: string) {
  const userFeeds = await prisma.userRssFeed.findMany({
    where: { userId, enabled: true }
  });
  
  for (const feed of userFeeds) {
    await fetchFromRSS(feed.url, {
      userId,
      category: feed.category,
      sourceName: feed.name
    });
  }
}
```

## 4. 음성 검색 기능

### 4.1 News API 검색 구현
```typescript
// News API Everything 엔드포인트 활용
async function searchNewsAPI(query: string, language = 'en') {
  const url = new URL('https://newsapi.org/v2/everything');
  url.searchParams.append('q', query);
  url.searchParams.append('language', language);
  url.searchParams.append('sortBy', 'relevancy');
  url.searchParams.append('apiKey', process.env.NEWS_API_KEY);
  
  const response = await fetch(url);
  const data = await response.json();
  
  return data.articles.map(article => ({
    title: article.title,
    summary: article.description,
    url: article.url,
    source: article.source.name,
    publishedAt: article.publishedAt,
    imageUrl: article.urlToImage
  }));
}
```

### 4.2 음성 검색 API 엔드포인트
```typescript
// POST /api/news/voice-search
export async function POST(request: NextRequest) {
  const { transcript, userId } = await request.json();
  
  // 1. 키워드 추출 (Gemini API 활용)
  const keywords = await extractKeywords(transcript);
  
  // 2. 뉴스 검색
  const newsApiResults = await searchNewsAPI(keywords.join(' '));
  const dbResults = await searchDatabase(keywords);
  
  // 3. 결과 병합 및 점수 계산
  const combinedResults = mergeAndScore([
    ...newsApiResults,
    ...dbResults
  ], userId);
  
  return NextResponse.json({
    query: transcript,
    keywords,
    results: combinedResults
  });
}
```

## 5. 대화형 인터페이스 확장

### 5.1 음성 명령 처리
```typescript
// 채팅 인터페이스에 추가할 명령어
const VOICE_COMMANDS = {
  SEARCH: /검색|찾아|관련.*뉴스/,
  RECOMMEND: /추천|오늘의|인기/,
  CATEGORY: /기술|비즈니스|과학|건강|스포츠/,
  SELECT: /번째|선택|들려줘/
};

// 명령어 처리 함수
async function handleVoiceCommand(transcript: string) {
  if (VOICE_COMMANDS.SEARCH.test(transcript)) {
    // 검색 실행
    const results = await searchNews(transcript);
    return { type: 'search', results };
  }
  
  if (VOICE_COMMANDS.RECOMMEND.test(transcript)) {
    // 추천 뉴스
    const recommendations = await getRecommendations(userId);
    return { type: 'recommendations', results: recommendations };
  }
  
  // ... 기타 명령어 처리
}
```

### 5.2 뉴스 선택 UI
```typescript
interface NewsSelectionCard {
  id: string;
  title: string;
  titleKo?: string;
  source: string;
  difficulty: number;
  readingTime: number;
  summary: string;
  
  // 선택을 위한 번호
  selectionNumber: number;
}

// 음성으로 선택 가능한 뉴스 카드
<div className={styles.newsCard}>
  <div className={styles.selectionNumber}>{card.selectionNumber}</div>
  <h3>{card.title}</h3>
  <p className={styles.source}>{card.source}</p>
  <div className={styles.metadata}>
    <span>난이도: {card.difficulty}</span>
    <span>{card.readingTime}분</span>
  </div>
</div>
```

## 6. 구현 우선순위 및 일정

### Phase 1: 성능 개선 (1-2일)
- [ ] isProcessed 필터 제거
- [ ] 관계 데이터 로딩 최적화
- [ ] 인메모리 캐시 구현
- [ ] Mock 모드 설정

### Phase 2: 음성 검색 (3-4일)
- [ ] News API 검색 함수 구현
- [ ] 음성 검색 API 엔드포인트
- [ ] 채팅 인터페이스 명령어 추가
- [ ] 검색 결과 UI 컴포넌트

### Phase 3: 개인화 RSS (5-7일)
- [ ] 데이터베이스 스키마 마이그레이션
- [ ] 사용자 RSS 관리 API
- [ ] 개인화된 수집 스크립트
- [ ] 온보딩 UI (RSS 추가)

### Phase 4: 통합 및 최적화 (2-3일)
- [ ] 전체 시스템 통합 테스트
- [ ] 성능 모니터링 및 최적화
- [ ] 사용자 피드백 수집 기능

## 7. 기술 스택 및 제약사항

### 7.1 API 제한
- News API: 하루 100회 요청 (무료 플랜)
- Gemini API: 분당 60회 요청
- Supabase: 500MB 데이터베이스

### 7.2 성능 목표
- 뉴스 목록 로딩: < 2초
- 음성 검색 응답: < 3초
- 개인화 추천: < 1초

### 7.3 확장성 고려사항
- 사용자 증가 시 캐시 전략
- News API 유료 플랜 전환 시점
- 자체 뉴스 크롤러 구축 검토

## 8. 테스트 계획

### 8.1 단위 테스트
- 키워드 추출 로직
- 점수 계산 알고리즘
- RSS 파싱 및 중복 체크

### 8.2 통합 테스트
- 음성 검색 전체 플로우
- 개인화 추천 정확도
- 다양한 RSS 피드 호환성

### 8.3 사용자 테스트
- 운전 중 음성 명령 인식률
- 검색 결과 관련성
- UI/UX 개선 포인트

## 9. 모니터링 및 분석

### 9.1 추적 메트릭
- API 응답 시간
- 캐시 히트율
- 사용자별 검색 패턴
- 인기 키워드 및 카테고리

### 9.2 로깅 전략
```typescript
// 구조화된 로깅
logger.info('news_search', {
  userId,
  query: transcript,
  keywords: extractedKeywords,
  resultCount: results.length,
  responseTime: Date.now() - startTime
});
```

## 10. 향후 개선 방향

### 10.1 고급 개인화
- 협업 필터링 (유사 사용자 기반)
- 읽기 이력 기반 추천
- 시간대별 선호도 분석

### 10.2 콘텐츠 확장
- 팟캐스트 통합
- YouTube 영어 채널
- 실시간 뉴스 알림

### 10.3 학습 기능 강화
- 단어장 자동 생성
- 문장 구조 분석
- 발음 연습 모드