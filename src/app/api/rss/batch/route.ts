import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-auth';

interface BatchFeedInput {
  name: string;
  url: string;
  category?: string;
}

// POST /api/rss/batch - 여러 RSS 피드 한번에 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { feeds } = body;
    
    if (!feeds || !Array.isArray(feeds) || feeds.length === 0) {
      return NextResponse.json(
        { error: 'Feeds array is required' },
        { status: 400 }
      );
    }
    
    // 최대 10개까지만 한번에 추가 가능
    if (feeds.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 feeds can be added at once' },
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
    
    const results = {
      added: [] as any[],
      skipped: [] as any[],
      errors: [] as string[],
    };
    
    // 각 피드 처리
    for (const feedInput of feeds) {
      try {
        // URL 검증
        if (!feedInput.url) {
          results.errors.push(`Invalid URL for ${feedInput.name}`);
          continue;
        }
        
        // 중복 확인
        const existing = await prisma.userRssFeed.findFirst({
          where: {
            userId: auth.userId!,
            url: feedInput.url
          }
        });
        
        if (existing) {
          results.skipped.push({
            name: feedInput.name,
            url: feedInput.url,
            reason: 'Already exists'
          });
          continue;
        }
        
        // RSS 피드 추가
        const feed = await prisma.userRssFeed.create({
          data: {
            userId: auth.userId!,
            name: feedInput.name || new URL(feedInput.url).hostname,
            url: feedInput.url,
            category: feedInput.category || 'general',
            enabled: true
          }
        });
        
        results.added.push(feed);
        
      } catch (error: any) {
        results.errors.push(`Failed to add ${feedInput.name}: ${error.message}`);
      }
    }
    
    // 추가된 피드들의 뉴스 수집 요청 (백그라운드)
    if (results.added.length > 0) {
      // 각 피드별로 수집 작업 시작
      // Pass authentication headers for internal API calls
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      // Pass device ID if it's skipAuth
      if (auth.isSkipAuth && auth.deviceId) {
        headers['x-device-id'] = auth.deviceId;
      }
      
      // Pass cookies for real auth
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        headers['cookie'] = cookieHeader;
      }
      
      Promise.all(
        results.added.map(feed =>
          fetch(new URL('/api/rss/fetch', request.url).toString(), {
            method: 'POST',
            headers,
            body: JSON.stringify({ 
              feedId: feed.id
            })
          })
        )
      ).catch(error => {
        console.error('Failed to start feed fetching:', error);
      });
    }
    
    return NextResponse.json({
      message: `Successfully added ${results.added.length} feeds`,
      results
    });
    
  } catch (error) {
    console.error('Error adding RSS feeds batch:', error);
    return NextResponse.json(
      { error: 'Failed to add RSS feeds' },
      { status: 500 }
    );
  }
}