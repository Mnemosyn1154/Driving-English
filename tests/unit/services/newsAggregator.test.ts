import { NewsAggregator } from '@/services/server/news/newsAggregator';

describe('NewsAggregator', () => {
  let aggregator: NewsAggregator;

  beforeEach(() => {
    aggregator = new NewsAggregator({
      deduplicationThreshold: 0.8,
      maxArticlesPerSource: 10,
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      const similarity = (aggregator as any).calculateSimilarity(
        'Breaking: Major earthquake hits Japan',
        'Breaking: Major earthquake hits Japan'
      );
      expect(similarity).toBe(1);
    });

    it('should return high similarity for similar titles', () => {
      const similarity = (aggregator as any).calculateSimilarity(
        'Breaking: Major earthquake hits Japan',
        'Breaking News: Major earthquake hits Japan'
      );
      expect(similarity).toBeGreaterThan(0.8);
    });

    it('should return low similarity for different titles', () => {
      const similarity = (aggregator as any).calculateSimilarity(
        'Breaking: Major earthquake hits Japan',
        'Scientists discover new species in Amazon'
      );
      expect(similarity).toBeLessThan(0.3);
    });

    it('should handle case differences', () => {
      const similarity = (aggregator as any).calculateSimilarity(
        'BREAKING: MAJOR EARTHQUAKE HITS JAPAN',
        'breaking: major earthquake hits japan'
      );
      expect(similarity).toBe(1);
    });

    it('should handle minor word variations', () => {
      const similarity = (aggregator as any).calculateSimilarity(
        'Apple announces new iPhone model',
        'Apple unveils new iPhone model'
      );
      expect(similarity).toBeGreaterThan(0.7);
    });
  });

  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      const distance = (aggregator as any).levenshteinDistance('hello', 'hello');
      expect(distance).toBe(0);
    });

    it('should calculate correct distance for single character difference', () => {
      const distance = (aggregator as any).levenshteinDistance('hello', 'hallo');
      expect(distance).toBe(1);
    });

    it('should calculate correct distance for multiple differences', () => {
      const distance = (aggregator as any).levenshteinDistance('kitten', 'sitting');
      expect(distance).toBe(3);
    });

    it('should handle empty strings', () => {
      const distance = (aggregator as any).levenshteinDistance('hello', '');
      expect(distance).toBe(5);
    });
  });

  describe('hashUrl', () => {
    it('should generate consistent hash for same URL', () => {
      const url = 'https://example.com/article';
      const hash1 = (aggregator as any).hashUrl(url);
      const hash2 = (aggregator as any).hashUrl(url);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different URLs', () => {
      const hash1 = (aggregator as any).hashUrl('https://example.com/article1');
      const hash2 = (aggregator as any).hashUrl('https://example.com/article2');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle URL with query parameters', () => {
      const hash1 = (aggregator as any).hashUrl('https://example.com/article?id=123');
      const hash2 = (aggregator as any).hashUrl('https://example.com/article?id=124');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Deduplication logic', () => {
    it('should identify duplicate URLs', async () => {
      const url = 'https://example.com/same-article';
      
      // First check should pass
      const firstCheck = await (aggregator as any).shouldProcessArticle(url, 'Title 1');
      expect(firstCheck).toBe(true);
      
      // Second check with same URL should fail
      const secondCheck = await (aggregator as any).shouldProcessArticle(url, 'Title 2');
      expect(secondCheck).toBe(false);
    });

    it('should identify similar titles as duplicates', async () => {
      // Mock the database query
      const mockFindMany = jest.fn().mockResolvedValue([
        { title: 'Breaking: Earthquake hits Japan with 7.0 magnitude', url: 'https://example.com/1' }
      ]);
      
      // Replace prisma.article.findMany with mock
      jest.spyOn(require('@/lib/prisma').prisma.article, 'findMany').mockImplementation(mockFindMany);
      
      const shouldProcess = await (aggregator as any).shouldProcessArticle(
        'https://example.com/2',
        'Breaking News: Earthquake hits Japan with 7.0 magnitude'
      );
      
      expect(shouldProcess).toBe(false);
    });

    it('should allow different articles', async () => {
      // Mock the database query
      const mockFindMany = jest.fn().mockResolvedValue([
        { title: 'Tech company releases new product', url: 'https://example.com/1' }
      ]);
      
      jest.spyOn(require('@/lib/prisma').prisma.article, 'findMany').mockImplementation(mockFindMany);
      
      const shouldProcess = await (aggregator as any).shouldProcessArticle(
        'https://example.com/2',
        'Scientists discover new species in rainforest'
      );
      
      expect(shouldProcess).toBe(true);
    });
  });
});