import { config } from '@/lib/env';

interface NewsAPIArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

export class NewsAPISearchService {
  private apiKey: string;
  private baseUrl = 'https://newsapi.org/v2';

  constructor() {
    const apiKey = config.api.newsApiKey;
    if (!apiKey) {
      throw new Error('NEWS_API_KEY is not configured');
    }
    this.apiKey = apiKey;
  }

  /**
   * News API Everything 엔드포인트를 사용한 검색
   */
  async searchNews(
    query: string,
    options: {
      language?: string;
      sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
      pageSize?: number;
      page?: number;
    } = {}
  ) {
    const {
      language = 'en',
      sortBy = 'relevancy',
      pageSize = 10,
      page = 1
    } = options;

    const url = new URL(`${this.baseUrl}/everything`);
    url.searchParams.append('q', query);
    url.searchParams.append('language', language);
    url.searchParams.append('sortBy', sortBy);
    url.searchParams.append('pageSize', pageSize.toString());
    url.searchParams.append('page', page.toString());
    url.searchParams.append('apiKey', this.apiKey);

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`News API Error: ${error.message || response.statusText}`);
      }

      const data: NewsAPIResponse = await response.json();

      if (data.status !== 'ok') {
        throw new Error('News API returned error status');
      }

      // News API 결과를 우리 형식으로 변환
      return {
        totalResults: data.totalResults,
        articles: data.articles.map(this.transformArticle)
      };
    } catch (error) {
      console.error('News API search error:', error);
      throw error;
    }
  }

  /**
   * 특정 도메인에서 검색
   */
  async searchInDomains(
    query: string,
    domains: string[],
    options: {
      language?: string;
      sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
    } = {}
  ) {
    const url = new URL(`${this.baseUrl}/everything`);
    url.searchParams.append('q', query);
    url.searchParams.append('domains', domains.join(','));
    
    if (options.language) {
      url.searchParams.append('language', options.language);
    }
    if (options.sortBy) {
      url.searchParams.append('sortBy', options.sortBy);
    }
    
    url.searchParams.append('apiKey', this.apiKey);

    const response = await fetch(url.toString());
    const data: NewsAPIResponse = await response.json();

    return {
      totalResults: data.totalResults,
      articles: data.articles.map(this.transformArticle)
    };
  }

  /**
   * 헤드라인 가져오기
   */
  async getTopHeadlines(
    options: {
      country?: string;
      category?: string;
      sources?: string;
      q?: string;
      pageSize?: number;
    } = {}
  ) {
    const { country = 'us', pageSize = 10 } = options;
    
    const url = new URL(`${this.baseUrl}/top-headlines`);
    
    if (options.country) {
      url.searchParams.append('country', country);
    }
    if (options.category) {
      url.searchParams.append('category', options.category);
    }
    if (options.sources) {
      url.searchParams.append('sources', options.sources);
    }
    if (options.q) {
      url.searchParams.append('q', options.q);
    }
    
    url.searchParams.append('pageSize', pageSize.toString());
    url.searchParams.append('apiKey', this.apiKey);

    const response = await fetch(url.toString());
    const data: NewsAPIResponse = await response.json();

    return {
      totalResults: data.totalResults,
      articles: data.articles.map(this.transformArticle)
    };
  }

  /**
   * News API 형식을 우리 앱 형식으로 변환
   */
  private transformArticle(article: NewsAPIArticle) {
    // 간단한 난이도 계산 (설명 길이 기반)
    const descLength = article.description?.length || 0;
    let difficulty = 3; // 기본 중급
    
    if (descLength < 100) difficulty = 2;
    else if (descLength < 150) difficulty = 3;
    else if (descLength < 200) difficulty = 4;
    else difficulty = 5;

    return {
      title: article.title,
      summary: article.description || 'No description available',
      url: article.url,
      source: article.source.name,
      imageUrl: article.urlToImage,
      publishedAt: article.publishedAt,
      difficulty,
      category: 'general', // News API는 카테고리를 직접 제공하지 않음
      author: article.author,
      content: article.content
    };
  }
}