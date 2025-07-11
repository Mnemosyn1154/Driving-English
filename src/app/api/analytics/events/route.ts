import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/server/database/prisma';

export async function POST(request: NextRequest) {
  try {
    const { events, session } = await request.json();

    // Batch insert events
    const analyticsEvents = await prisma.analyticsEvent.createMany({
      data: events.map((event: any) => ({
        eventId: event.id,
        type: event.type,
        category: event.category,
        action: event.action,
        label: event.label,
        value: event.value,
        metadata: event.metadata || {},
        timestamp: new Date(event.timestamp),
        sessionId: event.sessionId,
        userId: event.userId,
        url: event.url,
        referrer: event.referrer
      }))
    });

    // Update or create session
    if (session) {
      await prisma.analyticsSession.upsert({
        where: { id: session.id },
        update: {
          endTime: session.endTime ? new Date(session.endTime) : undefined,
          duration: session.duration,
          pageViews: session.pageViews,
          events: session.events,
          bounced: session.bounced
        },
        create: {
          id: session.id,
          userId: session.userId,
          deviceId: session.deviceId,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined,
          duration: session.duration,
          pageViews: session.pageViews,
          events: session.events,
          bounced: session.bounced,
          deviceInfo: session.deviceInfo || {}
        }
      });
    }

    // Log important events for monitoring
    const importantEvents = events.filter((e: any) => 
      ['session_start', 'session_end', 'error', 'voice_command'].includes(e.type)
    );
    
    if (importantEvents.length > 0) {
      console.log(`[Analytics] Received ${importantEvents.length} important events`);
    }

    return NextResponse.json({ 
      success: true, 
      eventsReceived: events.length 
    });
  } catch (error) {
    console.error('Failed to save analytics events:', error);
    return NextResponse.json(
      { error: 'Failed to save analytics events' },
      { status: 500 }
    );
  }
}