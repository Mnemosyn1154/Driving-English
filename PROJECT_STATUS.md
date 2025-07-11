# Driving English 프로젝트 상태 문서

## 🚨 현재 상태 (2025-01-11)

### ✅ 완료된 작업

#### Task 1-5: 기본 기능 구현
1. **RSS 파서 구현** - RSS 피드를 파싱하여 뉴스 기사 수집
2. **번역 시스템** - Gemini API를 사용한 영한 번역
3. **TTS 시스템** - Google Cloud TTS를 사용한 음성 합성
4. **백그라운드 작업** - Bull 큐를 사용한 비동기 처리
5. **PWA 구현** - 오프라인 지원 및 설치 가능한 웹앱

#### Task 6: 코드베이스 리팩토링 (완료)
- **Task 6.1**: API 엔드포인트 통합 (News API)
  - `/api/news/articles` 엔드포인트로 통합
  - type 파라미터로 latest, personalized, recommendations 구분
  
- **Task 6.2**: 인증 로직 중앙화
  - `authService.ts`와 `authService.server.ts` 분리
  - 서버/클라이언트 컴포넌트 구분 명확화
  
- **Task 6.3**: 서비스 추상화 (News Providers)
  - INewsProvider 인터페이스 정의
  - RssProvider, NewsApiProvider 구현
  - ProviderFactory 패턴 적용
  
- **Task 6.4**: 캐싱 전략 통일
  - CacheService 클래스로 통합
  - 타입 안전한 캐싱 메서드 제공
  
- **Task 6.5**: 환경 변수 및 설정 통합
  - `/src/lib/env.ts`에 중앙화된 config 객체
  - 환경별 설정 관리 개선
  
- **Task 6.6**: API 라우트 구조 개선 (RSS)
  - RESTful 구조로 변경: `/api/rss/sources`
  - 구버전 엔드포인트 deprecation 처리

### 🐛 해결된 이슈

1. **500 Internal Server Error**
   - 원인: SSR에서 `navigator` 접근 시도
   - 해결: `typeof navigator !== 'undefined'` 체크 추가

2. **RSS API CORS 에러**
   - 원인: 리다이렉트로 인한 origin 불일치
   - 해결: 클라이언트가 새 엔드포인트 직접 호출

3. **PerformanceObserver 경고**
   - 원인: `entryTypes`와 `buffered` 동시 사용 불가
   - 해결: `type` 속성 사용으로 변경

4. **Preload 리소스 경고**
   - 원인: 사용하지 않는 리소스 preload
   - 해결: 불필요한 preload 제거

5. **느린 뉴스 로딩**
   - 원인: Supabase 연결 테스트 지연
   - 해결: 개발 환경에서 `USE_MOCK=true` 설정

### 🔧 현재 설정

#### 환경 변수 (.env.local)
```env
# 데이터베이스 (Supabase 사용 중)
DATABASE_URL="postgresql://..."
SUPABASE_URL="https://..."
SUPABASE_ANON_KEY="..."

# 개발 옵션
USE_MOCK="true"  # 빠른 개발을 위해 목 데이터 사용
USE_SUPABASE_CACHE="true"

# API 키
NEWS_API_KEY="..."
GEMINI_API_KEY="..."
JWT_SECRET="..."

# 인증 옵션
NEXT_PUBLIC_SKIP_AUTH="true"  # 게스트 모드 허용
```

### 📁 주요 파일 구조

```
src/
├── app/api/
│   ├── news/
│   │   ├── articles/route.ts      # 통합된 뉴스 API
│   │   ├── personalized/route.ts  # 개인화 뉴스
│   │   └── recommendations/route.ts
│   └── rss/
│       ├── sources/               # RESTful RSS API
│       │   ├── route.ts
│       │   ├── [id]/route.ts
│       │   └── batch/route.ts
│       └── route.ts              # Deprecated (301 redirect)
├── lib/
│   ├── env.ts                    # 환경 변수 중앙 관리
│   ├── authService.ts            # 클라이언트 인증
│   └── authService.server.ts     # 서버 인증
├── services/server/
│   ├── news/
│   │   ├── providers/            # 뉴스 제공자 추상화
│   │   │   ├── INewsProvider.ts
│   │   │   ├── RssProvider.ts
│   │   │   └── NewsApiProvider.ts
│   │   └── newsService.ts
│   └── cache/
│       └── CacheService.ts       # 통합 캐싱 서비스
└── components/
    ├── ServiceWorkerProvider.tsx  # PWA 지원
    ├── OfflineIndicator.tsx      # 오프라인 상태 표시
    └── PWAInstallPrompt.tsx      # PWA 설치 프롬프트
```

### 🚀 다음 작업 (Task 7-10)

#### Task 7: 음성 인식 시스템 고도화
- Gemini Audio API 직접 연동
- 웨이크워드 감지 개선
- 실시간 명령 처리

#### Task 8: 학습 분석 기능
- 사용자 학습 통계
- 진도 추적
- 맞춤형 추천 알고리즘

#### Task 9: 배포 및 최적화
- Vercel 배포 설정
- 성능 최적화
- 모니터링 설정

#### Task 10: 추가 기능
- 소셜 기능
- 게이미피케이션
- 다국어 지원

### 💡 개발 팁

1. **빠른 개발을 위해**
   - `USE_MOCK=true` 사용 (실제 API 호출 없이 개발)
   - `npm run dev`로 개발 서버 실행 (자동으로 127.0.0.1:3003 사용)

2. **디버깅**
   - Chrome DevTools의 Network 탭에서 API 호출 확인
   - Application 탭에서 Service Worker 상태 확인
   - Console에서 에러 메시지 확인

3. **Git 워크플로우**
   ```bash
   git add -A
   git commit -m "feat: 기능 설명"
   git push origin main
   ```

4. **주요 명령어**
   ```bash
   npm run dev          # 개발 서버 (127.0.0.1:3003)
   npm run build        # 프로덕션 빌드
   npm run lint         # 린트 체크
   npm run type-check   # 타입 체크
   npm run db:generate  # Prisma 클라이언트 생성
   npm run worker       # 백그라운드 워커 실행
   ```

### 🔍 트러블슈팅

1. **ERR_CONNECTION_REFUSED**
   - 항상 `http://127.0.0.1:3003` 사용 (localhost 금지)
   - package.json의 dev 스크립트 확인

2. **CORS 에러**
   - API 엔드포인트가 올바른지 확인
   - 리다이렉트 대신 직접 호출 사용

3. **느린 로딩**
   - 개발 환경에서 `USE_MOCK=true` 설정
   - 불필요한 API 호출 최소화

### 📝 참고 링크

- [Next.js 문서](https://nextjs.org/docs)
- [Supabase 문서](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs)

## 🎯 중요한 주의사항

1. **개발 서버 주소**: 반드시 `http://127.0.0.1:3003` 사용 (localhost는 CORS 에러 발생)
2. **환경 변수**: 개발 시 `USE_MOCK=true` 권장
3. **Git**: 작업 완료 시 반드시 커밋 & 푸시
4. **데이터베이스**: Supabase 프로젝트 ID는 `fqyhjipnuxfyjgffgdmg`

---
마지막 커밋: `51d588e` - fix: 런타임 에러 수정 및 리팩토링 완료