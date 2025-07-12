/**
 * Article Extraction API - Status Check
 * GET /api/extract/status?articleId=xxx - Check extraction status for an article
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { extractionQueue } from '@/lib/queue';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('articleId');

    if (!articleId) {
      return NextResponse.json(
        {
          success: false,
          error: 'articleId parameter is required',
        },
        { status: 400 }
      );
    }

    // Validate articleId format (allow both UUID and MD5 hash)
    const validIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$|^[a-f0-9]{32}$/i;
    if (!validIdRegex.test(articleId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid articleId format',
        },
        { status: 400 }
      );
    }

    // Get article status from database
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        title: true,
        url: true,
        fullContentExtracted: true,
        extractionAttempts: true,
        extractionError: true,
        extractionMethod: true,
        lastExtractionAt: true,
        fullContent: true,
      },
    });

    if (!article) {
      return NextResponse.json(
        {
          success: false,
          error: 'Article not found',
        },
        { status: 404 }
      );
    }

    // Check queue for active jobs
    let queueStatus = null;
    let progress = null;

    try {
      // Get all active jobs
      const activeJobs = await extractionQueue.getActive();
      const waitingJobs = await extractionQueue.getWaiting();
      
      // Find job for this article
      const activeJob = activeJobs.find(job => job.data.articleId === articleId);
      const waitingJob = waitingJobs.find(job => job.data.articleId === articleId);

      if (activeJob) {
        queueStatus = 'processing';
        progress = activeJob.progress();
      } else if (waitingJob) {
        queueStatus = 'pending';
        progress = 0;
      }
    } catch (queueError) {
      console.error('[Status API] Error checking queue status:', queueError);
    }

    // Determine overall status
    let status: 'pending' | 'processing' | 'completed' | 'failed';
    let message: string;

    if (queueStatus === 'processing') {
      status = 'processing';
      message = 'Extraction in progress';
    } else if (queueStatus === 'pending') {
      status = 'pending';
      message = 'Extraction queued';
    } else if (article.fullContentExtracted) {
      status = 'completed';
      message = 'Extraction completed successfully';
    } else if (article.extractionError) {
      status = 'failed';
      message = article.extractionError;
    } else if (article.extractionAttempts > 0) {
      status = 'failed';
      message = 'Extraction failed (no active job)';
    } else {
      status = 'pending';
      message = 'Not yet processed';
    }

    // Build response
    const response = {
      success: true,
      articleId,
      title: article.title,
      status,
      message,
      extractionAttempts: article.extractionAttempts,
      lastExtractionAt: article.lastExtractionAt,
      hasFullContent: !!article.fullContent,
      fullContentLength: article.fullContent?.length || 0,
    };

    // Add progress if available
    if (progress !== null) {
      (response as any).progress = progress;
    }

    // Add extraction method if completed
    if (status === 'completed' && article.extractionMethod) {
      (response as any).extractionMethod = article.extractionMethod;
    }

    // Add error details if failed
    if (status === 'failed' && article.extractionError) {
      (response as any).error = article.extractionError;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Status API] Error checking extraction status:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Failed to check extraction status',
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}