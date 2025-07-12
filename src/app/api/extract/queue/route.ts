/**
 * Article Extraction API - Queue Status
 * GET /api/extract/queue - Get current queue statistics and status
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractionWorker } from '@/workers/extractionWorker';
import { extractionQueue } from '@/lib/queue';

export async function GET(request: NextRequest) {
  try {
    // Get queue statistics
    const stats = await extractionWorker.getQueueStats();

    // Get additional queue information
    const [activeJobs, waitingJobs, completedJobs, failedJobs] = await Promise.all([
      extractionQueue.getActive(),
      extractionQueue.getWaiting(),
      extractionQueue.getCompleted(),
      extractionQueue.getFailed(),
    ]);

    // Process active jobs to get progress information
    const activeJobsInfo = activeJobs.map(job => ({
      id: job.id,
      articleId: job.data.articleId,
      progress: job.progress(),
      processedOn: job.processedOn,
      attemptsMade: job.attemptsMade,
    }));

    // Process waiting jobs
    const waitingJobsInfo = waitingJobs.slice(0, 10).map(job => ({
      id: job.id,
      articleId: job.data.articleId,
      createdAt: new Date(job.timestamp),
      priority: job.opts.priority || 0,
    }));

    // Get recent completed jobs (last 10)
    const recentCompletedInfo = completedJobs.slice(-10).map(job => ({
      id: job.id,
      articleId: job.data.articleId,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
      duration: job.finishedOn && job.processedOn 
        ? job.finishedOn - job.processedOn 
        : null,
    }));

    // Get recent failed jobs (last 10)
    const recentFailedInfo = failedJobs.slice(-10).map(job => ({
      id: job.id,
      articleId: job.data.articleId,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
    }));

    // Calculate additional metrics
    const totalProcessed = stats.completed + stats.failed;
    const successRate = totalProcessed > 0 ? (stats.completed / totalProcessed) * 100 : 0;
    
    // Calculate average processing time from recent completed jobs
    const completedWithDuration = recentCompletedInfo.filter(job => job.duration !== null);
    const avgProcessingTime = completedWithDuration.length > 0
      ? completedWithDuration.reduce((sum, job) => sum + (job.duration || 0), 0) / completedWithDuration.length
      : null;

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      
      // Overall statistics
      stats: {
        ...stats,
        total: stats.waiting + stats.active + stats.completed + stats.failed,
        successRate: Math.round(successRate * 100) / 100,
        avgProcessingTimeMs: avgProcessingTime ? Math.round(avgProcessingTime) : null,
      },

      // Active jobs details
      activeJobs: {
        count: stats.active,
        jobs: activeJobsInfo,
      },

      // Waiting jobs details
      waitingJobs: {
        count: stats.waiting,
        next10: waitingJobsInfo,
      },

      // Recent completed jobs
      recentCompleted: {
        count: stats.completed,
        recent10: recentCompletedInfo,
      },

      // Recent failed jobs
      recentFailed: {
        count: stats.failed,
        recent10: recentFailedInfo,
      },

      // System health indicators
      health: {
        status: stats.active > 0 || stats.waiting > 0 ? 'processing' : 'idle',
        queueBacklog: stats.waiting,
        processingCapacity: 2, // Based on worker concurrency
        isHealthy: stats.failed < 100, // Arbitrary threshold
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Queue API] Error getting queue status:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Failed to get queue status',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// POST endpoint for queue management operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'cleanup':
        await extractionWorker.cleanupJobs();
        return NextResponse.json({
          success: true,
          message: 'Queue cleanup completed',
          timestamp: new Date().toISOString(),
        });

      case 'pause':
        await extractionQueue.pause();
        return NextResponse.json({
          success: true,
          message: 'Queue paused',
          timestamp: new Date().toISOString(),
        });

      case 'resume':
        await extractionQueue.resume();
        return NextResponse.json({
          success: true,
          message: 'Queue resumed',
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action',
            validActions: ['cleanup', 'pause', 'resume'],
          },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('[Queue API] Error performing queue operation:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Failed to perform queue operation',
      },
      { status: 500 }
    );
  }
}