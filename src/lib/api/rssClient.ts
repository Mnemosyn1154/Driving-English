/**
 * RSS API Client
 * Client-side helper for RSS source management
 */

interface RSSSource {
  id: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
  type: 'RSS' | 'USER_RSS';
  lastFetch?: Date | null;
  lastError?: string | null;
}

interface ValidationResult {
  valid: boolean;
  feedInfo?: {
    title: string;
    description?: string;
    link?: string;
    language?: string;
    itemCount: number;
    categories?: string[];
  };
  error?: string;
}

interface FetchResult {
  success: boolean;
  articlesCount: number;
  errors?: string[];
}

export class RSSClient {
  private baseUrl = '/api/rss';

  /**
   * Get all RSS sources
   */
  async getSources(options?: {
    category?: string;
    enabled?: boolean;
    type?: 'RSS' | 'USER_RSS' | 'ALL';
  }): Promise<{ sources: RSSSource[]; count: number }> {
    const params = new URLSearchParams();
    if (options?.category) params.set('category', options.category);
    if (options?.enabled !== undefined) params.set('enabled', String(options.enabled));
    if (options?.type) params.set('type', options.type);

    const response = await fetch(`${this.baseUrl}/sources?${params}`);
    if (!response.ok) {
      throw new Error('Failed to fetch RSS sources');
    }
    return response.json();
  }

  /**
   * Get a specific RSS source
   */
  async getSource(id: string): Promise<{ source: RSSSource; statistics: any }> {
    const response = await fetch(`${this.baseUrl}/sources/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch RSS source');
    }
    return response.json();
  }

  /**
   * Create a new RSS source
   */
  async createSource(data: {
    name: string;
    url: string;
    category?: string;
    enabled?: boolean;
  }): Promise<{ source: RSSSource; feedInfo?: any }> {
    const response = await fetch(`${this.baseUrl}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create RSS source');
    }
    return response.json();
  }

  /**
   * Update an RSS source
   */
  async updateSource(
    id: string,
    data: {
      name?: string;
      category?: string;
      enabled?: boolean;
      updateInterval?: number;
    }
  ): Promise<{ source: RSSSource }> {
    const response = await fetch(`${this.baseUrl}/sources/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update RSS source');
    }
    return response.json();
  }

  /**
   * Delete an RSS source
   */
  async deleteSource(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sources/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete RSS source');
    }
  }

  /**
   * Validate an RSS feed URL
   */
  async validateFeed(url: string): Promise<ValidationResult> {
    const response = await fetch(`${this.baseUrl}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    
    return response.json();
  }

  /**
   * Fetch articles from a specific source
   */
  async fetchSource(id: string, immediate = false): Promise<FetchResult | { jobId: string }> {
    const response = await fetch(
      `${this.baseUrl}/sources/${id}/fetch?immediate=${immediate}`,
      { method: 'POST' }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch from RSS source');
    }
    return response.json();
  }

  /**
   * Batch operations on RSS sources
   */
  async batchOperation(
    action: 'fetch' | 'enable' | 'disable' | 'delete',
    sourceIds: string[]
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/sources/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, sourceIds }),
    });
    
    if (!response.ok) {
      throw new Error('Batch operation failed');
    }
    return response.json();
  }

  /**
   * Get RSS statistics
   */
  async getStatistics(sourceId?: string): Promise<any> {
    const params = sourceId ? `?sourceId=${sourceId}` : '';
    const response = await fetch(`${this.baseUrl}/statistics${params}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch RSS statistics');
    }
    return response.json();
  }
}

// Export singleton instance
export const rssClient = new RSSClient();