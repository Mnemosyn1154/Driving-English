# WebSocket Protocol Specification

## Overview
Driving English는 실시간 음성 스트리밍을 위해 WebSocket을 사용합니다.

## Connection Flow

### 1. Connection Establishment
```javascript
// Client
const ws = new WebSocket('wss://api.driving-english.com/ws');

// Authentication
ws.send(JSON.stringify({
  type: 'auth',
  token: 'JWT_TOKEN'
}));
```

### 2. Message Types

#### Client → Server

##### AUTH - 인증
```json
{
  "type": "auth",
  "token": "JWT_TOKEN",
  "timestamp": 1234567890
}
```

##### AUDIO_STREAM_START - 오디오 스트리밍 시작
```json
{
  "type": "audio_stream_start",
  "config": {
    "sampleRate": 16000,
    "format": "FLAC",
    "language": "ko-KR"
  }
}
```

##### AUDIO_CHUNK - 오디오 데이터
```json
{
  "type": "audio_chunk",
  "data": "base64_encoded_audio_data",
  "sequence": 1,
  "timestamp": 1234567890
}
```

##### AUDIO_STREAM_END - 오디오 스트리밍 종료
```json
{
  "type": "audio_stream_end",
  "duration": 5000
}
```

##### COMMAND - 음성 명령
```json
{
  "type": "command",
  "command": "next_news",
  "context": {
    "currentNewsId": "news_123",
    "position": 45
  }
}
```

#### Server → Client

##### AUTH_SUCCESS - 인증 성공
```json
{
  "type": "auth_success",
  "sessionId": "session_123",
  "userId": "user_456"
}
```

##### RECOGNITION_RESULT - 음성 인식 결과
```json
{
  "type": "recognition_result",
  "transcript": "다음 뉴스 들려줘",
  "confidence": 0.95,
  "command": "next_news",
  "isFinal": true
}
```

##### AUDIO_RESPONSE - 오디오 응답
```json
{
  "type": "audio_response",
  "data": "base64_encoded_audio",
  "format": "mp3",
  "duration": 3000,
  "text": "다음 뉴스를 재생합니다",
  "language": "ko"
}
```

##### NEWS_DATA - 뉴스 데이터
```json
{
  "type": "news_data",
  "newsId": "news_789",
  "title": "Breaking News",
  "sentences": [
    {
      "id": "sent_1",
      "english": "The market showed strong growth.",
      "korean": "시장이 강한 성장을 보였습니다.",
      "audioUrl": {
        "english": "https://cdn.../en_1.mp3",
        "korean": "https://cdn.../ko_1.mp3"
      }
    }
  ]
}
```

##### ERROR - 에러
```json
{
  "type": "error",
  "code": "AUDIO_PROCESSING_ERROR",
  "message": "Failed to process audio",
  "details": {},
  "timestamp": 1234567890
}
```

## Binary Protocol (Alternative)

For better performance, binary frames can be used for audio data:

```
Frame Structure:
[1 byte: type][4 bytes: sequence][8 bytes: timestamp][N bytes: audio data]

Types:
0x01: Audio chunk
0x02: Audio end
0x03: Control message
```

## Connection Management

### Heartbeat
```json
// Client → Server (every 30s)
{
  "type": "ping",
  "timestamp": 1234567890
}

// Server → Client
{
  "type": "pong",
  "timestamp": 1234567890
}
```

### Reconnection Strategy
1. Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s
2. Max reconnection attempts: 5
3. Session recovery with sessionId

## Error Codes

| Code | Description |
|------|-------------|
| 1001 | Invalid message format |
| 1002 | Authentication failed |
| 1003 | Session expired |
| 2001 | Audio format not supported |
| 2002 | Audio processing failed |
| 3001 | Command not recognized |
| 3002 | Command execution failed |
| 4001 | Rate limit exceeded |
| 5001 | Internal server error |

## Rate Limiting

- Audio chunks: Max 100/second
- Commands: Max 10/minute
- Connections: Max 3 per user

## Security Considerations

1. **TLS/SSL**: All connections must use WSS
2. **Authentication**: JWT token required
3. **Origin validation**: CORS headers checked
4. **Input validation**: All messages validated
5. **Rate limiting**: Prevent abuse

## Client Implementation Example

```typescript
class DrivingEnglishWebSocket {
  private ws: WebSocket;
  private reconnectAttempts = 0;
  
  connect(token: string) {
    this.ws = new WebSocket('wss://api.driving-english.com/ws');
    
    this.ws.onopen = () => {
      this.authenticate(token);
      this.startHeartbeat();
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.ws.onerror = () => {
      this.reconnect();
    };
  }
  
  sendAudioChunk(audioData: ArrayBuffer) {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(audioData)));
    this.send({
      type: 'audio_chunk',
      data: base64,
      sequence: this.sequenceNumber++,
      timestamp: Date.now()
    });
  }
}
```