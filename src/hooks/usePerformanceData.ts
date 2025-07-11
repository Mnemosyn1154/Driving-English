import { useState, useEffect, useCallback } from 'react';

interface WebVitalsData {
  current: {
    lcp: number;
    fid: number;
    cls: number;
    fcp: number;
    ttfb: number;
    sttAvgDuration: number;
    ttsAvgDuration: number;
    apiAvgResponseTime: number;
    activeUsers: number;
    errorRate: number;
  };
  lcp: Array<{ timestamp: string; value: number }>;
  fid: Array<{ timestamp: string; value: number }>;
  cls: Array<{ timestamp: string; value: number }>;
  fcp: Array<{ timestamp: string; value: number }>;
  ttfb: Array<{ timestamp: string; value: number }>;
}

interface VoiceMetricsData {
  sttSuccessRate: number;
  ttsSuccessRate: number;
  avgSttDuration: number;
  avgTtsDuration: number;
  totalSttCalls: number;
  totalTtsCalls: number;
  timeline: Array<{
    timestamp: string;
    sttDuration: number;
    ttsDuration: number;
    sttSuccess: boolean;
    ttsSuccess: boolean;
  }>;
}

interface ApiMetricsData {
  endpoints: {
    [endpoint: string]: {
      count: number;
      avgDuration: number;
      errorRate: number;
      timeline: Array<{
        timestamp: string;
        duration: number;
        success: boolean;
      }>;
    };
  };
}

interface UserBehaviorData {
  pageViews: {
    [page: string]: number;
  };
  sessionDuration: {
    short: number;
    medium: number;
    long: number;
  };
  deviceTypes: {
    mobile: number;
    desktop: number;
  };
  bounceRate: number;
  avgSessionDuration: number;
  totalSessions: number;
}

interface UsePerformanceDataReturn {
  webVitals: WebVitalsData | null;
  voiceMetrics: VoiceMetricsData | null;
  apiMetrics: ApiMetricsData | null;
  userBehavior: UserBehaviorData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function usePerformanceData(timeRange: string): UsePerformanceDataReturn {
  const [webVitals, setWebVitals] = useState<WebVitalsData | null>(null);
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetricsData | null>(null);
  const [apiMetrics, setApiMetrics] = useState<ApiMetricsData | null>(null);
  const [userBehavior, setUserBehavior] = useState<UserBehaviorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, these would be actual API calls
      // For now, generate mock data
      const mockWebVitals: WebVitalsData = {
        current: {
          lcp: 2100,
          fid: 95,
          cls: 0.08,
          fcp: 1600,
          ttfb: 650,
          sttAvgDuration: 1200,
          ttsAvgDuration: 1800,
          apiAvgResponseTime: 250,
          activeUsers: 42,
          errorRate: 0.02
        },
        lcp: Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
          value: 2000 + Math.random() * 1000
        })),
        fid: Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
          value: 80 + Math.random() * 40
        })),
        cls: Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
          value: 0.05 + Math.random() * 0.1
        })),
        fcp: Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
          value: 1500 + Math.random() * 500
        })),
        ttfb: Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
          value: 600 + Math.random() * 200
        }))
      };

      const mockVoiceMetrics: VoiceMetricsData = {
        sttSuccessRate: 95.2,
        ttsSuccessRate: 98.1,
        avgSttDuration: 1200,
        avgTtsDuration: 1800,
        totalSttCalls: 2100,
        totalTtsCalls: 1850,
        timeline: Array.from({ length: 24 }, (_, i) => ({
          timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
          sttDuration: 1000 + Math.random() * 800,
          ttsDuration: 1500 + Math.random() * 1000,
          sttSuccess: Math.random() > 0.1,
          ttsSuccess: Math.random() > 0.05
        }))
      };

      const mockApiMetrics: ApiMetricsData = {
        endpoints: {
          '/api/news/articles': {
            count: 1250,
            avgDuration: 180,
            errorRate: 0.02,
            timeline: Array.from({ length: 24 }, (_, i) => ({
              timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
              duration: 150 + Math.random() * 100,
              success: Math.random() > 0.02
            }))
          },
          '/api/users/progress': {
            count: 890,
            avgDuration: 120,
            errorRate: 0.01,
            timeline: Array.from({ length: 24 }, (_, i) => ({
              timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
              duration: 100 + Math.random() * 80,
              success: Math.random() > 0.01
            }))
          },
          '/api/voice/recognize': {
            count: 2100,
            avgDuration: 350,
            errorRate: 0.05,
            timeline: Array.from({ length: 24 }, (_, i) => ({
              timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
              duration: 300 + Math.random() * 200,
              success: Math.random() > 0.05
            }))
          }
        }
      };

      const mockUserBehavior: UserBehaviorData = {
        pageViews: {
          '/learn': 1250,
          '/driving': 890,
          '/dashboard': 450,
          '/settings': 120,
          '/about': 80
        },
        sessionDuration: {
          short: 45,
          medium: 120,
          long: 85
        },
        deviceTypes: {
          mobile: 180,
          desktop: 70
        },
        bounceRate: 0.32,
        avgSessionDuration: 240,
        totalSessions: 250
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setWebVitals(mockWebVitals);
      setVoiceMetrics(mockVoiceMetrics);
      setApiMetrics(mockApiMetrics);
      setUserBehavior(mockUserBehavior);

    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 가져오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    webVitals,
    voiceMetrics,
    apiMetrics,
    userBehavior,
    loading,
    error,
    refresh
  };
}