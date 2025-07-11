import { NextRequest, NextResponse } from 'next/server';
import { NewsService } from '@/services/server/news/newsService';
import { isMockMode } from '@/lib/env';
import { mockArticles } from '@/services/server/mock/mockData';
import { initializeServices } from '@/services/server/startup';
import { getAuthContext } from '@/lib/api-auth';
import { prisma } from '@/services/server/database/prisma';

export async function GET(request: NextRequest) {
  try {
    // Skip service initialization for performance
    // await initializeServices();
    
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // New parameter for article type
    
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

    // Parse common filters
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

    // Handle different article types
    switch (type) {
      case 'latest':
        return NextResponse.json(
          await newsService.getLatestArticles(filters, pagination)
        );
      
      case 'personalized': {
        // Get auth context
        const auth = await getAuthContext(request);
        
        if (!auth.isAuthenticated) {
          return NextResponse.json(
            { error: 'Authentication required for personalized news' },
            { status: 401 }
          );
        }
        
        return NextResponse.json(
          await newsService.getPersonalizedArticles(
            auth.userId!,
            auth.deviceId,
            pagination
          )
        );
      }
      
      case 'recommendations': {
        // Get auth context
        const auth = await getAuthContext(request);
        const limit = parseInt(searchParams.get('limit') || '5');
        
        if (!auth.isAuthenticated) {
          // Return default recommendations for non-authenticated users
          // Direct query for better performance
          const articles = await prisma.article.findMany({
            where: { isProcessed: true },
            include: { source: true },
            orderBy: { publishedAt: 'desc' },
            take: limit,
          });
          
          return NextResponse.json({
            articles,
            pagination: {
              page: 1,
              limit,
              total: articles.length,
              hasNext: false,
              hasPrevious: false,
            }
          });
        }
        
        return NextResponse.json(
          await newsService.getRecommendations(auth.userId!, limit)
        );
      }
      
      default:
        // Default behavior - return all articles with filters
        return NextResponse.json(
          await newsService.getArticles(filters, pagination)
        );
    }
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}