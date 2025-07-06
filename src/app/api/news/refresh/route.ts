import { NextRequest, NextResponse } from 'next/server';
import { NewsFetcher } from '@/services/server/news/fetcher';

export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication to protect this endpoint
    
    const fetcher = new NewsFetcher();
    
    // Fetch updates from sources that need refreshing
    const results = await fetcher.fetchUpdates();
    
    const summary = {
      sourcesUpdated: results.length,
      totalArticles: results.reduce((sum, r) => sum + r.articlesCount, 0),
      errors: results.filter(r => r.errors && r.errors.length > 0).length,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({ 
      message: 'News refresh completed',
      summary,
      results,
    });
  } catch (error: any) {
    console.error('Error refreshing news:', error);
    return NextResponse.json(
      { error: 'Failed to refresh news', details: error.message },
      { status: 500 }
    );
  }
}