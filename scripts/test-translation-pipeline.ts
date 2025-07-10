/**
 * Test script for end-to-end translation pipeline
 * Run with: npx tsx scripts/test-translation-pipeline.ts
 */

import { newsAggregator } from '@/services/server/news/newsAggregator';
import { TranslationJob } from '@/services/server/jobs/translationJob';
import { prisma } from '@/lib/prisma';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testTranslationPipeline() {
  console.log('🧪 Testing Translation Pipeline...\n');

  try {
    // Step 1: Aggregate news
    console.log('1️⃣ Aggregating news from sources...');
    const aggregationResult = await newsAggregator.aggregateNews(['technology']);
    
    console.log(`✅ Aggregation complete:`);
    console.log(`   Total fetched: ${aggregationResult.totalFetched}`);
    console.log(`   Total processed: ${aggregationResult.totalProcessed}`);
    console.log(`   Duplicates found: ${aggregationResult.duplicatesFound}`);
    console.log(`   New articles: ${aggregationResult.newArticles?.length || 0}`);
    
    if (!aggregationResult.newArticles || aggregationResult.newArticles.length === 0) {
      console.log('\n⚠️  No new articles to translate. Try running again later.');
      return;
    }

    // Step 2: Translate new articles
    console.log('\n2️⃣ Translating new articles...');
    const translationJob = {
      data: {
        articleIds: aggregationResult.newArticles.slice(0, 3), // Test with first 3 articles
        priority: 'normal' as const,
      },
      id: 'test-job',
      progress: async (progress: number) => {
        console.log(`   Progress: ${progress}%`);
      },
      retry: async () => {},
      attemptsMade: 0,
    };

    const translationResult = await TranslationJob.process(translationJob as any);
    
    console.log(`✅ Translation complete:`);
    console.log(`   Processed: ${translationResult.processed}`);
    console.log(`   Failed: ${translationResult.failed}`);
    console.log(`   Time: ${translationResult.processingTime}ms`);
    
    if (translationResult.errors.length > 0) {
      console.log(`   Errors: ${translationResult.errors.join(', ')}`);
    }

    // Step 3: Verify translated articles
    console.log('\n3️⃣ Verifying translated articles...');
    const translatedArticles = await prisma.article.findMany({
      where: {
        id: { in: aggregationResult.newArticles.slice(0, 3) },
        isProcessed: true,
      },
      select: {
        id: true,
        title: true,
        titleKo: true,
        summary: true,
        summaryKo: true,
        sentences: {
          select: {
            text: true,
            translation: true,
          },
          take: 2,
        },
      },
    });

    console.log(`✅ Found ${translatedArticles.length} translated articles:`);
    
    translatedArticles.forEach((article, index) => {
      console.log(`\n   Article ${index + 1}:`);
      console.log(`   Title (EN): ${article.title}`);
      console.log(`   Title (KO): ${article.titleKo || 'Not translated'}`);
      console.log(`   Summary (EN): ${article.summary.substring(0, 100)}...`);
      console.log(`   Summary (KO): ${(article.summaryKo || '').substring(0, 100)}...`);
      
      if (article.sentences.length > 0) {
        console.log(`   Sample sentences:`);
        article.sentences.forEach((sentence, i) => {
          console.log(`     ${i + 1}. EN: ${sentence.text.substring(0, 80)}...`);
          console.log(`        KO: ${(sentence.translation || '').substring(0, 80)}...`);
        });
      }
    });

    // Step 4: Translation statistics
    console.log('\n4️⃣ Getting translation statistics...');
    const stats = await TranslationJob.getStatistics(1); // Last 1 hour
    
    console.log('✅ Translation statistics:');
    console.log(`   Total processed: ${stats.totalProcessed}`);
    console.log(`   Total failed: ${stats.totalFailed}`);
    console.log(`   Success rate: ${stats.successRate.toFixed(2)}%`);
    console.log(`   Total jobs: ${stats.totalJobs}`);

    console.log('\n✨ Translation pipeline test completed successfully!');

  } catch (error) {
    console.error('\n❌ Pipeline test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testTranslationPipeline();