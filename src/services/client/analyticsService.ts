'use client';

import { v4 as uuidv4 } from 'uuid';
import {
  UserBehaviorEvent,
  UserEventType,
  EventCategory,
  UserSession,
  AnalyticsConfig,
  PageViewMetrics,
  VoiceCommandMetrics,
  LearningProgressMetrics,
  DrivingModeMetrics
} from '@/types/analytics';

class AnalyticsService {
  private config: AnalyticsConfig;
  private session: UserSession | null = null;
  private eventQueue: UserBehaviorEvent[] = [];
  private pageStartTime: number = 0;
  private lastActivityTime: number = Date.now();
  private activityTimer?: NodeJS.Timeout;
  private flushTimer?: NodeJS.Timeout;
  private observers: Map<string, IntersectionObserver> = new Map();
  private scrollDepth: number = 0;
  private interactionCount: number = 0;

  constructor(config: AnalyticsConfig) {
    this.config = config;
    
    if (this.config.enabled) {
      this.initializeSession();
      this.setupEventListeners();
      this.startFlushTimer();
    }
  }

  private initializeSession() {
    const sessionId = this.getOrCreateSessionId();
    
    this.session = {
      id: sessionId,
      userId: this.getUserId(),
      deviceId: this.getDeviceId(),
      startTime: Date.now(),
      pageViews: 0,
      events: 0,
      bounced: true,
      deviceInfo: {
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        language: navigator.language,
        platform: navigator.platform,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      }
    };

    this.trackEvent({
      type: 'session_start',
      category: 'technical',
      action: 'session_started',
      metadata: this.session.deviceInfo
    });
  }

  private getOrCreateSessionId(): string {
    const stored = sessionStorage.getItem('analytics_session_id');
    if (stored) {
      const { id, timestamp } = JSON.parse(stored);
      const age = Date.now() - timestamp;
      
      // Session timeout (default 30 minutes)
      if (age < (this.config.sessionTimeout || 30) * 60 * 1000) {
        return id;
      }
    }
    
    const newId = uuidv4();
    sessionStorage.setItem('analytics_session_id', JSON.stringify({
      id: newId,
      timestamp: Date.now()
    }));
    
    return newId;
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  private getUserId(): string | undefined {
    try {
      const authData = localStorage.getItem('sb-auth-token');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.user?.id;
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  }

  private setupEventListeners() {
    // Page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handlePageExit('navigation');
      } else {
        this.pageStartTime = Date.now();
      }
    });

    // Before unload
    window.addEventListener('beforeunload', () => {
      this.handlePageExit('close');
    });

    // User activity tracking
    ['click', 'touchstart', 'keydown', 'scroll'].forEach(event => {
      document.addEventListener(event, () => {
        this.lastActivityTime = Date.now();
        if (event === 'click' || event === 'touchstart') {
          this.interactionCount++;
        }
      }, { passive: true });
    });

    // Scroll depth tracking
    this.setupScrollTracking();

    // Network status
    window.addEventListener('online', () => {
      this.trackEvent({
        type: 'online_transition',
        category: 'technical',
        action: 'went_online'
      });
    });

    window.addEventListener('offline', () => {
      this.trackEvent({
        type: 'offline_transition',
        category: 'technical',
        action: 'went_offline'
      });
    });

    // Start activity monitoring
    this.startActivityMonitoring();
  }

  private setupScrollTracking() {
    let maxScroll = 0;
    
    const updateScrollDepth = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const depth = Math.min((scrolled / total) * 100, 100);
      
      if (depth > maxScroll) {
        maxScroll = depth;
        this.scrollDepth = Math.round(maxScroll);
        
        // Track milestone scroll depths
        const milestones = [25, 50, 75, 100];
        for (const milestone of milestones) {
          if (maxScroll >= milestone && this.scrollDepth < milestone + 25) {
            this.trackEvent({
              type: 'feature_usage',
              category: 'engagement',
              action: 'scroll_depth',
              label: `${milestone}%`,
              value: milestone
            });
          }
        }
      }
    };

    window.addEventListener('scroll', updateScrollDepth, { passive: true });
  }

  private startActivityMonitoring() {
    this.activityTimer = setInterval(() => {
      const inactiveTime = Date.now() - this.lastActivityTime;
      
      // If inactive for more than 5 minutes, end the page view
      if (inactiveTime > 5 * 60 * 1000) {
        this.handlePageExit('timeout');
      }
    }, 60000); // Check every minute
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, 30000); // Flush every 30 seconds
  }

  /**
   * Track a user behavior event
   */
  public trackEvent(event: Partial<UserBehaviorEvent>) {
    if (!this.config.enabled || !this.session) return;

    // Check if this event type is enabled
    if (this.config.enabledEvents && event.type && 
        !this.config.enabledEvents.includes(event.type)) {
      return;
    }

    // Apply sampling rate
    if (this.config.sampleRate && Math.random() > this.config.sampleRate) {
      return;
    }

    const fullEvent: UserBehaviorEvent = {
      id: uuidv4(),
      type: event.type || 'feature_usage',
      category: event.category || 'engagement',
      action: event.action || 'unknown',
      label: event.label,
      value: event.value,
      metadata: {
        ...event.metadata,
        ...this.config.customDimensions
      },
      timestamp: Date.now(),
      sessionId: this.session.id,
      userId: this.session.userId,
      url: window.location.href,
      referrer: document.referrer
    };

    this.eventQueue.push(fullEvent);
    this.session.events++;

    // Update bounce status
    if (this.session.events > 1 || this.session.pageViews > 1) {
      this.session.bounced = false;
    }

    if (this.config.debug) {
      console.log('[Analytics] Event tracked:', fullEvent);
    }

    // Flush if queue is getting large
    if (this.eventQueue.length >= 10) {
      this.flushEvents();
    }
  }

  /**
   * Track page view
   */
  public trackPageView(metadata?: Record<string, any>) {
    this.pageStartTime = Date.now();
    this.scrollDepth = 0;
    this.interactionCount = 0;
    
    if (this.session) {
      this.session.pageViews++;
    }

    this.trackEvent({
      type: 'page_view',
      category: 'navigation',
      action: 'page_viewed',
      label: window.location.pathname,
      metadata
    });
  }

  /**
   * Track voice command
   */
  public trackVoiceCommand(metrics: VoiceCommandMetrics) {
    this.trackEvent({
      type: 'voice_command',
      category: 'voice',
      action: metrics.success ? 'voice_command_success' : 'voice_command_failed',
      label: metrics.command,
      value: metrics.processingTime,
      metadata: metrics
    });
  }

  /**
   * Track learning progress
   */
  public trackLearningProgress(metrics: LearningProgressMetrics) {
    this.trackEvent({
      type: 'learning_progress',
      category: 'learning',
      action: 'progress_updated',
      label: metrics.articleId,
      value: metrics.completionRate,
      metadata: metrics
    });
  }

  /**
   * Track driving mode metrics
   */
  public trackDrivingMode(metrics: DrivingModeMetrics) {
    this.trackEvent({
      type: 'driving_mode_toggle',
      category: 'driving',
      action: 'driving_session_ended',
      value: metrics.sessionDuration,
      metadata: metrics
    });
  }

  /**
   * Track custom event
   */
  public track(eventName: string, properties?: Record<string, any>) {
    this.trackEvent({
      type: 'feature_usage',
      category: 'engagement',
      action: eventName,
      metadata: properties
    });
  }

  /**
   * Handle page exit
   */
  private handlePageExit(exitType: PageViewMetrics['exitType']) {
    if (this.pageStartTime === 0) return;

    const timeOnPage = Date.now() - this.pageStartTime;
    
    const pageMetrics: PageViewMetrics = {
      pageLoadTime: performance.getEntriesByType('navigation')[0]?.duration || 0,
      timeOnPage,
      scrollDepth: this.scrollDepth,
      interactionCount: this.interactionCount,
      exitType
    };

    this.trackEvent({
      type: 'page_exit',
      category: 'navigation',
      action: 'page_exited',
      label: window.location.pathname,
      value: Math.round(timeOnPage / 1000), // Convert to seconds
      metadata: pageMetrics
    });

    this.pageStartTime = 0;
  }

  /**
   * Flush events to server
   */
  private async flushEvents() {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const response = await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events,
          session: this.session
        }),
        keepalive: true
      });

      if (!response.ok) {
        // In development, don't retry to avoid console spam
        if (process.env.NODE_ENV !== 'development') {
          // Put events back in queue for retry
          this.eventQueue.unshift(...events);
        }
      }
    } catch (error) {
      // In development, log quietly
      if (process.env.NODE_ENV === 'development') {
        // Silent fail in development
      } else {
        console.error('[Analytics] Failed to flush events:', error);
        // Put events back in queue for retry
        this.eventQueue.unshift(...events);
      }
    }
  }

  /**
   * End session
   */
  public endSession() {
    if (!this.session) return;

    this.session.endTime = Date.now();
    this.session.duration = this.session.endTime - this.session.startTime;

    this.trackEvent({
      type: 'session_end',
      category: 'technical',
      action: 'session_ended',
      value: Math.round(this.session.duration / 1000),
      metadata: {
        pageViews: this.session.pageViews,
        events: this.session.events,
        bounced: this.session.bounced
      }
    });

    this.flushEvents();
  }

  /**
   * Destroy analytics
   */
  public destroy() {
    this.endSession();
    
    if (this.activityTimer) {
      clearInterval(this.activityTimer);
    }
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
  }
}

// Singleton instance
let analyticsInstance: AnalyticsService | null = null;

export function initAnalytics(config: AnalyticsConfig): AnalyticsService {
  if (!analyticsInstance) {
    analyticsInstance = new AnalyticsService(config);
  }
  return analyticsInstance;
}

export function getAnalytics(): AnalyticsService | null {
  return analyticsInstance;
}

export function destroyAnalytics() {
  if (analyticsInstance) {
    analyticsInstance.destroy();
    analyticsInstance = null;
  }
}