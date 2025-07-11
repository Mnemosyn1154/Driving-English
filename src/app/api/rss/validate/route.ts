import { NextRequest, NextResponse } from 'next/server';
import { rssSourceService } from '@/services/server/rss/rssSourceService';

/**
 * POST /api/rss/validate
 * Validate an RSS feed URL
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format first
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { 
          valid: false, 
          error: 'Invalid URL format' 
        },
        { status: 400 }
      );
    }

    // Validate RSS feed
    const result = await rssSourceService.validateFeed(url);

    return NextResponse.json(result, { 
      status: result.valid ? 200 : 400 
    });
  } catch (error: any) {
    console.error('Error validating RSS feed:', error);
    return NextResponse.json(
      { 
        valid: false,
        error: 'Failed to validate RSS feed',
        details: error.message 
      },
      { status: 500 }
    );
  }
}