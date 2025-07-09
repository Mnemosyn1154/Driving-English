/**
 * TTS Batch Synthesis API Endpoint
 * POST /api/tts/batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechService } from '@/services/server/tts/textToSpeech';
import { BatchTTSRequest, TTSRequest } from '@/types/translation';
import { v4 as uuidv4 } from 'uuid';

// Initialize TTS service
const ttsService = new TextToSpeechService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    if (!body.requests || !Array.isArray(body.requests) || body.requests.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid requests array' },
        { status: 400 }
      );
    }

    // Validate each request
    const validRequests: TTSRequest[] = body.requests.map((req: any, index: number) => {
      if (!req.text || !req.language) {
        throw new Error(`Request at index ${index} missing required fields`);
      }

      return {
        id: req.id || `${uuidv4()}_${index}`,
        text: req.text,
        language: req.language,
        voice: req.voice,
        speed: req.speed || 1.0,
        pitch: req.pitch || 0,
        volumeGain: req.volumeGain || 0,
        ssml: req.ssml || false,
      };
    });

    // Create batch request
    const batchRequest: BatchTTSRequest = {
      requests: validRequests,
      priority: body.priority,
    };

    // Process batch
    const result = await ttsService.synthesizeBatch(batchRequest);

    // Return result
    return NextResponse.json({
      success: true,
      data: {
        batchId: result.batchId,
        audioFiles: result.audioFiles.map(file => ({
          id: file.id,
          audioUrl: file.audioUrl,
          duration: file.duration,
          format: file.format,
        })),
        successCount: result.successCount,
        failureCount: result.failureCount,
        totalDuration: result.totalDuration,
        errors: result.errors,
      },
    });
  } catch (error: any) {
    console.error('TTS batch synthesis error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process batch synthesis',
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}