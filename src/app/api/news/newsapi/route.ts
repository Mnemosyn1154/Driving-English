import { NextRequest, NextResponse } from 'next/server';
import { newsApiClient } from '@/services/server/news/newsApiClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract parameters
    const action = searchParams.get('action') || 'headlines';
    const category = searchParams.get('category') || 'general';
    const country = searchParams.get('country') || 'us';
    const keywords = searchParams.get('keywords') || '';
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    let articles;
    let processed = 0;
    let errors: string[] = [];

    switch (action) {
      case 'headlines':
        // Fetch top headlines by category
        articles = await newsApiClient.fetchTopHeadlines({
          category,
          country,
          pageSize,
          page
        });
        break;

      case 'search':
        // Search articles by keywords
        if (!keywords) {
          return NextResponse.json(
            { error: 'Keywords are required for search' },
            { status: 400 }
          );
        }
        articles = await newsApiClient.searchByKeywords(keywords);
        break;

      case 'fetch-and-save':
        // Fetch and save articles to database
        articles = await newsApiClient.fetchTopHeadlines({
          category,
          country,
          pageSize: 50 // Fetch more for saving
        });
        
        const result = await newsApiClient.processAndSaveArticles(articles, category);
        processed = result.processed;
        errors = result.errors;
        
        return NextResponse.json({
          success: true,
          message: `Fetched ${articles.length} articles, saved ${processed} new articles`,
          processed,
          errors,
          total: articles.length
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: headlines, search, or fetch-and-save' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      count: articles.length,
      articles: articles.map(article => ({
        title: article.title,
        description: article.description,
        url: article.url,
        source: article.source.name,
        publishedAt: article.publishedAt,
        imageUrl: article.urlToImage
      }))
    });

  } catch (error: any) {
    console.error('NewsAPI route error:', error);
    
    // Handle specific NewsAPI errors
    if (error.message?.includes('apiKey')) {
      return NextResponse.json(
        { error: 'NewsAPI key is not configured properly' },
        { status: 500 }
      );
    }
    
    if (error.message?.includes('rate limit')) {
      return NextResponse.json(
        { error: 'NewsAPI rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch news from NewsAPI', details: error.message },
      { status: 500 }
    );
  }
}