import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userService } from '@/lib/user-service';
import { createClient } from '@/lib/supabase-server';

interface BatchFeedInput {
  name: string;
  url: string;
  category?: string;
}

// POST /api/rss/batch - 여러 RSS 피드 한번에 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { feeds, deviceId } = body;
    
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
    
    // Supabase 인증 확인
    const supabase = createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    
    // 사용자 확인
    const user = await userService.ensureUser(supabaseUser, deviceId || undefined);
    
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
            userId: user.id,
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
            userId: user.id,
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
      Promise.all(
        results.added.map(feed =>
          fetch(new URL('/api/rss/fetch', request.url).toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              feedId: feed.id,
              deviceId 
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