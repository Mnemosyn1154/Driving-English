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

    const { mode = 'learn', deviceInfo = null } = await request.json();
    
    // 학습 세션 시작
    const session = await prisma.learningSession.create({
      data: {
        userId: auth.userId!,
        mode,
        deviceInfo,
        startTime: new Date()
      }
    });

    return NextResponse.json({
      sessionId: session.id,
      startTime: session.startTime,
      mode: session.mode
    });

  } catch (error) {
    console.error('Error starting learning session:', error);
    return NextResponse.json(
      { error: 'Failed to start learning session' },
      { status: 500 }
    );
  }
}