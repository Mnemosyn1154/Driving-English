import { NextRequest, NextResponse } from 'next/server';
import { jobScheduler } from '@/services/server/jobs/jobScheduler';
import { NewsCollectionJob } from '@/services/server/jobs/newsCollectionJob';

export async function GET(request: NextRequest) {
  try {
    // Get queue statistics
    const queueStats = await jobScheduler.getQueueStats();
    
    // Get scheduled jobs
    const scheduledJobs = await jobScheduler.getScheduledJobs();
    
    // Get job execution statistics
    const jobStats = await NewsCollectionJob.getStatistics();

    return NextResponse.json({
      success: true,
      queues: queueStats,
      scheduled: {
        recurring: scheduledJobs.recurring.map(job => ({
          name: job.name,
          pattern: job.cron,
          nextRun: job.next,
        })),
        delayed: scheduledJobs.delayed.length,
      },
      statistics: jobStats,
    });
  } catch (error: any) {
    console.error('Failed to get job status:', error);
    return NextResponse.json(
      { error: 'Failed to get job status', details: error.message },
      { status: 500 }
    );
  }
}