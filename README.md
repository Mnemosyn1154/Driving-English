# Driving English - AI-Powered English Learning for Drivers

운전 중 안전하게 영어를 학습할 수 있는 AI 기반 웹 서비스

## 🚀 Quick Start

### 필수 요구사항

1. **Node.js** 18.17 이상
2. **PostgreSQL** 14 이상
3. **Redis** 6.0 이상
4. **API Keys**:
   - [News API](https://newsapi.org) 키
   - [Google Cloud](https://console.cloud.google.com) 서비스 계정
   - [Google AI Studio](https://makersuite.google.com/app/apikey) Gemini API 키

### 1. 환경 설정

```bash
# 1. 환경 변수 설정
cp .env.example .env.local
# .env.local 파일을 편집하여 실제 값 입력

# 2. PostgreSQL 데이터베이스 생성
createdb driving_english

# 3. Redis 서버 시작 (별도 터미널)
redis-server
```

### 2. 의존성 설치 및 데이터베이스 설정

```bash
# 의존성 설치
npm install

# Prisma 클라이언트 생성
npm run db:generate

# 데이터베이스 스키마 적용
npm run db:push

# 초기 데이터 시딩
npm run db:seed
```

### 3. 개발 서버 실행

```bash
# 터미널 1: Next.js 개발 서버
npm run dev

# 터미널 2: 백그라운드 워커 (선택사항)
npm run worker
```

### 4. 접속 및 테스트

- 메인 페이지: http://localhost:3000
- 운전 모드: http://localhost:3000/driving
- 웨이크워드 테스트: http://localhost:3000/test-wakeword
- Prisma Studio (DB 관리): `npm run db:studio`

## 📱 주요 기능

### 현재 구현된 기능

1. **음성 인터랙션**
   - 웨이크워드 감지 ("헤이 드라이빙", "Hey Driving")
   - 음성 명령 처리 (다음, 이전, 반복, 일시정지)
   - Web Audio API 기반 16kHz 오디오 캡처

2. **뉴스 시스템**
   - RSS/API 기반 뉴스 수집
   - 난이도 자동 계산 (1-5단계)
   - 문장 단위 분할 및 품질 필터링

3. **번역 및 TTS**
   - Gemini API 기반 컨텍스트 인식 번역
   - Google Cloud TTS로 음성 생성
   - 번역/음성 캐싱 시스템

4. **운전 모드 UI**
   - 대형 버튼과 고대비 다크 테마
   - 스와이프 제스처 지원
   - 음성 피드백 우선 인터페이스

5. **백그라운드 처리**
   - Bull 큐 기반 작업 처리
   - 30분마다 뉴스 자동 업데이트
   - 번역/음성 사전 생성

## 🛠 개발 명령어

```bash
# 테스트
npm test                # 단위 테스트 실행
npm run test:watch      # 테스트 감시 모드
npm run test:coverage   # 커버리지 리포트

# 코드 품질
npm run lint            # ESLint 실행
npm run type-check      # TypeScript 타입 체크

# 데이터베이스
npm run db:studio       # Prisma Studio 실행
npm run db:migrate      # 마이그레이션 실행

# API 테스트
# 뉴스 목록 조회
curl http://localhost:3000/api/news/articles

# 뉴스 통계
curl http://localhost:3000/api/news/statistics

# 작업 상태
curl http://localhost:3000/api/jobs/status
```

## 🔍 문제 해결

### PostgreSQL 연결 오류
```bash
# PostgreSQL 서비스 확인
brew services list | grep postgresql

# 서비스 시작
brew services start postgresql
```

### Redis 연결 오류
```bash
# Redis 설치 (macOS)
brew install redis

# Redis 시작
redis-server
```

### Google Cloud 인증 오류
1. [Google Cloud Console](https://console.cloud.google.com)에서 서비스 계정 생성
2. Speech-to-Text, Text-to-Speech, Translation API 활성화
3. 서비스 계정 키 다운로드 후 `credentials/` 폴더에 저장
4. `.env.local`의 `GOOGLE_APPLICATION_CREDENTIALS` 경로 수정

## 📋 다음 단계

- [ ] 학습 기록 및 사용자 진도 추적
- [ ] PWA 및 오프라인 지원
- [ ] 개인화 추천 알고리즘
- [ ] 성능 최적화 및 부하 테스트

## 🤝 기여하기

버그 리포트나 기능 제안은 [Issues](https://github.com/your-repo/issues)에 등록해주세요.