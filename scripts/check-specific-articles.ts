/**
 * Check specific articles and add sentences if needed
 */

import { prisma } from '@/lib/prisma';
import { TextProcessor } from '@/utils/textProcessing';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkSpecificArticles() {
  const articleIds = [
    '4a5bfa44-2b10-4107-9d21-eebd50721f58', 
    '632d184c-19ae-4844-a5b7-73427d6cca96'
  ];

  for (const articleId of articleIds) {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: { sentences: true }
    });

    if (!article) {
      console.log(`❌ Article ${articleId} not found`);
      continue;
    }

    console.log(`\n📄 Article: ${article.title}`);
    console.log(`   • Content length: ${article.content.length}`);
    console.log(`   • Existing sentences: ${article.sentences.length}`);
    console.log(`   • Content preview: "${article.content.substring(0, 200)}..."`);

    if (article.sentences.length === 0 && article.content.length > 0) {
      console.log(`   • Generating sentences...`);
      
      const sentences = TextProcessor.splitIntoSentences(article.content);
      console.log(`   • Found ${sentences.length} sentences`);

      if (sentences.length > 0) {
        await prisma.sentence.createMany({
          data: sentences.map(sentence => ({
            id: uuidv4(),
            articleId: article.id,
            order: sentence.order,
            text: sentence.text,
            wordCount: sentence.wordCount,
          }))
        });
        console.log(`   ✅ Added ${sentences.length} sentences`);
      }
    }
  }

  await prisma.$disconnect();
}

checkSpecificArticles();