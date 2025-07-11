import { NextRequest, NextResponse } from 'next/server';
import { SpeechClient } from '@google-cloud/speech';
import path from 'path';
import fs from 'fs';
import { config } from '@/lib/env';

// Debug: Log environment variables
console.log('[STT API] Environment check:');
console.log('[STT API] GOOGLE_APPLICATION_CREDENTIALS:', config.api.googleCredentials);
console.log('[STT API] Current working directory:', process.cwd());

// Resolve credential path
const credentialPath = config.api.googleCredentials 
  ? path.resolve(process.cwd(), config.api.googleCredentials)
  : path.resolve(process.cwd(), './credentials/google-cloud-key.json');

console.log('[STT API] Resolved credential path:', credentialPath);
console.log('[STT API] Credential file exists:', fs.existsSync(credentialPath));

// Initialize Speech client with explicit credentials
let speechClient: SpeechClient;

try {
  speechClient = new SpeechClient({
    keyFilename: credentialPath,
  });
  console.log('[STT API] SpeechClient initialized successfully');
} catch (error) {
  console.error('[STT API] Failed to initialize SpeechClient:', error);
  throw error;
}

// Command patterns for clear commands
const CLEAR_COMMANDS = {
  NAVIGATION: [
    { patterns: ['다음', '넥스트', 'next'], command: 'NEXT_NEWS' },
    { patterns: ['이전', '백', 'back', 'previous'], command: 'PREV_NEWS' },
    { patterns: ['일시정지', '일시 정지', '스톱', 'pause', 'stop'], command: 'PAUSE' },
    { patterns: ['재생', '플레이', 'play', 'resume'], command: 'RESUME' },
  ],
  CONTROL: [
    { patterns: ['반복', '다시', 'repeat', 'again'], command: 'REPEAT' },
    { patterns: ['종료', '끝', 'exit', 'quit'], command: 'EXIT' },
    { patterns: ['처음', '처음부터', 'restart', 'from beginning'], command: 'RESTART' },
  ],
  SETTINGS: [
    { patterns: ['빠르게', '속도 올려', 'faster', 'speed up'], command: 'SPEED_UP' },
    { patterns: ['천천히', '속도 내려', 'slower', 'slow down'], command: 'SPEED_DOWN' },
    { patterns: ['크게', '볼륨 올려', 'louder', 'volume up'], command: 'VOLUME_UP' },
    { patterns: ['작게', '볼륨 내려', 'quieter', 'volume down'], command: 'VOLUME_DOWN' },
  ],
  LEARNING: [
    { patterns: ['번역', '한국어로', 'translate', 'korean'], command: 'TRANSLATE' },
    { patterns: ['설명', '자세히', 'explain', 'detail'], command: 'EXPLAIN' },
    { patterns: ['쉬운', '쉽게', 'easy', 'simple'], command: 'SIMPLIFY' },
  ],
  NEWS_SOURCE: [
    { patterns: ['테크크런치', 'techcrunch'], command: 'SOURCE_TECHCRUNCH' },
    { patterns: ['씨엔엔', 'cnn'], command: 'SOURCE_CNN' },
    { patterns: ['비비씨', 'bbc'], command: 'SOURCE_BBC' },
    { patterns: ['뉴욕타임즈', 'new york times'], command: 'SOURCE_NYT' },
  ],
};

// Helper function to extract base64 audio data
function extractAudioData(base64String: string): Buffer {
  // Remove data URL prefix if present
  const base64Data = base64String.includes(',') 
    ? base64String.split(',')[1] 
    : base64String;
  
  return Buffer.from(base64Data, 'base64');
}

// Helper function to match command patterns
function matchCommand(transcript: string): { command: string; confidence: number } | null {
  const normalizedTranscript = transcript.toLowerCase().trim();
  
  for (const category of Object.values(CLEAR_COMMANDS)) {
    for (const commandDef of category) {
      for (const pattern of commandDef.patterns) {
        if (normalizedTranscript.includes(pattern.toLowerCase())) {
          // Calculate confidence based on exact match vs partial match
          const confidence = normalizedTranscript === pattern.toLowerCase() ? 0.95 : 0.85;
          return { command: commandDef.command, confidence };
        }
      }
    }
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audio } = body;

    if (!audio) {
      return NextResponse.json(
        { error: 'Audio data is required' },
        { status: 400 }
      );
    }

    // Extract audio buffer
    const audioBuffer = extractAudioData(audio);

    // Configure recognition request
    const recognitionConfig = {
      encoding: 'WEBM_OPUS' as const,
      sampleRateHertz: 48000,  // WEBM_OPUS uses 48kHz
      languageCode: 'ko-KR',
      alternativeLanguageCodes: ['en-US'], // Support English as well
      maxAlternatives: 3,
      enableWordTimeOffsets: false,
      enableAutomaticPunctuation: true,
      model: 'latest_short', // Optimized for short commands
    };

    const recognitionRequest = {
      config: recognitionConfig,
      audio: {
        content: audioBuffer.toString('base64'),
      },
    };

    // Perform recognition
    const [response] = await speechClient.recognize(recognitionRequest);
    const results = response.results || [];

    if (results.length === 0 || !results[0].alternatives || results[0].alternatives.length === 0) {
      return NextResponse.json({
        type: 'fallback',
        reason: 'no_transcription',
      });
    }

    // Get the most confident transcription
    const topAlternative = results[0].alternatives[0];
    const transcript = topAlternative.transcript || '';
    const sttConfidence = topAlternative.confidence || 0;

    console.log('STT Result:', {
      transcript,
      confidence: sttConfidence,
      alternatives: results[0].alternatives.map(alt => ({
        transcript: alt.transcript,
        confidence: alt.confidence,
      })),
    });

    // Try to match command
    const commandMatch = matchCommand(transcript);

    if (commandMatch && sttConfidence >= 0.7) {
      // Clear command detected
      return NextResponse.json({
        type: 'command',
        payload: commandMatch.command,
        transcript,
        confidence: Math.min(sttConfidence, commandMatch.confidence),
      });
    }

    // Check if confidence is too low or transcript is too short
    if (sttConfidence < 0.6 || transcript.length < 2) {
      return NextResponse.json({
        type: 'fallback',
        transcript,
        reason: 'low_confidence',
      });
    }

    // Check if transcript seems like a complex request
    const complexIndicators = [
      '있잖아', '그거', '아까', '뭐였', '어떻게', '왜', 
      '좀', '어려', '쉬운', '다른', '말고', '찾아',
      'what', 'how', 'why', 'when', 'where', 'which'
    ];

    const isComplex = complexIndicators.some(indicator => 
      transcript.toLowerCase().includes(indicator)
    );

    if (isComplex) {
      return NextResponse.json({
        type: 'fallback',
        transcript,
        reason: 'complex_request',
      });
    }

    // No clear command and not obviously complex - still fallback
    return NextResponse.json({
      type: 'fallback',
      transcript,
      reason: 'unclear_intent',
    });

  } catch (error) {
    console.error('STT Command processing error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Check if it's a Google Cloud API error
    if (error instanceof Error) {
      if (error.message.includes('UNAUTHENTICATED')) {
        return NextResponse.json(
          { 
            error: 'Google Cloud credentials not configured',
            details: error.message,
            credentialPath: credentialPath,
            fileExists: fs.existsSync(credentialPath)
          },
          { status: 500 }
        );
      }
      
      // Return more detailed error information
      return NextResponse.json(
        { 
          error: 'Failed to process audio',
          message: error.message,
          type: error.name
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Unknown error occurred' },
      { status: 500 }
    );
  }
}