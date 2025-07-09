/**
 * STT Service Factory and Manager
 */

import { STTService, STTProvider, STTProviderConfig } from '@/types/stt';
import { GoogleSTTService } from './googleSTT';
import { GeminiSTTService } from './geminiSTT';
import { BrowserSTTService } from './browserSTT';

export class STTServiceManager {
  private static instance: STTServiceManager;
  private services: Map<STTProvider, STTService> = new Map();
  private currentProvider: STTProvider = 'browser';

  private constructor() {}

  static getInstance(): STTServiceManager {
    if (!STTServiceManager.instance) {
      STTServiceManager.instance = new STTServiceManager();
    }
    return STTServiceManager.instance;
  }

  /**
   * Initialize STT service with configuration
   */
  async initialize(config: STTProviderConfig): Promise<void> {
    const service = await this.createService(config);
    this.services.set(config.provider, service);
    this.currentProvider = config.provider;
  }

  /**
   * Get current STT service
   */
  getService(): STTService {
    const service = this.services.get(this.currentProvider);
    if (!service) {
      // Fallback to browser STT if no service configured
      const browserService = new BrowserSTTService();
      this.services.set('browser', browserService);
      return browserService;
    }
    return service;
  }

  /**
   * Switch STT provider
   */
  async switchProvider(provider: STTProvider): Promise<void> {
    if (!this.services.has(provider)) {
      throw new Error(`Provider ${provider} not initialized`);
    }
    this.currentProvider = provider;
  }

  /**
   * Create STT service instance
   */
  private async createService(config: STTProviderConfig): Promise<STTService> {
    switch (config.provider) {
      case 'google':
        return new GoogleSTTService(config);
      
      case 'gemini':
        return new GeminiSTTService(config);
      
      case 'browser':
        return new BrowserSTTService();
      
      case 'mock':
        // For testing
        throw new Error('Mock STT service not implemented');
      
      default:
        throw new Error(`Unknown STT provider: ${config.provider}`);
    }
  }

  /**
   * Check if a provider is available
   */
  async isProviderAvailable(provider: STTProvider): Promise<boolean> {
    try {
      const service = this.services.get(provider);
      if (!service) {
        const config: STTProviderConfig = { provider };
        const tempService = await this.createService(config);
        return await tempService.isAvailable();
      }
      return await service.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Get all available providers
   */
  async getAvailableProviders(): Promise<STTProvider[]> {
    const providers: STTProvider[] = ['browser', 'google', 'gemini'];
    const available: STTProvider[] = [];

    for (const provider of providers) {
      if (await this.isProviderAvailable(provider)) {
        available.push(provider);
      }
    }

    return available;
  }
}

// Export singleton instance
export const sttService = STTServiceManager.getInstance();