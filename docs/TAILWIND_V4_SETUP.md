# Tailwind CSS v4 설정 가이드

## 문제 해결

### 에러 메시지
```
Error: It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin.
```

### 해결 방법

1. **@tailwindcss/postcss 설치**
```bash
npm install -D @tailwindcss/postcss
```

2. **postcss.config.js 수정**
```javascript
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},  // tailwindcss -> @tailwindcss/postcss
    autoprefixer: {},
  },
}
```

3. **globals.css 파일 (변경 없음)**
```css
@import "tailwindcss";  // Tailwind v4 syntax
```

## Tailwind CSS v4 주요 변경사항

### 1. PostCSS 플러그인 분리
- v3: `tailwindcss` 패키지가 PostCSS 플러그인 포함
- v4: `@tailwindcss/postcss` 별도 패키지 필요

### 2. CSS Import 문법
- v3: `@tailwind base; @tailwind components; @tailwind utilities;`
- v4: `@import "tailwindcss";`

### 3. 설정 파일
- `tailwind.config.js`는 그대로 유지
- content 경로 설정 필수

## 검증 방법

서버 재시작 후 페이지에서 Tailwind 클래스가 정상 작동하는지 확인:
```bash
npm run dev
# http://127.0.0.1:3003 접속
```

## 참고사항
- Tailwind CSS v4는 더 빠른 빌드 성능 제공
- PostCSS 8.4+ 필요
- Next.js 15와 완벽 호환