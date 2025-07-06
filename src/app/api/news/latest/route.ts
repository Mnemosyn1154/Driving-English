import { NextRequest, NextResponse } from 'next/server';
import { NewsFetcher } from '@/services/server/news/fetcher';
import { NewsParser } from '@/services/server/news/parser';
import { NewsPreprocessor } from '@/services/server/news/preprocessor';
import { NewsFilter, NewsSortOptions, PaginationOptions } from '@/types/news';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sortBy = searchParams.get('sortBy') || 'publishedAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Create services
    const fetcher = new NewsFetcher();
    const parser = new NewsParser();
    const preprocessor = new NewsPreprocessor();

    // Fetch news
    const fetchResults = category 
      ? await fetcher.fetchByCategory(category as any)
      : await fetcher.fetchAllNews();

    // Parse articles
    const parsedArticles = [];
    for (const result of fetchResults) {
      for (const rawArticle of result.articles) {
        try {
          if (parser.validateArticle(rawArticle)) {
            const article = parser.parseArticle(rawArticle);
            parsedArticles.push(article);
          }
        } catch (error) {
          console.error('Failed to parse article:', error);
        }
      }
    }

    // Apply filters
    const filter: NewsFilter = {};
    if (category) filter.categories = [category as any];
    if (difficulty) filter.difficulty = [difficulty as any];
    
    const filteredArticles = preprocessor.filterArticles(parsedArticles, filter);

    // Sort articles
    const sortOptions: NewsSortOptions = {
      field: sortBy as any,
      order: sortOrder as any,
    };
    const sortedArticles = preprocessor.sortArticles(filteredArticles, sortOptions);

    // Paginate results
    const paginationOptions: PaginationOptions = { page, limit };
    const paginatedResponse = preprocessor.paginateArticles(sortedArticles, paginationOptions);

    return NextResponse.json(paginatedResponse);
  } catch (error: any) {
    console.error('Error fetching latest news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news', details: error.message },
      { status: 500 }
    );
  }
}