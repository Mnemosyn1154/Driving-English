/**
 * TTS Audio File Retrieval API Endpoint
 * GET /api/tts/audio/:id
 */

import { NextRequest, NextResponse } from 'next/server';
import { AudioCache } from '@/services/server/tts/audioCache';

// Initialize audio cache
const audioCache = new AudioCache();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const audioId = params.id;
    
    if (!audioId) {
      return NextResponse.json(
        { error: 'Audio ID is required' },
        { status: 400 }
      );
    }

    // Try to get from cache
    const cacheKey = `audio_${audioId}`;
    const cached = await audioCache.get(cacheKey);
    
    if (cached && cached.audioUrl) {
      // Redirect to cached audio URL
      return NextResponse.redirect(cached.audioUrl);
    }

    // If not in cache, check if it's a direct file request
    if (audioId.endsWith('.mp3')) {
      // For now, return 404 as we don't have actual file storage
      // In production, this would redirect to S3/GCS URL
      return NextResponse.json(
        { error: 'Audio file not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Audio not found in cache' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Audio retrieval error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to retrieve audio',
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}