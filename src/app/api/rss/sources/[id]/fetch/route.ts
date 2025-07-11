import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { rssSourceService } from '@/services/server/rss/rssSourceService';
import { newsQueue } from '@/services/server/jobs/queue';

interface Params {
  params: { id: string };
}

/**
 * POST /api/rss/sources/[id]/fetch
 * Fetch articles from a specific RSS source
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    // Require authentication for manual fetch
    const auth = await requireAuth(request);
    
    // Check if source exists and user has access
    const source = await rssSourceService.getSourceById(
      params.id,
      auth.userId || undefined
    );

    if (!source) {
      return NextResponse.json(
        { error: 'RSS source not found' },
        { status: 404 }
      );
    }

    if (!source.enabled) {
      return NextResponse.json(
        { error: 'RSS source is disabled' },
        { status: 400 }
      );
    }

    // Option 1: Direct fetch (immediate)
    const immediate = request.nextUrl.searchParams.get('immediate') === 'true';
    
    if (immediate) {
      const result = await rssSourceService.fetchFromSource(params.id);
      
      return NextResponse.json({
        message: result.success ? 'Fetch completed' : 'Fetch failed',
        result,
      }, { status: result.success ? 200 : 500 });
    }

    // Option 2: Queue for background processing
    const job = await newsQueue.add('fetch-source', {
      sourceId: params.id,
      category: source.category,
      manual: true,
    });

    return NextResponse.json({
      message: 'Fetch queued for processing',
      jobId: job.id,
      source: {
        id: source.id,
        name: source.name,
        url: source.url,
      },
    });
  } catch (error: any) {
    console.error('Error fetching RSS source:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS source', details: error.message },
      { status: 500 }
    );
  }
}