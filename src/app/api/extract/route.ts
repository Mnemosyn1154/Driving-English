/**
 * Article Extraction API - Individual Extraction
 * POST /api/extract - Trigger extraction for a single article
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { extractionWorker } from '@/workers/extractionWorker';
import { z } from 'zod';

const prisma = new PrismaClient();

// Request validation schema
const extractRequestSchema = z.object({
  articleId: z.string().min(1, 'Article ID is required'),
  forceReExtract: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = extractRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { articleId, forceReExtract } = validationResult.data;

    // Check if article exists
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        url: true,
        title: true,
        fullContentExtracted: true,
        extractionAttempts: true,
        extractionError: true,
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

    // Check extraction eligibility
    if (!forceReExtract) {
      if (article.fullContentExtracted) {
        return NextResponse.json(
          {
            success: false,
            error: 'Article already has extracted content. Use forceReExtract=true to re-extract.',
          },
          { status: 409 }
        );
      }

      if (article.extractionAttempts >= 3) {
        return NextResponse.json(
          {
            success: false,
            error: 'Article has exceeded maximum extraction attempts (3). Use forceReExtract=true to retry.',
          },
          { status: 409 }
        );
      }
    }

    // Add extraction job to queue
    const job = await extractionWorker.addExtractionJob({
      articleId,
      url: article.url,
      forceReExtract,
    });

    console.log(`[Extract API] Created extraction job ${job.id} for article ${articleId}`);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: `Extraction job created for article: ${article.title}`,
      articleId,
      estimatedDuration: '2-5 minutes',
    });

  } catch (error) {
    console.error('[Extract API] Error creating extraction job:', error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('already being processed')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Article is currently being processed',
          },
          { status: 409 }
        );
      }

      if (error.message.includes('exceeded maximum extraction attempts')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Failed to create extraction job',
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Health check endpoint
export async function GET() {
  try {
    const stats = await extractionWorker.getQueueStats();
    
    return NextResponse.json({
      success: true,
      message: 'Article extraction service is running',
      queueStats: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Extract API] Health check error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Service unavailable',
      },
      { status: 503 }
    );
  }
}