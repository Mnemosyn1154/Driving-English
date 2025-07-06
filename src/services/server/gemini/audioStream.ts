import { EventEmitter } from 'events';
import { GeminiGrpcClient } from './grpcClient';
import { google } from '@google-cloud/speech/build/protos/protos';

type RecognizeConfig = google.cloud.speech.v1.IRecognitionConfig;

export interface AudioStreamConfig {
  sampleRate: number;
  format: 'FLAC' | 'LINEAR16';
  language: string;
}

export interface StreamSession {
  sessionId: string;
  userId: string;
  config: AudioStreamConfig;
  startTime: number;
  lastActivity: number;
  sequenceNumber: number;
  isActive: boolean;
}

export interface RecognitionResult {
  sessionId: string;
  transcript: string;
  confidence: number;
  isFinal: boolean;
  command?: string;
}

export class AudioStreamHandler extends EventEmitter {
  private geminiClient: GeminiGrpcClient;
  private sessions: Map<string, StreamSession>;
  private commandProcessor: CommandProcessor;

  constructor() {
    super();
    this.geminiClient = new ExtendedGeminiClient(this);
    this.sessions = new Map();
    this.commandProcessor = new CommandProcessor();

    // Clean up inactive sessions periodically
    setInterval(() => this.cleanupInactiveSessions(), 60000); // Every minute
  }

  /**
   * Start a new audio stream session
   */
  async startStream(sessionId: string, userId: string, config: AudioStreamConfig) {
    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    // Convert our config to Google's format
    const recognitionConfig: RecognizeConfig = {
      encoding: config.format === 'FLAC' ? 'FLAC' : 'LINEAR16',
      sampleRateHertz: config.sampleRate,
      languageCode: config.language,
    };

    try {
      // Create the stream in Gemini client
      this.geminiClient.createStream(sessionId, recognitionConfig);

      // Store session info
      const session: StreamSession = {
        sessionId,
        userId,
        config,
        startTime: Date.now(),
        lastActivity: Date.now(),
        sequenceNumber: 0,
        isActive: true,
      };
      this.sessions.set(sessionId, session);

      console.log(`Started audio stream for session ${sessionId}`);
      
      // Emit session started event
      this.emit('sessionStarted', { sessionId, userId });

      return session;
    } catch (error) {
      console.error(`Failed to start stream for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Process incoming audio chunk
   */
  async processAudioChunk(sessionId: string, audioData: string, sequence: number) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.isActive) {
      throw new Error(`Session ${sessionId} is not active`);
    }

    // Update session activity
    session.lastActivity = Date.now();
    session.sequenceNumber = sequence;

    try {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      // Send to Gemini
      this.geminiClient.sendAudioChunk(sessionId, audioBuffer);
      
      // Emit chunk processed event
      this.emit('chunkProcessed', { sessionId, sequence, size: audioBuffer.length });
    } catch (error) {
      console.error(`Error processing audio chunk for session ${sessionId}:`, error);
      this.emit('error', { sessionId, error, type: 'AUDIO_PROCESSING_ERROR' });
      throw error;
    }
  }

  /**
   * End an audio stream session
   */
  async endStream(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Trying to end non-existent session ${sessionId}`);
      return;
    }

    try {
      // End the Gemini stream
      this.geminiClient.endStream(sessionId);
      
      // Update session
      session.isActive = false;
      
      // Calculate session duration
      const duration = Date.now() - session.startTime;
      
      // Emit session ended event
      this.emit('sessionEnded', { 
        sessionId, 
        userId: session.userId,
        duration,
        sequenceNumber: session.sequenceNumber 
      });
      
      // Remove session after a delay (keep for potential reconnection)
      setTimeout(() => {
        this.sessions.delete(sessionId);
      }, 30000); // 30 seconds
      
      console.log(`Ended audio stream for session ${sessionId}, duration: ${duration}ms`);
    } catch (error) {
      console.error(`Error ending stream for session ${sessionId}:`, error);
      this.emit('error', { sessionId, error, type: 'STREAM_END_ERROR' });
    }
  }

  /**
   * Handle recognition results from Gemini
   */
  handleRecognitionResult(result: RecognitionResult) {
    const session = this.sessions.get(result.sessionId);
    if (!session) {
      console.warn(`Received result for unknown session ${result.sessionId}`);
      return;
    }

    // Process the transcript to extract commands
    if (result.transcript) {
      const command = this.commandProcessor.extractCommand(result.transcript);
      if (command) {
        result.command = command;
      }
    }

    // Emit recognition result
    this.emit('recognitionResult', result);
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): StreamSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): StreamSession[] {
    return Array.from(this.sessions.values()).filter(s => s.isActive);
  }

  /**
   * Clean up inactive sessions
   */
  private cleanupInactiveSessions() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    for (const [sessionId, session] of this.sessions) {
      if (session.isActive && (now - session.lastActivity) > timeout) {
        console.log(`Cleaning up inactive session ${sessionId}`);
        this.endStream(sessionId).catch(error => {
          console.error(`Error cleaning up session ${sessionId}:`, error);
        });
      }
    }
  }

  /**
   * Shutdown handler
   */
  async shutdown() {
    console.log('Shutting down AudioStreamHandler...');
    
    // End all active sessions
    const activeSessions = this.getActiveSessions();
    await Promise.all(
      activeSessions.map(session => 
        this.endStream(session.sessionId).catch(error => 
          console.error(`Error ending session ${session.sessionId}:`, error)
        )
      )
    );

    // Clean up Gemini client
    this.geminiClient.cleanup();
    
    // Remove all listeners
    this.removeAllListeners();
  }
}

/**
 * Extended Gemini client that emits events to AudioStreamHandler
 */
class ExtendedGeminiClient extends GeminiGrpcClient {
  private handler: AudioStreamHandler;

  constructor(handler: AudioStreamHandler) {
    super();
    this.handler = handler;
  }

  protected emitRecognitionResult(sessionId: string, result: {
    transcript: string;
    confidence: number;
    isFinal: boolean;
    stability: number;
  }) {
    this.handler.handleRecognitionResult({
      sessionId,
      transcript: result.transcript,
      confidence: result.confidence,
      isFinal: result.isFinal,
    });
  }
}

/**
 * Simple command processor
 */
class CommandProcessor {
  private commandMap: Map<string, string>;

  constructor() {
    this.commandMap = new Map([
      // Korean commands
      ['다음', 'next_news'],
      ['이전', 'previous_news'],
      ['정지', 'stop'],
      ['멈춰', 'stop'],
      ['재생', 'play'],
      ['시작', 'play'],
      ['처음부터', 'restart'],
      ['다시', 'restart'],
      ['빠르게', 'speed_up'],
      ['천천히', 'slow_down'],
      ['무슨 뜻', 'explain'],
      ['설명', 'explain'],
      // English commands
      ['next', 'next_news'],
      ['previous', 'previous_news'],
      ['stop', 'stop'],
      ['play', 'play'],
      ['restart', 'restart'],
      ['faster', 'speed_up'],
      ['slower', 'slow_down'],
      ['what does it mean', 'explain'],
      ['explain', 'explain'],
    ]);
  }

  extractCommand(transcript: string): string | undefined {
    const lowerTranscript = transcript.toLowerCase().trim();
    
    // Check for exact matches first
    for (const [phrase, command] of this.commandMap) {
      if (lowerTranscript.includes(phrase)) {
        return command;
      }
    }

    // Check for wake word
    if (lowerTranscript.includes('헤이 뉴스') || lowerTranscript.includes('hey news')) {
      return 'wake_word';
    }

    return undefined;
  }
}