# Driving English - Task Master

## 🚀 현재 진행 상황

### ✅ 완료된 작업
- [x] Task 1: RSS 파서 구현
  - [x] Task 1.1: 기본 RSS 파서 구현
  - [x] Task 1.2: NewsAPI 클라이언트 구현 및 API 통합
  - [x] Task 1.3: 통합 뉴스 수집 시스템 및 중복 제거 알고리즘 구현
  - [x] Task 1.4: 실시간 수집 스케줄러 및 에러 처리 시스템 구현
  - [x] Task 1.5: 데이터 저장 구조 설계 및 데이터베이스 스키마 구현

- [x] Task 2: 번역 시스템 구현 - Gemini API 사용
  - Gemini-based translation service 구현
  - 캐싱 및 배치 번역 기능 포함

- [x] Task 3: TTS 시스템 구현 - 하이브리드 시스템
  - Gemini for SSML generation
  - Google Cloud TTS for audio generation

- [x] Task 4: 백그라운드 작업 시스템 구축
  - Bull 큐 기반 파이프라인 구현
  - News Collection → Translation → TTS 자동화

- [x] Task 5: PWA 구현
  - [x] Task 5.1: Service Worker 기본 구현 및 등록
  - [x] Task 5.2: 캐싱 전략 구현 및 Cache API 통합
  - [x] Task 5.3: 오프라인 기능 및 네트워크 인터셉션 구현
  - [x] Task 5.4: PWA 매니페스트 및 설치 기능 구현
  - [x] Task 5.5: 백그라운드 동기화 및 성능 최적화

## 🔧 진행 중인 작업

### Task 6: 코드베이스 리팩토링
- [ ] Task 6.1: API 엔드포인트 통합 (News API)
- [ ] Task 6.2: 인증 로직 중앙화
- [ ] Task 6.3: 서비스 추상화 (News Providers)
- [ ] Task 6.4: 캐싱 전략 통일
- [ ] Task 6.5: 환경 변수 및 설정 통합
- [ ] Task 6.6: API 라우트 구조 개선 (RSS)

## 📝 Task 6 상세 계획

### Task 6.1: API 엔드포인트 통합 (News API)
**목표**: 세분화된 News API 엔드포인트들을 RESTful 원칙에 맞게 통합

**작업 내용**:
1. `/api/news/articles` 엔드포인트 확장
   - `type` 쿼리 파라미터로 `latest`, `personalized`, `recommendations` 구분
   - 기존 개별 엔드포인트의 로직을 NewsService 메서드로 이전
   
2. 통합할 엔드포인트:
   - `GET /api/news/latest` → `GET /api/news/articles?type=latest`
   - `GET /api/news/personalized` → `GET /api/news/articles?type=personalized`
   - `GET /api/news/recommendations` → `GET /api/news/articles?type=recommendations`

3. NewsService 클래스 확장:
   - `getLatestArticles()`: 최신 뉴스 로직
   - `getPersonalizedArticles()`: 개인화 뉴스 로직
   - `getRecommendations()`: 기존 메서드 활용

### Task 6.2: 인증 로직 중앙화
**목표**: 파편화된 인증 로직을 통합하여 일관성 확보

**작업 내용**:
1. `lib/authService.ts` 생성
   - `getAuthContext`의 로직을 중앙 서비스로 이전
   - 클라이언트/서버 공통 인증 인터페이스 정의
   
2. 기존 컴포넌트 리팩토링:
   - `useAuth` 훅이 authService 활용
   - `withAuth` HOC가 authService 활용
   - `api-auth.ts`가 authService 호출

3. deviceId와 skipAuth 로직 캡슐화

### Task 6.3: 서비스 추상화 (News Providers)
**목표**: 뉴스 수집 로직을 인터페이스 기반으로 추상화

**작업 내용**:
1. `INewsProvider` 인터페이스 정의
   - `fetchArticles()` 메서드 포함
   - 공통 타입 정의
   
2. Provider 구현체 생성:
   - `RssProvider`: RSS 피드 수집
   - `NewsApiProvider`: NewsAPI 수집
   
3. `NewsAggregator` 리팩토링:
   - Provider 패턴 사용
   - 새로운 소스 추가가 용이한 구조

### Task 6.4: 캐싱 전략 통일
**목표**: 다양한 캐싱 구현을 인터페이스로 추상화

**작업 내용**:
1. `ICacheService` 인터페이스 정의
   - `get()`, `set()`, `delete()` 등 기본 메서드
   
2. 구현체 생성:
   - `RedisCacheService`
   - `SupabaseCacheService`
   - `InMemoryCacheService`
   
3. Factory 패턴으로 환경별 캐시 선택

### Task 6.5: 환경 변수 및 설정 통합
**목표**: 모든 환경 변수를 중앙에서 관리

**작업 내용**:
1. `lib/env.ts` 확장
   - 모든 환경 변수를 타입 안전하게 export
   - 검증 로직 추가
   
2. 전체 코드베이스에서 `process.env` 직접 참조 제거
   - grep으로 모든 위치 찾아 수정

### Task 6.6: API 라우트 구조 개선 (RSS)
**목표**: RSS 관련 API를 RESTful하게 재구성

**작업 내용**:
1. 기존 구조 유지하되 명확성 개선:
   - `GET /api/user/rss` - 사용자 RSS 목록
   - `POST /api/user/rss` - RSS 추가
   - `PUT /api/user/rss/:id` - RSS 수정
   - `DELETE /api/user/rss/:id` - RSS 삭제
   - `POST /api/user/rss/:id/fetch` - 특정 RSS 갱신

2. batch, validate 등은 actions로 통합

## 🐛 버그 수정 필요
- [ ] 환경 변수 직접 참조 문제
- [ ] 인증 로직 파편화로 인한 일관성 문제
- [ ] API 엔드포인트 중복으로 인한 유지보수 어려움

## 📅 실행 순서
1. Task 6.5 (환경 변수 통합) - 기반 작업
2. Task 6.2 (인증 로직 중앙화) - 핵심 로직 통합
3. Task 6.1 (News API 통합) - API 구조 개선
4. Task 6.3 (News Providers) - 서비스 추상화
5. Task 6.4 (캐싱 전략) - 인프라 개선
6. Task 6.6 (RSS API 개선) - 추가 API 정리

각 작업은 독립적으로 진행 가능하며, 기존 기능을 유지하면서 점진적으로 개선합니다.