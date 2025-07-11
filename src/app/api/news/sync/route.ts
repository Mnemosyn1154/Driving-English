import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { lastSync } = await request.json();
    const lastSyncDate = lastSync ? new Date(lastSync) : new Date(0);

    // Get user preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { categories: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get articles published after last sync
    const articles = await prisma.article.findMany({
      where: {
        publishedAt: { gt: lastSyncDate },
        category: {
          in: user.categories.map(c => c.id),
        },
      },
      include: {
        sentences: {
          include: {
            translation: true,
            audio: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 20, // Limit to 20 most recent articles
    });

    // Format articles for client-side caching
    const formattedArticles = articles.map(article => ({
      id: article.id,
      title: article.title,
      content: article.content,
      category: article.category,
      publishedAt: article.publishedAt.toISOString(),
      sentences: article.sentences.map(sentence => ({
        id: sentence.id,
        text: sentence.text,
        order: sentence.order,
        translation: sentence.translation?.translatedText || null,
        audioUrl: sentence.audio?.audioUrl || null,
      })),
    }));

    // Get user's recent progress
    const recentProgress = await prisma.userProgress.findMany({
      where: {
        userId: session.user.id,
        updatedAt: { gt: lastSyncDate },
      },
      select: {
        articleId: true,
        currentSentenceIndex: true,
        completed: true,
      },
    });

    return NextResponse.json({
      success: true,
      articles: formattedArticles,
      progress: recentProgress,
      syncTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('News sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync news' },
      { status: 500 }
    );
  }
}