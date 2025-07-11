/**
 * News Provider Factory
 * Creates and manages news provider instances
 */

import { INewsProvider, ProviderConfig } from './INewsProvider';
import { RssProvider } from './RssProvider';
import { NewsApiProvider } from './NewsApiProvider';
import { prisma } from '@/lib/prisma';

export type ProviderType = 'RSS' | 'NEWSAPI' | 'CUSTOM';

export class ProviderFactory {
  private static providers: Map<string, INewsProvider> = new Map();

  /**
   * Create a provider instance
   */
  static createProvider(type: ProviderType, config: ProviderConfig): INewsProvider {
    switch (type) {
      case 'RSS':
        return new RssProvider(config as any);
      
      case 'NEWSAPI':
        return new NewsApiProvider(config as any);
      
      case 'CUSTOM':
        // For future custom providers
        throw new Error(`Custom providers not yet implemented`);
      
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  /**
   * Get or create a provider instance (singleton pattern)
   */
  static async getProvider(name: string): Promise<INewsProvider | null> {
    // Check cache first
    if (this.providers.has(name)) {
      return this.providers.get(name)!;
    }

    // Load from database
    const dbConfig = await prisma.newsSource.findFirst({
      where: { name },
    });

    if (!dbConfig) {
      return null;
    }

    const config: ProviderConfig = {
      name: dbConfig.name,
      enabled: dbConfig.enabled,
      apiKey: dbConfig.apiKey || undefined,
      maxArticlesPerFetch: 50,
      categories: dbConfig.category ? [dbConfig.category] : undefined,
    };

    // Add type-specific configuration
    if (dbConfig.type === 'RSS') {
      (config as any).feedUrls = [dbConfig.url];
    } else if (dbConfig.type === 'NEWSAPI') {
      (config as any).defaultCountry = 'us';
      (config as any).defaultLanguage = 'en';
    }

    const provider = this.createProvider(dbConfig.type as ProviderType, config);
    this.providers.set(name, provider);
    
    return provider;
  }

  /**
   * Get all enabled providers
   */
  static async getEnabledProviders(): Promise<INewsProvider[]> {
    const sources = await prisma.newsSource.findMany({
      where: { enabled: true },
    });

    const providers: INewsProvider[] = [];

    for (const source of sources) {
      const provider = await this.getProvider(source.name);
      if (provider && provider.isEnabled()) {
        providers.push(provider);
      }
    }

    return providers;
  }

  /**
   * Get providers by type
   */
  static async getProvidersByType(type: ProviderType): Promise<INewsProvider[]> {
    const sources = await prisma.newsSource.findMany({
      where: { 
        type,
        enabled: true,
      },
    });

    const providers: INewsProvider[] = [];

    for (const source of sources) {
      const provider = await this.getProvider(source.name);
      if (provider && provider.isEnabled()) {
        providers.push(provider);
      }
    }

    return providers;
  }

  /**
   * Clear provider cache
   */
  static clearCache(): void {
    this.providers.clear();
  }

  /**
   * Register a custom provider class
   */
  static registerCustomProvider(name: string, providerClass: new (config: ProviderConfig) => INewsProvider): void {
    // Store custom provider classes for future use
    // This allows extending the system with new provider types
    console.log(`Registered custom provider: ${name}`);
  }
}