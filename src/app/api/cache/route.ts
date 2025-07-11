import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { cacheService } from '@/services/server/cache/CacheService';
import { getCacheHealth, performManualCleanup } from '@/services/server/jobs/processors/cacheProcessorV2';

/**
 * GET /api/cache
 * Get cache statistics and health status
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    await requireAuth(request);

    // Get cache statistics
    const stats = await cacheService.getStats();
    const health = await getCacheHealth();

    return NextResponse.json({
      stats,
      health,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching cache stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cache statistics', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cache
 * Clear cache by type or pattern
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    await requireAuth(request);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'all' | 'translation' | 'audio' | 'article' | 'stats' | null;
    const pattern = searchParams.get('pattern');
    const force = searchParams.get('force') === 'true';

    let result;

    if (pattern) {
      // Delete by pattern
      const deletedCount = await cacheService.deleteByPattern(pattern);
      result = {
        deletedCount,
        pattern,
      };
    } else {
      // Perform cleanup by type
      result = await performManualCleanup({
        type: type || 'all',
        force,
      });
    }

    return NextResponse.json({
      message: 'Cache cleared successfully',
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error clearing cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cache/warmup
 * Warm up cache with frequently accessed data
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    await requireAuth(request);

    // Parse request body
    const body = await request.json();
    const { types = ['all'] } = body;

    const results = {
      warmedUp: 0,
      errors: [] as string[],
    };

    // Warm up different cache types
    if (types.includes('all') || types.includes('translation')) {
      // Get frequently used translations and cache them
      try {
        const { prisma } = await import('@/services/server/database/prisma');
        const frequentTranslations = await prisma.translationLog.groupBy({
          by: ['originalText', 'translatedText', 'targetLanguage'],
          _count: true,
          orderBy: {
            _count: {
              originalText: 'desc',
            },
          },
          take: 100,
        });

        const { DomainCacheHelpers } = await import('@/services/server/cache/CacheService');
        for (const item of frequentTranslations) {
          await DomainCacheHelpers.cacheTranslation(
            item.originalText,
            item.translatedText,
            item.targetLanguage
          );
          results.warmedUp++;
        }
      } catch (error) {
        results.errors.push(`Failed to warm up translations: ${error}`);
      }
    }

    return NextResponse.json({
      message: 'Cache warmup completed',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error warming up cache:', error);
    return NextResponse.json(
      { error: 'Failed to warm up cache', details: error.message },
      { status: 500 }
    );
  }
}