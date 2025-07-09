# 개발 환경 필수 규칙 및 트러블슈팅

## 🚨 ERR_CONNECTION_REFUSED 방지 규칙

### 1. 서버 실행 시 필수 설정
```bash
# ❌ 잘못된 방법
npm run dev

# ✅ 올바른 방법 (package.json에 이미 설정됨)
npm run dev  # 내부적으로 NODE_OPTIONS와 -H 127.0.0.1 -p 3003 사용
```

### 2. 접속 URL 규칙
```bash
# ❌ 사용하지 말 것
http://localhost:3003  # IPv6 문제로 연결 실패 가능

# ✅ 항상 사용
http://127.0.0.1:3003  # IPv4 명시적 사용
```

### 3. package.json 설정 확인 (중요!)
```json
{
  "scripts": {
    "dev": "NODE_OPTIONS='--dns-result-order=ipv4first' next dev -H 127.0.0.1 -p 3003"  // 필수!
  }
}
```

**핵심 해결책**: `NODE_OPTIONS='--dns-result-order=ipv4first'`를 추가하여 Node.js가 항상 IPv4를 우선하도록 강제

## 🔧 ERR_CONNECTION_REFUSED 발생 시 해결 방법

### 1단계: 서버 상태 확인
```bash
# 서버가 실행 중인지 확인
ps aux | grep "next dev" | grep -v grep

# 포트 사용 확인
lsof -i :3003
```

### 2단계: 서버 재시작
```bash
# 기존 서버 종료
pkill -f "next dev"

# 서버 재시작
cd /Users/mnemosyn1154/Driving\ English_Web
npm run dev
```

### 3단계: 올바른 URL로 접속
```bash
# 브라우저 열기
open http://127.0.0.1:3003
```

## 📋 체크리스트

개발 시작 전 확인사항:
- [ ] package.json의 dev 스크립트에 `-H 127.0.0.1` 포함 여부
- [ ] 환경변수 파일 (.env.local) 존재 여부
- [ ] 포트 3003이 사용 가능한지 확인
- [ ] 127.0.0.1 (IPv4) 사용 여부

## 🎯 권장 개발 플로우

1. **터미널 1**: 서버 실행
   ```bash
   cd /Users/mnemosyn1154/Driving\ English_Web
   npm run dev
   ```

2. **터미널 2**: 서버 상태 모니터링
   ```bash
   # 서버 로그 확인
   tail -f dev.log
   ```

3. **브라우저**: 항상 127.0.0.1 사용
   ```
   http://127.0.0.1:3003
   ```

## 💡 추가 팁

### 백그라운드 실행 (선택사항)
```bash
# 백그라운드로 실행하고 싶을 때
nohup npm run dev > dev.log 2>&1 &

# 로그 확인
tail -f dev.log
```

### VS Code 설정
`.vscode/settings.json`:
```json
{
  "liveServer.settings.host": "127.0.0.1",
  "liveServer.settings.port": 3003
}
```

### 브라우저 북마크
다음 URL들을 북마크에 추가:
- http://127.0.0.1:3003 (홈)
- http://127.0.0.1:3003/test-hybrid-voice (음성 테스트)
- http://127.0.0.1:3003/api/check-env (환경변수 확인)

## 🚫 하지 말아야 할 것들

1. **localhost 사용 금지** - IPv6/IPv4 충돌 문제
2. **포트 변경 시 package.json 미수정** - 일관성 유지
3. **환경변수 파일 없이 실행** - API 오류 발생

## 📝 문제 발생 기록

### 2025-07-09
- 문제: localhost 사용 시 ERR_CONNECTION_REFUSED
- 원인: macOS의 IPv6 우선 순위
- 해결: 127.0.0.1 명시적 사용 + NODE_OPTIONS 설정

### 근본 원인 분석
1. **Next.js 15 + Node.js 18+의 IPv6 문제**
   - macOS에서 Node.js가 DNS 조회 시 IPv6를 우선시
   - localhost가 ::1 (IPv6)로 먼저 해석됨
   - Next.js 서버는 IPv4 (127.0.0.1)에만 바인딩

2. **왜 `-H 127.0.0.1`만으로는 부족한가?**
   - 서버는 IPv4에 바인딩되지만, 클라이언트 요청은 여전히 IPv6 우선
   - API 라우트나 내부 요청이 localhost를 사용할 수 있음

3. **완벽한 해결책: `--dns-result-order=ipv4first`**
   - Node.js의 DNS 해석 순서를 IPv4 우선으로 강제
   - 모든 네트워크 요청이 IPv4를 사용하도록 보장

## ✅ 검증된 해결 방법

```bash
# package.json의 dev 스크립트
"dev": "NODE_OPTIONS='--dns-result-order=ipv4first' next dev -H 127.0.0.1 -p 3003"
```

이 설정으로 ERR_CONNECTION_REFUSED 문제가 완전히 해결됩니다.

이 문서는 팀 전체가 참고해야 하는 필수 가이드입니다!