import { NextRequest, NextResponse } from 'next/server';
import { NewsService } from '@/services/server/news/newsService';
import { isMockMode } from '@/lib/env';
import { mockArticles } from '@/services/server/mock/mockData';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { articleId } = await params;
    
    // Use mock data if in mock mode
    if (isMockMode) {
      const article = mockArticles.find(a => a.id === articleId);
      if (!article) {
        return NextResponse.json(
          { error: 'Article not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(article);
    }
    
    const newsService = new NewsService();
    const article = await newsService.getArticle(articleId);

    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}