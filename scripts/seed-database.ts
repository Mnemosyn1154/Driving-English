import { prisma } from '../src/services/server/database/prisma';
import { newsQueue } from '../src/services/server/jobs/queue';

async function seedDatabase() {
  console.log('🌱 Seeding database...');

  try {
    // Create default news sources
    const sources = [
      {
        name: 'BBC News',
        type: 'RSS',
        url: 'http://feeds.bbci.co.uk/news/rss.xml',
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
        name: 'TechCrunch',
        type: 'RSS',
        url: 'https://techcrunch.com/feed/',
        category: 'technology',
        updateInterval: 60,
      },
      {
        name: 'The Verge',
        type: 'RSS',
        url: 'https://www.theverge.com/rss/index.xml',
        category: 'technology',
        updateInterval: 60,
      },
      {
        name: 'Reuters Business',
        type: 'RSS',
        url: 'https://feeds.reuters.com/reuters/businessNews',
        category: 'business',
        updateInterval: 45,
      },
    ];

    for (const source of sources) {
      await prisma.newsSource.upsert({
        where: { name: source.name },
        update: {},
        create: source,
      });
      console.log(`✓ Created/Updated source: ${source.name}`);
    }

    // Queue initial news fetch
    await newsQueue.add('fetch-all-sources', {});
    console.log('✓ Queued initial news fetch');

    console.log('🎉 Database seeding completed!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedDatabase();