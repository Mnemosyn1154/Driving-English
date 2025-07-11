export interface UserBehaviorEvent {
  id: string;
  type: UserEventType;
  category: EventCategory;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
  timestamp: number;
  sessionId: string;
  userId?: string;
  url: string;
  referrer?: string;
}

export type UserEventType = 
  | 'page_view'
  | 'page_exit'
  | 'voice_command'
  | 'button_click'
  | 'feature_usage'
  | 'error'
  | 'offline_transition'
  | 'online_transition'
  | 'session_start'
  | 'session_end'
  | 'learning_progress'
  | 'driving_mode_toggle';

export type EventCategory = 
  | 'navigation'
  | 'engagement'
  | 'voice'
  | 'learning'
  | 'driving'
  | 'technical'
  | 'pwa';

export interface PageViewMetrics {
  pageLoadTime: number;
  timeOnPage: number;
  scrollDepth: number;
  interactionCount: number;
  exitType: 'navigation' | 'close' | 'external' | 'timeout';
}

export interface VoiceCommandMetrics {
  command: string;
  success: boolean;
  confidence: number;
  processingTime: number;
  retryCount: number;
  context: 'learn' | 'driving' | 'navigation';
}

export interface LearningProgressMetrics {
  articleId: string;
  sentencesCompleted: number;
  totalSentences: number;
  timeSpent: number;
  voiceInteractions: number;
  completionRate: number;
}

export interface DrivingModeMetrics {
  sessionDuration: number;
  voiceCommandsUsed: number;
  voiceCommandSuccess: number;
  articlesCompleted: number;
  safetyViolations: number;
}

export interface UserSession {
  id: string;
  userId?: string;
  deviceId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  pageViews: number;
  events: number;
  bounced: boolean;
  deviceInfo: {
    userAgent: string;
    screenResolution: string;
    language: string;
    platform: string;
    isMobile: boolean;
  };
}

export interface AnalyticsConfig {
  enabled: boolean;
  debug?: boolean;
  sampleRate?: number; // 0-1, for sampling events
  sessionTimeout?: number; // in minutes
  enabledEvents?: UserEventType[];
  customDimensions?: Record<string, string>;
}