import { NextResponse } from 'next/server';
import { getJobStats } from '@/services/server/jobs/queue';
import { prisma } from '@/services/server/database/prisma';
import { isMockMode } from '@/lib/env';
import { mockJobStatus } from '@/services/server/mock/mockData';

export async function GET() {
  try {
    // Use mock data if in mock mode
    if (isMockMode) {
      return NextResponse.json(mockJobStatus);
    }
    
    // Get queue statistics
    const queueStats = await getJobStats();

    // Get recent job history
    const recentJobs = await prisma.backgroundJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        error: true,
        attempts: true,
      },
    });

    // Get job statistics by type
    const jobStats = await prisma.backgroundJob.groupBy({
      by: ['type', 'status'],
      _count: true,
    });

    return NextResponse.json({
      queues: queueStats,
      recentJobs,
      statistics: jobStats.map(stat => ({
        type: stat.type,
        status: stat.status,
        count: stat._count,
      })),
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}