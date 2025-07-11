import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated Use POST /api/rss/sources/[id]/fetch or POST /api/rss/sources/batch instead
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { feedId } = body;
    
    // Return deprecation notice with proper endpoint info
    return NextResponse.json(
      { 
        error: 'This endpoint is deprecated',
        message: 'Please use the new RSS API endpoints',
        endpoints: {
          fetchSingle: feedId ? `POST /api/rss/sources/${feedId}/fetch` : 'POST /api/rss/sources/[id]/fetch',
          batchFetch: 'POST /api/rss/sources/batch with action="fetch"',
          listSources: 'GET /api/rss/sources',
        }
      },
      { status: 301 }
    );
  } catch (error) {
    console.error('Error in deprecated RSS fetch endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}