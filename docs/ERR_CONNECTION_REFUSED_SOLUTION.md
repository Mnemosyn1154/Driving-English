# ERR_CONNECTION_REFUSED 완벽 해결 가이드

## 🎯 즉시 해결 방법

```bash
# 프로젝트 디렉토리에서 실행
npm run dev
```

이제 http://127.0.0.1:3003 으로 접속하세요.

## 🔍 문제의 원인

### 1. macOS + Node.js 18+ IPv6 우선 문제
- macOS는 `localhost`를 IPv6 주소 `::1`로 먼저 해석
- Next.js 서버는 IPv4 (`127.0.0.1`)에만 바인딩
- 결과: 연결 불일치로 ERR_CONNECTION_REFUSED 발생

### 2. Next.js 15의 변경사항
- 더 엄격한 네트워크 바인딩
- 내부 API 라우트도 IPv6/IPv4 충돌 영향

## ✅ 영구적 해결책

### 1. package.json 설정 (이미 적용됨)
```json
{
  "scripts": {
    "dev": "NODE_OPTIONS='--dns-result-order=ipv4first' next dev -H 127.0.0.1 -p 3003"
  }
}
```

### 2. 핵심 구성 요소
- `NODE_OPTIONS='--dns-result-order=ipv4first'`: Node.js가 IPv4를 우선
- `-H 127.0.0.1`: 서버를 IPv4 주소에 바인딩
- `-p 3003`: 명시적 포트 지정

### 3. 개발 시 준수사항
- ❌ `http://localhost:3003` 사용 금지
- ✅ `http://127.0.0.1:3003` 항상 사용

## 🛠 추가 트러블슈팅

### 서버가 시작되지 않을 때
```bash
# 1. 기존 프로세스 종료
pkill -f "next dev"

# 2. 포트 확인
lsof -i :3003

# 3. 서버 재시작
npm run dev
```

### 브라우저 캐시 문제
```bash
# Chrome에서 강제 새로고침
Cmd + Shift + R (Mac)
Ctrl + Shift + R (Windows/Linux)
```

### 대체 실행 방법
```bash
# scripts/dev-server.sh 사용
./scripts/dev-server.sh
```

## 📚 참고사항

### Node.js DNS 옵션
- `--dns-result-order=ipv4first`: IPv4 우선
- `--dns-result-order=verbatim`: OS 기본값 (문제 원인)

### 왜 이 문제가 발생하는가?
1. Node.js v17+부터 DNS 해석 순서 변경
2. macOS의 IPv6 선호 정책
3. Next.js의 엄격한 바인딩 정책

## 🔗 관련 문서
- [Node.js DNS Resolution](https://nodejs.org/api/dns.html#dnssetdefaultresultorderorder)
- [Next.js CLI](https://nextjs.org/docs/app/api-reference/next-cli)
- [DEV_RULES.md](../DEV_RULES.md)

## 📝 체크리스트
- [ ] package.json의 dev 스크립트 확인
- [ ] 127.0.0.1 사용 (localhost 금지)
- [ ] 서버 정상 시작 확인
- [ ] 브라우저 캐시 클리어

이 가이드를 따르면 ERR_CONNECTION_REFUSED 문제가 완전히 해결됩니다.