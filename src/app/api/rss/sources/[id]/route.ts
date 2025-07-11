import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/api-auth';
import { rssSourceService } from '@/services/server/rss/rssSourceService';

interface Params {
  params: { id: string };
}

/**
 * GET /api/rss/sources/[id]
 * Get a specific RSS source
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(request);
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

    // Get statistics for this source
    const stats = await rssSourceService.getStatistics(params.id);

    return NextResponse.json({
      source,
      statistics: stats,
    });
  } catch (error: any) {
    console.error('Error fetching RSS source:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS source', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/rss/sources/[id]
 * Update an RSS source
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(request);
    const body = await request.json();
    
    const { name, category, enabled, updateInterval } = body;

    const updated = await rssSourceService.updateSource(
      params.id,
      { name, category, enabled, updateInterval },
      auth.userId || undefined
    );

    return NextResponse.json({
      message: 'RSS source updated successfully',
      source: updated,
    });
  } catch (error: any) {
    console.error('Error updating RSS source:', error);
    
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update RSS source', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rss/sources/[id]
 * Delete an RSS source
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await getAuthContext(request);
    
    await rssSourceService.deleteSource(
      params.id,
      auth.userId || undefined
    );

    return NextResponse.json({
      message: 'RSS source deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting RSS source:', error);
    
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete RSS source', details: error.message },
      { status: 500 }
    );
  }
}