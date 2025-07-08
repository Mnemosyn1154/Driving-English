import { NextRequest, NextResponse } from 'next/server';
import { NewsAPISearchService } from '@/services/server/news/newsApiSearch';
import { NewsService } from '@/services/server/news/newsService';
import { prisma } from '@/services/server/database/prisma';

// Gemini를 사용한 키워드 추출 (간단한 구현)
async function extractKeywords(transcript: string): Promise<string[]> {
  // 일단 간단한 키워드 추출 로직 사용
  // 나중에 Gemini API로 교체 예정
  
  // 불용어 제거
  const stopWords = ['의', '를', '을', '이', '가', '에', '와', '과', '로', '으로', '에서', '부터', '까지', '만', '도', '는', '은', '들', '좀', '잘', '더'];
  
  // 명령어 제거
  const commandWords = ['검색', '찾아', '찾아줘', '보여줘', '알려줘', '뉴스', '기사', '관련'];
  
  let keywords = transcript
    .split(/\s+/)
    .filter(word => word.length > 1)
    .filter(word => !stopWords.includes(word))
    .filter(word => !commandWords.includes(word));
  
  // 영어 단어는 그대로 유지
  const englishWords = keywords.filter(word => /^[A-Za-z]+$/.test(word));
  const koreanWords = keywords.filter(word => /[가-힣]/.test(word));
  
  return [...englishWords, ...koreanWords];
}

// 사용자 키워드 저장
async function saveUserKeywords(userId: string, keywords: string[]) {
  try {
    // 기존 키워드 확인 및 가중치 업데이트
    for (const keyword of keywords) {
      const existing = await prisma.userKeyword.findFirst({
        where: { userId, keyword }
      });
      
      if (existing) {
        // 가중치 증가
        await prisma.userKeyword.update({
          where: { id: existing.id },
          data: { weight: { increment: 0.1 } }
        });
      } else {
        // 새 키워드 추가
        await prisma.userKeyword.create({
          data: { userId, keyword, weight: 1.0 }
        });
      }
    }
  } catch (error) {
    console.error('Error saving user keywords:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { transcript, userId } = await request.json();
    
    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      );
    }
    
    // 1. 키워드 추출
    const keywords = await extractKeywords(transcript);
    console.log('Extracted keywords:', keywords);
    
    // 2. 사용자 키워드 저장 (userId가 있는 경우)
    if (userId) {
      await saveUserKeywords(userId, keywords);
    }
    
    // 3. 병렬로 검색 수행
    const searchPromises = [];
    
    // News API 검색
    if (keywords.length > 0) {
      const newsApiService = new NewsAPISearchService();
      searchPromises.push(
        newsApiService.searchNews(keywords.join(' '), {
          language: 'en',
          pageSize: 10
        }).catch(error => {
          console.error('News API search error:', error);
          return { articles: [] };
        })
      );
    }
    
    // 데이터베이스 검색
    const newsService = new NewsService();
    searchPromises.push(
      newsService.getArticles({
        search: keywords.join(' '),
        isProcessed: undefined // 모든 기사 검색
      }, {
        limit: 10,
        orderBy: 'publishedAt'
      })
    );
    
    // 모든 검색 결과 대기
    const [newsApiResults, dbResults] = await Promise.all(searchPromises);
    
    // 4. 결과 병합 및 중복 제거
    const allArticles = [
      ...(newsApiResults?.articles || []).map(article => ({
        ...article,
        source: article.source || 'News API',
        isExternal: true
      })),
      ...(dbResults?.articles || []).map(article => ({
        ...article,
        isExternal: false
      }))
    ];
    
    // URL 기반 중복 제거
    const uniqueArticles = Array.from(
      new Map(allArticles.map(article => [article.url, article])).values()
    );
    
    // 5. 관련성 점수 계산 및 정렬
    const scoredArticles = uniqueArticles.map(article => {
      let score = 0;
      
      // 제목에 키워드 포함 여부
      keywords.forEach(keyword => {
        if (article.title.toLowerCase().includes(keyword.toLowerCase())) {
          score += 2;
        }
        if (article.summary?.toLowerCase().includes(keyword.toLowerCase())) {
          score += 1;
        }
      });
      
      // 최신 기사 가산점
      const publishedDate = new Date(article.publishedAt);
      const daysSincePublished = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePublished < 1) score += 2;
      else if (daysSincePublished < 7) score += 1;
      
      return { ...article, relevanceScore: score };
    });
    
    // 점수 기준 정렬
    scoredArticles.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // 상위 10개만 반환
    const topArticles = scoredArticles.slice(0, 10);
    
    return NextResponse.json({
      query: transcript,
      keywords,
      totalResults: uniqueArticles.length,
      articles: topArticles.map((article, index) => ({
        ...article,
        selectionNumber: index + 1 // 음성 선택을 위한 번호
      }))
    });
    
  } catch (error) {
    console.error('Voice search error:', error);
    return NextResponse.json(
      { error: 'Failed to search news' },
      { status: 500 }
    );
  }
}