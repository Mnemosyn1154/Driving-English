# System Architecture Design

## Overview

Driving English는 3-tier 아키텍처를 채택하여 보안성과 확장성을 확보합니다.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Web Browser    │────▶│  Backend Server │────▶│  External APIs  │
│  (Client)       │◀────│  (Next.js)      │◀────│  (Gemini, etc)  │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     WebSocket              gRPC/REST              Secure APIs
```

## Architecture Decisions

### 1. Client-Server Separation
**결정**: 브라우저에서 직접 Gemini API를 호출하지 않음
**이유**: 
- API 키 보안
- 요청 제어 및 모니터링
- 폴백 로직 중앙화

### 2. Real-time Communication
**결정**: WebSocket (Client↔Server) + gRPC (Server↔Gemini)
**이유**:
- 낮은 레이턴시
- 양방향 스트리밍
- 연결 상태 관리

### 3. Audio Processing
**결정**: FLAC/LINEAR16 @ 16kHz
**이유**:
- Gemini 권장 포맷
- 음성 인식 최적화
- 대역폭 효율성

## Component Architecture

### Frontend Components
```
src/
├── components/
│   ├── audio/
│   │   ├── AudioRecorder.tsx    # 마이크 입력 처리
│   │   ├── AudioPlayer.tsx      # 오디오 재생
│   │   └── VoiceVisualizer.tsx  # 음성 시각화
│   ├── voice/
│   │   ├── WakeWordDetector.tsx # 웨이크워드 UI
│   │   └── CommandFeedback.tsx  # 명령 피드백
│   └── driving/
│       └── DrivingModeUI.tsx    # 운전 모드 인터페이스
```

### Backend Services
```
src/
├── services/
│   ├── server/
│   │   ├── gemini/
│   │   │   ├── GeminiClient.ts     # gRPC 클라이언트
│   │   │   ├── AudioStream.ts      # 스트림 관리
│   │   │   └── CommandProcessor.ts # 명령 처리
│   │   └── fallback/
│   │       ├── STTService.ts       # Speech-to-Text
│   │       └── NLPService.ts       # 자연어 처리
│   └── client/
│       ├── audio/
│       │   ├── AudioCapture.ts     # 오디오 캡처
│       │   └── AudioEncoder.ts     # FLAC 인코딩
│       └── websocket/
│           └── StreamClient.ts     # WebSocket 클라이언트
```

## Data Flow

### 1. Voice Command Flow
```
1. User speaks "Hey 뉴스"
2. Picovoice detects wake word locally
3. Start audio capture (16kHz)
4. Encode to FLAC format
5. Stream via WebSocket to backend
6. Backend forwards to Gemini via gRPC
7. Gemini processes and returns command
8. Backend executes command
9. Response sent back to client
```

### 2. News Reading Flow
```
1. Fetch pre-processed news from cache
2. Stream English audio to client
3. Play English sentence
4. Stream Korean translation
5. Play Korean translation
6. Move to next sentence
```

## Security Architecture

### API Key Management
- Environment variables on server only
- No client-side API calls
- Key rotation strategy

### Audio Data Privacy
- No permanent storage of voice data
- Encrypted transmission (WSS/HTTPS)
- Clear data retention policy

### Authentication Flow
```
1. User login via OAuth2
2. JWT token generation
3. WebSocket authentication
4. Session management
```

## Scalability Considerations

### Horizontal Scaling
- Stateless backend design
- Redis for session storage
- Load balancer ready

### Caching Strategy
- CDN for static assets
- Redis for API responses
- Pre-processed audio in S3

### Performance Targets
- Voice recognition: < 1.5s
- Audio streaming: < 500ms latency
- Concurrent users: 10,000+