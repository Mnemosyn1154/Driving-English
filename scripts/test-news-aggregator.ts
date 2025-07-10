/**
 * Test script for News Aggregator
 * Run with: npx tsx scripts/test-news-aggregator.ts
 */

import { newsAggregator } from '@/services/server/news/newsAggregator';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testNewsAggregator() {
  console.log('🧪 Testing News Aggregator...\n');

  try {
    // Get initial statistics
    console.log('📊 Initial Statistics:');
    const initialStats = await newsAggregator.getStatistics();
    console.log(`   Total articles: ${initialStats.totalArticles}`);
    console.log(`   Categories: ${initialStats.articlesByCategory.map(c => `${c.category}(${c.count})`).join(', ')}`);
    console.log(`   Sources: ${initialStats.articlesBySource.map(s => `${s.source}(${s.count})`).join(', ')}`);

    // Test aggregation with specific categories
    console.log('\n🔄 Running news aggregation...');
    const categories = ['technology', 'business', 'science'];
    console.log(`   Categories: ${categories.join(', ')}`);
    
    const result = await newsAggregator.aggregateNews(categories);
    
    console.log('\n✅ Aggregation Results:');
    console.log(`   Total fetched: ${result.totalFetched}`);
    console.log(`   Total processed: ${result.totalProcessed}`);
    console.log(`   Duplicates found: ${result.duplicatesFound}`);
    console.log(`   RSS - Fetched: ${result.sourceBreakdown.rss.fetched}, Processed: ${result.sourceBreakdown.rss.processed}`);
    console.log(`   NewsAPI - Fetched: ${result.sourceBreakdown.newsApi.fetched}, Processed: ${result.sourceBreakdown.newsApi.processed}`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors (${result.errors.length}):`);
      result.errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
    }

    // Get updated statistics
    console.log('\n📊 Updated Statistics:');
    const updatedStats = await newsAggregator.getStatistics();
    console.log(`   Total articles: ${updatedStats.totalArticles} (+${updatedStats.totalArticles - initialStats.totalArticles})`);
    console.log(`   Categories: ${updatedStats.articlesByCategory.map(c => `${c.category}(${c.count})`).join(', ')}`);
    
    // Show deduplication effectiveness
    const deduplicationRate = result.duplicatesFound > 0 
      ? Math.round((result.duplicatesFound / result.totalFetched) * 100)
      : 0;
    console.log(`\n🔁 Deduplication Rate: ${deduplicationRate}%`);
    console.log(`   ${result.duplicatesFound} duplicates prevented out of ${result.totalFetched} articles`);

    console.log('\n✨ News aggregation test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the test
testNewsAggregator().catch(console.error);