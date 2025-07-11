'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { performanceOptimizer } from '@/services/optimization/performanceOptimizer';
import styles from './PerformanceOptimizationPanel.module.css';

interface OptimizationStatus {
  isRunning: boolean;
  lastRun: string | null;
  totalOptimizations: number;
  activeRules: number;
}

interface OptimizationRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: 'high' | 'medium' | 'low';
  lastTriggered: string | null;
  successRate: number;
}

export function PerformanceOptimizationPanel() {
  const [status, setStatus] = useState<OptimizationStatus>({
    isRunning: false,
    lastRun: null,
    totalOptimizations: 0,
    activeRules: 0
  });
  
  const [rules, setRules] = useState<OptimizationRule[]>([]);
  const [config, setConfig] = useState(performanceOptimizer.getConfig());
  const [history, setHistory] = useState(performanceOptimizer.getOptimizationHistory());
  const [autoOptimize, setAutoOptimize] = useState(false);

  useEffect(() => {
    updateStatus();
    updateRules();
    
    // Setup auto-optimization if enabled
    let interval: NodeJS.Timeout;
    if (autoOptimize) {
      interval = setInterval(() => {
        performanceOptimizer.startOptimization();
      }, 5 * 60 * 1000); // Every 5 minutes
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoOptimize]);

  const updateStatus = useCallback(() => {
    const optimizationHistory = performanceOptimizer.getOptimizationHistory();
    const lastRun = optimizationHistory.length > 0 
      ? optimizationHistory[optimizationHistory.length - 1].timestamp 
      : null;
    
    setStatus({
      isRunning: false, // This would be tracked in a real implementation
      lastRun,
      totalOptimizations: optimizationHistory.length,
      activeRules: config.bundleSplitting.enabled ? 1 : 0 +
                   config.imageOptimization.enabled ? 1 : 0 +
                   config.audioOptimization.enabled ? 1 : 0 +
                   config.cacheStrategy.enabled ? 1 : 0 +
                   config.featureToggling.enabled ? 1 : 0
    });
  }, [config]);

  const updateRules = useCallback(() => {
    const mockRules: OptimizationRule[] = [
      {
        id: 'slow-lcp-optimization',
        name: 'LCP 최적화',
        enabled: config.featureToggling.enabled,
        priority: 'high',
        lastTriggered: null,
        successRate: 0.92
      },
      {
        id: 'high-fid-optimization',
        name: 'FID 최적화',
        enabled: config.featureToggling.enabled,
        priority: 'high',
        lastTriggered: null,
        successRate: 0.88
      },
      {
        id: 'layout-shift-optimization',
        name: 'CLS 최적화',
        enabled: config.featureToggling.enabled,
        priority: 'medium',
        lastTriggered: null,
        successRate: 0.95
      },
      {
        id: 'bundle-size-optimization',
        name: '번들 크기 최적화',
        enabled: config.bundleSplitting.enabled,
        priority: 'medium',
        lastTriggered: null,
        successRate: 0.85
      },
      {
        id: 'memory-optimization',
        name: '메모리 사용량 최적화',
        enabled: true,
        priority: 'low',
        lastTriggered: null,
        successRate: 0.78
      }
    ];
    
    setRules(mockRules);
  }, [config]);

  const handleRunOptimization = async () => {
    setStatus(prev => ({ ...prev, isRunning: true }));
    
    try {
      await performanceOptimizer.startOptimization();
      setHistory(performanceOptimizer.getOptimizationHistory());
      updateStatus();
    } catch (error) {
      console.error('Failed to run optimization:', error);
    } finally {
      setStatus(prev => ({ ...prev, isRunning: false }));
    }
  };

  const handleConfigChange = (section: string, key: string, value: any) => {
    const newConfig = {
      ...config,
      [section]: {
        ...config[section as keyof typeof config],
        [key]: value
      }
    };
    
    setConfig(newConfig);
    performanceOptimizer.updateConfig(newConfig);
  };

  const handleRuleToggle = (ruleId: string, enabled: boolean) => {
    performanceOptimizer.toggleRule(ruleId, enabled);
    updateRules();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#f87171';
      case 'medium': return '#fbbf24';
      case 'low': return '#4ade80';
      default: return '#a0a0a0';
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 0.9) return '#4ade80';
    if (rate >= 0.8) return '#fbbf24';
    return '#f87171';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>성능 최적화 엔진</h2>
        <div className={styles.controls}>
          <button
            onClick={handleRunOptimization}
            disabled={status.isRunning}
            className={`${styles.button} ${styles.primary}`}
          >
            {status.isRunning ? '최적화 중...' : '최적화 실행'}
          </button>
          <label className={styles.autoToggle}>
            <input
              type="checkbox"
              checked={autoOptimize}
              onChange={(e) => setAutoOptimize(e.target.checked)}
            />
            자동 최적화
          </label>
        </div>
      </div>

      {/* Status Overview */}
      <div className={styles.statusGrid}>
        <div className={styles.statusCard}>
          <div className={styles.statusValue}>
            {status.isRunning ? '실행 중' : '대기 중'}
          </div>
          <div className={styles.statusLabel}>상태</div>
        </div>
        
        <div className={styles.statusCard}>
          <div className={styles.statusValue}>{status.totalOptimizations}</div>
          <div className={styles.statusLabel}>총 최적화 횟수</div>
        </div>
        
        <div className={styles.statusCard}>
          <div className={styles.statusValue}>{status.activeRules}</div>
          <div className={styles.statusLabel}>활성 규칙</div>
        </div>
        
        <div className={styles.statusCard}>
          <div className={styles.statusValue}>
            {status.lastRun ? new Date(status.lastRun).toLocaleString() : '없음'}
          </div>
          <div className={styles.statusLabel}>마지막 실행</div>
        </div>
      </div>

      {/* Configuration */}
      <div className={styles.section}>
        <h3>최적화 설정</h3>
        <div className={styles.configGrid}>
          <div className={styles.configCard}>
            <h4>번들 분할</h4>
            <label>
              <input
                type="checkbox"
                checked={config.bundleSplitting.enabled}
                onChange={(e) => handleConfigChange('bundleSplitting', 'enabled', e.target.checked)}
              />
              활성화
            </label>
            <div className={styles.configOption}>
              <label>
                최소 청크 크기 (KB):
                <input
                  type="number"
                  value={config.bundleSplitting.minChunkSize / 1000}
                  onChange={(e) => handleConfigChange('bundleSplitting', 'minChunkSize', parseInt(e.target.value) * 1000)}
                />
              </label>
            </div>
          </div>

          <div className={styles.configCard}>
            <h4>이미지 최적화</h4>
            <label>
              <input
                type="checkbox"
                checked={config.imageOptimization.enabled}
                onChange={(e) => handleConfigChange('imageOptimization', 'enabled', e.target.checked)}
              />
              활성화
            </label>
            <div className={styles.configOption}>
              <label>
                품질 (%):
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={config.imageOptimization.quality}
                  onChange={(e) => handleConfigChange('imageOptimization', 'quality', parseInt(e.target.value))}
                />
                <span>{config.imageOptimization.quality}%</span>
              </label>
            </div>
          </div>

          <div className={styles.configCard}>
            <h4>캐시 전략</h4>
            <label>
              <input
                type="checkbox"
                checked={config.cacheStrategy.enabled}
                onChange={(e) => handleConfigChange('cacheStrategy', 'enabled', e.target.checked)}
              />
              활성화
            </label>
            <div className={styles.configOption}>
              <label>
                전략:
                <select
                  value={config.cacheStrategy.strategy}
                  onChange={(e) => handleConfigChange('cacheStrategy', 'strategy', e.target.value)}
                >
                  <option value="cache-first">캐시 우선</option>
                  <option value="network-first">네트워크 우선</option>
                  <option value="stale-while-revalidate">백그라운드 갱신</option>
                </select>
              </label>
            </div>
          </div>

          <div className={styles.configCard}>
            <h4>기능 토글링</h4>
            <label>
              <input
                type="checkbox"
                checked={config.featureToggling.enabled}
                onChange={(e) => handleConfigChange('featureToggling', 'enabled', e.target.checked)}
              />
              활성화
            </label>
            <div className={styles.configOption}>
              <label>
                LCP 임계값 (ms):
                <input
                  type="number"
                  value={config.featureToggling.performanceThresholds.lcp}
                  onChange={(e) => handleConfigChange('featureToggling', 'performanceThresholds', {
                    ...config.featureToggling.performanceThresholds,
                    lcp: parseInt(e.target.value)
                  })}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Optimization Rules */}
      <div className={styles.section}>
        <h3>최적화 규칙</h3>
        <div className={styles.rulesGrid}>
          {rules.map(rule => (
            <div key={rule.id} className={styles.ruleCard}>
              <div className={styles.ruleHeader}>
                <div className={styles.ruleName}>{rule.name}</div>
                <div 
                  className={styles.rulePriority}
                  style={{ color: getPriorityColor(rule.priority) }}
                >
                  {rule.priority}
                </div>
              </div>
              
              <div className={styles.ruleStats}>
                <div className={styles.ruleStat}>
                  <span 
                    className={styles.successRate}
                    style={{ color: getSuccessRateColor(rule.successRate) }}
                  >
                    {(rule.successRate * 100).toFixed(1)}%
                  </span>
                  <span className={styles.statLabel}>성공률</span>
                </div>
                
                <div className={styles.ruleStat}>
                  <span>{rule.lastTriggered || '없음'}</span>
                  <span className={styles.statLabel}>마지막 실행</span>
                </div>
              </div>

              <div className={styles.ruleToggle}>
                <label>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => handleRuleToggle(rule.id, e.target.checked)}
                  />
                  활성화
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optimization History */}
      <div className={styles.section}>
        <h3>최적화 기록</h3>
        <div className={styles.historyList}>
          {history.length === 0 ? (
            <div className={styles.emptyState}>최적화 기록이 없습니다.</div>
          ) : (
            history.slice(-10).reverse().map((entry, index) => (
              <div key={index} className={styles.historyItem}>
                <div className={styles.historyTime}>
                  {new Date(entry.timestamp).toLocaleString()}
                </div>
                <div className={styles.historyRule}>{entry.rule}</div>
                <div className={`${styles.historyStatus} ${entry.success ? styles.success : styles.failure}`}>
                  {entry.success ? '성공' : '실패'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}