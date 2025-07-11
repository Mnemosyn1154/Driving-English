import { PrismaClient } from '@prisma/client';
import Parser from 'rss-parser';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();
const parser = new Parser();


// 읽기 시간 계산 (분)
function calculateReadingTime(wordCount: number): number {
  const wordsPerMinute = 200; // 평균 읽기 속도
  return Math.ceil(wordCount / wordsPerMinute) * 60; // 초 단위로 변환
}

// URL에서 고유 ID 생성
function generateIdFromUrl(url: string): string {
  return crypto.createHash('md5').update(url).digest('hex');
}

async function fetchFromSource(source: any) {
  console.log(`\n📡 Fetching from ${source.name}...`);
  
  try {
    const feed = await parser.parseURL(source.url);
    let articlesCreated = 0;
    let articlesSkipped = 0;
    
    for (const item of feed.items.slice(0, 10)) { // 각 소스에서 최대 10개씩
      if (!item.title || !item.link) continue;
      
      // 중복 체크
      const existingArticle = await prisma.article.findUnique({
        where: { url: item.link }
      });
      
      if (existingArticle) {
        articlesSkipped++;
        continue;
      }
      
      // 콘텐츠 추출
      const content = item.contentSnippet || item.content || item.summary || '';
      const summary = content.substring(0, 500).replace(/<[^>]*>/g, '').trim();
      const fullContent = content.replace(/<[^>]*>/g, '').trim();
      const wordCount = fullContent.split(/\s+/).length;
      
      // 기사 생성
      try {
        await prisma.article.create({
          data: {
            id: generateIdFromUrl(item.link),
            sourceId: source.id,
            title: item.title,
            summary: summary || 'No summary available',
            content: fullContent || summary || 'No content available',
            url: item.link,
            imageUrl: item.enclosure?.url,
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            wordCount: wordCount,
            readingTime: calculateReadingTime(wordCount),
            category: source.category,
            tags: Array.isArray(item.categories) ? item.categories : [],
            isProcessed: false, // 번역 및 TTS 처리 대기
          }
        });
        articlesCreated++;
      } catch (error) {
        console.error(`Error creating article: ${item.title}`, error);
      }
    }
    
    // 마지막 수집 시간 업데이트
    await prisma.newsSource.update({
      where: { id: source.id },
      data: { lastFetch: new Date() }
    });
    
    console.log(`✅ ${source.name}: ${articlesCreated} created, ${articlesSkipped} skipped`);
    
  } catch (error) {
    console.error(`❌ Error fetching from ${source.name}:`, error);
  }
}

async function fetchAllNews() {
  console.log('🗞️  Starting news fetch...\n');
  
  // 활성화된 모든 소스 가져오기
  const sources = await prisma.newsSource.findMany({
    where: { enabled: true }
  });
  
  console.log(`Found ${sources.length} active news sources`);
  
  // 각 소스에서 뉴스 가져오기
  for (const source of sources) {
    await fetchFromSource(source);
    // API 제한을 피하기 위한 지연
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 통계 출력
  const stats = await prisma.article.groupBy({
    by: ['category'],
    _count: true,
  });
  
  console.log('\n📊 Final Statistics:');
  stats.forEach(stat => {
    console.log(`  ${stat.category}: ${stat._count} articles`);
  });
  
  const total = await prisma.article.count();
  console.log(`  Total: ${total} articles`);
}

async function main() {
  try {
    await fetchAllNews();
    console.log('\n✨ News fetch completed!');
  } catch (error) {
    console.error('Error fetching news:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();