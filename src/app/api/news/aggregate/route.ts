import { NextRequest, NextResponse } from 'next/server';
import { newsAggregator } from '@/services/server/news/newsAggregator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categories = ['general', 'technology', 'business', 'science'] } = body;

    console.log('🔄 Starting news aggregation...');
    
    // Run aggregation
    const result = await newsAggregator.aggregateNews(categories);
    
    // Get statistics
    const stats = await newsAggregator.getStatistics();

    return NextResponse.json({
      success: true,
      message: `Aggregated ${result.totalProcessed} articles from ${result.totalFetched} fetched`,
      result: {
        ...result,
        categories: categories,
      },
      statistics: stats,
    });
  } catch (error: any) {
    console.error('Aggregation error:', error);
    return NextResponse.json(
      { error: 'Failed to aggregate news', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get current statistics without running aggregation
    const stats = await newsAggregator.getStatistics();
    
    return NextResponse.json({
      success: true,
      statistics: stats,
    });
  } catch (error: any) {
    console.error('Statistics error:', error);
    return NextResponse.json(
      { error: 'Failed to get statistics', details: error.message },
      { status: 500 }
    );
  }
}