import { NextRequest, NextResponse } from 'next/server';
import Parser from 'rss-parser';

// POST /api/rss/validate - RSS URL 유효성 검사
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;
    
    if (!url) {
      return NextResponse.json(
        { error: 'RSS feed URL is required' },
        { status: 400 }
      );
    }
    
    // URL 형식 검증
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return NextResponse.json({
          valid: false,
          error: 'Invalid URL protocol. Only HTTP and HTTPS are supported.'
        });
      }
    } catch {
      return NextResponse.json({
        valid: false,
        error: 'Invalid URL format'
      });
    }
    
    // RSS 피드 파싱 시도
    const parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'Driving English News Bot/1.0',
      },
    });
    
    try {
      const feed = await parser.parseURL(url);
      
      if (!feed.items || feed.items.length === 0) {
        return NextResponse.json({
          valid: false,
          error: 'RSS feed is empty or has no items'
        });
      }
      
      // 피드 정보 반환
      return NextResponse.json({
        valid: true,
        feedInfo: {
          title: feed.title || 'Unknown Feed',
          description: feed.description,
          link: feed.link,
          itemCount: feed.items.length,
          latestItem: feed.items[0] ? {
            title: feed.items[0].title,
            pubDate: feed.items[0].pubDate
          } : null
        }
      });
      
    } catch (parseError: any) {
      return NextResponse.json({
        valid: false,
        error: `Failed to parse RSS feed: ${parseError.message || 'Unknown error'}`
      });
    }
    
  } catch (error) {
    console.error('Error validating RSS feed:', error);
    return NextResponse.json(
      { 
        valid: false,
        error: 'Internal server error while validating RSS feed' 
      },
      { status: 500 }
    );
  }
}