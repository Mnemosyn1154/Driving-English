import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { rssSourceService } from '@/services/server/rss/rssSourceService';

/**
 * GET /api/rss/sources
 * Get RSS sources (system + user sources)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const { searchParams } = new URL(request.url);
    
    const category = searchParams.get('category') || undefined;
    const enabled = searchParams.get('enabled') === 'true' ? true : 
                   searchParams.get('enabled') === 'false' ? false : undefined;
    const type = searchParams.get('type') as 'RSS' | 'USER_RSS' | 'ALL' | null;

    const sources = await rssSourceService.getAllSources({
      userId: auth.userId || undefined,
      category,
      enabled,
      type: type || 'ALL',
    });

    return NextResponse.json({
      sources,
      count: sources.length,
    });
  } catch (error: any) {
    console.error('Error fetching RSS sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS sources', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rss/sources
 * Create a new RSS source
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const body = await request.json();
    
    const { name, url, category = 'general', enabled = true, updateInterval } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      );
    }

    // Validate the feed first
    const validation = await rssSourceService.validateFeed(url);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid RSS feed', details: validation.error },
        { status: 400 }
      );
    }

    // Create the source
    const source = await rssSourceService.createSource({
      name: name || validation.feedInfo?.title || 'Unnamed Feed',
      url,
      category,
      enabled,
      updateInterval,
      userId: auth.userId || undefined,
    });

    return NextResponse.json({
      message: 'RSS source created successfully',
      source,
      feedInfo: validation.feedInfo,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating RSS source:', error);
    
    if (error.message.includes('already exists')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create RSS source', details: error.message },
      { status: 500 }
    );
  }
}