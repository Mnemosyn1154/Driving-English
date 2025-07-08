import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

// 다양한 영어 뉴스 RSS 피드 소스
const RSS_SOURCES = [
  // 기술 뉴스
  {
    name: 'TechCrunch',
    type: 'RSS',
    url: 'https://techcrunch.com/feed/',
    category: 'technology',
    updateInterval: 30,
  },
  {
    name: 'The Verge',
    type: 'RSS',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'technology',
    updateInterval: 30,
  },
  {
    name: 'Wired',
    type: 'RSS',
    url: 'https://www.wired.com/feed/rss',
    category: 'technology',
    updateInterval: 60,
  },
  
  // 비즈니스 뉴스
  {
    name: 'BBC Business',
    type: 'RSS',
    url: 'http://feeds.bbci.co.uk/news/business/rss.xml',
    category: 'business',
    updateInterval: 30,
  },
  {
    name: 'Reuters Business',
    type: 'RSS',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    category: 'business',
    updateInterval: 30,
  },
  
  // 과학 뉴스
  {
    name: 'Science Daily',
    type: 'RSS',
    url: 'https://www.sciencedaily.com/rss/all.xml',
    category: 'science',
    updateInterval: 60,
  },
  {
    name: 'NASA News',
    type: 'RSS',
    url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',
    category: 'science',
    updateInterval: 120,
  },
  
  // 건강 뉴스
  {
    name: 'Medical News Today',
    type: 'RSS',
    url: 'https://www.medicalnewstoday.com/rss/featurednews.xml',
    category: 'health',
    updateInterval: 60,
  },
  {
    name: 'Harvard Health',
    type: 'RSS',
    url: 'https://www.health.harvard.edu/blog/feed',
    category: 'health',
    updateInterval: 120,
  },
  
  // 일반 뉴스
  {
    name: 'BBC World',
    type: 'RSS',
    url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'general',
    updateInterval: 30,
  },
  {
    name: 'CNN Top Stories',
    type: 'RSS',
    url: 'http://rss.cnn.com/rss/cnn_topstories.rss',
    category: 'general',
    updateInterval: 30,
  },
  {
    name: 'NPR News',
    type: 'RSS',
    url: 'https://feeds.npr.org/1001/rss.xml',
    category: 'general',
    updateInterval: 30,
  },
  
  // 스포츠 뉴스
  {
    name: 'ESPN',
    type: 'RSS',
    url: 'https://www.espn.com/espn/rss/news',
    category: 'sports',
    updateInterval: 60,
  },
  {
    name: 'BBC Sport',
    type: 'RSS',
    url: 'http://feeds.bbci.co.uk/sport/rss.xml',
    category: 'sports',
    updateInterval: 60,
  },
];

async function seedNewsSources() {
  console.log('🌱 Seeding news sources...');
  
  for (const source of RSS_SOURCES) {
    try {
      const created = await prisma.newsSource.upsert({
        where: { name: source.name },
        update: {
          url: source.url,
          category: source.category,
          updateInterval: source.updateInterval,
          enabled: true,
        },
        create: source,
      });
      
      console.log(`✅ ${created.name} (${created.category})`);
    } catch (error) {
      console.error(`❌ Error seeding ${source.name}:`, error);
    }
  }
  
  const count = await prisma.newsSource.count();
  console.log(`\n📊 Total news sources: ${count}`);
}

async function main() {
  try {
    await seedNewsSources();
    console.log('\n✨ Seeding completed!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();