/**
 * Test script for Translation API endpoint
 * Run with: npx tsx scripts/test-translation-api.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const API_URL = 'http://127.0.0.1:3003/api/translate';

async function testTranslationAPI() {
  console.log('🧪 Testing Translation API endpoint...\n');

  try {
    // Test 1: Single text translation
    console.log('1️⃣ Testing single text translation...');
    const singleResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Breaking news: Technology company announces major acquisition',
      }),
    });
    const singleResult = await singleResponse.json();
    console.log('✅ Single translation response:', singleResult);

    // Test 2: Batch translation
    console.log('\n2️⃣ Testing batch translation...');
    const batchResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: [
          'The stock market is performing well today',
          'Climate change remains a global concern',
          'New medical breakthrough offers hope',
        ],
      }),
    });
    const batchResult = await batchResponse.json();
    console.log('✅ Batch translation response:', batchResult);

    // Test 3: Translation statistics
    console.log('\n3️⃣ Testing translation statistics...');
    const statsResponse = await fetch(API_URL, {
      method: 'GET',
    });
    const statsResult = await statsResponse.json();
    console.log('✅ Translation statistics:', statsResult);

    // Test 4: Error handling - missing parameters
    console.log('\n4️⃣ Testing error handling...');
    const errorResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const errorResult = await errorResponse.json();
    console.log('✅ Error response for missing parameters:', errorResult);

    // Test 5: Custom language pair
    console.log('\n5️⃣ Testing custom language pair (KO to EN)...');
    const customLangResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '안녕하세요, 오늘 날씨가 좋네요',
        from: 'ko',
        to: 'en',
      }),
    });
    const customLangResult = await customLangResponse.json();
    console.log('✅ Korean to English translation:', customLangResult);

    console.log('\n✨ All API tests completed successfully!');

  } catch (error) {
    console.error('\n❌ API test failed:', error);
    
    if (error.message?.includes('ECONNREFUSED')) {
      console.error('\n⚠️  Make sure the development server is running:');
      console.error('   npm run dev');
    }
  }
}

// Run the test
testTranslationAPI();