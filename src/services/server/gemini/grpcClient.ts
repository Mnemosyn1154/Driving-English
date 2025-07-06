import speech from '@google-cloud/speech';
import { google } from '@google-cloud/speech/build/protos/protos';

type RecognizeConfig = google.cloud.speech.v1.IRecognitionConfig;
type StreamingRecognizeRequest = google.cloud.speech.v1.IStreamingRecognizeRequest;
type StreamingRecognizeResponse = google.cloud.speech.v1.IStreamingRecognizeResponse;

export interface GeminiConfig {
  projectId?: string;
  keyFilename?: string;
  apiKey?: string;
}

export class GeminiGrpcClient {
  private client: speech.SpeechClient;
  private activeStreams: Map<string, any>;

  constructor(config?: GeminiConfig) {
    // Initialize the Google Cloud Speech client
    // In production, use service account credentials
    this.client = new speech.SpeechClient({
      projectId: config?.projectId || process.env.GOOGLE_CLOUD_PROJECT,
      keyFilename: config?.keyFilename || process.env.GOOGLE_APPLICATION_CREDENTIALS,
      apiKey: config?.apiKey || process.env.GOOGLE_API_KEY,
    });

    this.activeStreams = new Map();
  }

  /**
   * Create a new streaming recognition session
   */
  createStream(sessionId: string, config: RecognizeConfig) {
    // Configure recognition settings
    const recognitionConfig: RecognizeConfig = {
      encoding: config.encoding || 'FLAC',
      sampleRateHertz: config.sampleRateHertz || 16000,
      languageCode: config.languageCode || 'ko-KR',
      enableAutomaticPunctuation: true,
      model: 'command_and_search', // Optimized for short voice commands
      useEnhanced: true,
      // Add alternative languages for better recognition
      alternativeLanguageCodes: ['en-US'],
      maxAlternatives: 1,
    };

    const streamingConfig: StreamingRecognizeRequest = {
      config: recognitionConfig,
      interimResults: true, // Get partial results
    };

    // Create the stream
    const recognizeStream = this.client
      .streamingRecognize()
      .on('error', (error) => {
        console.error(`Stream error for session ${sessionId}:`, error);
        this.handleStreamError(sessionId, error);
      })
      .on('data', (data: StreamingRecognizeResponse) => {
        this.handleRecognitionData(sessionId, data);
      })
      .on('end', () => {
        console.log(`Stream ended for session ${sessionId}`);
        this.activeStreams.delete(sessionId);
      });

    // Send the initial config
    recognizeStream.write(streamingConfig);

    // Store the stream
    this.activeStreams.set(sessionId, {
      stream: recognizeStream,
      config: recognitionConfig,
      startTime: Date.now(),
    });

    return recognizeStream;
  }

  /**
   * Send audio chunk to the stream
   */
  sendAudioChunk(sessionId: string, audioChunk: Buffer) {
    const streamData = this.activeStreams.get(sessionId);
    if (!streamData) {
      throw new Error(`No active stream for session ${sessionId}`);
    }

    try {
      const request: StreamingRecognizeRequest = {
        audioContent: audioChunk,
      };
      streamData.stream.write(request);
    } catch (error) {
      console.error(`Error sending audio chunk for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * End the streaming session
   */
  endStream(sessionId: string) {
    const streamData = this.activeStreams.get(sessionId);
    if (streamData) {
      streamData.stream.end();
      this.activeStreams.delete(sessionId);
    }
  }

  /**
   * Handle recognition data
   */
  private handleRecognitionData(sessionId: string, data: StreamingRecognizeResponse) {
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      if (result.alternatives && result.alternatives.length > 0) {
        const alternative = result.alternatives[0];
        
        // Emit recognition event (to be handled by the caller)
        this.emitRecognitionResult(sessionId, {
          transcript: alternative.transcript || '',
          confidence: alternative.confidence || 0,
          isFinal: result.isFinal || false,
          stability: result.stability || 0,
        });
      }
    }
  }

  /**
   * Handle stream errors
   */
  private handleStreamError(sessionId: string, error: any) {
    // Check if it's a recoverable error
    if (error.code === 11) { // DEADLINE_EXCEEDED
      console.log(`Stream timeout for session ${sessionId}, this is normal for long streams`);
      // The stream will auto-close, client should create a new one
    } else {
      console.error(`Unrecoverable stream error for session ${sessionId}:`, error);
    }
    
    // Clean up
    this.activeStreams.delete(sessionId);
  }

  /**
   * Emit recognition result (to be implemented by extending class or event emitter)
   */
  protected emitRecognitionResult(sessionId: string, result: {
    transcript: string;
    confidence: number;
    isFinal: boolean;
    stability: number;
  }) {
    // This will be overridden or use event emitter in actual implementation
    console.log(`Recognition result for session ${sessionId}:`, result);
  }

  /**
   * Get active stream count
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  /**
   * Clean up all streams
   */
  cleanup() {
    for (const [sessionId, streamData] of this.activeStreams) {
      try {
        streamData.stream.end();
      } catch (error) {
        console.error(`Error cleaning up stream ${sessionId}:`, error);
      }
    }
    this.activeStreams.clear();
  }
}