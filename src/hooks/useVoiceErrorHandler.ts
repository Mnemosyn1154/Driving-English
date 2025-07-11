'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceErrorHandler, VoiceError, createVoiceErrorHandler } from '@/services/error/voiceErrorHandler';

interface UseVoiceErrorHandlerOptions {
  maxRetries?: number;
  retryDelay?: number;
  enableLogging?: boolean;
  enableUserNotification?: boolean;
  gracefulDegradation?: boolean;
  onError?: (error: VoiceError) => void;
  onRecovery?: (success: boolean) => void;
  onFallback?: (mode: string) => void;
}

interface UseVoiceErrorHandlerReturn {
  isHealthy: boolean;
  isInRecovery: boolean;
  currentError: VoiceError | null;
  errorHistory: VoiceError[];
  errorStats: {
    totalErrors: number;
    errorsBySource: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recoverySuccessRate: number;
  };
  // Methods
  handleError: (error: Partial<VoiceError>) => Promise<void>;
  clearErrors: () => void;
  addFallback: (fallback: () => Promise<void>) => void;
  removeFallback: (fallback: () => Promise<void>) => void;
  // Status
  networkStatus: 'online' | 'offline' | 'unstable';
  permissionStatus: 'granted' | 'denied' | 'prompt';
  audioDeviceStatus: 'available' | 'unavailable' | 'error';
  serviceStatus: {
    stt: 'available' | 'unavailable' | 'limited';
    gemini: 'available' | 'unavailable' | 'limited';
    wakeWord: 'available' | 'unavailable' | 'limited';
  };
}

export function useVoiceErrorHandler(options: UseVoiceErrorHandlerOptions = {}): UseVoiceErrorHandlerReturn {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    enableLogging = true,
    enableUserNotification = true,
    gracefulDegradation = true,
    onError,
    onRecovery,
    onFallback,
  } = options;

  // State
  const [isHealthy, setIsHealthy] = useState(true);
  const [isInRecovery, setIsInRecovery] = useState(false);
  const [currentError, setCurrentError] = useState<VoiceError | null>(null);
  const [errorHistory, setErrorHistory] = useState<VoiceError[]>([]);
  const [errorStats, setErrorStats] = useState({
    totalErrors: 0,
    errorsBySource: {} as Record<string, number>,
    errorsBySeverity: {} as Record<string, number>,
    recoverySuccessRate: 0,
  });
  
  // Status states
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'unstable'>('online');
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [audioDeviceStatus, setAudioDeviceStatus] = useState<'available' | 'unavailable' | 'error'>('available');
  const [serviceStatus, setServiceStatus] = useState({
    stt: 'available' as 'available' | 'unavailable' | 'limited',
    gemini: 'available' as 'available' | 'unavailable' | 'limited',
    wakeWord: 'available' as 'available' | 'unavailable' | 'limited',
  });

  // Refs
  const errorHandlerRef = useRef<VoiceErrorHandler | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize error handler
  useEffect(() => {
    errorHandlerRef.current = createVoiceErrorHandler({
      maxRetries,
      retryDelay,
      enableLogging,
      enableUserNotification,
      gracefulDegradation,
    });

    const handler = errorHandlerRef.current;

    // Set up event listeners
    handler.on('error', (error: VoiceError) => {
      setCurrentError(error);
      setErrorHistory(prev => [...prev, error]);
      updateErrorStats();
      onError?.(error);
    });

    handler.on('recovery-attempt', () => {
      setIsInRecovery(true);
    });

    handler.on('recovery-success', () => {
      setIsInRecovery(false);
      setCurrentError(null);
      updateErrorStats();
      onRecovery?.(true);
    });

    handler.on('recovery-failed', () => {
      setIsInRecovery(false);
      onRecovery?.(false);
    });

    handler.on('fallback-mode', (mode: string) => {
      onFallback?.(mode);
      updateServiceStatus(mode);
    });

    handler.on('stt-fallback', (mode: string) => {
      setServiceStatus(prev => ({ ...prev, stt: mode === 'browser' ? 'limited' : 'unavailable' }));
    });

    handler.on('gemini-fallback', (mode: string) => {
      setServiceStatus(prev => ({ ...prev, gemini: mode === 'local-commands' ? 'limited' : 'unavailable' }));
    });

    handler.on('wake-word-fallback', (mode: string) => {
      setServiceStatus(prev => ({ ...prev, wakeWord: mode === 'energy' ? 'limited' : 'unavailable' }));
    });

    handler.on('graceful-degradation', (data: any) => {
      console.log('Graceful degradation activated:', data.degradedMode);
      updateServiceStatusForDegradation(data.degradedMode);
    });

    return () => {
      handler.dispose();
    };
  }, [maxRetries, retryDelay, enableLogging, enableUserNotification, gracefulDegradation, onError, onRecovery, onFallback]);

  // Monitor system health
  useEffect(() => {
    const checkHealth = () => {
      if (errorHandlerRef.current) {
        const healthy = errorHandlerRef.current.isHealthy();
        setIsHealthy(healthy);
      }
    };

    // Check health every 30 seconds
    healthCheckIntervalRef.current = setInterval(checkHealth, 30000);
    
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, []);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial status
    setNetworkStatus(navigator.onLine ? 'online' : 'offline');
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check permissions
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        
        result.onchange = () => {
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        };
      } catch (error) {
        console.warn('Permission check failed:', error);
      }
    };
    
    checkPermissions();
  }, []);

  // Check audio devices
  useEffect(() => {
    const checkAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        
        setAudioDeviceStatus(audioInputs.length > 0 ? 'available' : 'unavailable');
      } catch (error) {
        console.warn('Audio device check failed:', error);
        setAudioDeviceStatus('error');
      }
    };
    
    checkAudioDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', checkAudioDevices);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', checkAudioDevices);
    };
  }, []);

  // Update error statistics
  const updateErrorStats = useCallback(() => {
    if (errorHandlerRef.current) {
      const stats = errorHandlerRef.current.getErrorStatistics();
      setErrorStats({
        totalErrors: stats.totalErrors,
        errorsBySource: stats.errorsBySource,
        errorsBySeverity: stats.errorsBySeverity,
        recoverySuccessRate: stats.recoverySuccessRate,
      });
    }
  }, []);

  // Update service status based on fallback mode
  const updateServiceStatus = useCallback((mode: string) => {
    switch (mode) {
      case 'offline':
        setServiceStatus({
          stt: 'limited',
          gemini: 'unavailable',
          wakeWord: 'limited',
        });
        break;
      case 'minimal-mode':
        setServiceStatus({
          stt: 'limited',
          gemini: 'unavailable',
          wakeWord: 'unavailable',
        });
        break;
    }
  }, []);

  // Update service status for degradation
  const updateServiceStatusForDegradation = useCallback((degradedMode: string) => {
    switch (degradedMode) {
      case 'basic-stt-only':
        setServiceStatus(prev => ({ ...prev, gemini: 'unavailable' }));
        break;
      case 'manual-activation':
        setServiceStatus(prev => ({ ...prev, wakeWord: 'unavailable' }));
        break;
      case 'text-input-only':
        setServiceStatus(prev => ({ ...prev, stt: 'unavailable' }));
        break;
      case 'visual-only':
        setServiceStatus(prev => ({ ...prev, stt: 'unavailable', wakeWord: 'unavailable' }));
        break;
      case 'minimal-functionality':
        setServiceStatus({
          stt: 'unavailable',
          gemini: 'unavailable',
          wakeWord: 'unavailable',
        });
        break;
    }
  }, []);

  // Handle error
  const handleError = useCallback(async (error: Partial<VoiceError>) => {
    if (errorHandlerRef.current) {
      await errorHandlerRef.current.handleError(error);
    }
  }, []);

  // Clear errors
  const clearErrors = useCallback(() => {
    if (errorHandlerRef.current) {
      errorHandlerRef.current.clearErrorHistory();
    }
    setErrorHistory([]);
    setCurrentError(null);
    updateErrorStats();
  }, [updateErrorStats]);

  // Add fallback
  const addFallback = useCallback((fallback: () => Promise<void>) => {
    if (errorHandlerRef.current) {
      errorHandlerRef.current.addFallback(fallback);
    }
  }, []);

  // Remove fallback
  const removeFallback = useCallback((fallback: () => Promise<void>) => {
    if (errorHandlerRef.current) {
      errorHandlerRef.current.removeFallback(fallback);
    }
  }, []);

  return {
    isHealthy,
    isInRecovery,
    currentError,
    errorHistory,
    errorStats,
    handleError,
    clearErrors,
    addFallback,
    removeFallback,
    networkStatus,
    permissionStatus,
    audioDeviceStatus,
    serviceStatus,
  };
}