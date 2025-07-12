/**
 * Article Extraction API - Batch Extraction
 * POST /api/extract/batch - Trigger extraction for multiple articles
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { extractionWorker } from '@/workers/extractionWorker';
import { z } from 'zod';

const prisma = new PrismaClient();

// Request validation schema
const batchExtractRequestSchema = z.object({
  articleIds: z.array(z.string().min(1, 'Article ID is required')).min(1).max(50, 'Maximum 50 articles per batch'),
  forceReExtract: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = batchExtractRequestSchema.safeParse(body);
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

    const { articleIds, forceReExtract } = validationResult.data;

    // Fetch articles from database
    const articles = await prisma.article.findMany({
      where: { 
        id: { in: articleIds } 
      },
      select: {
        id: true,
        url: true,
        title: true,
        fullContentExtracted: true,
        extractionAttempts: true,
      },
    });

    if (articles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid articles found',
        },
        { status: 404 }
      );
    }

    // Filter articles that are eligible for extraction
    const eligibleArticles = articles.filter(article => {
      if (forceReExtract) return true;
      
      // Skip if already extracted
      if (article.fullContentExtracted) return false;
      
      // Skip if too many failed attempts
      if (article.extractionAttempts >= 3) return false;
      
      return true;
    });

    if (eligibleArticles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No articles eligible for extraction',
          message: forceReExtract 
            ? 'All articles are currently being processed'
            : 'All articles either already extracted or exceeded attempt limit',
        },
        { status: 409 }
      );
    }

    // Create extraction jobs
    const jobResults = [];
    const errors = [];

    for (const article of eligibleArticles) {
      try {
        const job = await extractionWorker.addExtractionJob({
          articleId: article.id,
          url: article.url,
          forceReExtract,
        });

        jobResults.push({
          articleId: article.id,
          jobId: job.id,
          title: article.title,
        });

        console.log(`[Batch Extract API] Created job ${job.id} for article ${article.id}`);
      } catch (error) {
        console.error(`[Batch Extract API] Failed to create job for article ${article.id}:`, error);
        
        errors.push({
          articleId: article.id,
          title: article.title,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Prepare response
    const response = {
      success: jobResults.length > 0,
      message: `Created ${jobResults.length} extraction jobs`,
      totalRequested: articleIds.length,
      totalFound: articles.length,
      totalEligible: eligibleArticles.length,
      totalCreated: jobResults.length,
      jobs: jobResults,
      estimatedDuration: '2-5 minutes per article',
    };

    if (errors.length > 0) {
      (response as any).errors = errors;
      (response as any).message += `, ${errors.length} failed`;
    }

    const statusCode = jobResults.length > 0 ? 200 : 
                      errors.length > 0 ? 207 : // Partial success
                      500;

    return NextResponse.json(response, { status: statusCode });

  } catch (error) {
    console.error('[Batch Extract API] Error creating extraction jobs:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'Failed to create extraction jobs',
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}