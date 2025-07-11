/**
 * Voice Recognition Error Handler
 * Provides comprehensive error handling and fallback mechanisms for voice recognition
 */

import { EventEmitter } from 'events';

export interface VoiceError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  source: 'stt' | 'gemini' | 'wake-word' | 'audio' | 'network' | 'permission';
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'graceful-degradation' | 'user-intervention';
  description: string;
  action: () => Promise<void>;
  maxRetries?: number;
}

export interface ErrorHandlerConfig {
  maxRetries: number;
  retryDelay: number;
  fallbackTimeout: number;
  enableLogging: boolean;
  enableUserNotification: boolean;
  gracefulDegradation: boolean;
}

export class VoiceErrorHandler extends EventEmitter {
  private config: ErrorHandlerConfig;
  private errorHistory: VoiceError[] = [];
  private recoveryActions: Map<string, RecoveryAction> = new Map();
  private retryCounters: Map<string, number> = new Map();
  private isInRecovery = false;
  private fallbackChain: Array<() => Promise<void>> = [];

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    super();
    
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      fallbackTimeout: 5000,
      enableLogging: true,
      enableUserNotification: true,
      gracefulDegradation: true,
      ...config,
    };

    this.initializeRecoveryActions();
  }

  /**
   * Initialize recovery actions for common error scenarios
   */
  private initializeRecoveryActions(): void {
    // Network-related errors
    this.recoveryActions.set('network-timeout', {
      type: 'retry',
      description: '네트워크 연결 재시도',
      action: async () => {
        await this.delay(this.config.retryDelay);
        // Network retry logic would go here
      },
      maxRetries: 3,
    });

    this.recoveryActions.set('network-offline', {
      type: 'fallback',
      description: '오프라인 모드로 전환',
      action: async () => {
        this.emit('fallback-mode', 'offline');
      },
    });

    // Permission-related errors
    this.recoveryActions.set('permission-denied', {
      type: 'user-intervention',
      description: '마이크 권한 요청',
      action: async () => {
        this.emit('permission-request', 'microphone');
      },
    });

    // Audio-related errors
    this.recoveryActions.set('audio-device-not-found', {
      type: 'fallback',
      description: '다른 오디오 장치 탐색',
      action: async () => {
        this.emit('audio-device-search');
      },
    });

    this.recoveryActions.set('audio-processing-error', {
      type: 'retry',
      description: '오디오 처리 재시도',
      action: async () => {
        await this.delay(this.config.retryDelay);
        this.emit('audio-restart');
      },
      maxRetries: 2,
    });

    // STT-related errors
    this.recoveryActions.set('stt-service-unavailable', {
      type: 'fallback',
      description: '대체 STT 서비스 사용',
      action: async () => {
        this.emit('stt-fallback', 'browser');
      },
    });

    this.recoveryActions.set('stt-quota-exceeded', {
      type: 'graceful-degradation',
      description: '로컬 STT로 전환',
      action: async () => {
        this.emit('stt-fallback', 'local');
      },
    });

    // Gemini-related errors
    this.recoveryActions.set('gemini-api-error', {
      type: 'fallback',
      description: '기본 명령 처리기 사용',
      action: async () => {
        this.emit('gemini-fallback', 'local-commands');
      },
    });

    this.recoveryActions.set('gemini-rate-limit', {
      type: 'retry',
      description: 'API 제한 대기 후 재시도',
      action: async () => {
        await this.delay(this.config.retryDelay * 2);
        this.emit('gemini-retry');
      },
      maxRetries: 1,
    });

    // Wake word detection errors
    this.recoveryActions.set('wake-word-ml-error', {
      type: 'fallback',
      description: '에너지 기반 감지로 전환',
      action: async () => {
        this.emit('wake-word-fallback', 'energy');
      },
    });

    this.recoveryActions.set('wake-word-audio-error', {
      type: 'retry',
      description: '오디오 스트림 재시작',
      action: async () => {
        await this.delay(this.config.retryDelay);
        this.emit('wake-word-restart');
      },
      maxRetries: 2,
    });
  }

  /**
   * Handle an error with automatic recovery
   */
  async handleError(error: Partial<VoiceError>): Promise<void> {
    const voiceError: VoiceError = {
      code: error.code || 'unknown-error',
      message: error.message || 'Unknown error occurred',
      details: error.details,
      timestamp: Date.now(),
      severity: error.severity || 'medium',
      recoverable: error.recoverable ?? true,
      source: error.source || 'unknown',
    };

    // Add to error history
    this.errorHistory.push(voiceError);
    this.trimErrorHistory();

    // Log error if enabled
    if (this.config.enableLogging) {
      console.error('Voice Error:', voiceError);
    }

    // Emit error event
    this.emit('error', voiceError);

    // Notify user if enabled
    if (this.config.enableUserNotification) {
      this.notifyUser(voiceError);
    }

    // Attempt recovery if error is recoverable
    if (voiceError.recoverable && !this.isInRecovery) {
      await this.attemptRecovery(voiceError);
    }
  }

  /**
   * Attempt to recover from an error
   */
  private async attemptRecovery(error: VoiceError): Promise<void> {
    this.isInRecovery = true;
    
    try {
      const recoveryAction = this.recoveryActions.get(error.code);
      
      if (recoveryAction) {
        const retryKey = `${error.code}-${error.source}`;
        const currentRetries = this.retryCounters.get(retryKey) || 0;
        const maxRetries = recoveryAction.maxRetries || this.config.maxRetries;

        if (currentRetries < maxRetries) {
          // Increment retry counter
          this.retryCounters.set(retryKey, currentRetries + 1);
          
          // Emit recovery attempt event
          this.emit('recovery-attempt', {
            error,
            action: recoveryAction,
            attempt: currentRetries + 1,
            maxRetries,
          });

          // Execute recovery action
          await recoveryAction.action();
          
          // Reset retry counter on success
          this.retryCounters.delete(retryKey);
          
          this.emit('recovery-success', { error, action: recoveryAction });
        } else {
          // Max retries reached
          this.emit('recovery-failed', { error, action: recoveryAction });
          
          // Try fallback chain
          await this.executeFallbackChain(error);
        }
      } else {
        // No specific recovery action, try generic fallback
        await this.executeGenericFallback(error);
      }
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      this.emit('recovery-error', { originalError: error, recoveryError });
      
      // Try fallback chain
      await this.executeFallbackChain(error);
    } finally {
      this.isInRecovery = false;
    }
  }

  /**
   * Execute fallback chain
   */
  private async executeFallbackChain(error: VoiceError): Promise<void> {
    for (const fallback of this.fallbackChain) {
      try {
        await fallback();
        this.emit('fallback-success', { error });
        return;
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError);
        continue;
      }
    }
    
    // All fallbacks failed
    this.emit('fallback-exhausted', { error });
    
    // Graceful degradation if enabled
    if (this.config.gracefulDegradation) {
      await this.executeGracefulDegradation(error);
    }
  }

  /**
   * Execute generic fallback
   */
  private async executeGenericFallback(error: VoiceError): Promise<void> {
    switch (error.source) {
      case 'network':
        this.emit('fallback-mode', 'offline');
        break;
      case 'stt':
        this.emit('stt-fallback', 'browser');
        break;
      case 'gemini':
        this.emit('gemini-fallback', 'local-commands');
        break;
      case 'wake-word':
        this.emit('wake-word-fallback', 'energy');
        break;
      case 'audio':
        this.emit('audio-fallback', 'alternative-device');
        break;
      default:
        this.emit('system-fallback', 'minimal-mode');
    }
  }

  /**
   * Execute graceful degradation
   */
  private async executeGracefulDegradation(error: VoiceError): Promise<void> {
    // Disable advanced features and use basic functionality
    this.emit('graceful-degradation', {
      error,
      degradedMode: this.getDegradedMode(error),
    });
  }

  /**
   * Get degraded mode based on error
   */
  private getDegradedMode(error: VoiceError): string {
    switch (error.source) {
      case 'gemini':
        return 'basic-stt-only';
      case 'wake-word':
        return 'manual-activation';
      case 'stt':
        return 'text-input-only';
      case 'audio':
        return 'visual-only';
      default:
        return 'minimal-functionality';
    }
  }

  /**
   * Notify user of error
   */
  private notifyUser(error: VoiceError): void {
    const message = this.getUserFriendlyMessage(error);
    
    this.emit('user-notification', {
      type: 'error',
      severity: error.severity,
      message,
      recoverable: error.recoverable,
    });
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(error: VoiceError): string {
    const messages: Record<string, string> = {
      'network-timeout': '네트워크 연결에 문제가 있습니다. 잠시 후 다시 시도해주세요.',
      'network-offline': '인터넷 연결이 끊어졌습니다. 오프라인 모드로 전환합니다.',
      'permission-denied': '마이크 권한이 필요합니다. 브라우저 설정에서 마이크 권한을 허용해주세요.',
      'audio-device-not-found': '마이크를 찾을 수 없습니다. 장치 연결을 확인해주세요.',
      'audio-processing-error': '오디오 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      'stt-service-unavailable': '음성 인식 서비스를 사용할 수 없습니다. 대체 서비스를 사용합니다.',
      'stt-quota-exceeded': '음성 인식 사용량이 초과되었습니다. 로컬 인식 기능을 사용합니다.',
      'gemini-api-error': 'AI 서비스에 문제가 있습니다. 기본 명령 처리기를 사용합니다.',
      'gemini-rate-limit': 'AI 서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.',
      'wake-word-ml-error': '웨이크워드 인식에 문제가 있습니다. 단순 음성 감지를 사용합니다.',
      'wake-word-audio-error': '웨이크워드 오디오 처리에 문제가 있습니다. 재시도 중입니다.',
    };

    return messages[error.code] || `오류가 발생했습니다: ${error.message}`;
  }

  /**
   * Add fallback function to chain
   */
  addFallback(fallback: () => Promise<void>): void {
    this.fallbackChain.push(fallback);
  }

  /**
   * Remove fallback function from chain
   */
  removeFallback(fallback: () => Promise<void>): void {
    const index = this.fallbackChain.indexOf(fallback);
    if (index > -1) {
      this.fallbackChain.splice(index, 1);
    }
  }

  /**
   * Clear all fallbacks
   */
  clearFallbacks(): void {
    this.fallbackChain = [];
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsBySource: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recoverySuccessRate: number;
    recentErrors: VoiceError[];
  } {
    const errorsBySource = this.errorHistory.reduce((acc, error) => {
      acc[error.source] = (acc[error.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorsBySeverity = this.errorHistory.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalRecoveryAttempts = Array.from(this.retryCounters.values()).reduce((a, b) => a + b, 0);
    const recoverySuccessRate = totalRecoveryAttempts > 0 ? 
      (this.errorHistory.length - totalRecoveryAttempts) / this.errorHistory.length : 0;

    return {
      totalErrors: this.errorHistory.length,
      errorsBySource,
      errorsBySeverity,
      recoverySuccessRate,
      recentErrors: this.errorHistory.slice(-10),
    };
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): boolean {
    const recentErrors = this.errorHistory.filter(
      error => Date.now() - error.timestamp < 60000 // Last minute
    );
    
    const criticalErrors = recentErrors.filter(error => error.severity === 'critical');
    const highPriorityErrors = recentErrors.filter(error => error.severity === 'high');
    
    return criticalErrors.length === 0 && highPriorityErrors.length < 3;
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
    this.retryCounters.clear();
  }

  /**
   * Trim error history to prevent memory issues
   */
  private trimErrorHistory(): void {
    if (this.errorHistory.length > 100) {
      this.errorHistory = this.errorHistory.slice(-50);
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.clearErrorHistory();
    this.clearFallbacks();
    this.removeAllListeners();
  }
}

// Export factory function
export function createVoiceErrorHandler(config?: Partial<ErrorHandlerConfig>): VoiceErrorHandler {
  return new VoiceErrorHandler(config);
}