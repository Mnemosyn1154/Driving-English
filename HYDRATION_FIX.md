# Hydration 오류 해결 가이드

## 문제 상황
Next.js 15에서 서버와 클라이언트 간 렌더링 불일치로 인한 hydration 오류 발생

### 원인
```jsx
// 문제 코드
<li>• GOOGLE_APPLICATION_CREDENTIALS: {process.env.GOOGLE_APPLICATION_CREDENTIALS ? '✅' : '❌'}</li>
```
- 서버: `process.env` 접근 가능 → ✅ 렌더링
- 클라이언트: `process.env` undefined → ❌ 렌더링

## 해결 방법

### 1. 별도 클라이언트 컴포넌트 생성
`/src/components/CredentialStatus.tsx`

```typescript
'use client';

export function CredentialStatus() {
  const [status, setStatus] = useState<EnvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // 클라이언트에서 API 호출로 환경변수 상태 확인
    fetch('/api/check-env')
      .then(res => res.json())
      .then(data => setStatus(data));
  }, []);
  
  // 로딩 중에는 일관된 UI 표시
  if (loading) {
    return <div>환경변수 체크 중...</div>;
  }
  
  // 클라이언트에서만 실제 상태 표시
  return <div>{/* 실제 상태 표시 */}</div>;
}
```

### 2. API 엔드포인트 생성
`/src/app/api/check-env/route.ts`

```typescript
export async function GET() {
  // 서버에서만 환경변수 체크
  return NextResponse.json({
    credentials: {
      googleCloud: {
        path: process.env.GOOGLE_APPLICATION_CREDENTIALS ? '✅ Set' : '❌ Not set',
        fileExists: fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS) ? '✅' : '❌'
      }
    }
  });
}
```

### 3. 메인 컴포넌트에서 사용
```jsx
// Before
<li>• GOOGLE_APPLICATION_CREDENTIALS: {process.env.GOOGLE_APPLICATION_CREDENTIALS ? '✅' : '❌'}</li>

// After
<CredentialStatus />
```

## 핵심 원칙

1. **서버 전용 데이터는 클라이언트에서 직접 접근하지 않기**
   - `process.env`, `fs`, DB 쿼리 등

2. **클라이언트 컴포넌트 사용**
   - `'use client'` 지시문 추가
   - `useEffect`로 클라이언트 마운트 후 데이터 로드

3. **일관된 초기 렌더링**
   - 서버와 클라이언트 모두 동일한 초기 상태(로딩)로 시작
   - 클라이언트 마운트 후 실제 데이터 표시

## 다른 해결 방법들

### 방법 1: suppressHydrationWarning (권장하지 않음)
```jsx
<li suppressHydrationWarning>
  • GOOGLE_APPLICATION_CREDENTIALS: {process.env.GOOGLE_APPLICATION_CREDENTIALS ? '✅' : '❌'}
</li>
```
- 빠르지만 근본적 해결책이 아님
- 의도적인 불일치인 경우에만 사용

### 방법 2: 동적 import
```jsx
const CredentialStatus = dynamic(() => import('@/components/CredentialStatus'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});
```
- 컴포넌트를 클라이언트에서만 렌더링
- 초기 로딩이 느려질 수 있음

## 결과
✅ Hydration 오류 해결
✅ 환경변수 상태 정확히 표시
✅ 서버-클라이언트 렌더링 일치