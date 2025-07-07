import { NextRequest, NextResponse } from 'next/server';
import { NewsService } from '@/services/server/news/newsService';
import { isMockMode } from '@/lib/env';
import { mockArticles } from '@/services/server/mock/mockData';

export async function GET(
  request: NextRequest,
  { params }: { params: { articleId: string } }
) {
  try {
    // Use mock data if in mock mode
    if (isMockMode) {
      const article = mockArticles.find(a => a.id === params.articleId);
      if (!article) {
        return NextResponse.json(
          { error: 'Article not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(article);
    }
    
    const newsService = new NewsService();
    const article = await newsService.getArticle(params.articleId);

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