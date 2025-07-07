import { NextResponse } from 'next/server';
import { NewsService } from '@/services/server/news/newsService';
import { isMockMode } from '@/lib/env';
import { mockStatistics } from '@/services/server/mock/mockData';

export async function GET() {
  try {
    // Use mock data if in mock mode
    if (isMockMode) {
      return NextResponse.json(mockStatistics);
    }
    
    const newsService = new NewsService();
    const statistics = await newsService.getStatistics();

    return NextResponse.json(statistics);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}