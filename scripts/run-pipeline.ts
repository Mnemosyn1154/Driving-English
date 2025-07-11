#!/usr/bin/env npx ts-node

import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const execAsync = promisify(exec);

async function runCommand(command: string, description: string) {
  console.log(`\n🚀 ${description}...`);
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(stdout);
    if (stderr) console.log(stderr);
    console.log(`✅ ${description} completed!`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error);
    throw error;
  }
}

async function main() {
  console.log('🔄 Starting News Pipeline...\n');
  
  const startTime = Date.now();
  
  try {
    // 1. 뉴스 수집
    await runCommand(
      'npx ts-node scripts/fetch-news.ts',
      'Fetching news from RSS sources'
    );
    
    // 2. 기사 처리 (번역 및 TTS)
    await runCommand(
      'npx ts-node scripts/process-articles.ts',
      'Processing articles (translation and TTS)'
    );
    
    // 3. RSS 피드 검증
    await runCommand(
      'npx ts-node scripts/validate-rss-feeds.ts',
      'Validating RSS feeds'
    );
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`\n✨ Pipeline completed successfully in ${duration} seconds!`);
    console.log(`\n📊 Next steps:`);
    console.log(`  1. Check the database for processed articles`);
    console.log(`  2. Test the news API endpoints`);
    console.log(`  3. Verify audio files in public/audio/`);
    
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error);
    process.exit(1);
  }
}

// 스케줄링 옵션 추가
if (process.argv.includes('--schedule')) {
  console.log('📅 Setting up scheduled pipeline...');
  
  // 매 시간마다 실행
  setInterval(async () => {
    console.log('\n⏰ Scheduled pipeline execution...');
    await main();
  }, 60 * 60 * 1000); // 1시간
  
  console.log('✅ Pipeline scheduled to run every hour');
} else {
  // 일회성 실행
  main();
}