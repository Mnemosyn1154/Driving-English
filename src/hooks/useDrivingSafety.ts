'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccessibleVoiceFeedback } from './useAccessibleVoiceFeedback';

export interface DrivingSafetyConfig {
  enabled: boolean;
  autoDetectSpeed: boolean;
  speedThresholds: {
    slow: number;    // km/h
    fast: number;    // km/h
  };
  emergencyDetection: boolean;
  focusMode: boolean;
  batteryMonitoring: boolean;
  locationServices: boolean;
}

export interface DrivingSafetyState {
  speedLevel: 'stationary' | 'slow' | 'fast';
  isEmergency: boolean;
  isFocusMode: boolean;
  batteryLevel: number;
  locationAccuracy: 'high' | 'medium' | 'low' | 'none';
  networkStrength: 'excellent' | 'good' | 'poor' | 'none';
  dangerLevel: 'safe' | 'caution' | 'danger' | 'emergency';
  lastSpeedUpdate: number;
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
}

export function useDrivingSafety(config: DrivingSafetyConfig) {
  const [state, setState] = useState<DrivingSafetyState>({
    speedLevel: 'stationary',
    isEmergency: false,
    isFocusMode: false,
    batteryLevel: 1,
    locationAccuracy: 'none',
    networkStrength: 'none',
    dangerLevel: 'safe',
    lastSpeedUpdate: Date.now(),
    currentLocation: null,
  });

  const [emergencyContacts, setEmergencyContacts] = useState<string[]>([]);
  const [safetyHistory, setSafetyHistory] = useState<any[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  
  const geolocationWatchIdRef = useRef<number | null>(null);
  const speedCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const batteryCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const networkCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastKnownSpeedRef = useRef<number>(0);
  const speedHistoryRef = useRef<number[]>([]);
  
  const voiceFeedback = useAccessibleVoiceFeedback({
    enabled: config.enabled,
    isDrivingMode: true,
    speedLevel: state.speedLevel,
    voiceSettings: {
      rate: 1.1,
      pitch: 1.0,
      volume: 0.9,
    },
    feedbackLevel: state.isEmergency ? 'minimal' : 'standard',
    emergencyMode: state.isEmergency,
  });

  // 속도 감지 및 분류
  const detectSpeed = useCallback(async () => {
    if (!config.autoDetectSpeed) return;

    try {
      // GPS 기반 속도 계산
      if (navigator.geolocation && state.currentLocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, speed } = position.coords;
            const currentSpeed = speed ? Math.abs(speed * 3.6) : 0; // m/s to km/h
            
            // 속도 히스토리 업데이트
            speedHistoryRef.current.push(currentSpeed);
            if (speedHistoryRef.current.length > 10) {
              speedHistoryRef.current.shift();
            }
            
            // 평균 속도 계산
            const avgSpeed = speedHistoryRef.current.reduce((a, b) => a + b, 0) / speedHistoryRef.current.length;
            lastKnownSpeedRef.current = avgSpeed;
            
            // 속도 레벨 결정
            let newSpeedLevel: 'stationary' | 'slow' | 'fast' = 'stationary';
            
            if (avgSpeed > config.speedThresholds.fast) {
              newSpeedLevel = 'fast';
            } else if (avgSpeed > config.speedThresholds.slow) {
              newSpeedLevel = 'slow';
            }
            
            // 속도 레벨이 변경된 경우
            if (newSpeedLevel !== state.speedLevel) {
              setState(prev => ({
                ...prev,
                speedLevel: newSpeedLevel,
                lastSpeedUpdate: Date.now(),
              }));
              
              // 음성 피드백
              if (newSpeedLevel === 'fast') {
                voiceFeedback.messages.warning.connection();
              } else if (newSpeedLevel === 'stationary') {
                voiceFeedback.messages.status.connected();
              }
            }
            
            // 위치 정보 업데이트
            setState(prev => ({
              ...prev,
              currentLocation: { latitude, longitude, accuracy: position.coords.accuracy },
            }));
          },
          (error) => {
            console.error('Geolocation error:', error);
            setState(prev => ({
              ...prev,
              locationAccuracy: 'none',
            }));
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000,
          }
        );
      }
    } catch (error) {
      console.error('Speed detection error:', error);
    }
  }, [config.autoDetectSpeed, config.speedThresholds, state.currentLocation, state.speedLevel, voiceFeedback]);

  // 배터리 상태 모니터링
  const monitorBattery = useCallback(async () => {
    if (!config.batteryMonitoring) return;

    try {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        
        setState(prev => ({
          ...prev,
          batteryLevel: battery.level,
        }));
        
        // 배터리 부족 경고
        if (battery.level < 0.2 && !battery.charging) {
          voiceFeedback.messages.warning.battery();
        }
        
        // 배터리 이벤트 리스너
        battery.addEventListener('levelchange', () => {
          setState(prev => ({
            ...prev,
            batteryLevel: battery.level,
          }));
        });
      }
    } catch (error) {
      console.error('Battery monitoring error:', error);
    }
  }, [config.batteryMonitoring, voiceFeedback]);

  // 네트워크 상태 모니터링
  const monitorNetwork = useCallback(() => {
    if (!navigator.connection) return;

    const connection = navigator.connection;
    
    const updateNetworkState = () => {
      let strength: 'excellent' | 'good' | 'poor' | 'none' = 'none';
      
      if (connection.effectiveType) {
        switch (connection.effectiveType) {
          case '4g':
            strength = 'excellent';
            break;
          case '3g':
            strength = 'good';
            break;
          case '2g':
            strength = 'poor';
            break;
          default:
            strength = 'none';
        }
      }
      
      setState(prev => ({
        ...prev,
        networkStrength: strength,
      }));
    };
    
    updateNetworkState();
    
    connection.addEventListener('change', updateNetworkState);
    
    return () => {
      connection.removeEventListener('change', updateNetworkState);
    };
  }, []);

  // 긴급 상황 감지
  const detectEmergency = useCallback(() => {
    if (!config.emergencyDetection) return;

    // 급격한 속도 변화 감지
    const speedHistory = speedHistoryRef.current;
    if (speedHistory.length >= 3) {
      const recentSpeeds = speedHistory.slice(-3);
      const speedDifference = Math.max(...recentSpeeds) - Math.min(...recentSpeeds);
      
      if (speedDifference > 50) { // 50km/h 이상 급격한 변화
        triggerEmergency('급격한 속도 변화가 감지되었습니다');
      }
    }
    
    // 배터리 매우 부족
    if (state.batteryLevel < 0.05) {
      triggerEmergency('배터리가 매우 부족합니다');
    }
    
    // 네트워크 완전 끊김 (고속 주행 중)
    if (state.networkStrength === 'none' && state.speedLevel === 'fast') {
      triggerEmergency('네트워크 연결이 끊어졌습니다');
    }
  }, [config.emergencyDetection, state.batteryLevel, state.networkStrength, state.speedLevel]);

  // 긴급 상황 트리거
  const triggerEmergency = useCallback((reason: string) => {
    setState(prev => ({
      ...prev,
      isEmergency: true,
      dangerLevel: 'emergency',
    }));
    
    voiceFeedback.addUrgentMessage(`긴급 상황: ${reason}`, 'emergency');
    
    // 안전 히스토리에 기록
    setSafetyHistory(prev => [{
      timestamp: Date.now(),
      type: 'emergency',
      reason,
      location: state.currentLocation,
      speed: lastKnownSpeedRef.current,
    }, ...prev]);
    
    // 자동 복구 타이머 (30초 후)
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        isEmergency: false,
        dangerLevel: 'safe',
      }));
    }, 30000);
  }, [voiceFeedback, state.currentLocation]);

  // 집중 모드 토글
  const toggleFocusMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      isFocusMode: !prev.isFocusMode,
    }));
    
    if (state.isFocusMode) {
      voiceFeedback.messages.status.connected();
    } else {
      voiceFeedback.messages.status.loading();
    }
  }, [state.isFocusMode, voiceFeedback]);

  // 위치 추적 시작
  const startLocationTracking = useCallback(() => {
    if (!config.locationServices) return;

    if (navigator.geolocation) {
      geolocationWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          setState(prev => ({
            ...prev,
            currentLocation: { latitude, longitude, accuracy },
            locationAccuracy: accuracy < 10 ? 'high' : accuracy < 50 ? 'medium' : 'low',
          }));
        },
        (error) => {
          console.error('Geolocation watch error:', error);
          setState(prev => ({
            ...prev,
            locationAccuracy: 'none',
          }));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    }
  }, [config.locationServices]);

  // 위치 추적 중지
  const stopLocationTracking = useCallback(() => {
    if (geolocationWatchIdRef.current) {
      navigator.geolocation.clearWatch(geolocationWatchIdRef.current);
      geolocationWatchIdRef.current = null;
    }
  }, []);

  // 안전 모니터링 시작
  const startSafetyMonitoring = useCallback(() => {
    if (!config.enabled || isMonitoring) return;

    setIsMonitoring(true);
    
    // 위치 추적 시작
    startLocationTracking();
    
    // 주기적 점검 시작
    speedCheckIntervalRef.current = setInterval(detectSpeed, 5000);
    batteryCheckIntervalRef.current = setInterval(monitorBattery, 30000);
    networkCheckIntervalRef.current = setInterval(monitorNetwork, 10000);
    
    // 긴급 상황 감지 시작
    const emergencyCheckInterval = setInterval(detectEmergency, 2000);
    
    voiceFeedback.messages.status.connected();
    
    return () => {
      clearInterval(emergencyCheckInterval);
    };
  }, [config.enabled, isMonitoring, startLocationTracking, detectSpeed, monitorBattery, monitorNetwork, detectEmergency, voiceFeedback]);

  // 안전 모니터링 중지
  const stopSafetyMonitoring = useCallback(() => {
    setIsMonitoring(false);
    
    stopLocationTracking();
    
    if (speedCheckIntervalRef.current) {
      clearInterval(speedCheckIntervalRef.current);
      speedCheckIntervalRef.current = null;
    }
    
    if (batteryCheckIntervalRef.current) {
      clearInterval(batteryCheckIntervalRef.current);
      batteryCheckIntervalRef.current = null;
    }
    
    if (networkCheckIntervalRef.current) {
      clearInterval(networkCheckIntervalRef.current);
      networkCheckIntervalRef.current = null;
    }
    
    voiceFeedback.messages.status.disconnected();
  }, [stopLocationTracking, voiceFeedback]);

  // 초기화
  useEffect(() => {
    if (config.enabled) {
      startSafetyMonitoring();
    }
    
    return () => {
      stopSafetyMonitoring();
    };
  }, [config.enabled, startSafetyMonitoring, stopSafetyMonitoring]);

  // 정리
  useEffect(() => {
    return () => {
      stopSafetyMonitoring();
    };
  }, [stopSafetyMonitoring]);

  // 안전 리포트 생성
  const generateSafetyReport = useCallback(() => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentEvents = safetyHistory.filter(event => event.timestamp > oneHourAgo);
    
    return {
      currentState: state,
      recentEvents,
      statistics: {
        averageSpeed: speedHistoryRef.current.reduce((a, b) => a + b, 0) / speedHistoryRef.current.length || 0,
        maxSpeed: Math.max(...speedHistoryRef.current),
        emergencyCount: recentEvents.filter(e => e.type === 'emergency').length,
        totalDistance: 0, // 계산 필요
      },
      recommendations: generateSafetyRecommendations(),
    };
  }, [state, safetyHistory]);

  // 안전 권장사항 생성
  const generateSafetyRecommendations = useCallback(() => {
    const recommendations: string[] = [];
    
    if (state.batteryLevel < 0.3) {
      recommendations.push('배터리를 충전하세요');
    }
    
    if (state.networkStrength === 'poor' || state.networkStrength === 'none') {
      recommendations.push('네트워크 연결을 확인하세요');
    }
    
    if (state.speedLevel === 'fast') {
      recommendations.push('고속 주행 시 음성 명령을 사용하세요');
    }
    
    if (state.locationAccuracy === 'none') {
      recommendations.push('위치 서비스를 활성화하세요');
    }
    
    return recommendations;
  }, [state]);

  return {
    // 상태
    state,
    isMonitoring,
    history: safetyHistory,
    
    // 제어
    startSafetyMonitoring,
    stopSafetyMonitoring,
    toggleFocusMode,
    triggerEmergency,
    
    // 리포트
    generateSafetyReport,
    generateSafetyRecommendations,
    
    // 음성 피드백
    voiceFeedback,
    
    // 긴급 연락처
    emergencyContacts,
    setEmergencyContacts,
  };
}