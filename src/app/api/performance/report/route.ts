import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/server/database/prisma';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Store performance data in database
    const performanceReport = await prisma.performanceReport.create({
      data: {
        sessionId: data.sessionId,
        url: data.url,
        userAgent: data.userAgent,
        webVitals: data.webVitals || {},
        voiceMetrics: data.voiceMetrics || {},
        apiMetrics: data.apiMetrics || {},
        voiceAvgMetrics: data.voiceAvgMetrics || {},
        connectionType: data.connectionType,
        timestamp: new Date(data.timestamp),
        userId: data.userId // Optional, if user is authenticated
      }
    });

    // Log important metrics for monitoring
    if (data.webVitals) {
      const { largestContentfulPaint, cumulativeLayoutShift, firstInputDelay } = data.webVitals;
      console.log(`[Performance Report] LCP: ${largestContentfulPaint}ms, CLS: ${cumulativeLayoutShift}, FID: ${firstInputDelay}ms`);
    }

    return NextResponse.json({ 
      success: true, 
      reportId: performanceReport.id 
    });
  } catch (error) {
    console.error('Failed to save performance report:', error);
    return NextResponse.json(
      { error: 'Failed to save performance report' },
      { status: 500 }
    );
  }
}