import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { items } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Process batch progress updates
    const results = await Promise.allSettled(
      items.map(async (item) => {
        const { articleId, sentenceIndex, completed } = item;

        // Find or create progress record
        const existingProgress = await prisma.userProgress.findFirst({
          where: {
            userId: session.user.id,
            articleId,
          },
        });

        if (existingProgress) {
          // Update existing progress
          return prisma.userProgress.update({
            where: { id: existingProgress.id },
            data: {
              currentSentenceIndex: Math.max(
                existingProgress.currentSentenceIndex,
                sentenceIndex
              ),
              completed: completed || existingProgress.completed,
              lastAccessedAt: new Date(),
            },
          });
        } else {
          // Create new progress
          return prisma.userProgress.create({
            data: {
              userId: session.user.id,
              articleId,
              currentSentenceIndex: sentenceIndex,
              completed,
              lastAccessedAt: new Date(),
            },
          });
        }
      })
    );

    // Count successful and failed updates
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      processed: items.length,
      successful,
      failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Batch progress update error:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}