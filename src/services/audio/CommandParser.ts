/**
 * Command Parser for Audio Service
 * Handles pattern matching and Gemini NLU integration
 */

import { analyzeCommand, CommandAnalysis } from '@/utils/command-patterns';
import { Action, ActionType, CommandParseResult } from './types';

export class CommandParser {
  private geminiApiKey: string | undefined;
  private confidenceThreshold = 0.8;

  constructor(geminiApiKey?: string) {
    this.geminiApiKey = geminiApiKey;
  }

  /**
   * Parse command text and return action
   */
  async parse(text: string): Promise<CommandParseResult> {
    // First, try pattern matching
    const patternResult = this.parseWithPatterns(text);
    
    // If pattern matching has high confidence, use it
    if (patternResult.action.confidence >= this.confidenceThreshold) {
      return {
        text,
        action: patternResult.action,
        requiresGemini: false,
        metadata: patternResult.metadata,
      };
    }

    // Otherwise, use Gemini NLU if available
    if (this.geminiApiKey) {
      try {
        const geminiResult = await this.parseWithGemini(text);
        if (geminiResult.action.confidence > patternResult.action.confidence) {
          return {
            text,
            action: geminiResult.action,
            requiresGemini: true,
            metadata: geminiResult.metadata,
          };
        }
      } catch (error) {
        console.error('Gemini NLU failed, falling back to pattern result:', error);
      }
    }

    // Fall back to pattern result
    return {
      text,
      action: patternResult.action,
      requiresGemini: false,
      metadata: patternResult.metadata,
    };
  }

  /**
   * Parse command using pattern matching
   */
  private parseWithPatterns(text: string): CommandParseResult {
    const analysis = analyzeCommand(text);
    const action = this.convertAnalysisToAction(analysis);
    
    return {
      text,
      action,
      requiresGemini: false,
      metadata: {
        analysis,
      },
    };
  }

  /**
   * Parse command using Gemini NLU
   */
  private async parseWithGemini(text: string): Promise<CommandParseResult> {
    // For now, return a placeholder
    // In real implementation, this would call Gemini API
    const prompt = `
You are a command parser for a driving English learning app. Analyze the user's command and extract the intent and entities.

Available intents:
- search_news: User wants to search for news
- select_article: User wants to select a specific article
- navigation: User wants to navigate (next, previous)
- playback_control: User wants to control playback (play, pause, repeat)
- volume_control: User wants to adjust volume
- help: User needs help
- start_conversation: User wants to have a general conversation
- unknown: Cannot determine intent

Extract entities like:
- source: News source name
- category: News category
- count: Number of articles
- number: Article number
- keyword: Search keyword
- direction: Navigation direction

Command: "${text}"

Respond in JSON format:
{
  "intent": "...",
  "entities": {...},
  "confidence": 0.0-1.0
}`;

    // Placeholder implementation
    // TODO: Implement actual Gemini API call
    return {
      text,
      action: {
        type: 'start_conversation',
        params: { text },
        confidence: 0.7,
        source: 'gemini',
      },
      requiresGemini: true,
      metadata: {
        geminiPrompt: prompt,
      },
    };
  }

  /**
   * Convert command analysis to action
   */
  private convertAnalysisToAction(analysis: CommandAnalysis): Action {
    let type: ActionType = 'unknown';
    const params: Record<string, any> = {};

    switch (analysis.type) {
      case 'source_with_count':
      case 'source_news':
      case 'category_recommend':
      case 'category_with_count':
      case 'natural_request':
      case 'general_search':
        type = 'search_news';
        if (analysis.source) params.source = analysis.source;
        if (analysis.category) params.category = analysis.category;
        if (analysis.count) params.count = analysis.count;
        if (analysis.keyword) params.keyword = analysis.keyword;
        break;

      case 'number_selection':
        type = 'select_article';
        params.number = analysis.number;
        break;

      case 'navigation':
        type = 'navigation';
        params.direction = analysis.keyword;
        break;

      case 'playback':
        type = 'playback_control';
        params.action = analysis.keyword;
        break;

      case 'help':
        type = 'help';
        break;

      default:
        type = 'unknown';
    }

    return {
      type,
      params,
      confidence: analysis.confidence,
      source: 'pattern',
    };
  }

  /**
   * Check if command indicates conversation start
   */
  isConversationStart(text: string): boolean {
    const conversationTriggers = [
      '대화하자',
      '이야기하자',
      '얘기하자',
      '대화해줘',
      '대화하고 싶어',
      '질문있어',
      '물어볼게 있어',
      '궁금한게 있어',
    ];

    const lowerText = text.toLowerCase();
    return conversationTriggers.some(trigger => lowerText.includes(trigger));
  }

  /**
   * Check if command indicates conversation end
   */
  isConversationEnd(text: string): boolean {
    const endTriggers = [
      '대화 끝',
      '대화 종료',
      '그만',
      '종료',
      '끝',
      '바이',
      '안녕',
    ];

    const lowerText = text.toLowerCase();
    return endTriggers.some(trigger => lowerText.includes(trigger));
  }

  /**
   * Update confidence threshold
   */
  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }
}