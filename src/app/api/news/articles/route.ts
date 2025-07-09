import { NextRequest, NextResponse } from 'next/server';
import { NewsService } from '@/services/server/news/newsService';
import { isMockMode } from '@/lib/env';
import { mockArticles } from '@/services/server/mock/mockData';
import { initializeServices } from '@/services/server/startup';

export async function GET(request: NextRequest) {
  try {
    // Initialize services on first request
    await initializeServices();
    
    const searchParams = request.nextUrl.searchParams;
    
    // Use mock data if in mock mode
    if (isMockMode) {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const category = searchParams.get('category');
      
      let filteredArticles = mockArticles;
      if (category) {
        filteredArticles = mockArticles.filter(a => a.category === category);
      }
      
      const start = (page - 1) * limit;
      const paginatedArticles = filteredArticles.slice(start, start + limit);
      
      return NextResponse.json({
        articles: paginatedArticles,
        pagination: {
          page,
          limit,
          total: filteredArticles.length,
          totalPages: Math.ceil(filteredArticles.length / limit),
          hasNext: start + limit < filteredArticles.length,
          hasPrevious: page > 1,
        },
      });
    }
    
    const newsService = new NewsService();

    // Parse filters
    const filters = {
      category: searchParams.get('category') || undefined,
      difficulty: searchParams.get('difficulty') 
        ? parseInt(searchParams.get('difficulty')!)
        : undefined,
      minDifficulty: searchParams.get('minDifficulty')
        ? parseInt(searchParams.get('minDifficulty')!)
        : undefined,
      maxDifficulty: searchParams.get('maxDifficulty')
        ? parseInt(searchParams.get('maxDifficulty')!)
        : undefined,
      // isProcessed: searchParams.get('isProcessed') !== 'false', // 성능 개선을 위해 임시 제거
      search: searchParams.get('search') || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      dateFrom: searchParams.get('dateFrom')
        ? new Date(searchParams.get('dateFrom')!)
        : undefined,
      dateTo: searchParams.get('dateTo')
        ? new Date(searchParams.get('dateTo')!)
        : undefined,
    };

    // Parse pagination
    const pagination = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      orderBy: (searchParams.get('orderBy') || 'publishedAt') as any,
      order: (searchParams.get('order') || 'desc') as any,
    };

    // Validate pagination
    if (pagination.page < 1) pagination.page = 1;
    if (pagination.limit < 1 || pagination.limit > 100) pagination.limit = 20;

    const result = await newsService.getArticles(filters, pagination);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}