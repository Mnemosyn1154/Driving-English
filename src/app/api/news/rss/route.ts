import { NextRequest, NextResponse } from 'next/server';
import { rssParser } from '@/services/server/news/rssParser';
import { prisma } from '@/lib/prisma';

/**
 * Process RSS feed
 * POST /api/news/rss
 */
export async function POST(request: NextRequest) {
  try {
    const { feedUrl, userId } = await request.json();

    if (!feedUrl) {
      return NextResponse.json(
        { error: 'Feed URL is required' },
        { status: 400 }
      );
    }

    // Process the RSS feed
    const result = await rssParser.processFeed(feedUrl, userId);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      message: `Processed ${result.processed} articles${result.errors.length > 0 ? ` with ${result.errors.length} errors` : ''}`
    });
  } catch (error) {
    console.error('RSS processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process RSS feed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get user's RSS feeds
 * GET /api/news/rss?userId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const feeds = await prisma.userRssFeed.findMany({
      where: { userId, enabled: true },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      feeds,
      total: feeds.length
    });
  } catch (error) {
    console.error('Error fetching RSS feeds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS feeds' },
      { status: 500 }
    );
  }
}

/**
 * Update RSS feed status
 * PATCH /api/news/rss
 */
export async function PATCH(request: NextRequest) {
  try {
    const { feedId, enabled } = await request.json();

    if (!feedId) {
      return NextResponse.json(
        { error: 'Feed ID is required' },
        { status: 400 }
      );
    }

    const updated = await prisma.userRssFeed.update({
      where: { id: feedId },
      data: { enabled }
    });

    return NextResponse.json({
      success: true,
      feed: updated
    });
  } catch (error) {
    console.error('Error updating RSS feed:', error);
    return NextResponse.json(
      { error: 'Failed to update RSS feed' },
      { status: 500 }
    );
  }
}

/**
 * Delete RSS feed
 * DELETE /api/news/rss?feedId=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feedId = searchParams.get('feedId');

    if (!feedId) {
      return NextResponse.json(
        { error: 'Feed ID is required' },
        { status: 400 }
      );
    }

    await prisma.userRssFeed.delete({
      where: { id: feedId }
    });

    return NextResponse.json({
      success: true,
      message: 'RSS feed deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting RSS feed:', error);
    return NextResponse.json(
      { error: 'Failed to delete RSS feed' },
      { status: 500 }
    );
  }
}