# WebSocket Implementation Details

## Overview
WebSocket 서버 구현이 완료되었습니다. Gemini의 권장사항에 따라 3-tier 아키텍처를 구현했습니다.

## Architecture
```
Browser → WebSocket → Backend Server → gRPC → Gemini Audio API
                                     ↘ REST → Fallback STT
```

## Key Components

### 1. WebSocket Types (`src/types/websocket.ts`)
- Client → Server 메시지 타입
- Server → Client 메시지 타입
- 타입 안정성을 위한 Union 타입 사용

### 2. Gemini gRPC Client (`src/services/server/gemini/grpcClient.ts`)
- Google Cloud Speech API 사용 (Gemini Audio API 대신 임시)
- 실시간 스트리밍 지원
- 한국어/영어 동시 인식

### 3. Audio Stream Handler (`src/services/server/gemini/audioStream.ts`)
- 세션 관리
- 이벤트 기반 아키텍처
- 자동 세션 정리 (5분 타임아웃)
- 명령어 추출 로직

### 4. WebSocket Server (`src/lib/websocket/server.ts`)
- JWT 인증
- 세션별 격리
- Ping/Pong 연결 상태 확인
- 에러 처리 및 재연결 지원

### 5. Fallback System (`src/services/server/gemini/fallback.ts`)
- STT + Gemini Text API 조합
- 에러 시 자동 전환
- 간단한 키워드 기반 백업

## Security Features
1. **JWT 인증**: 모든 연결은 인증 필요
2. **세션 격리**: 각 사용자별 독립적 세션
3. **API 키 보호**: 서버에서만 API 호출
4. **입력 검증**: 모든 메시지 타입 검증

## Performance Optimizations
1. **압축 비활성화**: 실시간 오디오를 위해
2. **버퍼 관리**: 순차적 시퀀스 번호
3. **연결 재사용**: 세션별 스트림 관리
4. **자동 정리**: 비활성 세션 제거

## Next Steps
1. 실제 Gemini Audio API 연동 (현재는 Google Speech API)
2. 클라이언트 라이브러리 구현
3. 테스트 코드 작성
4. 성능 최적화
5. 모니터링 추가

## Testing
```bash
# WebSocket 연결 테스트
wscat -c ws://localhost:3000/api/voice/stream

# 인증 메시지
{"type":"auth","token":"your-jwt-token","timestamp":1234567890}

# 오디오 스트림 시작
{"type":"audio_stream_start","config":{"sampleRate":16000,"format":"FLAC","language":"ko-KR"},"timestamp":1234567890}
```

## Known Limitations
1. Next.js의 Vercel 배포 시 WebSocket 제한
   - 대안: 별도 WebSocket 서버 또는 Pusher/Ably 사용
2. 현재 Google Speech API 사용 (Gemini Audio API 대기 중)
3. 오디오 포맷 변환은 클라이언트에서 처리 필요