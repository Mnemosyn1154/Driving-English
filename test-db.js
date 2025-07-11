const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDB() {
  try {
    console.log('Testing database connection...');
    
    // 총 기사 수 확인
    const totalArticles = await prisma.article.count();
    console.log(`Total articles: ${totalArticles}`);
    
    // 최신 기사 5개 확인
    const latestArticles = await prisma.article.findMany({
      take: 5,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        category: true,
        publishedAt: true,
        isProcessed: true
      }
    });
    
    console.log('\nLatest articles:');
    latestArticles.forEach((article, index) => {
      console.log(`${index + 1}. ${article.title} (${article.category}) - Processed: ${article.isProcessed}`);
    });
    
    // 카테고리별 기사 수
    const categoryStats = await prisma.article.groupBy({
      by: ['category'],
      _count: true,
      orderBy: { _count: 'desc' }
    });
    
    console.log('\nCategory statistics:');
    categoryStats.forEach(stat => {
      console.log(`${stat.category}: ${stat._count} articles`);
    });
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDB();