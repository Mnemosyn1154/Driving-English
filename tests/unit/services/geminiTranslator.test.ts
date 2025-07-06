import { GeminiTranslator } from '@/services/server/translation/geminiTranslator';
import { TranslationCache } from '@/services/server/translation/cache';
import { TranslationError } from '@/types/errors';

// Mock the cache module
jest.mock('@/services/server/translation/cache');

// Mock fetch globally
global.fetch = jest.fn();

describe('GeminiTranslator', () => {
  let translator: GeminiTranslator;
  let mockCache: jest.Mocked<TranslationCache>;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set up environment variable
    process.env.GEMINI_API_KEY = mockApiKey;
    
    // Create mock cache instance
    mockCache = new TranslationCache() as jest.Mocked<TranslationCache>;
    (TranslationCache as jest.Mock).mockImplementation(() => mockCache);
    
    // Initialize translator
    translator = new GeminiTranslator(mockApiKey);
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('translate', () => {
    it('should translate text successfully', async () => {
      const text = 'Hello world';
      const expectedTranslation = '안녕하세요 세계';
      
      // Mock cache miss
      mockCache.get.mockReturnValue(null);
      
      // Mock successful API response
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: expectedTranslation
            }]
          }
        }]
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await translator.translate(text);

      expect(result).toBe(expectedTranslation);
      expect(mockCache.get).toHaveBeenCalledWith(text);
      expect(mockCache.set).toHaveBeenCalledWith(text, expectedTranslation);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should return cached translation if available', async () => {
      const text = 'Hello world';
      const cachedTranslation = '안녕하세요 세계';
      
      // Mock cache hit
      mockCache.get.mockReturnValue(cachedTranslation);

      const result = await translator.translate(text);

      expect(result).toBe(cachedTranslation);
      expect(mockCache.get).toHaveBeenCalledWith(text);
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle empty text', async () => {
      const result = await translator.translate('');
      expect(result).toBe('');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw error on API failure', async () => {
      const text = 'Hello world';
      
      mockCache.get.mockReturnValue(null);
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(translator.translate(text)).rejects.toThrow(TranslationError);
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      const text = 'Hello world';
      
      mockCache.get.mockReturnValue(null);
      
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(translator.translate(text)).rejects.toThrow(TranslationError);
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('translateBatch', () => {
    it('should translate multiple texts successfully', async () => {
      const texts = ['Hello', 'World', 'Test'];
      const translations = ['안녕하세요', '세계', '테스트'];
      
      // Mock all cache misses
      mockCache.get.mockReturnValue(null);
      
      // Mock successful API responses
      texts.forEach((text, index) => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: translations[index]
                }]
              }
            }]
          })
        });
      });

      const results = await translator.translateBatch(texts);

      expect(results).toEqual(translations);
      expect(mockCache.get).toHaveBeenCalledTimes(texts.length);
      expect(mockCache.set).toHaveBeenCalledTimes(texts.length);
    });

    it('should use cached translations when available', async () => {
      const texts = ['Hello', 'World', 'Test'];
      const translations = ['안녕하세요', '세계', '테스트'];
      
      // Mock cache: first two are hits, last one is miss
      mockCache.get.mockImplementation((text) => {
        const index = texts.indexOf(text);
        return index < 2 ? translations[index] : null;
      });
      
      // Mock API response for uncached text
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: translations[2]
              }]
            }
          }]
        })
      });

      const results = await translator.translateBatch(texts);

      expect(results).toEqual(translations);
      expect(mockCache.get).toHaveBeenCalledTimes(texts.length);
      expect(mockCache.set).toHaveBeenCalledTimes(1); // Only for the uncached text
      expect(global.fetch).toHaveBeenCalledTimes(1); // Only one API call
    });

    it('should handle empty batch', async () => {
      const results = await translator.translateBatch([]);
      expect(results).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should continue with other translations if one fails', async () => {
      const texts = ['Hello', 'World', 'Test'];
      
      mockCache.get.mockReturnValue(null);
      
      // First succeeds, second fails, third succeeds
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: '안녕하세요'
                }]
              }
            }]
          })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: '테스트'
                }]
              }
            }]
          })
        });

      const results = await translator.translateBatch(texts);

      expect(results).toHaveLength(texts.length);
      expect(results[0]).toBe('안녕하세요');
      expect(results[1]).toBe('[Translation Error]');
      expect(results[2]).toBe('테스트');
    });
  });

  describe('translateArticleWithConsistency', () => {
    const mockArticle = {
      title: 'Technology News',
      summary: 'Latest updates in tech industry',
      sentences: [
        'Apple announced new products.',
        'The company revealed innovative features.',
        'Apple stock prices rose significantly.'
      ]
    };

    it('should translate article with consistency', async () => {
      mockCache.get.mockReturnValue(null);
      
      // Mock successful API response with consistency instructions
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                title: '기술 뉴스',
                summary: '기술 업계의 최신 업데이트',
                sentences: [
                  '애플이 새로운 제품을 발표했습니다.',
                  '회사는 혁신적인 기능을 공개했습니다.',
                  '애플 주가가 크게 상승했습니다.'
                ],
                termConsistency: {
                  'Apple': '애플',
                  'company': '회사',
                  'products': '제품'
                }
              })
            }]
          }
        }]
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await translator.translateArticleWithConsistency(
        mockArticle.title,
        mockArticle.summary,
        mockArticle.sentences
      );

      expect(result.title).toBe('기술 뉴스');
      expect(result.summary).toBe('기술 업계의 최신 업데이트');
      expect(result.sentences).toHaveLength(3);
      expect(result.sentences[0]).toContain('애플');
      
      // Verify the API was called with proper context
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.contents[0].parts[0].text).toContain('consistency');
      expect(requestBody.contents[0].parts[0].text).toContain('Apple');
    });

    it('should handle API errors gracefully', async () => {
      mockCache.get.mockReturnValue(null);
      
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      await expect(
        translator.translateArticleWithConsistency(
          mockArticle.title,
          mockArticle.summary,
          mockArticle.sentences
        )
      ).rejects.toThrow(TranslationError);
    });

    it('should handle invalid response format', async () => {
      mockCache.get.mockReturnValue(null);
      
      // Mock response with invalid format
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: 'Invalid JSON response'
            }]
          }
        }]
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await expect(
        translator.translateArticleWithConsistency(
          mockArticle.title,
          mockArticle.summary,
          mockArticle.sentences
        )
      ).rejects.toThrow(TranslationError);
    });
  });

  describe('detectLanguage', () => {
    it('should detect language correctly', async () => {
      const text = '안녕하세요 세계';
      
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: 'ko'
            }]
          }
        }]
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await translator.detectLanguage(text);

      expect(result).toBe('ko');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('should handle detection errors', async () => {
      const text = 'Hello world';
      
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      await expect(translator.detectLanguage(text)).rejects.toThrow(TranslationError);
    });

    it('should handle empty text', async () => {
      const result = await translator.detectLanguage('');
      expect(result).toBe('unknown');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});