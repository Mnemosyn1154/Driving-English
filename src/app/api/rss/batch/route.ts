import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated Use POST /api/rss/sources/batch instead
 */
export async function POST(request: NextRequest) {
  // Return deprecation notice
  return NextResponse.json(
    { 
      error: 'This endpoint has been moved',
      message: 'Please use POST /api/rss/sources/batch instead',
      endpoint: '/api/rss/sources/batch',
      info: 'Use action parameter to specify the batch operation type'
    },
    { status: 301 }
  );
}