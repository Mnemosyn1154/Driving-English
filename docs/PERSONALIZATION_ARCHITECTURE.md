# 뉴스 개인화 아키텍처

## 개요
사용자가 처음 서비스를 이용할 때 관심 있는 RSS 피드나 키워드를 설정하고, 이를 기반으로 영어 뉴스를 큐레이션하는 시스템

## 1. 사용자 온보딩 플로우

### 1.1 초기 설정 화면
```
1. 환영 메시지
   ↓
2. 관심 분야 선택 (복수 선택 가능)
   - Technology
   - Business
   - Science
   - Health
   - Sports
   - General News
   ↓
3. 세부 설정
   - RSS 피드 추가 (선택사항)
   - 관심 키워드 입력
   - 영어 수준 선택 (1-5)
   - 일일 학습 목표
   ↓
4. 프로필 생성 완료
```

### 1.2 대화형 설정 (AI 어시스턴트)
```typescript
// 예시 대화
AI: "안녕하세요! 어떤 분야의 영어 뉴스를 읽고 싶으신가요?"
User: "저는 AI와 스타트업 관련 뉴스를 보고 싶어요"
AI: "좋습니다! AI와 스타트업 관련 뉴스를 찾아드릴게요. 
     특별히 선호하는 뉴스 사이트가 있으신가요?"
User: "TechCrunch랑 MIT Technology Review를 주로 봐요"
AI: "알겠습니다. 영어 실력은 어느 정도이신가요? (초급/중급/고급)"
```

## 2. 데이터베이스 스키마 확장

### 2.1 사용자 맞춤 RSS 피드
```prisma
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
```

### 2.2 사용자 키워드
```prisma
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
```

### 2.3 사용자 선호 카테고리
```prisma
model UserCategoryPreference {
  id         String   @id @default(uuid())
  userId     String
  category   String
  preference Float    @default(1.0) // 선호도 점수
  
  user       User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, category])
}
```

## 3. 개인화 엔진

### 3.1 뉴스 수집 전략
```typescript
interface PersonalizationStrategy {
  // 1. RSS 기반 수집
  collectFromUserFeeds(userId: string): Promise<Article[]>
  
  // 2. 키워드 기반 검색
  searchByKeywords(keywords: string[]): Promise<Article[]>
  
  // 3. 카테고리 기반 추천
  recommendByCategories(preferences: CategoryPreference[]): Promise<Article[]>
  
  // 4. 협업 필터링 (유사 사용자 기반)
  collaborativeFiltering(userId: string): Promise<Article[]>
}
```

### 3.2 점수 계산 알고리즘
```typescript
function calculateRelevanceScore(article: Article, user: User): number {
  let score = 0;
  
  // 1. 키워드 매칭 (40%)
  const keywordMatches = countKeywordMatches(article, user.keywords);
  score += keywordMatches * 0.4;
  
  // 2. 카테고리 선호도 (30%)
  const categoryScore = user.categoryPreferences[article.category] || 0;
  score += categoryScore * 0.3;
  
  // 3. 난이도 적합성 (20%)
  const difficultyMatch = 1 - Math.abs(article.difficulty - user.preferredLevel) / 5;
  score += difficultyMatch * 0.2;
  
  // 4. 신선도 (10%)
  const freshness = calculateFreshness(article.publishedAt);
  score += freshness * 0.1;
  
  return score;
}
```

## 4. API 엔드포인트

### 4.1 사용자 설정 API
```typescript
// 사용자 RSS 피드 관리
POST   /api/users/:userId/feeds     // RSS 피드 추가
GET    /api/users/:userId/feeds     // 피드 목록 조회
DELETE /api/users/:userId/feeds/:feedId  // 피드 삭제

// 키워드 관리
POST   /api/users/:userId/keywords  // 키워드 추가
GET    /api/users/:userId/keywords  // 키워드 목록
PUT    /api/users/:userId/keywords/:id  // 키워드 수정
DELETE /api/users/:userId/keywords/:id  // 키워드 삭제

// 카테고리 선호도
PUT    /api/users/:userId/preferences/categories
```

### 4.2 개인화된 뉴스 API
```typescript
// 개인화된 뉴스 피드
GET /api/news/personalized
  Query params:
    - userId: string
    - limit: number
    - offset: number
    - strategy: 'balanced' | 'keyword-focused' | 'category-focused'

// 키워드 기반 검색
GET /api/news/search
  Query params:
    - keywords: string[]
    - language: 'en' | 'ko'
    - difficulty: 1-5
```

## 5. 구현 우선순위

### Phase 1: MVP (1-2주)
1. ✅ 기본 RSS 피드 수집
2. 🔲 사용자 키워드 저장 및 검색
3. 🔲 간단한 온보딩 UI
4. 🔲 키워드 기반 뉴스 필터링

### Phase 2: 개인화 강화 (2-3주)
1. 🔲 사용자별 RSS 피드 관리
2. 🔲 대화형 온보딩 (Gemini API 활용)
3. 🔲 학습 진도에 따른 난이도 조정
4. 🔲 읽기 이력 기반 추천

### Phase 3: 고급 기능 (3-4주)
1. 🔲 협업 필터링
2. 🔲 실시간 트렌드 반영
3. 🔲 커스텀 RSS 피드 자동 발견
4. 🔲 학습 효과 분석 및 피드백

## 6. 대화형 뉴스 선택 인터페이스

### 6.1 음성 명령 예시
```
사용자: "오늘 AI 관련 뉴스 있어?"
AI: "네, 3개의 AI 관련 뉴스가 있습니다:
     1. OpenAI의 새로운 모델 발표 (중급)
     2. 구글의 AI 연구 성과 (고급)
     3. AI 스타트업 투자 동향 (초급)
     어떤 것을 들으시겠어요?"

사용자: "투자 동향 뉴스 들려줘"
AI: "알겠습니다. 시작합니다..."
```

### 6.2 텍스트 채팅 인터페이스
```typescript
interface NewsSelectionChat {
  // 뉴스 목록 표시
  showNewsList(filters: NewsFilters): Promise<NewsCard[]>
  
  // 카테고리별 브라우징
  browseByCategory(category: string): Promise<NewsCard[]>
  
  // 키워드 검색
  searchNews(query: string): Promise<NewsCard[]>
  
  // 추천 받기
  getRecommendations(): Promise<NewsCard[]>
}
```

## 7. 뉴스 카드 UI 컴포넌트
```typescript
interface NewsCard {
  id: string
  title: string
  titleKo?: string
  source: string
  category: string
  difficulty: 1-5
  readingTime: number
  keywords: string[]
  relevanceScore: number
  thumbnail?: string
}
```

## 8. 예상 사용 시나리오

### 시나리오 1: 첫 사용자
1. 앱 실행 → 온보딩 시작
2. "AI와 머신러닝" 키워드 입력
3. TechCrunch RSS 추가
4. 중급 난이도 선택
5. 매일 3개 기사 목표 설정
6. → 맞춤 뉴스 피드 생성

### 시나리오 2: 운전 중 사용
1. "Hey 뉴스" 음성 명령
2. "오늘의 추천 뉴스 들려줘"
3. AI가 3개 뉴스 제목 읽어줌
4. "두 번째 뉴스 선택"
5. 영어 → 한국어 순차 재생

### 시나리오 3: 지하철에서 사용
1. 채팅 인터페이스 열기
2. "blockchain" 검색
3. 난이도별 결과 표시
4. 터치로 기사 선택
5. 조용히 텍스트로 학습