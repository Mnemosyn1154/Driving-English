import { NextRequest, NextResponse } from 'next/server';
import { newsService } from '@/services/server/news/newsService';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET /api/news/providers
 * Get list of available news providers and their statistics
 */
export async function GET(request: NextRequest) {
  try {
    const providers = await newsService.getProviders();
    
    return NextResponse.json({
      providers,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching providers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch providers', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/news/providers/refresh
 * Refresh specific providers
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const auth = await requireAuth(request);
    
    // Parse request body
    const body = await request.json();
    const { providers } = body;
    
    if (!Array.isArray(providers)) {
      return NextResponse.json(
        { error: 'Invalid request: providers must be an array' },
        { status: 400 }
      );
    }
    
    // Refresh specified providers
    const result = await newsService.refreshProviders(providers);
    
    return NextResponse.json({
      message: 'Providers refreshed successfully',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error refreshing providers:', error);
    return NextResponse.json(
      { error: 'Failed to refresh providers', details: error.message },
      { status: 500 }
    );
  }
}