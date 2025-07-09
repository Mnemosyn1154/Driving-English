# Authentication System Guide

## Overview

Driving English 프로젝트는 유연한 인증 시스템을 제공합니다. 사용자는 다음 두 가지 방법으로 서비스를 이용할 수 있습니다:

1. **정식 로그인**: Supabase Auth를 통한 이메일/OAuth 로그인
2. **게스트 모드 (skipAuth)**: 로그인 없이 deviceId 기반으로 서비스 이용

## 주요 컴포넌트

### 1. useAuth Hook

인증 상태를 관리하는 중앙 훅입니다.

```typescript
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { 
    user,              // 로그인한 사용자 정보
    loading,           // 로딩 상태
    isAuthenticated,   // 인증 여부 (정식 로그인 또는 skipAuth)
    isSkipAuth,        // skipAuth 모드 여부
    deviceId,          // 디바이스 ID
    signIn,            // 로그인 함수
    signOut,           // 로그아웃 함수
    skipAuth,          // skipAuth 모드 시작
    clearSkipAuth      // skipAuth 모드 종료
  } = useAuth();
}
```

### 2. withAuth HOC

페이지/컴포넌트를 인증으로 보호하는 Higher Order Component입니다.

```typescript
import { withAuth } from '@/components/Auth/withAuth';

function ProtectedPage() {
  // 이 컴포넌트는 인증된 사용자만 접근 가능
  return <div>Protected Content</div>;
}

// skipAuth 허용
export default withAuth(ProtectedPage, { allowSkipAuth: true });

// 정식 로그인만 허용
export default withAuth(ProtectedPage, { allowSkipAuth: false });
```

### 3. API 인증 미들웨어

API 라우트에서 인증을 처리하는 미들웨어입니다.

```typescript
import { getAuthContext } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  
  if (!auth.isAuthenticated) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // auth.userId로 사용자별 데이터 처리
  const data = await getUserData(auth.userId);
  return NextResponse.json(data);
}
```

## skipAuth 모드

### 활성화 조건

1. 환경 변수 `NEXT_PUBLIC_SKIP_AUTH=true` 설정
2. 사용자가 "로그인 없이 계속하기" 선택

### 동작 방식

1. 브라우저에 고유한 deviceId 생성 및 저장
2. deviceId를 기반으로 임시 사용자 생성
3. 로그인한 사용자와 동일한 기능 제공 (일부 제한 있음)

### 제한사항

- 다른 기기에서 데이터 동기화 불가
- 브라우저 데이터 삭제 시 진행 상황 손실
- 일부 프리미엄 기능 제한

## 환경 변수 설정

`.env.local` 파일에 다음 설정을 추가하세요:

```env
# skipAuth 모드 활성화 (production에서는 false 권장)
NEXT_PUBLIC_SKIP_AUTH=true

# Supabase 설정
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 페이지별 인증 설정

### 1. 공개 페이지
```typescript
// 인증 불필요
export default function PublicPage() {
  return <div>Public Content</div>;
}
```

### 2. 보호된 페이지 (skipAuth 허용)
```typescript
import { withAuth } from '@/components/Auth/withAuth';

function DashboardPage() {
  const { user, isSkipAuth } = useAuth();
  
  return (
    <div>
      {isSkipAuth ? '게스트 모드' : user?.email}
    </div>
  );
}

export default withAuth(DashboardPage, { allowSkipAuth: true });
```

### 3. 보호된 페이지 (정식 로그인만)
```typescript
import { withAuth } from '@/components/Auth/withAuth';

function PremiumPage() {
  const { user } = useAuth();
  
  return <div>Premium Content for {user.email}</div>;
}

export default withAuth(PremiumPage, { allowSkipAuth: false });
```

## API 라우트 인증

### 1. 인증 필요한 API
```typescript
import { getAuthContext } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  
  if (!auth.isAuthenticated) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // 비즈니스 로직
  const result = await processUserRequest(auth.userId);
  return NextResponse.json(result);
}
```

### 2. skipAuth 구분이 필요한 API
```typescript
export async function GET(request: NextRequest) {
  const auth = await getAuthContext(request);
  
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 });
  }
  
  if (auth.isSkipAuth) {
    // 게스트 사용자용 제한된 기능
    return NextResponse.json({ 
      data: await getBasicData(auth.userId),
      premium: false 
    });
  } else {
    // 정식 사용자용 전체 기능
    return NextResponse.json({ 
      data: await getFullData(auth.userId),
      premium: true 
    });
  }
}
```

## 클라이언트에서 API 호출

### 1. fetch 사용 시
```typescript
// deviceId는 자동으로 쿠키에서 전달됨
const response = await fetch('/api/user/data', {
  credentials: 'include' // 쿠키 포함
});
```

### 2. deviceId 명시적 전달 (필요시)
```typescript
const response = await fetch('/api/user/data', {
  headers: {
    'x-device-id': localStorage.getItem('deviceId')
  }
});
```

## 마이그레이션 가이드

### 기존 코드에서 새 시스템으로

#### Before:
```typescript
// 복잡한 수동 체크
const skipAuth = localStorage.getItem('skipAuth');
const user = await supabase.auth.getUser();
if (!user && !skipAuth) {
  router.push('/');
}
```

#### After:
```typescript
// HOC 사용
export default withAuth(MyComponent, { allowSkipAuth: true });
```

## 문제 해결

### 1. 인증이 계속 실패하는 경우
- 브라우저 쿠키 설정 확인
- Supabase 설정 확인
- 환경 변수 확인

### 2. skipAuth가 작동하지 않는 경우
- `NEXT_PUBLIC_SKIP_AUTH` 환경 변수 확인
- localStorage의 deviceId 확인
- 브라우저 개발자 도구에서 쿠키 확인

### 3. API 호출 시 401 에러
- 쿠키가 제대로 전달되는지 확인
- API 라우트의 인증 미들웨어 구현 확인
- deviceId 헤더 전달 여부 확인

## 보안 고려사항

1. **Production 환경**: skipAuth 모드는 개발/테스트용으로 권장
2. **민감한 데이터**: skipAuth 사용자에게는 제한된 데이터만 제공
3. **Rate Limiting**: deviceId 기반 요청 제한 구현 권장
4. **데이터 정리**: 오래된 deviceId 데이터 주기적 삭제