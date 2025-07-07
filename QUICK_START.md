# 🚀 빠른 시작 가이드

## 1분 안에 개발 서버 실행하기

### 1️⃣ 최소 요구사항
- Node.js 18+ 설치됨
- npm 또는 yarn 설치됨

### 2️⃣ Mock 모드로 빠른 실행 (DB 설정 불필요)

```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 실행
npm run dev
```

서버가 시작되면 http://localhost:3000 에서 확인할 수 있습니다.

### 3️⃣ 주요 페이지

- **메인 페이지**: http://localhost:3000
  - 최신 뉴스 목록 (Mock 데이터)
  - 주요 기능 소개
  
- **운전 모드**: http://localhost:3000/driving
  - 대형 버튼 UI
  - 음성 명령 지원
  - 스와이프 제스처
  
- **웨이크워드 테스트**: http://localhost:3000/test-wakeword
  - "헤이 드라이빙" 또는 "Hey Driving" 테스트
  - 음성 인식 상태 확인
  
- **기사 상세**: http://localhost:3000/article/1
  - 문장별 학습
  - 한영 번역 토글

### 4️⃣ Mock 모드 기능

Mock 모드에서는 다음 기능을 테스트할 수 있습니다:
- ✅ 뉴스 목록 조회
- ✅ 기사 상세 보기
- ✅ 문장별 번역
- ✅ 운전 모드 UI
- ✅ 웨이크워드 감지
- ✅ 음성 명령 인터페이스

### 5️⃣ 전체 기능 활성화 (선택사항)

전체 기능을 사용하려면:

1. **PostgreSQL 설치 및 실행**
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql
   createdb driving_english
   ```

2. **Redis 설치 및 실행**
   ```bash
   # macOS
   brew install redis
   redis-server
   ```

3. **환경 변수 설정**
   ```bash
   cp .env.example .env.local
   # .env.local 파일 편집하여 API 키 입력
   ```

4. **데이터베이스 설정**
   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

5. **워커 프로세스 실행** (별도 터미널)
   ```bash
   npm run worker
   ```

### 🎯 다음 단계

1. 웨이크워드 테스트 페이지에서 음성 인식 확인
2. 운전 모드에서 핸즈프리 인터페이스 체험
3. Mock 뉴스 기사로 학습 플로우 테스트

문제가 있으시면 README.md의 문제 해결 섹션을 참조하세요!