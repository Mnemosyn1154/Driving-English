/**
 * RSS Parser Service Unit Tests
 */

import { RSSParserService } from '@/services/server/news/rssParser';
import { prisma } from '@/lib/prisma';
import Parser from 'rss-parser';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    article: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    newsSource: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userRssFeed: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('rss-parser');

describe('RSSParserService', () => {
  let rssParserService: RSSParserService;
  let mockParser: jest.Mocked<Parser>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock parser instance
    mockParser = {
      parseURL: jest.fn(),
    } as any;
    
    // Mock the Parser constructor
    (Parser as any).mockImplementation(() => mockParser);
    
    // Create service instance after mocking
    rssParserService = new RSSParserService();
  });

  describe('processFeed', () => {
    const validFeedUrl = 'https://example.com/rss';
    const mockFeedData = {
      title: 'Example News Feed',
      items: [
        {
          title: 'Tech Innovation in AI Development',
          link: 'https://example.com/article1',
          pubDate: '2024-01-10T10:00:00Z',
          contentSnippet: 'A breakthrough in artificial intelligence...',
          content: '<p>A breakthrough in artificial intelligence technology has been announced. Scientists at the research lab have developed a new machine learning algorithm that can process data 10 times faster than previous models. This innovation promises to revolutionize how we approach complex computational problems.</p>',
          categories: ['Technology', 'AI'],
          guid: '12345',
        },
        {
          title: 'Global Economy Shows Signs of Recovery',
          link: 'https://example.com/article2',
          pubDate: '2024-01-10T09:00:00Z',
          contentSnippet: 'The global economy is showing positive signs...',
          content: '<p>The global economy is showing positive signs of recovery after months of uncertainty. Stock markets around the world have responded positively to new trade agreements and improved business confidence. Economists predict steady growth in the coming quarters.</p>',
          categories: ['Business', 'Economy'],
        },
      ],
    };

    it('should successfully process a valid RSS feed', async () => {
      mockParser.parseURL.mockResolvedValue(mockFeedData as any);
      (prisma.newsSource.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.newsSource.create as jest.Mock).mockResolvedValue({
        id: 'source-1',
        name: 'Example News Feed',
        url: validFeedUrl,
        category: 'general',
      });
      (prisma.article.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.article.create as jest.Mock).mockResolvedValue({});

      const result = await rssParserService.processFeed(validFeedUrl);

      expect(result.processed).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(mockParser.parseURL).toHaveBeenCalledWith(validFeedUrl);
      expect(prisma.article.create).toHaveBeenCalledTimes(2);
    });

    it('should handle invalid URL', async () => {
      const invalidUrl = 'not-a-valid-url';

      const result = await rssParserService.processFeed(invalidUrl);

      expect(result.processed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid RSS feed URL');
    });

    it('should skip duplicate articles', async () => {
      mockParser.parseURL.mockResolvedValue(mockFeedData as any);
      (prisma.newsSource.findFirst as jest.Mock).mockResolvedValue({
        id: 'source-1',
        name: 'Example News Feed',
      });
      (prisma.article.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-article' });

      const result = await rssParserService.processFeed(validFeedUrl);

      expect(result.processed).toBe(0);
      expect(prisma.article.create).not.toHaveBeenCalled();
    });

    it('should handle feed parsing errors gracefully', async () => {
      mockParser.parseURL.mockRejectedValue(new Error('Network timeout'));

      const result = await rssParserService.processFeed(validFeedUrl);

      expect(result.processed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Network timeout');
    });

    it('should handle empty RSS feed', async () => {
      mockParser.parseURL.mockResolvedValue({ title: 'Empty Feed', items: [] } as any);

      const result = await rssParserService.processFeed(validFeedUrl);

      expect(result.processed).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('No items found in RSS feed');
    });

    it('should save user RSS feed when userId is provided', async () => {
      const userId = 'user-123';
      mockParser.parseURL.mockResolvedValue(mockFeedData as any);
      (prisma.newsSource.findFirst as jest.Mock).mockResolvedValue({
        id: 'source-1',
        name: 'Example News Feed',
        category: 'technology',
      });
      (prisma.article.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.article.create as jest.Mock).mockResolvedValue({});

      await rssParserService.processFeed(validFeedUrl, userId);

      expect(prisma.userRssFeed.upsert).toHaveBeenCalledWith({
        where: {
          userId_url: { userId, url: validFeedUrl },
        },
        update: {
          name: 'Example News Feed',
          enabled: true,
        },
        create: {
          userId,
          name: 'Example News Feed',
          url: validFeedUrl,
          category: 'technology',
          enabled: true,
        },
      });
    });
  });

  describe('processMultipleFeeds', () => {
    it('should process multiple feeds and aggregate results', async () => {
      const feedUrls = [
        'https://example1.com/rss',
        'https://example2.com/rss',
        'https://example3.com/rss',
      ];

      const mockFeed = {
        title: 'Feed',
        items: [
          {
            title: 'Article',
            link: 'https://example.com/article',
            content: 'This is a test article with enough content to pass the minimum length requirement for processing. We need to ensure this has enough words to meet the minimum requirements for the parser to process it properly.',
          },
        ],
      };

      mockParser.parseURL.mockResolvedValue(mockFeed as any);
      (prisma.newsSource.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.newsSource.create as jest.Mock).mockResolvedValue({ id: 'source-1', name: 'Feed' });
      (prisma.article.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.article.create as jest.Mock).mockResolvedValue({});
      (prisma.newsSource.update as jest.Mock).mockResolvedValue({});

      const result = await rssParserService.processMultipleFeeds(feedUrls);

      expect(result.total).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(mockParser.parseURL).toHaveBeenCalledTimes(3);
    });
  });

  describe('processUserFeeds', () => {
    it('should process all enabled user feeds', async () => {
      const userId = 'user-123';
      const userFeeds = [
        { url: 'https://feed1.com/rss' },
        { url: 'https://feed2.com/rss' },
      ];

      (prisma.userRssFeed.findMany as jest.Mock).mockResolvedValue(userFeeds);

      const mockFeed = {
        title: 'User Feed',
        items: [
          {
            title: 'Article',
            link: 'https://example.com/article',
            content: 'This is a test article with enough content to pass the minimum length requirement for processing. We need to ensure this has enough words to meet the minimum requirements for the parser to process it properly.',
          },
        ],
      };

      mockParser.parseURL.mockResolvedValue(mockFeed as any);
      (prisma.newsSource.findFirst as jest.Mock).mockResolvedValue({ id: 'source-1', name: 'User Feed' });
      (prisma.article.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.article.create as jest.Mock).mockResolvedValue({});
      (prisma.newsSource.update as jest.Mock).mockResolvedValue({});

      const result = await rssParserService.processUserFeeds(userId);

      expect(result.total).toBe(2);
      expect(prisma.userRssFeed.findMany).toHaveBeenCalledWith({
        where: { userId, enabled: true },
        select: { url: true },
      });
    });
  });

  describe('private methods (through public interface)', () => {
    it('should correctly classify articles by category', async () => {
      const techArticle = {
        title: 'New AI Technology Breakthrough in Machine Learning',
        link: 'https://example.com/tech',
        content: 'Artificial intelligence and machine learning continue to evolve with new innovations in software development.',
        categories: ['Technology'],
      };

      const businessArticle = {
        title: 'Stock Market Rally Continues',
        link: 'https://example.com/business',
        content: 'The stock market showed strong gains today as investors responded to positive economic news and corporate earnings.',
        categories: ['Business', 'Finance'],
      };

      mockParser.parseURL.mockResolvedValueOnce({
        title: 'Tech Feed',
        items: [techArticle],
      } as any);

      (prisma.newsSource.findFirst as jest.Mock).mockResolvedValue({ id: 'source-1', name: 'Tech Source' });
      (prisma.article.findUnique as jest.Mock).mockResolvedValue(null);
      
      let createdArticle: any;
      (prisma.article.create as jest.Mock).mockImplementation(({ data }) => {
        createdArticle = data;
        return Promise.resolve(data);
      });

      await rssParserService.processFeed('https://techfeed.com/rss');

      expect(createdArticle.category).toBe('technology');
      expect(createdArticle.tags).toContain('technology');
    });

    it('should clean HTML and calculate metrics correctly', async () => {
      const articleWithHTML = {
        title: 'Test Article',
        link: 'https://example.com/test',
        content: '<p>This is a <strong>test article</strong> with <a href="https://example.com">HTML tags</a> and &nbsp; entities &amp; more. We need to make sure this article has enough content to pass the minimum length requirements. This paragraph contains various HTML elements and entities that should be properly cleaned and processed by the parser. The content should be long enough to calculate meaningful word count and reading time metrics.</p>',
      };

      mockParser.parseURL.mockResolvedValue({
        title: 'Test Feed',
        items: [articleWithHTML],
      } as any);

      (prisma.newsSource.findFirst as jest.Mock).mockResolvedValue({ id: 'source-1', name: 'Test Feed' });
      (prisma.article.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.newsSource.update as jest.Mock).mockResolvedValue({});
      
      let createdArticle: any;
      (prisma.article.create as jest.Mock).mockImplementation(({ data }) => {
        createdArticle = data;
        return Promise.resolve(data);
      });

      await rssParserService.processFeed('https://testfeed.com/rss');

      expect(createdArticle).toBeDefined();
      expect(createdArticle.content).not.toContain('<p>');
      expect(createdArticle.content).not.toContain('&nbsp;');
      expect(createdArticle.content).toContain('test article');
      expect(createdArticle.wordCount).toBeGreaterThan(0);
      expect(createdArticle.readingTime).toBeGreaterThan(0);
    });

    it('should skip articles with insufficient content', async () => {
      const shortArticle = {
        title: 'Short Article',
        link: 'https://example.com/short',
        content: 'Too short.',
      };

      mockParser.parseURL.mockResolvedValue({
        title: 'Test Feed',
        items: [shortArticle],
      } as any);

      (prisma.newsSource.findFirst as jest.Mock).mockResolvedValue({ id: 'source-1' });

      const result = await rssParserService.processFeed('https://testfeed.com/rss');

      expect(result.processed).toBe(0);
      expect(prisma.article.create).not.toHaveBeenCalled();
    });
  });
});