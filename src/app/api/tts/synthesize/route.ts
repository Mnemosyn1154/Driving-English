/**
 * TTS Synthesis API Endpoint
 * POST /api/tts/synthesize
 */

import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechService } from '@/services/server/tts/textToSpeech';
import { TTSRequest } from '@/types/translation';
import { v4 as uuidv4 } from 'uuid';

// Initialize TTS service
const ttsService = new TextToSpeechService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    if (!body.text || !body.language) {
      return NextResponse.json(
        { error: 'Missing required fields: text and language' },
        { status: 400 }
      );
    }

    // Create TTS request
    const ttsRequest: TTSRequest = {
      id: body.id || uuidv4(),
      text: body.text,
      language: body.language,
      voice: body.voice,
      speed: body.speed || 1.0,
      pitch: body.pitch || 0,
      volumeGain: body.volumeGain || 0,
      ssml: body.ssml || false,
    };

    // Synthesize speech
    const result = await ttsService.synthesize(ttsRequest);

    // Return result
    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        audioUrl: result.audioUrl,
        audioBase64: result.audioBase64,
        duration: result.duration,
        format: result.format,
        sampleRate: result.sampleRate,
      },
    });
  } catch (error: any) {
    console.error('TTS synthesis error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to synthesize speech',
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}