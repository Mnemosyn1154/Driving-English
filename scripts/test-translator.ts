/**
 * Test script for Gemini Translation Service
 * Run with: npx tsx scripts/test-translator.ts
 */

import { translator } from '@/services/server/translation/geminiTranslator';
import { prisma } from '@/lib/prisma';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testTranslator() {
  console.log('🧪 Testing Gemini Translation Service...\n');

  try {
    // Test 1: Single text translation
    console.log('1️⃣ Testing single text translation...');
    const singleText = 'Breaking news: Artificial intelligence makes breakthrough in medical research';
    const singleResult = await translator.translateText(singleText);
    console.log(`✅ Original: ${singleText}`);
    console.log(`   Translation: ${singleResult.translatedText}`);
    console.log(`   Cached: ${singleResult.cached}`);

    // Test 2: Batch translation
    console.log('\n2️⃣ Testing batch translation...');
    const batchTexts = [
      'The weather is beautiful today',
      'Technology is advancing rapidly',
      'Global economy shows signs of recovery',
    ];
    const batchResults = await translator.translateBatch(batchTexts);
    console.log('✅ Batch translations:');
    batchTexts.forEach((text, i) => {
      console.log(`   ${i + 1}. ${text}`);
      console.log(`      → ${batchResults[i].translatedText} (cached: ${batchResults[i].cached})`);
    });

    // Test 3: Cache hit test
    console.log('\n3️⃣ Testing cache functionality...');
    const cacheTestText = 'This is a cache test';
    const firstCall = await translator.translateText(cacheTestText);
    const secondCall = await translator.translateText(cacheTestText);
    console.log(`✅ First call - Cached: ${firstCall.cached}`);
    console.log(`   Second call - Cached: ${secondCall.cached}`);

    // Test 4: Article translation
    console.log('\n4️⃣ Testing article translation...');
    // Get a sample article
    const sampleArticle = await prisma.article.findFirst({
      where: { isProcessed: false },
      include: { sentences: true },
    });

    if (sampleArticle) {
      console.log(`   Translating article: "${sampleArticle.title}"`);
      console.log(`   Sentences: ${sampleArticle.sentences.length}`);
      
      const articleResult = await translator.translateArticle(sampleArticle.id);
      console.log(`✅ Article translated successfully`);
      console.log(`   Title (KO): ${articleResult.title}`);
      console.log(`   Summary (KO): ${articleResult.summary.substring(0, 100)}...`);
      console.log(`   Translated sentences: ${articleResult.sentences.length}`);
    } else {
      console.log('⚠️  No unprocessed articles found for translation test');
    }

    // Test 5: Statistics
    console.log('\n5️⃣ Getting translation statistics...');
    const stats = await translator.getStatistics();
    console.log('✅ Translation statistics:');
    console.log(`   Total translations: ${stats.totalTranslations}`);
    console.log(`   Cached translations: ${stats.cachedTranslations}`);
    console.log(`   Cache hit rate: ${(stats.cacheHitRate * 100).toFixed(2)}%`);
    console.log(`   Average translation size: ${stats.averageTranslationSize} bytes`);

    console.log('\n✨ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    if (error.message?.includes('GEMINI_API_KEY')) {
      console.error('\n⚠️  Make sure GEMINI_API_KEY is set in your .env.local file');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testTranslator();