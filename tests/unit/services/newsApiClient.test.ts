import { NewsApiClient } from '@/services/server/news/newsApiClient';

// Mock fetch
global.fetch = jest.fn();

describe('NewsApiClient', () => {
  let client: NewsApiClient;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock environment variable
    process.env.NEWS_API_KEY = 'test-api-key';
    client = new NewsApiClient();
  });

  describe('fetchTopHeadlines', () => {
    it('should fetch top headlines successfully', async () => {
      const mockResponse = {
        status: 'ok',
        totalResults: 2,
        articles: [
          {
            source: { id: null, name: 'Test Source' },
            author: 'Test Author',
            title: 'Test Article 1',
            description: 'Test description 1',
            url: 'https://example.com/1',
            urlToImage: 'https://example.com/image1.jpg',
            publishedAt: '2024-01-01T00:00:00Z',
            content: 'Test content 1'
          },
          {
            source: { id: null, name: 'Test Source 2' },
            author: 'Test Author 2',
            title: 'Test Article 2',
            description: 'Test description 2',
            url: 'https://example.com/2',
            urlToImage: 'https://example.com/image2.jpg',
            publishedAt: '2024-01-02T00:00:00Z',
            content: 'Test content 2'
          }
        ]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const articles = await client.fetchTopHeadlines({ category: 'technology' });

      expect(articles).toHaveLength(2);
      expect(articles[0].title).toBe('Test Article 1');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('top-headlines')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('category=technology')
      );
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        status: 'error',
        code: 'apiKeyInvalid',
        message: 'Your API key is invalid'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await expect(client.fetchTopHeadlines()).rejects.toThrow('NewsAPI error: Your API key is invalid');
    });

    it('should retry on rate limit error', async () => {
      // First call: rate limited
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429
      });

      // Second call: success
      const mockResponse = {
        status: 'ok',
        totalResults: 1,
        articles: [{
          source: { id: null, name: 'Test Source' },
          author: 'Test Author',
          title: 'Test Article',
          description: 'Test description',
          url: 'https://example.com/1',
          urlToImage: null,
          publishedAt: '2024-01-01T00:00:00Z',
          content: 'Test content'
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Set a shorter retry delay for testing
      (client as any).retryDelay = 10;

      const articles = await client.fetchTopHeadlines();

      expect(articles).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('searchEverything', () => {
    it('should search articles by keywords', async () => {
      const mockResponse = {
        status: 'ok',
        totalResults: 1,
        articles: [{
          source: { id: null, name: 'Tech News' },
          author: 'Tech Author',
          title: 'AI Revolution in 2024',
          description: 'Latest AI developments',
          url: 'https://example.com/ai',
          urlToImage: null,
          publishedAt: '2024-01-01T00:00:00Z',
          content: 'AI content here'
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const articles = await client.searchEverything({ q: 'AI technology' });

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('AI Revolution in 2024');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('everything')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=AI%20technology')
      );
    });
  });

  describe('fetchByCategory', () => {
    it('should fetch news by category', async () => {
      const mockResponse = {
        status: 'ok',
        totalResults: 1,
        articles: [{
          source: { id: null, name: 'Business Times' },
          author: 'Business Author',
          title: 'Market Update',
          description: 'Stock market news',
          url: 'https://example.com/market',
          urlToImage: null,
          publishedAt: '2024-01-01T00:00:00Z',
          content: 'Market content'
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const articles = await client.fetchByCategory('business', 'us');

      expect(articles).toHaveLength(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('category=business')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('country=us')
      );
    });
  });

  describe('extractContent', () => {
    it('should extract and clean content', () => {
      const article = {
        source: { id: null, name: 'Test' },
        author: null,
        title: 'Test',
        description: 'This is a description',
        url: 'https://example.com',
        urlToImage: null,
        publishedAt: '2024-01-01T00:00:00Z',
        content: 'This is the full content [+2000 chars]'
      };

      const content = (client as any).extractContent(article);
      
      expect(content).toBe('This is the full content');
      expect(content).not.toContain('[+2000 chars]');
    });

    it('should use description when content is too short', () => {
      const article = {
        source: { id: null, name: 'Test' },
        author: null,
        title: 'Test',
        description: 'This is a much longer description that contains more information about the article',
        url: 'https://example.com',
        urlToImage: null,
        publishedAt: '2024-01-01T00:00:00Z',
        content: 'Short'
      };

      const content = (client as any).extractContent(article);
      
      expect(content).toBe(article.description);
    });
  });

  describe('extractTags', () => {
    it('should extract tags from article', () => {
      const article = {
        source: { id: null, name: 'TechCrunch' },
        author: null,
        title: 'Artificial Intelligence Breakthrough Technology Revolution',
        description: null,
        url: 'https://example.com',
        urlToImage: null,
        publishedAt: '2024-01-01T00:00:00Z',
        content: null
      };

      const tags = (client as any).extractTags(article);
      
      expect(tags).toContain('techcrunch');
      expect(tags).toContain('artificial');
      expect(tags).toContain('intelligence');
      expect(tags.length).toBeLessThanOrEqual(5);
    });
  });
});