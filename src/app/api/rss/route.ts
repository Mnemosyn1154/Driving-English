import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-auth';

// GET /api/rss - 사용자 RSS 피드 목록 조회
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user or device user
    const auth = await getAuthContext(request);
    
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // RSS 피드 목록 조회
    const feeds = await prisma.userRssFeed.findMany({
      where: { userId: auth.userId! },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ feeds });
  } catch (error) {
    console.error('Error fetching RSS feeds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS feeds' },
      { status: 500 }
    );
  }
}

// POST /api/rss - 새 RSS 피드 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, category } = body;
    
    if (!url) {
      return NextResponse.json(
        { error: 'RSS feed URL is required' },
        { status: 400 }
      );
    }
    
    // Get authenticated user or device user
    const auth = await getAuthContext(request);
    
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // 중복 확인
    const existing = await prisma.userRssFeed.findFirst({
      where: {
        userId: auth.userId!,
        url
      }
    });
    
    if (existing) {
      return NextResponse.json(
        { error: 'RSS feed already exists' },
        { status: 409 }
      );
    }
    
    // RSS 피드 추가
    const feed = await prisma.userRssFeed.create({
      data: {
        userId: auth.userId!,
        name: name || new URL(url).hostname,
        url,
        category: category || 'general',
        enabled: true
      }
    });
    
    return NextResponse.json({
      message: 'RSS feed added successfully',
      feed
    });
  } catch (error) {
    console.error('Error adding RSS feed:', error);
    return NextResponse.json(
      { error: 'Failed to add RSS feed' },
      { status: 500 }
    );
  }
}

// PUT /api/rss - RSS 피드 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { feedId, name, enabled, category } = body;
    
    if (!feedId) {
      return NextResponse.json(
        { error: 'Feed ID is required' },
        { status: 400 }
      );
    }
    
    // Get authenticated user or device user
    const auth = await getAuthContext(request);
    
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // 피드 소유권 확인
    const feed = await prisma.userRssFeed.findFirst({
      where: {
        id: feedId,
        userId: auth.userId!
      }
    });
    
    if (!feed) {
      return NextResponse.json(
        { error: 'RSS feed not found' },
        { status: 404 }
      );
    }
    
    // 피드 업데이트
    const updated = await prisma.userRssFeed.update({
      where: { id: feedId },
      data: {
        ...(name !== undefined && { name }),
        ...(enabled !== undefined && { enabled }),
        ...(category !== undefined && { category })
      }
    });
    
    return NextResponse.json({
      message: 'RSS feed updated successfully',
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

// DELETE /api/rss - RSS 피드 삭제
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
    
    // Get authenticated user or device user
    const auth = await getAuthContext(request);
    
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // 피드 소유권 확인
    const feed = await prisma.userRssFeed.findFirst({
      where: {
        id: feedId,
        userId: auth.userId!
      }
    });
    
    if (!feed) {
      return NextResponse.json(
        { error: 'RSS feed not found' },
        { status: 404 }
      );
    }
    
    // 피드 삭제
    await prisma.userRssFeed.delete({
      where: { id: feedId }
    });
    
    return NextResponse.json({
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