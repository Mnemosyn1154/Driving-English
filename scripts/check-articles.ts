import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkArticles() {
  try {
    // Check total article count
    const totalCount = await prisma.article.count();
    console.log(`Total articles in database: ${totalCount}`);
    
    // Check processed articles
    const processedCount = await prisma.article.count({
      where: { isProcessed: true }
    });
    console.log(`Processed articles: ${processedCount}`);
    
    // Get sample articles
    const sampleArticles = await prisma.article.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        sentenceModels: true,
        source: true
      }
    });
    
    console.log('\nSample articles:');
    sampleArticles.forEach(article => {
      console.log(`- ID: ${article.id}`);
      console.log(`  Title: ${article.title}`);
      console.log(`  SentenceModels: ${article.sentenceModels.length}`);
      console.log(`  Sentences (JSON): ${article.sentences ? 'Yes' : 'No'}`);
      console.log(`  Processed: ${article.isProcessed}`);
      console.log(`  Category: ${article.category}`);
      console.log('');
    });
    
    // Check specific article
    const specificId = 'd2ad77d5-c879-48e3-8ccf-846f20f48d9b';
    const specificArticle = await prisma.article.findUnique({
      where: { id: specificId },
      include: { sentenceModels: true }
    });
    
    if (specificArticle) {
      console.log(`\nSpecific article ${specificId}:`);
      console.log(`Title: ${specificArticle.title}`);
      console.log(`SentenceModels: ${specificArticle.sentenceModels.length}`);
      console.log(`Sentences (JSON): ${specificArticle.sentences ? 'Yes' : 'No'}`);
    } else {
      console.log(`\nArticle ${specificId} not found in database`);
    }
    
  } catch (error) {
    console.error('Error checking articles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkArticles();