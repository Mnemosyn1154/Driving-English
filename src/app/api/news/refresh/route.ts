import { NextRequest, NextResponse } from 'next/server';
import { newsService } from '@/services/server/news/newsService';
import { requireAuth } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const auth = await requireAuth(request);
    
    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const { categories, providers, force } = body;
    
    // Use the new aggregator through newsService
    const result = await newsService.aggregateNews({
      categories,
      providers,
      force,
    });
    
    // Get statistics
    const stats = await newsService.getAggregationStatistics();
    
    return NextResponse.json({ 
      message: 'News refresh completed',
      result,
      statistics: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error refreshing news:', error);
    return NextResponse.json(
      { error: 'Failed to refresh news', details: error.message },
      { status: 500 }
    );
  }
}