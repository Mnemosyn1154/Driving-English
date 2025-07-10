/**
 * Test script for full news processing pipeline
 * Tests: News Collection → Translation → TTS
 * Run with: npx tsx scripts/test-full-pipeline.ts
 */

import { newsAggregator } from '@/services/server/news/newsAggregator';
import { TranslationJob } from '@/services/server/jobs/translationJob';
import { TTSJob } from '@/services/server/jobs/ttsJob';
import { prisma } from '@/lib/prisma';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testFullPipeline() {
  console.log('🧪 Testing Full News Processing Pipeline...\n');

  try {
    // Step 1: News Collection
    console.log('1️⃣ News Collection Phase');
    console.log('━'.repeat(50));
    
    const aggregationResult = await newsAggregator.aggregateNews(['technology']);
    
    console.log(`📰 News collection complete:`);
    console.log(`   • Total fetched: ${aggregationResult.totalFetched}`);
    console.log(`   • Total processed: ${aggregationResult.totalProcessed}`);
    console.log(`   • Duplicates found: ${aggregationResult.duplicatesFound}`);
    console.log(`   • New articles: ${aggregationResult.newArticles?.length || 0}`);
    
    if (!aggregationResult.newArticles || aggregationResult.newArticles.length === 0) {
      console.log('\n⚠️  No new articles found. Using existing untranslated articles...');
      
      // Get some untranslated articles
      const untranslatedArticles = await prisma.article.findMany({
        where: { isProcessed: false },
        select: { id: true },
        take: 2,
        orderBy: { createdAt: 'desc' },
      });
      
      if (untranslatedArticles.length === 0) {
        console.log('❌ No articles available for testing');
        return;
      }
      
      aggregationResult.newArticles = untranslatedArticles.map(a => a.id);
    }

    const testArticleIds = aggregationResult.newArticles!.slice(0, 2); // Test with 2 articles
    console.log(`\n🎯 Testing with ${testArticleIds.length} articles: ${testArticleIds.join(', ')}\n`);

    // Step 2: Translation Phase
    console.log('2️⃣ Translation Phase');
    console.log('━'.repeat(50));
    
    const translationJob = {
      data: {
        articleIds: testArticleIds,
        priority: 'high' as const,
      },
      id: 'test-translation-job',
      progress: async (progress: number) => {
        process.stdout.write(`\r   Translation progress: ${progress}%`);
      },
      retry: async () => {},
      attemptsMade: 0,
    };

    const translationResult = await TranslationJob.process(translationJob as any);
    
    console.log(`\n✅ Translation complete:`);
    console.log(`   • Processed: ${translationResult.processed}`);
    console.log(`   • Failed: ${translationResult.failed}`);
    console.log(`   • Time: ${translationResult.processingTime}ms`);
    
    if (translationResult.errors.length > 0) {
      console.log(`   • Errors: ${translationResult.errors.slice(0, 3).join(', ')}${translationResult.errors.length > 3 ? '...' : ''}`);
    }

    // Wait a moment for any async operations
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: TTS Phase
    console.log('\n3️⃣ TTS Generation Phase');
    console.log('━'.repeat(50));
    
    const ttsJob = {
      data: {
        articleIds: testArticleIds,
        priority: 'high' as const,
      },
      id: 'test-tts-job',
      progress: async (progress: number) => {
        process.stdout.write(`\r   TTS progress: ${progress}%`);
      },
      retry: async () => {},
      attemptsMade: 0,
    };

    const ttsResult = await TTSJob.process(ttsJob as any);
    
    console.log(`\n✅ TTS generation complete:`);
    console.log(`   • Processed: ${ttsResult.processed}`);
    console.log(`   • Failed: ${ttsResult.failed}`);
    console.log(`   • Audio files generated: ${ttsResult.audioFilesGenerated}`);
    console.log(`   • Time: ${ttsResult.processingTime}ms`);
    
    if (ttsResult.errors.length > 0) {
      console.log(`   • Errors: ${ttsResult.errors.slice(0, 3).join(', ')}${ttsResult.errors.length > 3 ? '...' : ''}`);
    }

    // Step 4: Verification
    console.log('\n4️⃣ Pipeline Verification');
    console.log('━'.repeat(50));
    
    const processedArticles = await prisma.article.findMany({
      where: {
        id: { in: testArticleIds },
      },
      include: {
        sentences: {
          select: {
            id: true,
            text: true,
            translation: true,
            audioUrlEn: true,
            audioUrlKo: true,
          },
          take: 3,
        },
      },
    });

    let fullyProcessedCount = 0;
    let translatedCount = 0;
    let audioGeneratedCount = 0;

    for (const article of processedArticles) {
      const hasTranslation = article.isProcessed && article.titleKo && article.summaryKo;
      const hasAudio = article.audioProcessed && article.sentences.some(s => s.audioUrlEn || s.audioUrlKo);
      
      if (hasTranslation) translatedCount++;
      if (hasAudio) audioGeneratedCount++;
      if (hasTranslation && hasAudio) fullyProcessedCount++;

      console.log(`\n📄 Article: ${article.title.substring(0, 60)}...`);
      console.log(`   • ID: ${article.id}`);
      console.log(`   • Translated: ${hasTranslation ? '✅' : '❌'}`);
      console.log(`   • Audio Generated: ${hasAudio ? '✅' : '❌'}`);
      console.log(`   • Sentences: ${article.sentences.length}`);
      
      if (article.sentences.length > 0) {
        const sentence = article.sentences[0];
        console.log(`   • Sample EN: ${sentence.text.substring(0, 80)}...`);
        if (sentence.translation) {
          console.log(`   • Sample KO: ${sentence.translation.substring(0, 80)}...`);
        }
        if (sentence.audioUrlEn || sentence.audioUrlKo) {
          console.log(`   • Audio URLs: EN=${sentence.audioUrlEn ? '✅' : '❌'}, KO=${sentence.audioUrlKo ? '✅' : '❌'}`);
        }
      }
    }

    // Step 5: Pipeline Statistics
    console.log('\n5️⃣ Pipeline Statistics');
    console.log('━'.repeat(50));
    
    const [translationStats, ttsStats] = await Promise.all([
      TranslationJob.getStatistics(1),
      TTSJob.getStatistics(1),
    ]);

    console.log('📊 Overall Pipeline Results:');
    console.log(`   • Articles tested: ${testArticleIds.length}`);
    console.log(`   • Successfully translated: ${translatedCount}/${testArticleIds.length}`);
    console.log(`   • Audio generated: ${audioGeneratedCount}/${testArticleIds.length}`);
    console.log(`   • Fully processed: ${fullyProcessedCount}/${testArticleIds.length}`);
    console.log(`   • Pipeline success rate: ${((fullyProcessedCount / testArticleIds.length) * 100).toFixed(1)}%`);
    
    console.log('\n📈 System Statistics:');
    console.log(`   • Total translated articles: ${translationStats.totalProcessed}`);
    console.log(`   • Articles needing translation: ${translationStats.untranslatedArticles || 0}`);
    console.log(`   • Audio processed articles: ${ttsStats.audioProcessedArticles}`);
    console.log(`   • Articles needing audio: ${ttsStats.needsAudioProcessing}`);
    console.log(`   • Total audio files: ${ttsStats.totalAudioFiles}`);

    if (fullyProcessedCount === testArticleIds.length) {
      console.log('\n🎉 Full pipeline test completed successfully!');
      console.log('✨ News Collection → Translation → TTS pipeline is working perfectly!');
    } else {
      console.log('\n⚠️  Pipeline test completed with some issues');
      console.log('🔍 Check the error logs above for details');
    }

  } catch (error) {
    console.error('\n❌ Pipeline test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testFullPipeline();