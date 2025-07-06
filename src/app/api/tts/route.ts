import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechService } from '@/services/server/tts/textToSpeech';
import { TTSRequest } from '@/types/translation';

const ttsService = new TextToSpeechService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    if (!body.text || !body.language) {
      return NextResponse.json(
        { error: 'Missing required fields: text, language' },
        { status: 400 }
      );
    }

    const ttsRequest: TTSRequest = {
      id: body.id || `tts_${Date.now()}`,
      text: body.text,
      language: body.language,
      voice: body.voice,
      speed: body.speed,
      pitch: body.pitch,
      volumeGain: body.volumeGain,
      ssml: body.ssml,
    };

    // Generate audio
    const result = await ttsService.synthesize(ttsRequest);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('TTS error:', error);
    return NextResponse.json(
      { error: 'TTS synthesis failed', details: error.message },
      { status: 500 }
    );
  }
}

// Batch TTS endpoint
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.requests || !Array.isArray(body.requests)) {
      return NextResponse.json(
        { error: 'Missing required field: requests (array)' },
        { status: 400 }
      );
    }

    const result = await ttsService.synthesizeBatch({
      requests: body.requests,
      outputFormat: body.outputFormat,
      quality: body.quality,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Batch TTS error:', error);
    return NextResponse.json(
      { error: 'Batch TTS failed', details: error.message },
      { status: 500 }
    );
  }
}