import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { rssSourceService } from '@/services/server/rss/rssSourceService';

/**
 * GET /api/rss/statistics
 * Get RSS sources statistics
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    const { searchParams } = new URL(request.url);
    
    const sourceId = searchParams.get('sourceId') || undefined;
    
    // Get statistics
    const stats = await rssSourceService.getStatistics(sourceId);
    
    // If user is authenticated, add user-specific stats
    let userStats;
    if (auth.userId) {
      const userSources = await rssSourceService.getAllSources({
        userId: auth.userId,
        type: 'USER_RSS',
      });
      
      userStats = {
        userSourcesCount: userSources.length,
        userEnabledCount: userSources.filter(s => s.enabled).length,
      };
    }

    return NextResponse.json({
      statistics: {
        ...stats,
        ...userStats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching RSS statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS statistics', details: error.message },
      { status: 500 }
    );
  }
}