/**
 * Conversation Context Manager
 * Manages conversation state, context, and memory for voice interactions
 */

import { ConversationMessage } from '@/types/websocket';

export interface ContextState {
  currentArticle?: {
    id: string;
    title: string;
    content: string;
    currentSentence: number;
    totalSentences: number;
  };
  userPreferences: {
    language: 'ko' | 'en';
    speed: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    interests: string[];
  };
  sessionState: {
    isPlaying: boolean;
    isPaused: boolean;
    volume: number;
    repeatCount: number;
    startTime: number;
    totalListenTime: number;
  };
  learningProgress: {
    wordsLearned: string[];
    difficultWords: string[];
    completedArticles: string[];
    streak: number;
    totalSessions: number;
  };
  conversationHistory: ConversationMessage[];
  recentCommands: string[];
  currentLocation?: {
    lat: number;
    lng: number;
    address: string;
  };
  drivingContext: {
    isDriving: boolean;
    speed?: number;
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    weather?: string;
    trafficCondition?: 'light' | 'moderate' | 'heavy';
  };
}

export class ConversationContextManager {
  private state: ContextState;
  private stateChangeListeners: Array<(state: ContextState) => void> = [];
  private contextGenerationTemplates: Record<string, string> = {
    newsReading: `사용자가 운전 중에 영어 뉴스를 듣고 있습니다.
현재 기사: {articleTitle}
진행도: {currentSentence}/{totalSentences}
난이도: {difficulty}
사용자 관심사: {interests}
시간대: {timeOfDay}
운전 상황: {drivingContext}

사용자의 명령이나 질문에 대해 간결하고 안전한 답변을 제공하세요.`,
    
    learning: `사용자가 영어 학습 중입니다.
학습 진도: {wordsLearned}개 단어 학습 완료
어려운 단어: {difficultWords}
현재 세션 시간: {sessionTime}분
연속 학습 일수: {streak}일

학습 관련 질문이나 단어 설명 요청에 도움을 주세요.`,
    
    general: `드라이빙 잉글리쉬 음성 어시스턴트입니다.
사용자 선호도: {language} 언어, {speed} 속도
현재 위치: {location}
시간: {timeOfDay}
날씨: {weather}

운전 안전을 최우선으로 하며 간결한 답변을 제공합니다.`
  };

  constructor(initialState?: Partial<ContextState>) {
    this.state = {
      userPreferences: {
        language: 'ko',
        speed: 1.0,
        difficulty: 'intermediate',
        interests: [],
      },
      sessionState: {
        isPlaying: false,
        isPaused: false,
        volume: 1.0,
        repeatCount: 0,
        startTime: Date.now(),
        totalListenTime: 0,
      },
      learningProgress: {
        wordsLearned: [],
        difficultWords: [],
        completedArticles: [],
        streak: 0,
        totalSessions: 0,
      },
      conversationHistory: [],
      recentCommands: [],
      drivingContext: {
        isDriving: false,
        timeOfDay: this.getTimeOfDay(),
      },
      ...initialState,
    };
  }

  /**
   * Get current context state
   */
  getState(): ContextState {
    return { ...this.state };
  }

  /**
   * Update context state
   */
  updateState(updates: Partial<ContextState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyStateChange();
  }

  /**
   * Update specific sections of state
   */
  updateUserPreferences(prefs: Partial<ContextState['userPreferences']>): void {
    this.state.userPreferences = { ...this.state.userPreferences, ...prefs };
    this.notifyStateChange();
  }

  updateSessionState(session: Partial<ContextState['sessionState']>): void {
    this.state.sessionState = { ...this.state.sessionState, ...session };
    this.notifyStateChange();
  }

  updateLearningProgress(progress: Partial<ContextState['learningProgress']>): void {
    this.state.learningProgress = { ...this.state.learningProgress, ...progress };
    this.notifyStateChange();
  }

  updateDrivingContext(context: Partial<ContextState['drivingContext']>): void {
    this.state.drivingContext = { ...this.state.drivingContext, ...context };
    this.notifyStateChange();
  }

  /**
   * Add conversation message
   */
  addConversationMessage(message: ConversationMessage): void {
    this.state.conversationHistory.push(message);
    
    // Keep only last 20 messages
    if (this.state.conversationHistory.length > 20) {
      this.state.conversationHistory = this.state.conversationHistory.slice(-20);
    }

    this.notifyStateChange();
  }

  /**
   * Add recent command
   */
  addRecentCommand(command: string): void {
    this.state.recentCommands.unshift(command);
    
    // Keep only last 10 commands
    if (this.state.recentCommands.length > 10) {
      this.state.recentCommands = this.state.recentCommands.slice(0, 10);
    }

    this.notifyStateChange();
  }

  /**
   * Set current article
   */
  setCurrentArticle(article: ContextState['currentArticle']): void {
    this.state.currentArticle = article;
    this.notifyStateChange();
  }

  /**
   * Update current sentence position
   */
  updateCurrentSentence(sentenceNumber: number): void {
    if (this.state.currentArticle) {
      this.state.currentArticle.currentSentence = sentenceNumber;
      this.notifyStateChange();
    }
  }

  /**
   * Generate context string for AI
   */
  generateContextString(type: 'newsReading' | 'learning' | 'general' = 'general'): string {
    const template = this.contextGenerationTemplates[type];
    
    return template.replace(/{(\w+)}/g, (match, key) => {
      switch (key) {
        case 'articleTitle':
          return this.state.currentArticle?.title || '없음';
        case 'currentSentence':
          return this.state.currentArticle?.currentSentence?.toString() || '0';
        case 'totalSentences':
          return this.state.currentArticle?.totalSentences?.toString() || '0';
        case 'difficulty':
          return this.state.userPreferences.difficulty;
        case 'interests':
          return this.state.userPreferences.interests.join(', ') || '일반';
        case 'timeOfDay':
          return this.state.drivingContext.timeOfDay;
        case 'drivingContext':
          return this.state.drivingContext.isDriving ? '운전 중' : '정차';
        case 'wordsLearned':
          return this.state.learningProgress.wordsLearned.length.toString();
        case 'difficultWords':
          return this.state.learningProgress.difficultWords.join(', ') || '없음';
        case 'sessionTime':
          return Math.round((Date.now() - this.state.sessionState.startTime) / 60000).toString();
        case 'streak':
          return this.state.learningProgress.streak.toString();
        case 'language':
          return this.state.userPreferences.language;
        case 'speed':
          return this.state.userPreferences.speed.toString();
        case 'location':
          return this.state.currentLocation?.address || '알 수 없음';
        case 'weather':
          return this.state.drivingContext.weather || '알 수 없음';
        default:
          return match;
      }
    });
  }

  /**
   * Get conversation summary
   */
  getConversationSummary(): string {
    const recentMessages = this.state.conversationHistory.slice(-5);
    if (recentMessages.length === 0) return '대화 기록 없음';

    const summary = recentMessages
      .map(msg => `${msg.role === 'user' ? '사용자' : '어시스턴트'}: ${msg.content}`)
      .join('\n');

    return `최근 대화:\n${summary}`;
  }

  /**
   * Get user behavior patterns
   */
  getUserBehaviorPatterns(): {
    frequentCommands: string[];
    preferredTopics: string[];
    averageSessionTime: number;
    learningVelocity: number;
  } {
    const commandFrequency = this.state.recentCommands.reduce((acc, cmd) => {
      acc[cmd] = (acc[cmd] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const frequentCommands = Object.entries(commandFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cmd]) => cmd);

    const averageSessionTime = this.state.sessionState.totalListenTime / 
      (this.state.learningProgress.totalSessions || 1);

    const learningVelocity = this.state.learningProgress.wordsLearned.length / 
      (this.state.learningProgress.totalSessions || 1);

    return {
      frequentCommands,
      preferredTopics: this.state.userPreferences.interests,
      averageSessionTime,
      learningVelocity,
    };
  }

  /**
   * Get contextual recommendations
   */
  getContextualRecommendations(): string[] {
    const recommendations: string[] = [];
    const patterns = this.getUserBehaviorPatterns();
    
    // Based on time of day
    const timeOfDay = this.state.drivingContext.timeOfDay;
    if (timeOfDay === 'morning') {
      recommendations.push('아침 뉴스나 경제 기사를 추천합니다.');
    } else if (timeOfDay === 'evening') {
      recommendations.push('가벼운 문화 기사나 엔터테인먼트 뉴스를 추천합니다.');
    }

    // Based on learning progress
    if (this.state.learningProgress.difficultWords.length > 5) {
      recommendations.push('어려운 단어들을 복습해보세요.');
    }

    // Based on session time
    if (patterns.averageSessionTime > 30) {
      recommendations.push('잠깐 휴식을 취하시는 것이 좋겠습니다.');
    }

    // Based on interests
    if (this.state.userPreferences.interests.length === 0) {
      recommendations.push('관심사를 설정하면 더 맞춤형 뉴스를 제공할 수 있습니다.');
    }

    return recommendations;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: ContextState) => void): () => void {
    this.stateChangeListeners.push(listener);
    
    return () => {
      const index = this.stateChangeListeners.indexOf(listener);
      if (index > -1) {
        this.stateChangeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyStateChange(): void {
    this.stateChangeListeners.forEach(listener => listener(this.state));
  }

  /**
   * Get current time of day
   */
  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Save state to localStorage
   */
  saveToStorage(): void {
    try {
      const serializedState = JSON.stringify(this.state);
      localStorage.setItem('driving-english-context', serializedState);
    } catch (error) {
      console.error('Failed to save context to storage:', error);
    }
  }

  /**
   * Load state from localStorage
   */
  loadFromStorage(): void {
    try {
      const serializedState = localStorage.getItem('driving-english-context');
      if (serializedState) {
        const savedState = JSON.parse(serializedState);
        this.state = { ...this.state, ...savedState };
        this.notifyStateChange();
      }
    } catch (error) {
      console.error('Failed to load context from storage:', error);
    }
  }

  /**
   * Clear all context data
   */
  clearContext(): void {
    this.state = {
      userPreferences: {
        language: 'ko',
        speed: 1.0,
        difficulty: 'intermediate',
        interests: [],
      },
      sessionState: {
        isPlaying: false,
        isPaused: false,
        volume: 1.0,
        repeatCount: 0,
        startTime: Date.now(),
        totalListenTime: 0,
      },
      learningProgress: {
        wordsLearned: [],
        difficultWords: [],
        completedArticles: [],
        streak: 0,
        totalSessions: 0,
      },
      conversationHistory: [],
      recentCommands: [],
      drivingContext: {
        isDriving: false,
        timeOfDay: this.getTimeOfDay(),
      },
    };
    
    this.notifyStateChange();
    
    // Clear storage
    try {
      localStorage.removeItem('driving-english-context');
    } catch (error) {
      console.error('Failed to clear context storage:', error);
    }
  }
}

// Export singleton instance
export const conversationContextManager = new ConversationContextManager();

// Auto-save to storage every 30 seconds
setInterval(() => {
  conversationContextManager.saveToStorage();
}, 30000);

// Load from storage on initialization
if (typeof window !== 'undefined') {
  conversationContextManager.loadFromStorage();
}