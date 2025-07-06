# Project Folder Structure

## Overview
Driving English 프로젝트는 기능별로 명확히 분리된 폴더 구조를 채택하여 유지보수성과 확장성을 높입니다.

## Root Structure
```
driving-english-web/
├── docs/                    # 프로젝트 문서
├── public/                  # 정적 파일
├── src/                     # 소스 코드
├── prisma/                  # 데이터베이스 스키마
├── scripts/                 # 유틸리티 스크립트
├── tests/                   # 테스트 파일
└── [설정 파일들]
```

## Detailed Structure

### /src/app - Next.js App Router
```
app/
├── layout.tsx              # 루트 레이아웃
├── page.tsx               # 홈페이지
├── globals.css            # 전역 스타일
├── api/                   # API 라우트
│   ├── voice/
│   │   ├── stream/       # WebSocket 엔드포인트
│   │   └── command/      # 명령 처리
│   ├── gemini/           # Gemini API 프록시
│   ├── news/             # 뉴스 관련 API
│   └── user/             # 사용자 관련 API
└── (routes)/             # 페이지 라우트
    ├── dashboard/        # 대시보드
    ├── settings/         # 설정
    └── learn/           # 학습 페이지
```

### /src/components - React Components
```
components/
├── ui/                    # 기본 UI 컴포넌트
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Modal.tsx
│   └── Loading.tsx
├── audio/                 # 오디오 관련
│   ├── AudioPlayer.tsx
│   ├── VoiceRecorder.tsx
│   └── WaveformVisualizer.tsx
├── news/                  # 뉴스 관련
│   ├── NewsCard.tsx
│   ├── NewsList.tsx
│   └── NewsReader.tsx
└── layout/               # 레이아웃
    ├── Header.tsx
    ├── Navigation.tsx
    └── DrivingModeUI.tsx
```

### /src/services - Business Logic
```
services/
├── client/               # 클라이언트 사이드
│   ├── audio/
│   │   ├── recorder.ts      # 오디오 녹음
│   │   ├── encoder.ts       # FLAC 인코딩
│   │   └── processor.ts     # 오디오 처리
│   ├── wakeWord/
│   │   └── picovoice.ts     # 웨이크워드 감지
│   └── websocket/
│       └── client.ts        # WebSocket 클라이언트
└── server/               # 서버 사이드
    ├── gemini/
    │   ├── grpcClient.ts    # gRPC 클라이언트
    │   ├── audioStream.ts   # 오디오 스트리밍
    │   └── fallback.ts      # STT 폴백
    ├── news/
    │   ├── fetcher.ts       # 뉴스 수집
    │   ├── parser.ts        # 콘텐츠 파싱
    │   └── preprocessor.ts  # 사전 처리
    └── translation/
        ├── translator.ts    # 번역 서비스
        └── tts.ts          # 음성 합성
```

### /src/hooks - Custom React Hooks
```
hooks/
├── useAudio.ts           # 오디오 관련 훅
├── useVoiceCommand.ts    # 음성 명령 훅
├── useNewsReader.ts      # 뉴스 리더 훅
├── useOffline.ts         # 오프라인 상태 훅
└── useWebSocket.ts       # WebSocket 연결 훅
```

### /src/lib - Utilities
```
lib/
├── db/
│   ├── prisma.ts         # Prisma 클라이언트
│   └── redis.ts          # Redis 클라이언트
├── auth/
│   ├── jwt.ts            # JWT 유틸리티
│   └── oauth.ts          # OAuth 설정
├── websocket/
│   ├── server.ts         # WebSocket 서버
│   └── protocol.ts       # 프로토콜 정의
└── utils/
    ├── audio.ts          # 오디오 유틸리티
    ├── format.ts         # 포맷팅 헬퍼
    └── constants.ts      # 상수 정의
```

### /src/store - State Management
```
store/
├── audioStore.ts         # 오디오 상태
├── userStore.ts          # 사용자 상태
├── newsStore.ts          # 뉴스 상태
└── settingsStore.ts      # 설정 상태
```

### /src/types - TypeScript Types
```
types/
├── api.ts               # API 타입
├── audio.ts             # 오디오 타입
├── news.ts              # 뉴스 타입
├── user.ts              # 사용자 타입
└── websocket.ts         # WebSocket 타입
```

### /src/config - Configuration
```
config/
├── constants.ts         # 앱 상수
├── ai-prompts.ts        # AI 프롬프트
├── news-sources.ts      # 뉴스 소스 설정
└── audio-settings.ts    # 오디오 설정
```

## File Naming Conventions

### Components
- PascalCase: `AudioPlayer.tsx`
- Index files: `index.tsx` for barrel exports

### Services/Utilities
- camelCase: `audioEncoder.ts`
- Test files: `audioEncoder.test.ts`

### Types
- PascalCase for interfaces: `interface NewsArticle`
- camelCase for type aliases: `type audioFormat`

## Import Aliases
```typescript
// tsconfig.json paths
"@/*": ["./src/*"]
"@/components": ["./src/components"]
"@/services": ["./src/services"]
"@/hooks": ["./src/hooks"]
"@/lib": ["./src/lib"]
"@/store": ["./src/store"]
"@/types": ["./src/types"]
"@/config": ["./src/config"]
```

## Best Practices

1. **Single Responsibility**: 각 파일은 하나의 책임만
2. **Barrel Exports**: 폴더별 index.ts로 export 관리
3. **Colocation**: 관련 파일은 같은 폴더에
4. **Separation of Concerns**: 비즈니스 로직과 UI 분리
5. **Type Safety**: 모든 파일에 TypeScript 적용