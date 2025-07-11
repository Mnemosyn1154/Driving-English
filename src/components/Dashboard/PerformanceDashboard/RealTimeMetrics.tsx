'use client';

import React from 'react';
import styles from './RealTimeMetrics.module.css';

interface CurrentMetrics {
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
}

interface Props {
  metrics?: CurrentMetrics;
}

export function RealTimeMetrics({ metrics }: Props) {
  if (!metrics) {
    return (
      <div className={styles.container}>
        <h2>실시간 메트릭</h2>
        <div className={styles.grid}>
          <div className={styles.metric}>
            <div className={styles.loading}>데이터 로딩 중...</div>
          </div>
        </div>
      </div>
    );
  }

  const getMetricStatus = (value: number, thresholds: { good: number; poor: number }) => {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.poor) return 'needs-improvement';
    return 'poor';
  };

  const formatValue = (value: number, unit: string = 'ms') => {
    if (unit === '%') return `${(value * 100).toFixed(1)}%`;
    if (unit === 's') return `${(value / 1000).toFixed(1)}s`;
    return `${value.toFixed(0)}${unit}`;
  };

  const metricCards = [
    {
      title: 'LCP',
      subtitle: 'Largest Contentful Paint',
      value: metrics.lcp,
      unit: 'ms',
      status: getMetricStatus(metrics.lcp, { good: 2500, poor: 4000 }),
      trend: 'stable' // TODO: Calculate trend
    },
    {
      title: 'FID',
      subtitle: 'First Input Delay',
      value: metrics.fid,
      unit: 'ms',
      status: getMetricStatus(metrics.fid, { good: 100, poor: 300 }),
      trend: 'up'
    },
    {
      title: 'CLS',
      subtitle: 'Cumulative Layout Shift',
      value: metrics.cls,
      unit: '',
      status: getMetricStatus(metrics.cls, { good: 0.1, poor: 0.25 }),
      trend: 'down'
    },
    {
      title: 'TTFB',
      subtitle: 'Time to First Byte',
      value: metrics.ttfb,
      unit: 'ms',
      status: getMetricStatus(metrics.ttfb, { good: 800, poor: 1800 }),
      trend: 'stable'
    },
    {
      title: 'STT',
      subtitle: '음성 인식 평균 시간',
      value: metrics.sttAvgDuration,
      unit: 'ms',
      status: getMetricStatus(metrics.sttAvgDuration, { good: 1000, poor: 3000 }),
      trend: 'stable'
    },
    {
      title: 'TTS',
      subtitle: '음성 합성 평균 시간',
      value: metrics.ttsAvgDuration,
      unit: 'ms',
      status: getMetricStatus(metrics.ttsAvgDuration, { good: 1500, poor: 4000 }),
      trend: 'up'
    },
    {
      title: 'API',
      subtitle: '평균 응답 시간',
      value: metrics.apiAvgResponseTime,
      unit: 'ms',
      status: getMetricStatus(metrics.apiAvgResponseTime, { good: 200, poor: 1000 }),
      trend: 'down'
    },
    {
      title: '활성 사용자',
      subtitle: '현재 접속 중',
      value: metrics.activeUsers,
      unit: '명',
      status: 'good',
      trend: 'stable'
    },
    {
      title: '에러율',
      subtitle: '지난 1시간',
      value: metrics.errorRate,
      unit: '%',
      status: getMetricStatus(metrics.errorRate, { good: 0.01, poor: 0.05 }),
      trend: 'down'
    }
  ];

  return (
    <div className={styles.container}>
      <h2>실시간 메트릭</h2>
      <div className={styles.grid}>
        {metricCards.map((metric, index) => (
          <div key={index} className={`${styles.metric} ${styles[metric.status]}`}>
            <div className={styles.header}>
              <div className={styles.title}>{metric.title}</div>
              <div className={`${styles.trend} ${styles[metric.trend]}`}>
                {metric.trend === 'up' && '↗'}
                {metric.trend === 'down' && '↘'}
                {metric.trend === 'stable' && '→'}
              </div>
            </div>
            <div className={styles.value}>
              {formatValue(metric.value, metric.unit)}
            </div>
            <div className={styles.subtitle}>{metric.subtitle}</div>
          </div>
        ))}
      </div>
    </div>
  );
}