# 자주 발생하는 오류 및 해결 방법

## 1. Database Column Error: `User.supabaseId`

### 오류 메시지
```
The column `User.supabaseId` does not exist in the current database.
    at async Object.ensureUser (src/lib/user-service.ts:55:17)
```

### 원인
Prisma 스키마와 실제 데이터베이스 간의 불일치

### 해결 방법
```bash
# 1. Prisma 스키마를 데이터베이스와 동기화
npm run db:push

# 2. Prisma 클라이언트 재생성
npm run db:generate

# 3. 서버 재시작
npm run dev
```

### 예방 방법
- 스키마 변경 후 항상 `db:push` 실행
- 팀원들과 스키마 변경사항 공유
- `.env` 파일에 올바른 DATABASE_URL 설정 확인

## 2. Redis Connection Refused Error

### 오류 메시지
```
Redis Client Error [AggregateError: ] { code: 'ECONNREFUSED' }
```

### 원인
1. Redis 서버가 실행되지 않음
2. `USE_SUPABASE_CACHE=true`로 설정되어 있지만 코드가 여전히 Redis 연결 시도
3. Top-level await로 인한 즉시 연결 시도

### 해결 방법

#### 방법 1: Supabase Cache 사용 (권장)
```bash
# .env.local에 추가
USE_SUPABASE_CACHE=true
```

#### 방법 2: Redis 서버 실행
```bash
# macOS
brew services start redis

# 또는 직접 실행
redis-server
```

#### 방법 3: 코드 수정 (이미 적용됨)
`src/services/server/cache/index.ts`를 lazy loading으로 변경:
```typescript
// 기존 코드 (문제 발생)
let cacheModule = await import('./redis');

// 수정된 코드 (lazy loading)
async function loadCacheModule() {
  if (USE_SUPABASE_CACHE) {
    return await import('./supabaseCache');
  }
  return await import('./redis');
}
```

### 예방 방법
- 개발 환경에서는 `USE_SUPABASE_CACHE=true` 사용
- Redis가 필요한 경우만 `USE_SUPABASE_CACHE=false` 설정
- Top-level await 사용 지양

## 3. 음성 명령어 인식 실패

### 문제 상황
"테크크런치 5개" 같은 복잡한 명령어를 인식하지 못함

### 원인
STT API가 단순 패턴 매칭만 수행하여 복잡한 명령어 처리 불가

### 해결 방법
1. **Gemini Audio API 활용**
   - `src/app/api/gemini-audio/route.ts`에서 복잡한 명령어 처리
   - 시스템 프롬프트에 뉴스 소스와 수량 인식 추가

2. **의도(Intent) 추가**
   ```typescript
   // Gemini 프롬프트에 추가된 의도들
   - REQUEST_SOURCE: "테크크런치 5개", "CNN 뉴스"
   - REQUEST_TOPIC: "AI 뉴스", "경제 기사"
   ```

3. **테스트 페이지 활용**
   - http://127.0.0.1:3003/test-voice-commands 에서 음성 명령어 테스트

## 4. Next.js 15 ERR_CONNECTION_REFUSED

### 오류 메시지
```
Failed to connect to 127.0.0.1 port 3003 after 0 ms: Couldn't connect to server
```

### 원인
macOS의 IPv6 우선 DNS 해석과 Next.js의 IPv4 바인딩 불일치

### 해결 방법
`package.json`의 dev 스크립트 수정:
```json
{
  "scripts": {
    "dev": "NODE_OPTIONS='--dns-result-order=ipv4first' next dev -H 127.0.0.1 -p 3003"
  }
}
```

### 참고 문서
- [ERR_CONNECTION_REFUSED 완벽 해결 가이드](./ERR_CONNECTION_REFUSED_SOLUTION.md)
- [개발 환경 필수 규칙](../DEV_RULES.md)

## 5. CSS/Tailwind 로드 실패

### 오류 메시지
```
Error: It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin
```

### 원인
Tailwind CSS v4에서 PostCSS 플러그인이 분리됨

### 해결 방법
```bash
# 1. @tailwindcss/postcss 설치
npm install -D @tailwindcss/postcss

# 2. postcss.config.js 수정
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},  // 변경됨
    autoprefixer: {},
  },
}
```

### 참고 문서
- [Tailwind CSS v4 설정 가이드](./TAILWIND_V4_SETUP.md)

## 트러블슈팅 체크리스트

### 서버 시작 전
- [ ] `.env.local` 파일 존재 확인
- [ ] DATABASE_URL 설정 확인
- [ ] `USE_SUPABASE_CACHE=true` 설정 (Redis 불필요 시)
- [ ] `npm install` 실행 완료

### 오류 발생 시
- [ ] 서버 로그 확인
- [ ] 브라우저 콘솔 확인
- [ ] 네트워크 탭에서 실패한 요청 확인
- [ ] `npm run db:generate` 실행
- [ ] 서버 재시작

### 음성 기능 테스트
- [ ] 마이크 권한 허용
- [ ] HTTPS 또는 localhost 환경
- [ ] Google Cloud 인증 파일 존재
- [ ] Gemini API 키 설정

## 유용한 명령어

```bash
# 데이터베이스 관련
npm run db:generate    # Prisma 클라이언트 생성
npm run db:push       # 스키마를 DB에 적용
npm run db:studio     # Prisma Studio 실행

# 서버 실행
npm run dev           # 개발 서버 (IPv4 우선)

# 포트 확인
lsof -i :3003        # 3003 포트 사용 확인
pkill -f "next dev"  # Next.js 프로세스 종료

# 캐시 설정
echo "USE_SUPABASE_CACHE=true" >> .env.local
```