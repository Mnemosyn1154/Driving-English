/**
 * Validated Recommended RSS Feeds
 * Updated based on RSS feed validation - 2025-07-10
 */

export interface RecommendedFeed {
  name: string;
  url: string;
  description: string;
  language?: string;
  status?: 'active' | 'broken';
}

export interface CategoryFeeds {
  [key: string]: RecommendedFeed[];
}

export const VALIDATED_RSS_FEEDS: CategoryFeeds = {
  technology: [
    {
      name: 'TechCrunch',
      url: 'https://techcrunch.com/feed/',
      description: '스타트업, 벤처캐피탈, 최신 기술 뉴스',
      status: 'active',
    },
    {
      name: 'The Verge',
      url: 'https://www.theverge.com/rss/index.xml',
      description: '기술, 과학, 예술, 문화의 교차점',
      status: 'active',
    },
    {
      name: 'Ars Technica',
      url: 'https://feeds.arstechnica.com/arstechnica/index',
      description: '심층 기술 분석 및 IT 뉴스',
      status: 'active',
    },
    {
      name: 'Wired',
      url: 'https://www.wired.com/feed/rss',
      description: '기술이 미래를 바꾸는 방법',
      status: 'active',
    },
    {
      name: 'MIT Technology Review',
      url: 'https://www.technologyreview.com/feed/',
      description: '최신 기술 연구 및 혁신',
      status: 'active',
    },
  ],
  business: [
    {
      name: 'Bloomberg',
      url: 'https://feeds.bloomberg.com/markets/news.rss',
      description: '금융 시장, 경제, 기업 뉴스',
      status: 'active',
    },
    {
      name: 'Financial Times',
      url: 'https://www.ft.com/rss/home/uk',
      description: '국제 비즈니스 및 경제 분석',
      status: 'active',
    },
    {
      name: 'Forbes',
      url: 'https://www.forbes.com/real-time/feed2/',
      description: '비즈니스, 투자, 기업가 정신',
      status: 'active',
    },
  ],
  world: [
    {
      name: 'BBC World News',
      url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
      description: '영국 관점의 국제 뉴스',
      status: 'active',
    },
    {
      name: 'CNN International',
      url: 'http://rss.cnn.com/rss/edition_world.rss',
      description: '미국 관점의 글로벌 뉴스',
      status: 'active',
    },
    {
      name: 'The Guardian International',
      url: 'https://www.theguardian.com/world/rss',
      description: '진보적 관점의 국제 뉴스',
      status: 'active',
    },
    {
      name: 'Al Jazeera English',
      url: 'https://www.aljazeera.com/xml/rss/all.xml',
      description: '중동 및 글로벌 뉴스',
      status: 'active',
    },
    {
      name: 'NPR News',
      url: 'https://feeds.npr.org/1001/rss.xml',
      description: '미국 공영 라디오 뉴스',
      status: 'active',
    },
  ],
  science: [
    {
      name: 'Science Daily',
      url: 'https://www.sciencedaily.com/rss/all.xml',
      description: '최신 과학 연구 및 발견',
      status: 'active',
    },
    {
      name: 'Nature News',
      url: 'https://www.nature.com/nature.rss',
      description: '권위있는 과학 저널 뉴스',
      status: 'active',
    },
    {
      name: 'New Scientist',
      url: 'https://www.newscientist.com/feed/home',
      description: '과학 기술 최신 동향',
      status: 'active',
    },
    {
      name: 'NASA News',
      url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',
      description: '우주 탐사 및 항공우주',
      status: 'active',
    },
  ],
  health: [
    {
      name: 'WHO News',
      url: 'https://www.who.int/rss-feeds/news-english.xml',
      description: '세계보건기구 공식 뉴스',
      status: 'active',
    },
  ],
  sports: [
    {
      name: 'ESPN',
      url: 'https://www.espn.com/espn/rss/news',
      description: '종합 스포츠 뉴스',
      status: 'active',
    },
    {
      name: 'BBC Sport',
      url: 'https://feeds.bbci.co.uk/sport/rss.xml',
      description: '영국 및 국제 스포츠',
      status: 'active',
    },
    {
      name: 'Sky Sports',
      url: 'https://www.skysports.com/rss/12040',
      description: '유럽 축구 및 스포츠',
      status: 'active',
    },
  ],
  entertainment: [
    {
      name: 'Variety',
      url: 'https://variety.com/feed/',
      description: '엔터테인먼트 산업 뉴스',
      status: 'active',
    },
    {
      name: 'The Hollywood Reporter',
      url: 'https://www.hollywoodreporter.com/feed',
      description: '할리우드 및 연예계 뉴스',
      status: 'active',
    },
    {
      name: 'Rolling Stone',
      url: 'https://www.rollingstone.com/feed/',
      description: '음악, 영화, TV, 정치, 문화',
      status: 'active',
    },
    {
      name: 'Deadline',
      url: 'https://deadline.com/feed/',
      description: '엔터테인먼트 비즈니스 뉴스',
      status: 'active',
    },
  ],
  politics: [
    {
      name: 'The Hill',
      url: 'https://thehill.com/feed/?feed=partnerfeed-news-feed&format=rss',
      description: '미국 의회 및 정치 뉴스',
      status: 'active',
    },
    {
      name: 'Foreign Policy',
      url: 'https://foreignpolicy.com/feed/',
      description: '국제 정치 및 외교 분석',
      status: 'active',
    },
    {
      name: 'The Economist',
      url: 'https://www.economist.com/international/rss.xml',
      description: '글로벌 정치 경제 분석',
      status: 'active',
    },
  ],
};

// 카테고리 이름 매핑
export const CATEGORY_LABELS: { [key: string]: string } = {
  technology: '기술',
  business: '비즈니스',
  world: '국제',
  science: '과학',
  health: '건강',
  sports: '스포츠',
  entertainment: '엔터테인먼트',
  politics: '정치',
};

// Export for backward compatibility
export const RECOMMENDED_RSS_FEEDS = VALIDATED_RSS_FEEDS;