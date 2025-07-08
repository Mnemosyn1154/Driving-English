import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { userService } from '@/lib/user-service';
import { createClient } from '@/lib/supabase-server';
import { rssParser } from '@/services/server/news/rssParser';

// POST /api/rss/fetch - 사용자 RSS 피드에서 뉴스 수집
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, feedId, forceUpdate = false } = body;
    
    // Supabase 인증 확인
    const supabase = createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    
    // 사용자 확인
    const user = await userService.ensureUser(supabaseUser, deviceId || undefined);
    
    // 특정 피드만 처리하는 경우
    if (feedId) {
      const feed = await prisma.userRssFeed.findFirst({
        where: {
          id: feedId,
          userId: user.id,
          enabled: true
        }
      });
      
      if (!feed) {
        return NextResponse.json(
          { error: 'RSS feed not found or disabled' },
          { status: 404 }
        );
      }
      
      // 마지막 업데이트 확인 (forceUpdate가 아닌 경우)
      if (!forceUpdate && feed.lastFetch) {
        const minutesSinceLastFetch = (Date.now() - feed.lastFetch.getTime()) / (1000 * 60);
        if (minutesSinceLastFetch < 30) { // 30분 이내 재수집 방지
          return NextResponse.json({
            message: 'Feed was recently fetched',
            lastFetch: feed.lastFetch,
            nextFetchAvailable: new Date(feed.lastFetch.getTime() + 30 * 60 * 1000)
          });
        }
      }
      
      // RSS 피드 처리
      const result = await rssParser.processFeed(feed.url, user.id);
      
      // 마지막 수집 시간 업데이트
      await prisma.userRssFeed.update({
        where: { id: feedId },
        data: { lastFetch: new Date() }
      });
      
      return NextResponse.json({
        message: 'RSS feed fetched successfully',
        processed: result.processed,
        errors: result.errors
      });
      
    } else {
      // 사용자의 모든 활성 피드 처리
      const feeds = await prisma.userRssFeed.findMany({
        where: {
          userId: user.id,
          enabled: true
        }
      });
      
      if (feeds.length === 0) {
        return NextResponse.json({
          message: 'No active RSS feeds found',
          processed: 0,
          errors: []
        });
      }
      
      let totalProcessed = 0;
      const allErrors: string[] = [];
      const results: any[] = [];
      
      // 각 피드 처리
      for (const feed of feeds) {
        try {
          // 마지막 업데이트 확인
          if (!forceUpdate && feed.lastFetch) {
            const minutesSinceLastFetch = (Date.now() - feed.lastFetch.getTime()) / (1000 * 60);
            if (minutesSinceLastFetch < 30) {
              results.push({
                feedId: feed.id,
                feedName: feed.name,
                skipped: true,
                reason: 'Recently fetched'
              });
              continue;
            }
          }
          
          // RSS 피드 처리
          const result = await rssParser.processFeed(feed.url, user.id);
          totalProcessed += result.processed;
          
          if (result.errors.length > 0) {
            allErrors.push(...result.errors.map(e => `${feed.name}: ${e}`));
          }
          
          // 마지막 수집 시간 업데이트
          await prisma.userRssFeed.update({
            where: { id: feed.id },
            data: { lastFetch: new Date() }
          });
          
          results.push({
            feedId: feed.id,
            feedName: feed.name,
            processed: result.processed,
            errors: result.errors
          });
          
        } catch (error: any) {
          const errorMsg = `Failed to process ${feed.name}: ${error.message}`;
          allErrors.push(errorMsg);
          results.push({
            feedId: feed.id,
            feedName: feed.name,
            error: error.message
          });
        }
      }
      
      return NextResponse.json({
        message: 'RSS feeds fetched',
        totalProcessed,
        totalFeeds: feeds.length,
        results,
        errors: allErrors
      });
    }
    
  } catch (error) {
    console.error('Error fetching RSS feeds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS feeds' },
      { status: 500 }
    );
  }
}