# Gemini API Integration Guide

## Overview
Gemini API 통합은 Driving English의 핵심 기능입니다. Gemini의 피드백을 바탕으로 작성된 통합 가이드입니다.

## Architecture

```
┌──────────┐     WebSocket      ┌──────────┐      gRPC        ┌──────────┐
│ Browser  │ ◄─────────────────► │ Backend  │ ◄──────────────► │ Gemini   │
│          │   Audio Stream       │ Server   │   Audio Stream   │   API    │
└──────────┘                      └──────────┘                  └──────────┘
```

## Key Decisions (Based on Gemini Feedback)

### 1. Security Architecture
- ❌ 브라우저에서 직접 Gemini API 호출
- ✅ Backend 서버를 통한 프록시 방식
- API 키는 서버 환경 변수에만 저장

### 2. Communication Protocol
- **Client ↔ Backend**: WebSocket
- **Backend ↔ Gemini**: gRPC streaming
- **Fallback**: REST API for non-streaming operations

### 3. Audio Format
- **Format**: FLAC or LINEAR16 (PCM)
- **Sample Rate**: 16,000 Hz
- **Encoding**: UTF-8 for text data

## Implementation

### 1. Backend gRPC Client

```typescript
// src/services/server/gemini/grpcClient.ts
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

export class GeminiGrpcClient {
  private client: any;
  private metadata: grpc.Metadata;

  constructor() {
    // Load proto file
    const packageDefinition = protoLoader.loadSync(
      'path/to/gemini.proto',
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      }
    );

    // Create gRPC client
    const geminiProto = grpc.loadPackageDefinition(packageDefinition);
    this.client = new geminiProto.GeminiService(
      process.env.GEMINI_ENDPOINT!,
      grpc.credentials.createSsl()
    );

    // Set authentication
    this.metadata = new grpc.Metadata();
    this.metadata.add('authorization', `Bearer ${process.env.GEMINI_API_KEY}`);
  }

  // Bidirectional streaming for audio
  streamAudio() {
    const stream = this.client.StreamingRecognize(this.metadata);
    
    // Handle responses
    stream.on('data', (response: any) => {
      console.log('Recognition result:', response);
    });

    stream.on('error', (error: any) => {
      console.error('Stream error:', error);
    });

    return stream;
  }
}
```

### 2. Audio Stream Handler

```typescript
// src/services/server/gemini/audioStream.ts
export class AudioStreamHandler {
  private geminiClient: GeminiGrpcClient;
  private activeStreams: Map<string, any>;

  constructor() {
    this.geminiClient = new GeminiGrpcClient();
    this.activeStreams = new Map();
  }

  async startStream(sessionId: string, config: AudioConfig) {
    const stream = this.geminiClient.streamAudio();
    
    // Send initial config
    stream.write({
      streamingConfig: {
        config: {
          encoding: 'FLAC',
          sampleRateHertz: 16000,
          languageCode: 'ko-KR',
          maxAlternatives: 1,
          enableAutomaticPunctuation: true,
        },
        interimResults: true,
      }
    });

    this.activeStreams.set(sessionId, stream);
    return stream;
  }

  sendAudioChunk(sessionId: string, audioChunk: Buffer) {
    const stream = this.activeStreams.get(sessionId);
    if (stream) {
      stream.write({
        audioContent: audioChunk
      });
    }
  }

  endStream(sessionId: string) {
    const stream = this.activeStreams.get(sessionId);
    if (stream) {
      stream.end();
      this.activeStreams.delete(sessionId);
    }
  }
}
```

### 3. WebSocket to gRPC Bridge

```typescript
// src/lib/websocket/server.ts
import { WebSocketServer } from 'ws';
import { AudioStreamHandler } from '@/services/server/gemini/audioStream';

export class WebSocketBridge {
  private wss: WebSocketServer;
  private audioHandler: AudioStreamHandler;

  constructor(server: any) {
    this.wss = new WebSocketServer({ server });
    this.audioHandler = new AudioStreamHandler();

    this.wss.on('connection', (ws, req) => {
      const sessionId = this.generateSessionId();
      
      ws.on('message', async (data) => {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'audio_stream_start':
            await this.handleStreamStart(sessionId, message.config);
            break;
            
          case 'audio_chunk':
            this.handleAudioChunk(sessionId, message.data);
            break;
            
          case 'audio_stream_end':
            this.handleStreamEnd(sessionId);
            break;
        }
      });
    });
  }

  private async handleStreamStart(sessionId: string, config: any) {
    const stream = await this.audioHandler.startStream(sessionId, config);
    
    stream.on('data', (response: any) => {
      // Forward to WebSocket client
      this.sendToClient(sessionId, {
        type: 'recognition_result',
        ...response
      });
    });
  }

  private handleAudioChunk(sessionId: string, base64Audio: string) {
    const audioBuffer = Buffer.from(base64Audio, 'base64');
    this.audioHandler.sendAudioChunk(sessionId, audioBuffer);
  }
}
```

### 4. Client-side Audio Capture

```typescript
// src/services/client/audio/recorder.ts
export class AudioRecorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private encoder: FlacEncoder;

  async initialize() {
    // Get microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      }
    });

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    // Create processor for capturing audio
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const audioData = e.inputBuffer.getChannelData(0);
      this.processAudio(audioData);
    };

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    
    // Initialize FLAC encoder
    this.encoder = new FlacEncoder({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16
    });
  }

  private processAudio(audioData: Float32Array) {
    // Convert to 16-bit PCM
    const pcm = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      pcm[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
    }
    
    // Encode to FLAC
    const flacData = this.encoder.encode(pcm);
    
    // Send to server
    this.sendAudioChunk(flacData);
  }
}
```

## Fallback System

### STT + NLP Fallback

```typescript
// src/services/server/gemini/fallback.ts
export class GeminiFallback {
  async processWithSTT(audioData: Buffer): Promise<string> {
    try {
      // First, use STT
      const transcript = await this.speechToText(audioData);
      
      // Then, use Gemini for NLP
      const command = await this.processText(transcript);
      
      return command;
    } catch (error) {
      console.error('Fallback failed:', error);
      throw error;
    }
  }

  private async speechToText(audioData: Buffer): Promise<string> {
    // Use Google STT or another Gemini endpoint
    const response = await fetch('https://speech.googleapis.com/v1/speech:recognize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GOOGLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        config: {
          encoding: 'FLAC',
          sampleRateHertz: 16000,
          languageCode: 'ko-KR'
        },
        audio: {
          content: audioData.toString('base64')
        }
      })
    });

    const result = await response.json();
    return result.results[0].alternatives[0].transcript;
  }

  private async processText(text: string): Promise<string> {
    // Use Gemini for text understanding
    const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Understand this voice command and return the action: "${text}"`
          }]
        }]
      })
    });

    const result = await response.json();
    return result.candidates[0].content.parts[0].text;
  }
}
```

## Korean Language Considerations

1. **Testing with Dialects**: Test with various Korean accents
2. **UTF-8 Encoding**: Ensure all text is properly encoded
3. **Cultural Context**: Handle culturally specific commands

```typescript
// Example: Korean command processing
const koreanCommands = {
  '다음': 'next',
  '이전': 'previous',
  '정지': 'stop',
  '재생': 'play',
  '처음부터': 'restart',
  '빠르게': 'speed_up',
  '천천히': 'slow_down'
};
```

## Error Handling

```typescript
class GeminiErrorHandler {
  handleError(error: any): ErrorResponse {
    if (error.code === grpc.status.UNAVAILABLE) {
      // Switch to fallback
      return { useFallback: true };
    }
    
    if (error.code === grpc.status.RESOURCE_EXHAUSTED) {
      // Rate limit hit
      return { retry: true, delay: 1000 };
    }
    
    // Log and return generic error
    console.error('Gemini error:', error);
    return { error: 'Processing failed' };
  }
}
```

## Testing

### Unit Tests
```typescript
describe('GeminiGrpcClient', () => {
  it('should connect to Gemini service', async () => {
    const client = new GeminiGrpcClient();
    expect(client).toBeDefined();
  });

  it('should handle audio streaming', async () => {
    const client = new GeminiGrpcClient();
    const stream = client.streamAudio();
    expect(stream).toBeDefined();
  });
});
```

### Integration Tests
- Test with real audio files
- Test fallback mechanisms
- Test error scenarios
- Test reconnection logic

## Monitoring

1. **Latency Tracking**: Monitor gRPC call latency
2. **Error Rates**: Track fallback usage
3. **Audio Quality**: Monitor recognition confidence
4. **Usage Metrics**: Track API usage for billing