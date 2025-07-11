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

    const { sessionId, articlesRead = 0, sentencesRead = 0 } = await request.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // 세션 종료
    const session = await prisma.learningSession.findFirst({
      where: {
        id: sessionId,
        userId: auth.userId!,
        endTime: null
      }
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or already ended' },
        { status: 404 }
      );
    }

    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - session.startTime.getTime()) / (1000 * 60));

    // 세션 업데이트
    const updatedSession = await prisma.learningSession.update({
      where: { id: sessionId },
      data: {
        endTime,
        durationMinutes,
        articlesRead,
        sentencesRead
      }
    });

    // 오늘의 통계 업데이트
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.dailyStats.upsert({
      where: {
        userId_date: {
          userId: auth.userId!,
          date: today
        }
      },
      update: {
        studyMinutes: {
          increment: durationMinutes
        },
        articlesRead: {
          increment: articlesRead
        },
        sentencesRead: {
          increment: sentencesRead
        }
      },
      create: {
        userId: auth.userId!,
        date: today,
        studyMinutes: durationMinutes,
        articlesRead,
        sentencesRead
      }
    });

    return NextResponse.json({
      sessionId: updatedSession.id,
      duration: durationMinutes,
      articlesRead,
      sentencesRead
    });

  } catch (error) {
    console.error('Error ending learning session:', error);
    return NextResponse.json(
      { error: 'Failed to end learning session' },
      { status: 500 }
    );
  }
}