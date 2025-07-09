# 하이브리드 음성 처리 시스템 구현 완료

## 구현된 파일 목록

### 1. 클라이언트 측
- **`/src/hooks/useHybridSpeechRecognition.ts`**
  - 음성 녹음 및 처리를 위한 React Hook
  - 침묵 감지 자동 종료
  - STT → Gemini 폴백 로직
  - 상태 관리 (idle, recording, processing_stt, processing_gemini, success, error)

### 2. API 엔드포인트
- **`/src/app/api/stt-command/route.ts`**
  - Google Speech-to-Text를 사용한 1차 처리
  - 명확한 명령어 패턴 매칭
  - 한국어/영어 지원

- **`/src/app/api/gemini-audio/route.ts`**
  - Gemini 멀티모달 API를 사용한 2차 처리
  - 문맥 기반 이해
  - 복잡한 요청 처리

### 3. 서버 측
- **`/src/services/gemini/audioService.ts`**
  - 하이브리드 모드 지원 추가
  - `processWithHybridMode()` 메서드 구현

- **`/src/server/websocket-server.ts`**
  - 하이브리드 모드 메시지 처리 추가
  - `handleHybridMode()` 핸들러 구현

### 4. 타입 정의
- **`/src/types/websocket.ts`**
  - `HybridModeMessage` 타입 추가

## 사용 방법

### 1. 환경변수 설정

```env
# Google Cloud 인증
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Gemini API
GEMINI_API_KEY=your-gemini-api-key

# 옵션
SPEECH_RECOGNITION_TIMEOUT=3000
GEMINI_PROCESSING_TIMEOUT=5000
```

### 2. React 컴포넌트에서 사용

```typescript
import { useHybridSpeechRecognition } from '@/hooks/useHybridSpeechRecognition';

function VoiceControlButton() {
  const {
    isRecording,
    status,
    lastTranscript,
    lastIntent,
    lastError,
    startRecording,
    stopRecording,
    clearError,
  } = useHybridSpeechRecognition({
    onCommand: (command, transcript) => {
      console.log(`Command: ${command}, Transcript: ${transcript}`);
      // 명령어 처리 로직
    },
    onGeminiResponse: (result) => {
      console.log('Gemini result:', result);
      // Gemini 응답 처리 로직
    },
    onError: (error) => {
      console.error('Error:', error);
    },
  });

  return (
    <div>
      <button 
        onClick={isRecording ? stopRecording : startRecording}
        disabled={status === 'processing_stt' || status === 'processing_gemini'}
      >
        {isRecording ? '녹음 중지' : '음성 인식 시작'}
      </button>
      
      {status !== 'idle' && (
        <div>상태: {status}</div>
      )}
      
      {lastTranscript && (
        <div>인식된 텍스트: {lastTranscript}</div>
      )}
      
      {lastIntent && (
        <div>의도: {lastIntent}</div>
      )}
      
      {lastError && (
        <div>
          오류: {lastError.message}
          <button onClick={clearError}>닫기</button>
        </div>
      )}
    </div>
  );
}
```

### 3. WebSocket으로 하이브리드 모드 사용

```typescript
import { useGeminiAudio } from '@/hooks/useGeminiAudio';

function WebSocketVoiceControl() {
  const {
    isConnected,
    isRecording,
    startRecording,
    stopRecording,
    sendCommand,
  } = useGeminiAudio({
    autoConnect: true,
    onTranscript: (transcript, isFinal) => {
      console.log('Transcript:', transcript, isFinal);
    },
    onAudioResponse: (audioData) => {
      // 오디오 재생 로직
    },
  });

  // 하이브리드 모드 활성화
  const enableHybridMode = () => {
    if (isConnected) {
      // WebSocket 클라이언트에 하이브리드 모드 메시지 전송
      sendCommand('hybrid_mode', { enabled: true });
    }
  };

  return (
    <div>
      <button onClick={enableHybridMode}>
        하이브리드 모드 활성화
      </button>
      {/* 나머지 UI */}
    </div>
  );
}
```

## 지원되는 명령어

### 명확한 명령어 (STT로 처리)
- **탐색**: 다음, 이전, 처음부터
- **재생 제어**: 일시정지, 재생, 반복, 종료
- **속도 조절**: 빠르게, 천천히
- **볼륨 조절**: 크게, 작게
- **학습**: 번역, 설명, 쉽게

### 복잡한 요청 (Gemini로 처리)
- 문맥 참조: "아까 그거", "방금 전에"
- 감정 표현: "너무 어려워", "재미있는 거"
- 불명확한 발음
- 복합 명령: "이거 말고 다른 주제"

## 성능 최적화 팁

1. **오디오 포맷**
   - 권장: `audio/webm;codecs=opus`
   - 샘플레이트: 16kHz
   - 채널: 모노

2. **침묵 감지**
   - 기본값: 2초
   - 시끄러운 환경: 3-4초로 조정

3. **타임아웃 설정**
   - STT: 3초
   - Gemini: 5초

## 문제 해결

### Google Cloud 인증 오류
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

### Gemini API 키 오류
`.env.local` 파일에 다음 추가:
```
GEMINI_API_KEY=your-api-key
```

### 오디오 권한 오류
브라우저에서 마이크 권한을 허용했는지 확인

## 다음 단계

1. **실시간 스트리밍**: gRPC를 사용한 완전한 실시간 처리
2. **오프라인 모드**: 기본 명령어 오프라인 처리
3. **사용자 맞춤화**: 개인별 명령어 패턴 학습
4. **다국어 지원**: 일본어, 중국어 등 추가