'use client';

import { useState, useEffect, useCallback } from 'react';
import { conversationContextManager, ContextState } from '@/services/context/conversationContext';
import { ConversationMessage } from '@/types/websocket';

export function useConversationContext() {
  const [state, setState] = useState<ContextState>(() => 
    conversationContextManager.getState()
  );

  useEffect(() => {
    const unsubscribe = conversationContextManager.subscribe(setState);
    return unsubscribe;
  }, []);

  // Context update functions
  const updateUserPreferences = useCallback((prefs: Partial<ContextState['userPreferences']>) => {
    conversationContextManager.updateUserPreferences(prefs);
  }, []);

  const updateSessionState = useCallback((session: Partial<ContextState['sessionState']>) => {
    conversationContextManager.updateSessionState(session);
  }, []);

  const updateLearningProgress = useCallback((progress: Partial<ContextState['learningProgress']>) => {
    conversationContextManager.updateLearningProgress(progress);
  }, []);

  const updateDrivingContext = useCallback((context: Partial<ContextState['drivingContext']>) => {
    conversationContextManager.updateDrivingContext(context);
  }, []);

  const addConversationMessage = useCallback((message: ConversationMessage) => {
    conversationContextManager.addConversationMessage(message);
  }, []);

  const addRecentCommand = useCallback((command: string) => {
    conversationContextManager.addRecentCommand(command);
  }, []);

  const setCurrentArticle = useCallback((article: ContextState['currentArticle']) => {
    conversationContextManager.setCurrentArticle(article);
  }, []);

  const updateCurrentSentence = useCallback((sentenceNumber: number) => {
    conversationContextManager.updateCurrentSentence(sentenceNumber);
  }, []);

  // Context generation functions
  const generateContextString = useCallback((type: 'newsReading' | 'learning' | 'general' = 'general') => {
    return conversationContextManager.generateContextString(type);
  }, []);

  const getConversationSummary = useCallback(() => {
    return conversationContextManager.getConversationSummary();
  }, []);

  const getUserBehaviorPatterns = useCallback(() => {
    return conversationContextManager.getUserBehaviorPatterns();
  }, []);

  const getContextualRecommendations = useCallback(() => {
    return conversationContextManager.getContextualRecommendations();
  }, []);

  // Utility functions
  const clearContext = useCallback(() => {
    conversationContextManager.clearContext();
  }, []);

  const saveToStorage = useCallback(() => {
    conversationContextManager.saveToStorage();
  }, []);

  const loadFromStorage = useCallback(() => {
    conversationContextManager.loadFromStorage();
  }, []);

  return {
    // State
    state,
    
    // Context sections
    userPreferences: state.userPreferences,
    sessionState: state.sessionState,
    learningProgress: state.learningProgress,
    conversationHistory: state.conversationHistory,
    recentCommands: state.recentCommands,
    currentArticle: state.currentArticle,
    currentLocation: state.currentLocation,
    drivingContext: state.drivingContext,
    
    // Update functions
    updateUserPreferences,
    updateSessionState,
    updateLearningProgress,
    updateDrivingContext,
    addConversationMessage,
    addRecentCommand,
    setCurrentArticle,
    updateCurrentSentence,
    
    // Context generation
    generateContextString,
    getConversationSummary,
    getUserBehaviorPatterns,
    getContextualRecommendations,
    
    // Utility
    clearContext,
    saveToStorage,
    loadFromStorage,
  };
}