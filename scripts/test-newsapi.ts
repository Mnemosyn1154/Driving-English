/**
 * Test script for NewsAPI integration
 * Run with: npm run ts-node scripts/test-newsapi.ts
 */

import { newsApiClient } from '@/services/server/news/newsApiClient';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testNewsApi() {
  console.log('🧪 Testing NewsAPI Client...\n');

  try {
    // Test 1: Fetch top headlines
    console.log('1️⃣ Testing fetchTopHeadlines (Technology)...');
    const techHeadlines = await newsApiClient.fetchTopHeadlines({
      category: 'technology',
      country: 'us',
      pageSize: 5
    });
    console.log(`✅ Found ${techHeadlines.length} technology headlines`);
    if (techHeadlines.length > 0) {
      console.log(`   Sample: "${techHeadlines[0].title}"`);
    }

    // Test 2: Fetch business news
    console.log('\n2️⃣ Testing fetchByCategory (Business)...');
    const businessNews = await newsApiClient.fetchByCategory('business', 'us');
    console.log(`✅ Found ${businessNews.length} business articles`);
    if (businessNews.length > 0) {
      console.log(`   Sample: "${businessNews[0].title}"`);
    }

    // Test 3: Search by keywords
    console.log('\n3️⃣ Testing searchByKeywords (AI)...');
    const aiArticles = await newsApiClient.searchByKeywords('artificial intelligence');
    console.log(`✅ Found ${aiArticles.length} AI-related articles`);
    if (aiArticles.length > 0) {
      console.log(`   Sample: "${aiArticles[0].title}"`);
    }

    // Test 4: Process and save articles
    console.log('\n4️⃣ Testing processAndSaveArticles...');
    const scienceHeadlines = await newsApiClient.fetchTopHeadlines({
      category: 'science',
      country: 'us',
      pageSize: 10
    });
    
    const { processed, errors } = await newsApiClient.processAndSaveArticles(
      scienceHeadlines,
      'science'
    );
    
    console.log(`✅ Processed ${processed} new articles`);
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} errors occurred:`);
      errors.forEach(err => console.log(`   - ${err}`));
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Total articles fetched: ${techHeadlines.length + businessNews.length + aiArticles.length + scienceHeadlines.length}`);
    console.log(`   New articles saved: ${processed}`);
    console.log(`   Categories tested: technology, business, science`);
    console.log(`   Search tested: artificial intelligence`);

    console.log('\n✨ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    
    if (error.message?.includes('NEWS_API_KEY')) {
      console.error('\n⚠️  Make sure NEWS_API_KEY is set in your .env.local file');
      console.error('   You can get a free API key from https://newsapi.org');
    }
  }
}

// Run the test
testNewsApi().catch(console.error);