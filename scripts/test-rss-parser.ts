/**
 * Test RSS Parser
 * Usage: npx tsx scripts/test-rss-parser.ts
 */

import { rssParser } from '../src/services/server/news/rssParser';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Sample RSS feeds for testing
const testFeeds = [
  'https://feeds.bbci.co.uk/news/rss.xml', // BBC News
  'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', // NY Times
  'https://feeds.npr.org/1001/rss.xml', // NPR News
  'https://techcrunch.com/feed/', // TechCrunch
  'https://feeds.arstechnica.com/arstechnica/index', // Ars Technica
];

async function testRSSParser() {
  console.log('🚀 Testing RSS Parser Service\n');

  // Test single feed
  console.log('📰 Testing single feed parsing...');
  const singleFeedUrl = testFeeds[0];
  console.log(`Feed: ${singleFeedUrl}`);
  
  try {
    const result = await rssParser.processFeed(singleFeedUrl);
    console.log(`✅ Processed ${result.processed} articles`);
    if (result.errors.length > 0) {
      console.log(`⚠️  Errors:`, result.errors);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test multiple feeds
  console.log('📚 Testing multiple feed parsing...');
  try {
    const results = await rssParser.processMultipleFeeds(testFeeds.slice(0, 3));
    console.log(`✅ Total processed: ${results.total} articles`);
    if (results.errors.length > 0) {
      console.log(`⚠️  Total errors: ${results.errors.length}`);
      results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test with user ID (creates user RSS feed entries)
  console.log('👤 Testing with user ID...');
  const testUserId = 'test-user-123';
  try {
    const result = await rssParser.processFeed(testFeeds[3], testUserId);
    console.log(`✅ Processed ${result.processed} articles for user ${testUserId}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n✨ RSS Parser test completed!');
}

// Run test
testRSSParser().catch(console.error);