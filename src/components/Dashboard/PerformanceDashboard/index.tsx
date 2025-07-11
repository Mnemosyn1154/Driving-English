'use client';

import React, { useState, useEffect } from 'react';
import { WebVitalsChart } from './WebVitalsChart';
import { VoicePerformanceChart } from './VoicePerformanceChart';
import { ApiPerformanceChart } from './ApiPerformanceChart';
import { UserBehaviorChart } from './UserBehaviorChart';
import { RealTimeMetrics } from './RealTimeMetrics';
import { PerformanceAlerts } from './PerformanceAlerts';
import { usePerformanceData } from '@/hooks/usePerformanceData';
import { usePerformanceWebSocket } from '@/hooks/usePerformanceWebSocket';
// import { PerformanceOptimizationPanel } from '@/components/Optimization/PerformanceOptimizationPanel';
// import { OptimizationDemo } from '@/components/Optimization/OptimizedComponents';
import styles from './styles.module.css';

export function PerformanceDashboard() {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  // const [activeTab, setActiveTab] = useState<'dashboard' | 'optimization' | 'demo'>('dashboard');
  
  // Fetch performance data
  const { 
    webVitals, 
    voiceMetrics, 
    apiMetrics, 
    userBehavior,
    loading,
    error,
    refresh
  } = usePerformanceData(timeRange);

  // WebSocket for real-time updates
  const { 
    isConnected,
    lastMessage 
  } = usePerformanceWebSocket('/api/ws/performance', {
    onMessage: (data) => {
      // Handle real-time performance updates
      if (data.type === 'metrics_update') {
        refresh();
      }
    }
  });

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refresh();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, refresh]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>성능 데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>데이터를 불러오는데 실패했습니다.</p>
        <button onClick={refresh}>다시 시도</button>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      {/* Control Panel */}
      <div className={styles.controls}>
        <div className={styles.timeRangeSelector}>
          <button 
            className={timeRange === '1h' ? styles.active : ''}
            onClick={() => setTimeRange('1h')}
          >
            1시간
          </button>
          <button 
            className={timeRange === '24h' ? styles.active : ''}
            onClick={() => setTimeRange('24h')}
          >
            24시간
          </button>
          <button 
            className={timeRange === '7d' ? styles.active : ''}
            onClick={() => setTimeRange('7d')}
          >
            7일
          </button>
          <button 
            className={timeRange === '30d' ? styles.active : ''}
            onClick={() => setTimeRange('30d')}
          >
            30일
          </button>
        </div>

        <div className={styles.refreshToggle}>
          <label>
            <input 
              type="checkbox" 
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            자동 새로고침
          </label>
          <button onClick={refresh} className={styles.refreshButton}>
            <span>🔄</span> 새로고침
          </button>
        </div>

        <div className={styles.connectionStatus}>
          {isConnected ? (
            <span className={styles.connected}>● 실시간 연결됨</span>
          ) : (
            <span className={styles.disconnected}>● 연결 끊김</span>
          )}
        </div>
      </div>

      {/* Real-time Metrics */}
      <RealTimeMetrics metrics={webVitals?.current} />

      {/* Performance Alerts */}
      <PerformanceAlerts />

      {/* Charts Grid */}
      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h2>Core Web Vitals</h2>
          <WebVitalsChart data={webVitals} timeRange={timeRange} />
        </div>

        <div className={styles.chartCard}>
          <h2>음성 인식 성능</h2>
          <VoicePerformanceChart data={voiceMetrics} timeRange={timeRange} />
        </div>

        <div className={styles.chartCard}>
          <h2>API 응답 시간</h2>
          <ApiPerformanceChart data={apiMetrics} timeRange={timeRange} />
        </div>

        <div className={styles.chartCard}>
          <h2>사용자 행동 분석</h2>
          <UserBehaviorChart data={userBehavior} timeRange={timeRange} />
        </div>
      </div>
    </div>
  );
}