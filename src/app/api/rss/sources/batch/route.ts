import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { rssSourceService } from '@/services/server/rss/rssSourceService';

/**
 * POST /api/rss/sources/batch
 * Batch operations on RSS sources
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication for batch operations
    const auth = await requireAuth(request);
    const body = await request.json();
    
    const { action, sourceIds } = body;

    if (!action || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return NextResponse.json(
        { error: 'Action and sourceIds array are required' },
        { status: 400 }
      );
    }

    // Validate action
    const validActions = ['fetch', 'enable', 'disable', 'delete'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate user has access to all sources
    const sources = await Promise.all(
      sourceIds.map(id => rssSourceService.getSourceById(id, auth.userId || undefined))
    );

    const notFound = sourceIds.filter((id, index) => !sources[index]);
    if (notFound.length > 0) {
      return NextResponse.json(
        { error: `Sources not found: ${notFound.join(', ')}` },
        { status: 404 }
      );
    }

    // Perform batch action
    let result;
    
    switch (action) {
      case 'fetch':
        result = await rssSourceService.batchFetch(sourceIds);
        break;
        
      case 'enable':
        result = await batchUpdate(sourceIds, { enabled: true }, auth.userId || undefined);
        break;
        
      case 'disable':
        result = await batchUpdate(sourceIds, { enabled: false }, auth.userId || undefined);
        break;
        
      case 'delete':
        result = await batchDelete(sourceIds, auth.userId || undefined);
        break;
        
      default:
        throw new Error('Invalid action');
    }

    return NextResponse.json({
      message: `Batch ${action} completed`,
      result,
    });
  } catch (error: any) {
    console.error('Error in batch operation:', error);
    return NextResponse.json(
      { error: 'Batch operation failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Batch update helper
 */
async function batchUpdate(
  sourceIds: string[],
  data: { enabled?: boolean; category?: string },
  userId?: string
): Promise<{ updated: number; errors: string[] }> {
  const results = {
    updated: 0,
    errors: [] as string[],
  };

  for (const sourceId of sourceIds) {
    try {
      await rssSourceService.updateSource(sourceId, data, userId);
      results.updated++;
    } catch (error) {
      results.errors.push(`Failed to update ${sourceId}: ${error}`);
    }
  }

  return results;
}

/**
 * Batch delete helper
 */
async function batchDelete(
  sourceIds: string[],
  userId?: string
): Promise<{ deleted: number; errors: string[] }> {
  const results = {
    deleted: 0,
    errors: [] as string[],
  };

  for (const sourceId of sourceIds) {
    try {
      await rssSourceService.deleteSource(sourceId, userId);
      results.deleted++;
    } catch (error) {
      results.errors.push(`Failed to delete ${sourceId}: ${error}`);
    }
  }

  return results;
}