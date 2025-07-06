# Client-Side Audio Implementation Request

Please implement the client-side audio capture and encoding system for Driving English.

## Requirements:

### 1. Audio Recorder (src/services/client/audio/recorder.ts)
- Use Web Audio API to capture microphone input
- Sample rate: 16kHz (as required by Gemini)
- Mono channel
- Enable noise suppression and echo cancellation
- Handle browser permissions properly
- Stream audio chunks in real-time

### 2. Audio Encoder (src/services/client/audio/encoder.ts)
- Convert Float32Array to Int16Array (PCM)
- Optionally encode to FLAC format
- Optimize for real-time encoding
- Minimize latency

### 3. WebSocket Client (src/services/client/websocket/client.ts)
- Connect to ws://localhost:3000/api/voice/stream
- Handle JWT authentication
- Implement reconnection logic
- Send audio chunks with proper sequencing
- Handle server messages

### 4. React Hook (src/hooks/useAudioRecorder.ts)
- Provide easy-to-use interface for React components
- Handle start/stop recording
- Manage recording state
- Emit events for UI updates

### 5. Voice Recorder Component (src/components/audio/VoiceRecorder.tsx)
- Visual feedback during recording
- Microphone permission handling
- Start/stop button
- Connection status indicator
- Minimal UI for driving safety

## Technical Specifications:
- TypeScript with proper types
- Error boundaries and fallbacks
- Browser compatibility (Chrome, Safari, Firefox, Edge)
- Mobile web support
- Performance optimized for real-time streaming

Please provide complete implementations for all files.