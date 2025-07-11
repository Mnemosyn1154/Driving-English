/**
 * IndexedDB utilities for offline data storage
 */

interface DBConfig {
  name: string;
  version: number;
  stores: {
    [key: string]: {
      keyPath?: string;
      autoIncrement?: boolean;
      indexes?: Array<{
        name: string;
        keyPath: string | string[];
        unique?: boolean;
      }>;
    };
  };
}

export class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private dbName: string;
  private dbVersion: number;
  private stores: DBConfig['stores'];

  constructor(config: DBConfig) {
    this.dbName = config.name;
    this.dbVersion = config.version;
    this.stores = config.stores;
  }

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        for (const [storeName, storeConfig] of Object.entries(this.stores)) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, {
              keyPath: storeConfig.keyPath,
              autoIncrement: storeConfig.autoIncrement,
            });

            // Create indexes
            if (storeConfig.indexes) {
              for (const index of storeConfig.indexes) {
                store.createIndex(index.name, index.keyPath, {
                  unique: index.unique,
                });
              }
            }
          }
        }
      };
    });
  }

  /**
   * Get a single item from a store
   */
  async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all items from a store
   */
  async getAll<T>(storeName: string): Promise<T[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add or update an item in a store
   */
  async put<T>(storeName: string, value: T): Promise<IDBValidKey> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete an item from a store
   */
  async delete(storeName: string, key: IDBValidKey): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all items from a store
   */
  async clear(storeName: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get items by index
   */
  async getByIndex<T>(
    storeName: string,
    indexName: string,
    value: IDBValidKey
  ): Promise<T[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Specific database for offline sync
export const offlineDB = new IndexedDBManager({
  name: 'driving-english-offline',
  version: 1,
  stores: {
    syncQueue: {
      keyPath: 'id',
      autoIncrement: true,
      indexes: [
        { name: 'timestamp', keyPath: 'timestamp' },
        { name: 'type', keyPath: 'type' },
        { name: 'status', keyPath: 'status' },
      ],
    },
    userProgress: {
      keyPath: 'id',
      indexes: [
        { name: 'articleId', keyPath: 'articleId' },
        { name: 'userId', keyPath: 'userId' },
        { name: 'timestamp', keyPath: 'timestamp' },
      ],
    },
    cachedArticles: {
      keyPath: 'id',
      indexes: [
        { name: 'category', keyPath: 'category' },
        { name: 'publishedAt', keyPath: 'publishedAt' },
        { name: 'cachedAt', keyPath: 'cachedAt' },
      ],
    },
    settings: {
      keyPath: 'key',
    },
  },
});

// Types for offline data
export interface SyncQueueItem {
  id?: number;
  type: 'progress' | 'bookmark' | 'settings';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  error?: string;
}

export interface OfflineUserProgress {
  id: string;
  userId: string;
  articleId: string;
  sentenceIndex: number;
  completed: boolean;
  timestamp: number;
  synced: boolean;
}

export interface CachedArticle {
  id: string;
  title: string;
  content: string;
  sentences: Array<{
    id: string;
    text: string;
    translation?: string;
    audioUrl?: string;
  }>;
  category: string;
  publishedAt: string;
  cachedAt: number;
}

// Helper functions for offline operations
export const offlineHelpers = {
  /**
   * Add an action to the sync queue
   */
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'status' | 'retryCount'>): Promise<void> {
    await offlineDB.put('syncQueue', {
      ...item,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0,
    });
  },

  /**
   * Get pending sync items
   */
  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    const items = await offlineDB.getByIndex<SyncQueueItem>('syncQueue', 'status', 'pending');
    return items.sort((a, b) => a.timestamp - b.timestamp);
  },

  /**
   * Update sync item status
   */
  async updateSyncItemStatus(id: number, status: SyncQueueItem['status'], error?: string): Promise<void> {
    const item = await offlineDB.get<SyncQueueItem>('syncQueue', id);
    if (item) {
      item.status = status;
      if (error) item.error = error;
      if (status === 'failed') item.retryCount++;
      await offlineDB.put('syncQueue', item);
    }
  },

  /**
   * Save progress offline
   */
  async saveProgressOffline(progress: Omit<OfflineUserProgress, 'id' | 'timestamp' | 'synced'>): Promise<void> {
    const id = `${progress.userId}_${progress.articleId}_${progress.sentenceIndex}`;
    await offlineDB.put('userProgress', {
      ...progress,
      id,
      timestamp: Date.now(),
      synced: false,
    });

    // Add to sync queue
    await this.addToSyncQueue({
      type: 'progress',
      action: 'update',
      data: progress,
    });
  },

  /**
   * Cache article for offline reading
   */
  async cacheArticle(article: CachedArticle): Promise<void> {
    await offlineDB.put('cachedArticles', {
      ...article,
      cachedAt: Date.now(),
    });
  },

  /**
   * Get cached articles
   */
  async getCachedArticles(category?: string): Promise<CachedArticle[]> {
    if (category) {
      return offlineDB.getByIndex('cachedArticles', 'category', category);
    }
    return offlineDB.getAll('cachedArticles');
  },

  /**
   * Clear old cached data
   */
  async clearOldCache(daysToKeep: number = 7): Promise<void> {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    const articles = await offlineDB.getAll<CachedArticle>('cachedArticles');
    
    for (const article of articles) {
      if (article.cachedAt < cutoffTime) {
        await offlineDB.delete('cachedArticles', article.id);
      }
    }
  },

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    pending: number;
    failed: number;
    lastSync: number | null;
  }> {
    const items = await offlineDB.getAll<SyncQueueItem>('syncQueue');
    const lastSyncTime = await offlineDB.get<{ value: number }>('settings', 'lastSyncTime');

    return {
      pending: items.filter(i => i.status === 'pending').length,
      failed: items.filter(i => i.status === 'failed').length,
      lastSync: lastSyncTime?.value || null,
    };
  },

  /**
   * Update last sync time
   */
  async updateLastSyncTime(): Promise<void> {
    await offlineDB.put('settings', {
      key: 'lastSyncTime',
      value: Date.now(),
    });
  },
};