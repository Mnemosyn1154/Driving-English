import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthContext } from '@/lib/api-auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    
    // Skip auth 모드일 때는 샘플 데이터 사용
    if (!auth.isAuthenticated) {
      return NextResponse.json({
        articles: [
          {
            id: '1',
            title: 'Tech Giants Report Record Profits Despite Economic Uncertainty',
            source: 'TechCrunch',
            readAt: '2시간 전',
            completionRate: 100,
            bookmarked: true
          },
          {
            id: '2',
            title: 'Climate Scientists Warn of Accelerating Global Warming',
            source: 'BBC News',
            readAt: '5시간 전',
            completionRate: 75,
            bookmarked: false
          },
          {
            id: '3',
            title: 'New AI Model Achieves Breakthrough in Language Understanding',
            source: 'MIT Tech Review',
            readAt: '어제',
            completionRate: 100,
            bookmarked: true
          },
          {
            id: '4',
            title: 'Global Markets React to Federal Reserve Decision',
            source: 'Reuters Business',
            readAt: '2일 전',
            completionRate: 50,
            bookmarked: false
          },
          {
            id: '5',
            title: 'Space Exploration: New Discoveries from Mars Rover',
            source: 'NASA News',
            readAt: '3일 전',
            completionRate: 100,
            bookmarked: false
          }
        ]
      });
    }
    
    const userId = auth.userId!;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '5');
    
    // 최근 읽은 기사 가져오기
    const recentProgress = await prisma.userArticleProgress.findMany({
      where: {
        userId,
        lastReadAt: {
          not: null
        }
      },
      include: {
        article: {
          include: {
            source: true
          }
        }
      },
      orderBy: {
        lastReadAt: 'desc'
      },
      take: limit
    });
    
    // 결과 포맷팅
    const articles = recentProgress.map(progress => {
      const now = new Date();
      const readAt = progress.lastReadAt!;
      const diffMinutes = Math.floor((now.getTime() - readAt.getTime()) / (1000 * 60));
      
      let readAtText = '';
      if (diffMinutes < 60) {
        readAtText = `${diffMinutes}분 전`;
      } else if (diffMinutes < 60 * 24) {
        readAtText = `${Math.floor(diffMinutes / 60)}시간 전`;
      } else if (diffMinutes < 60 * 24 * 7) {
        readAtText = `${Math.floor(diffMinutes / (60 * 24))}일 전`;
      } else {
        readAtText = readAt.toLocaleDateString('ko-KR');
      }
      
      return {
        id: progress.article.id,
        title: progress.article.title,
        source: progress.article.source?.name || 'Unknown',
        readAt: readAtText,
        completionRate: progress.isCompleted ? 100 : Math.round(progress.progressPercentage),
        bookmarked: progress.isBookmarked
      };
    });
    
    return NextResponse.json({
      articles
    });
    
  } catch (error) {
    console.error('Error fetching recent articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent articles' },
      { status: 500 }
    );
  }
}