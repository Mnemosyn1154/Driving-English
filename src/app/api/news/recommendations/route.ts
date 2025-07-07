import { NextRequest, NextResponse } from 'next/server';
import { NewsService } from '@/services/server/news/newsService';
import { prisma } from '@/services/server/database/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '5');
    
    // Get user ID from device ID or JWT (simplified for now)
    const deviceId = request.headers.get('x-device-id');
    if (!deviceId) {
      return NextResponse.json(
        { error: 'Device ID required' },
        { status: 400 }
      );
    }

    // Get or create user
    const user = await prisma.user.upsert({
      where: { deviceId },
      update: { lastActiveAt: new Date() },
      create: { deviceId },
    });

    const newsService = new NewsService();
    const recommendations = await newsService.getRecommendations(user.id, limit);

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}