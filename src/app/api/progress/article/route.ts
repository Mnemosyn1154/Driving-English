import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthContext } from '@/lib/api-auth';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { 
      articleId, 
      currentSentence, 
      totalSentences, 
      isCompleted = false,
      isBookmarked = false,
      readingTime = 0 
    } = await request.json();
    
    if (!articleId) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { status: 400 }
      );
    }

    // 진도 계산
    const progressPercentage = totalSentences > 0 ? (currentSentence / totalSentences) * 100 : 0;

    // 기사 진도 업데이트
    const progress = await prisma.userArticleProgress.upsert({
      where: {
        userId_articleId: {
          userId: auth.userId!,
          articleId
        }
      },
      update: {
        currentSentence,
        totalSentences,
        progressPercentage,
        isCompleted,
        isBookmarked,
        lastReadAt: new Date(),
        readingTime: {
          increment: readingTime
        }
      },
      create: {
        userId: auth.userId!,
        articleId,
        currentSentence,
        totalSentences,
        progressPercentage,
        isCompleted,
        isBookmarked,
        lastReadAt: new Date(),
        readingTime
      }
    });

    return NextResponse.json({
      progressId: progress.id,
      currentSentence: progress.currentSentence,
      totalSentences: progress.totalSentences,
      progressPercentage: progress.progressPercentage,
      isCompleted: progress.isCompleted,
      isBookmarked: progress.isBookmarked
    });

  } catch (error) {
    console.error('Error updating article progress:', error);
    return NextResponse.json(
      { error: 'Failed to update article progress' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('articleId');
    
    if (!articleId) {
      return NextResponse.json(
        { error: 'Article ID is required' },
        { status: 400 }
      );
    }

    // 기사 진도 조회
    const progress = await prisma.userArticleProgress.findUnique({
      where: {
        userId_articleId: {
          userId: auth.userId!,
          articleId
        }
      }
    });

    if (!progress) {
      return NextResponse.json({
        currentSentence: 0,
        totalSentences: 0,
        progressPercentage: 0,
        isCompleted: false,
        isBookmarked: false,
        readingTime: 0
      });
    }

    return NextResponse.json({
      currentSentence: progress.currentSentence,
      totalSentences: progress.totalSentences,
      progressPercentage: progress.progressPercentage,
      isCompleted: progress.isCompleted,
      isBookmarked: progress.isBookmarked,
      readingTime: progress.readingTime,
      lastReadAt: progress.lastReadAt
    });

  } catch (error) {
    console.error('Error fetching article progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article progress' },
      { status: 500 }
    );
  }
}