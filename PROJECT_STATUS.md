# Driving English 프로젝트 진행 현황

## 📅 작업일: 2025-07-07

## ✅ 완료된 작업

### 1. Supabase 마이그레이션
- PostgreSQL + Redis → Supabase로 전환 완료
- 프로젝트 ID: `fqyhjipnuxfyjgffgdmg`
- 데이터베이스 스키마 푸시 완료
- Storage 버킷 자동 생성 로직 구현

### 2. 환경 설정
- `.env.local` 파일 구성 완료
  - DATABASE_URL: Pooler 연결 사용 (aws-0-ap-northeast-2.pooler.supabase.com)
  - SUPABASE_URL, SUPABASE_ANON_KEY 설정
  - NEWS_API_KEY 설정
  - JWT_SECRET 설정
- Prisma 클라이언트 생성 완료

### 3. 코드 구현
- Supabase 클라이언트 라이브러리 (`/src/lib/supabase.ts`)
- 캐시 시스템 구현 (Redis 대체)
  - `/src/services/server/cache/supabaseCache.ts`
  - 자동 전환 로직 (`/src/services/server/cache/index.ts`)
- API 엔드포인트 구현
  - `/api/news/articles`
  - `/api/news/recommendations`
  - `/api/news/statistics`
  - `/api/jobs/status`
- 백그라운드 작업 시스템
  - Bull 큐 설정
  - 뉴스 수집, 번역, TTS 처리 워커

### 4. 문서화
- `SUPABASE_SETUP.md` - 상세 설정 가이드
- `README.md` - 프로젝트 개요
- `QUICK_START.md` - 빠른 시작 가이드

## 🚧 현재 이슈

### 1. 개발 서버 연결 문제
- **증상**: `npm run dev` 실행 시 서버는 시작되나 브라우저에서 ERR_CONNECTION_REFUSED
- **시도한 해결책**:
  - 포트 변경 (3000 → 3001)
  - Tailwind CSS PostCSS 플러그인 설치 및 설정
  - instrumentation 비활성화
  - 간단한 테스트 서버 생성
- **가능한 원인**:
  - macOS 방화벽/보안 설정
  - Next.js 서버가 실제로 포트를 열지 않음
  - 네트워크 인터페이스 문제

### 2. 해결이 필요한 부분
- TTS 서비스 export 문제 (일부 수정했으나 완전하지 않음)
- Google Cloud 인증 설정 (TTS 기능 사용 시)

## 📝 다음 단계

### 1. 서버 연결 문제 해결
```bash
# 방화벽 확인
sudo pfctl -s rules

# 다른 포트로 시도
PORT=8080 npm run dev

# 간단한 Express 서버로 테스트
node test-server.js
```

### 2. 필요한 추가 작업
- Wake word 감지 기능 완성
- 실제 음성 스트리밍 구현
- PWA 설정
- 오프라인 기능 구현

### 3. 테스트 필요 항목
- Supabase 연결 안정성
- 뉴스 수집 백그라운드 작업
- 번역 및 TTS 파이프라인
- 캐시 시스템 성능

## 🔑 중요 정보

### API 키 상태
- ✅ Supabase (설정 완료)
- ✅ News API (설정 완료)
- ✅ Gemini API (예제 키 사용 중)
- ❌ Google Cloud (미설정 - TTS 사용 시 필요)

### 데이터베이스 테이블
- NewsSource (뉴스 소스)
- Article (기사)
- Sentence (문장별 번역)
- User (사용자)
- UserProgress (학습 진행)
- Cache (Supabase 캐시)
- BackgroundJob (작업 큐)

### 파일 구조
```
/src
  /app - Next.js 13+ App Router
  /components - React 컴포넌트
  /services
    /client - 클라이언트 서비스
    /server - 서버 서비스
  /lib - 유틸리티
  /hooks - React 훅
  /types - TypeScript 타입
  /config - 설정 파일
```

## 💡 트러블슈팅 팁

1. **서버가 시작되지 않을 때**
   - `pkill -f "next dev"` 로 기존 프로세스 종료
   - `.next` 폴더 삭제 후 재시작
   - `npm install` 다시 실행

2. **데이터베이스 연결 실패**
   - Supabase 대시보드에서 프로젝트 상태 확인
   - DATABASE_URL의 비밀번호 확인
   - Pooler vs Direct connection 차이 이해

3. **환경 변수 인식 안 될 때**
   - `npx dotenv -e .env.local -- [명령어]` 사용
   - `.env.local` 파일 위치 확인

## 🎯 현재 포커스
서버 연결 문제를 해결하여 베타 테스트가 가능한 상태로 만들기

---
마지막 커밋: `b4f6bd3` - feat: Supabase 통합 및 베타 테스트 환경 구성