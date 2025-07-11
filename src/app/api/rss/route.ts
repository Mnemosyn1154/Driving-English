import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated Use /api/rss/sources instead
 */
// GET /api/rss - 사용자 RSS 피드 목록 조회
export async function GET(request: NextRequest) {
  // Redirect to new endpoint
  const { searchParams } = new URL(request.url);
  searchParams.set('type', 'USER_RSS');
  
  return NextResponse.json(
    { 
      error: 'This endpoint has been moved',
      redirect: `/api/rss/sources?${searchParams.toString()}`,
      message: 'Please use GET /api/rss/sources?type=USER_RSS instead'
    },
    { 
      status: 301,
      headers: {
        'Location': `/api/rss/sources?${searchParams.toString()}`
      }
    }
  );
}

// Original implementation (deprecated)
export async function GET_DEPRECATED(request: NextRequest) {
  try {
    const { prisma } = await import('@/lib/prisma');
    const { getAuthContext } = await import('@/lib/api-auth');
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
  // Return deprecation notice instead of redirecting
  return NextResponse.json(
    { 
      error: 'This endpoint has been moved',
      message: 'Please use POST /api/rss/sources instead',
      endpoint: '/api/rss/sources'
    },
    { status: 301 }
  );
}

// PUT /api/rss - RSS 피드 수정
export async function PUT(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'This endpoint has been moved',
      message: 'Please use PUT /api/rss/sources/{id} instead',
      endpoint: '/api/rss/sources/{id}'
    },
    { status: 301 }
  );
}

// DELETE /api/rss - RSS 피드 삭제
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const feedId = searchParams.get('feedId');
  
  return NextResponse.json(
    { 
      error: 'This endpoint has been moved',
      message: `Please use DELETE /api/rss/sources/${feedId || '{id}'} instead`,
      endpoint: `/api/rss/sources/${feedId || '{id}'}`
    },
    { status: 301 }
  );
}