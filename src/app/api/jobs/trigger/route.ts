import { NextRequest, NextResponse } from 'next/server';
import { jobScheduler } from '@/services/server/jobs/jobScheduler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      categories = ['general', 'technology', 'business', 'science'],
      forceRefresh = true 
    } = body;

    // Trigger immediate news collection
    const job = await jobScheduler.triggerNewsCollection(categories, forceRefresh);

    return NextResponse.json({
      success: true,
      message: 'News collection job triggered',
      jobId: job.id,
      status: await job.getState(),
    });
  } catch (error: any) {
    console.error('Failed to trigger job:', error);
    return NextResponse.json(
      { error: 'Failed to trigger job', details: error.message },
      { status: 500 }
    );
  }
}