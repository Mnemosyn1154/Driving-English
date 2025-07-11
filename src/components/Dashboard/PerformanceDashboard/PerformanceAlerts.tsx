'use client';

import React, { useState, useEffect } from 'react';
import styles from './PerformanceAlerts.module.css';

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
  metric: string;
  value: number;
  threshold: number;
  acknowledged: boolean;
}

interface Props {
  alerts?: Alert[];
}

export function PerformanceAlerts({ alerts: externalAlerts }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'all' | 'warning' | 'error' | 'info'>('all');

  // Mock alerts for demonstration
  useEffect(() => {
    if (externalAlerts) {
      setAlerts(externalAlerts);
    } else {
      // Generate some mock alerts
      const mockAlerts: Alert[] = [
        {
          id: '1',
          type: 'error',
          title: 'LCP 임계값 초과',
          message: 'Largest Contentful Paint가 4.2초로 측정되어 권장 임계값(2.5초)을 초과했습니다.',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          metric: 'LCP',
          value: 4200,
          threshold: 2500,
          acknowledged: false
        },
        {
          id: '2',
          type: 'warning',
          title: 'API 응답 시간 증가',
          message: '/api/news/articles 엔드포인트의 평균 응답 시간이 1.2초로 증가했습니다.',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          metric: 'API Response Time',
          value: 1200,
          threshold: 1000,
          acknowledged: false
        },
        {
          id: '3',
          type: 'warning',
          title: 'STT 처리 시간 지연',
          message: '음성 인식 처리 시간이 평소보다 50% 증가했습니다.',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          metric: 'STT Duration',
          value: 2100,
          threshold: 1500,
          acknowledged: true
        },
        {
          id: '4',
          type: 'info',
          title: '성능 개선 감지',
          message: 'CLS 값이 지난 주 대비 20% 개선되었습니다.',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          metric: 'CLS',
          value: 0.08,
          threshold: 0.1,
          acknowledged: false
        }
      ];
      setAlerts(mockAlerts);
    }
  }, [externalAlerts]);

  const filteredAlerts = alerts.filter(alert => 
    filter === 'all' || alert.type === filter
  );

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffMs = now.getTime() - alertTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    return alertTime.toLocaleDateString();
  };

  const unacknowledgedCount = alerts.filter(alert => !alert.acknowledged).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>
          성능 알림 
          {unacknowledgedCount > 0 && (
            <span className={styles.badge}>{unacknowledgedCount}</span>
          )}
        </h3>
        <div className={styles.filters}>
          <button 
            className={filter === 'all' ? styles.active : ''}
            onClick={() => setFilter('all')}
          >
            전체
          </button>
          <button 
            className={filter === 'error' ? styles.active : ''}
            onClick={() => setFilter('error')}
          >
            에러
          </button>
          <button 
            className={filter === 'warning' ? styles.active : ''}
            onClick={() => setFilter('warning')}
          >
            경고
          </button>
          <button 
            className={filter === 'info' ? styles.active : ''}
            onClick={() => setFilter('info')}
          >
            정보
          </button>
        </div>
      </div>

      <div className={styles.alertsList}>
        {filteredAlerts.length === 0 ? (
          <div className={styles.noAlerts}>
            {filter === 'all' ? '알림이 없습니다.' : `${filter} 알림이 없습니다.`}
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <div 
              key={alert.id} 
              className={`${styles.alert} ${styles[alert.type]} ${alert.acknowledged ? styles.acknowledged : ''}`}
            >
              <div className={styles.alertContent}>
                <div className={styles.alertHeader}>
                  <div className={styles.alertTitle}>{alert.title}</div>
                  <div className={styles.alertTime}>{getRelativeTime(alert.timestamp)}</div>
                </div>
                <div className={styles.alertMessage}>{alert.message}</div>
                <div className={styles.alertMetrics}>
                  <span className={styles.metric}>{alert.metric}</span>
                  <span className={styles.value}>
                    현재: {alert.value}{alert.metric.includes('Rate') ? '%' : 'ms'}
                  </span>
                  <span className={styles.threshold}>
                    임계값: {alert.threshold}{alert.metric.includes('Rate') ? '%' : 'ms'}
                  </span>
                </div>
              </div>
              
              <div className={styles.alertActions}>
                {!alert.acknowledged && (
                  <button 
                    className={styles.acknowledgeBtn}
                    onClick={() => acknowledgeAlert(alert.id)}
                  >
                    확인
                  </button>
                )}
                <button 
                  className={styles.dismissBtn}
                  onClick={() => dismissAlert(alert.id)}
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}