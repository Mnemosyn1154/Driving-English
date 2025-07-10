/**
 * Migration script to add sentences to existing articles
 * Run with: npx tsx scripts/migrate-sentences.ts
 */

import { prisma } from '@/lib/prisma';
import { TextProcessor } from '@/utils/textProcessing';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function migrateSentences() {
  console.log('🔄 Starting sentence migration for existing articles...\n');

  try {
    // Get articles without sentences
    const articlesWithoutSentences = await prisma.article.findMany({
      where: {
        sentences: {
          none: {}
        }
      },
      select: {
        id: true,
        title: true,
        content: true,
      },
      take: 50, // Process in batches
    });

    console.log(`📰 Found ${articlesWithoutSentences.length} articles without sentences`);

    if (articlesWithoutSentences.length === 0) {
      console.log('✅ All articles already have sentences!');
      return;
    }

    let processed = 0;
    let failed = 0;

    for (const article of articlesWithoutSentences) {
      try {
        console.log(`Processing: ${article.title.substring(0, 60)}...`);

        // Split content into sentences
        const sentences = TextProcessor.splitIntoSentences(article.content);

        if (sentences.length > 0) {
          // Create sentences for this article
          await prisma.sentence.createMany({
            data: sentences.map(sentence => ({
              id: uuidv4(),
              articleId: article.id,
              order: sentence.order,
              text: sentence.text,
              wordCount: sentence.wordCount,
            }))
          });

          console.log(`  ✅ Added ${sentences.length} sentences`);
          processed++;
        } else {
          console.log(`  ⚠️  No valid sentences found`);
          failed++;
        }

      } catch (error) {
        console.error(`  ❌ Error processing article ${article.id}:`, error.message);
        failed++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   • Articles processed: ${processed}`);
    console.log(`   • Articles failed: ${failed}`);
    console.log(`   • Total articles: ${articlesWithoutSentences.length}`);

    // Show some sample articles with sentences
    console.log(`\n🔍 Sample verification:`);
    const sampleArticles = await prisma.article.findMany({
      include: {
        sentences: {
          take: 3,
          orderBy: { order: 'asc' }
        }
      },
      take: 3,
      orderBy: { createdAt: 'desc' }
    });

    for (const article of sampleArticles) {
      console.log(`\n📄 ${article.title.substring(0, 50)}...`);
      console.log(`   • Sentences: ${article.sentences.length}`);
      if (article.sentences.length > 0) {
        console.log(`   • Sample: "${article.sentences[0].text.substring(0, 80)}..."`);
      }
    }

    console.log('\n✨ Migration completed!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateSentences();