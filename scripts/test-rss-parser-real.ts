/**
 * Real RSS Feed Parser Test Script
 * Tests the RSS parser with actual RSS feeds
 */

import { rssParser } from '@/services/server/news/rssParser';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Sample RSS feeds to test
const testFeeds = [
  'https://feeds.bbci.co.uk/news/world/rss.xml', // BBC World News
  'https://rss.cnn.com/rss/cnn_topstories.rss', // CNN Top Stories
  'https://feeds.npr.org/1001/rss.xml', // NPR News
  'https://www.theguardian.com/world/rss', // The Guardian World News
  'https://techcrunch.com/feed/', // TechCrunch
];

async function testRSSParser() {
  console.log('🚀 Starting RSS Parser Real-World Test\n');

  for (const feedUrl of testFeeds) {
    console.log(`\n📡 Testing feed: ${feedUrl}`);
    console.log('─'.repeat(60));

    try {
      const startTime = Date.now();
      const result = await rssParser.processFeed(feedUrl);
      const duration = Date.now() - startTime;

      console.log(`✅ Success!`);
      console.log(`   Articles processed: ${result.processed}`);
      console.log(`   Processing time: ${duration}ms`);
      
      if (result.errors.length > 0) {
        console.log(`   ⚠️  Errors encountered: ${result.errors.length}`);
        result.errors.forEach(error => {
          console.log(`      - ${error}`);
        });
      }
    } catch (error) {
      console.error(`❌ Failed to process feed: ${error.message}`);
    }
  }

  console.log('\n\n📊 Test Summary');
  console.log('─'.repeat(60));
  console.log(`Total feeds tested: ${testFeeds.length}`);
  console.log('\n✨ RSS Parser test completed!');
}

// Run the test
testRSSParser().catch(console.error);