export interface PerformanceMetric {
  id: string;
  name: MetricName;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  entries: any[];
  timestamp: number;
  url: string;
  deviceType: 'mobile' | 'desktop';
}

export type MetricName = 'CLS' | 'FID' | 'FCP' | 'INP' | 'LCP' | 'TTFB';

export interface VoicePerformanceMetric {
  id: string;
  type: 'stt' | 'tts';
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: {
    language?: string;
    wordCount?: number;
    audioSize?: number;
  };
}

export interface PerformanceReport {
  id: string;
  sessionId: string;
  userId?: string;
  url: string;
  webVitals: PerformanceMetric[];
  voiceMetrics: VoicePerformanceMetric[];
  customMetrics: Record<string, number>;
  userAgent: string;
  timestamp: number;
  connectionType?: string;
}

export interface PerformanceThreshold {
  metric: MetricName;
  good: number;
  needsImprovement: number;
}

export const PERFORMANCE_THRESHOLDS: Record<MetricName, PerformanceThreshold> = {
  LCP: { metric: 'LCP', good: 2500, needsImprovement: 4000 },
  FID: { metric: 'FID', good: 100, needsImprovement: 300 },
  CLS: { metric: 'CLS', good: 0.1, needsImprovement: 0.25 },
  FCP: { metric: 'FCP', good: 1800, needsImprovement: 3000 },
  INP: { metric: 'INP', good: 200, needsImprovement: 500 },
  TTFB: { metric: 'TTFB', good: 800, needsImprovement: 1800 }
};