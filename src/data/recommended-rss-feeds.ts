export interface RecommendedFeed {
  name: string;
  url: string;
  description: string;
  language?: string;
}

export interface CategoryFeeds {
  [key: string]: RecommendedFeed[];
}

export const RECOMMENDED_RSS_FEEDS: CategoryFeeds = {
  technology: [
    {
      name: 'TechCrunch',
      url: 'https://techcrunch.com/feed/',
      description: '스타트업, 벤처캐피탈, 최신 기술 뉴스',
    },
    {
      name: 'The Verge',
      url: 'https://www.theverge.com/rss/index.xml',
      description: '기술, 과학, 예술, 문화의 교차점',
    },
    {
      name: 'Ars Technica',
      url: 'https://feeds.arstechnica.com/arstechnica/index',
      description: '심층 기술 분석 및 IT 뉴스',
    },
    {
      name: 'Wired',
      url: 'https://www.wired.com/feed/rss',
      description: '기술이 미래를 바꾸는 방법',
    },
    {
      name: 'MIT Technology Review',
      url: 'https://www.technologyreview.com/feed/',
      description: '최신 기술 연구 및 혁신',
    },
  ],
  business: [
    {
      name: 'Reuters Business',
      url: 'https://feeds.reuters.com/reuters/businessNews',
      description: '글로벌 비즈니스 및 금융 뉴스',
    },
    {
      name: 'Bloomberg',
      url: 'https://feeds.bloomberg.com/markets/news.rss',
      description: '금융 시장, 경제, 기업 뉴스',
    },
    {
      name: 'Financial Times',
      url: 'https://www.ft.com/?format=rss',
      description: '국제 비즈니스 및 경제 분석',
    },
    {
      name: 'Harvard Business Review',
      url: 'https://feeds.hbr.org/harvardbusiness',
      description: '경영 전략 및 리더십 인사이트',
    },
    {
      name: 'Forbes',
      url: 'https://www.forbes.com/real-time/feed2/',
      description: '비즈니스, 투자, 기업가 정신',
    },
  ],
  world: [
    {
      name: 'BBC World News',
      url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
      description: '영국 관점의 국제 뉴스',
    },
    {
      name: 'CNN International',
      url: 'http://rss.cnn.com/rss/edition_world.rss',
      description: '미국 관점의 글로벌 뉴스',
    },
    {
      name: 'Reuters World',
      url: 'https://feeds.reuters.com/Reuters/worldNews',
      description: '중립적 국제 뉴스 보도',
    },
    {
      name: 'The Guardian International',
      url: 'https://www.theguardian.com/world/rss',
      description: '진보적 관점의 국제 뉴스',
    },
    {
      name: 'Al Jazeera English',
      url: 'https://www.aljazeera.com/xml/rss/all.xml',
      description: '중동 및 글로벌 뉴스',
    },
  ],
  science: [
    {
      name: 'Science Daily',
      url: 'https://www.sciencedaily.com/rss/all.xml',
      description: '최신 과학 연구 및 발견',
    },
    {
      name: 'Nature News',
      url: 'https://www.nature.com/nature.rss',
      description: '권위있는 과학 저널 뉴스',
    },
    {
      name: 'Scientific American',
      url: 'https://rss.sciam.com/ScientificAmerican-Global',
      description: '대중을 위한 과학 뉴스',
    },
    {
      name: 'New Scientist',
      url: 'https://www.newscientist.com/feed/home',
      description: '과학 기술 최신 동향',
    },
    {
      name: 'NASA News',
      url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',
      description: '우주 탐사 및 항공우주',
    },
  ],
  health: [
    {
      name: 'WebMD Health News',
      url: 'https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC',
      description: '일반 건강 정보 및 의학 뉴스',
    },
    {
      name: 'Mayo Clinic News',
      url: 'https://newsnetwork.mayoclinic.org/feed/',
      description: '의학 전문가의 건강 정보',
    },
    {
      name: 'Medical News Today',
      url: 'https://www.medicalnewstoday.com/rss/featurednews.xml',
      description: '최신 의학 연구 및 건강 뉴스',
    },
    {
      name: 'Harvard Health',
      url: 'https://www.health.harvard.edu/blog/feed',
      description: '하버드 의대 건강 조언',
    },
    {
      name: 'WHO News',
      url: 'https://www.who.int/rss-feeds/news-english.xml',
      description: '세계보건기구 공식 뉴스',
    },
  ],
  sports: [
    {
      name: 'ESPN',
      url: 'https://www.espn.com/espn/rss/news',
      description: '종합 스포츠 뉴스',
    },
    {
      name: 'BBC Sport',
      url: 'https://feeds.bbci.co.uk/sport/rss.xml',
      description: '영국 및 국제 스포츠',
    },
    {
      name: 'The Athletic',
      url: 'https://theathletic.com/rss/',
      description: '심층 스포츠 분석 및 리포트',
    },
    {
      name: 'Sky Sports',
      url: 'https://www.skysports.com/rss/12040',
      description: '유럽 축구 및 스포츠',
    },
    {
      name: 'Sports Illustrated',
      url: 'https://www.si.com/rss/si_topstories.rss',
      description: '스포츠 문화 및 분석',
    },
  ],
  entertainment: [
    {
      name: 'Variety',
      url: 'https://variety.com/feed/',
      description: '엔터테인먼트 산업 뉴스',
    },
    {
      name: 'The Hollywood Reporter',
      url: 'https://www.hollywoodreporter.com/feed',
      description: '할리우드 및 연예계 뉴스',
    },
    {
      name: 'Entertainment Weekly',
      url: 'https://feeds.entertainmentweekly.com/ew/topstories',
      description: 'TV, 영화, 음악, 책',
    },
    {
      name: 'Rolling Stone',
      url: 'https://www.rollingstone.com/feed/',
      description: '음악, 영화, TV, 정치, 문화',
    },
    {
      name: 'Deadline',
      url: 'https://deadline.com/feed/',
      description: '엔터테인먼트 비즈니스 뉴스',
    },
  ],
  politics: [
    {
      name: 'Politico',
      url: 'https://www.politico.com/rss/politicopicks.xml',
      description: '미국 정치 및 정책 뉴스',
    },
    {
      name: 'The Hill',
      url: 'https://thehill.com/feed/',
      description: '미국 의회 및 정치 뉴스',
    },
    {
      name: 'Foreign Policy',
      url: 'https://foreignpolicy.com/feed/',
      description: '국제 정치 및 외교 분석',
    },
    {
      name: 'The Economist',
      url: 'https://www.economist.com/international/rss.xml',
      description: '글로벌 정치 경제 분석',
    },
    {
      name: 'Reuters Politics',
      url: 'https://feeds.reuters.com/Reuters/PoliticsNews',
      description: '국제 정치 뉴스',
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