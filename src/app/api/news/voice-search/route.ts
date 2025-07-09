import { NextRequest, NextResponse } from 'next/server';
import { NewsAPISearchService } from '@/services/server/news/newsApiSearch';
import { NewsService } from '@/services/server/news/newsService';
import { prisma } from '@/services/server/database/prisma';
import { getAuthContext } from '@/lib/api-auth';

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

// 사용자 RSS 피드에서 기사 검색
async function searchUserRSSFeeds(userId: string, keywords: string[]) {
  try {
    // 사용자의 활성화된 RSS 피드 가져오기
    const userFeeds = await prisma.userRssFeed.findMany({
      where: { userId, enabled: true },
      select: { url: true, category: true }
    });
    
    if (userFeeds.length === 0) return [];
    
    // RSS 피드 URL 목록
    const feedUrls = userFeeds.map(f => f.url);
    
    // 해당 피드들의 기사 검색
    const articles = await prisma.article.findMany({
      where: {
        source: {
          url: { in: feedUrls }
        },
        OR: keywords.map(keyword => ({
          OR: [
            { title: { contains: keyword, mode: 'insensitive' } },
            { summary: { contains: keyword, mode: 'insensitive' } },
            { content: { contains: keyword, mode: 'insensitive' } }
          ]
        }))
      },
      include: {
        source: true
      },
      take: 20,
      orderBy: { publishedAt: 'desc' }
    });
    
    return articles;
  } catch (error) {
    console.error('Error searching user RSS feeds:', error);
    return [];
  }
}

// 사용자 선호도 기반 점수 계산
async function calculatePersonalizedScore(
  article: any,
  keywords: string[],
  userId?: string
): Promise<number> {
  let score = 0;
  
  // 기본 키워드 매칭 점수
  keywords.forEach(keyword => {
    const lowerKeyword = keyword.toLowerCase();
    if (article.title?.toLowerCase().includes(lowerKeyword)) {
      score += 3; // 제목 매칭은 높은 점수
    }
    if (article.summary?.toLowerCase().includes(lowerKeyword)) {
      score += 2;
    }
    if (article.content?.toLowerCase().includes(lowerKeyword)) {
      score += 1;
    }
  });
  
  // 사용자 선호도 점수
  if (userId) {
    try {
      // 사용자 키워드 가중치 적용
      const userKeywords = await prisma.userKeyword.findMany({
        where: { userId },
        select: { keyword: true, weight: true }
      });
      
      userKeywords.forEach(uk => {
        if (article.title?.toLowerCase().includes(uk.keyword.toLowerCase())) {
          score += uk.weight * 2;
        }
        if (article.summary?.toLowerCase().includes(uk.keyword.toLowerCase())) {
          score += uk.weight;
        }
      });
      
      // 사용자 선호 카테고리 확인
      const userPrefs = await prisma.userPreference.findFirst({
        where: { userId, key: 'categories' }
      });
      
      if (userPrefs) {
        const preferredCategories = JSON.parse(userPrefs.value);
        if (preferredCategories.includes(article.category)) {
          score += 2; // 선호 카테고리 가산점
        }
      }
      
      // RSS 피드 소스 가산점 (사용자가 구독한 피드)
      if (article.isFromUserFeed) {
        score += 3;
      }
    } catch (error) {
      console.error('Error calculating personalized score:', error);
    }
  }
  
  // 최신성 점수
  const publishedDate = new Date(article.publishedAt);
  const daysSincePublished = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSincePublished < 1) score += 3;
  else if (daysSincePublished < 3) score += 2;
  else if (daysSincePublished < 7) score += 1;
  
  return score;
}

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json();
    
    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      );
    }
    
    // Get authenticated user or device user
    const auth = await getAuthContext(request);
    
    // 1. 키워드 추출
    const keywords = await extractKeywords(transcript);
    console.log('Extracted keywords:', keywords);
    
    // 2. 사용자 ID 확인
    const dbUserId = auth.userId;
    
    // 3. 사용자 키워드 저장
    if (dbUserId) {
      await saveUserKeywords(dbUserId, keywords);
    }
    
    // 4. 병렬로 검색 수행
    const searchPromises = [];
    
    // 사용자 RSS 피드 검색 (최우선)
    if (dbUserId && keywords.length > 0) {
      searchPromises.push(
        searchUserRSSFeeds(dbUserId, keywords)
      );
    } else {
      searchPromises.push(Promise.resolve([]));
    }
    
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
    } else {
      searchPromises.push(Promise.resolve({ articles: [] }));
    }
    
    // 일반 데이터베이스 검색
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
    const [userFeedResults, newsApiResults, dbResults] = await Promise.all(searchPromises);
    
    // 5. 결과 병합 및 중복 제거
    const allArticles = [
      // 사용자 RSS 피드 기사 (최우선)
      ...(userFeedResults || []).map((article: any) => ({
        ...article,
        source: article.source?.name || 'User RSS Feed',
        sourceType: 'RSS',
        isExternal: false,
        isFromUserFeed: true
      })),
      // News API 결과
      ...(newsApiResults?.articles || []).map((article: any) => ({
        ...article,
        source: article.source || 'News API',
        sourceType: 'API',
        isExternal: true,
        isFromUserFeed: false
      })),
      // 일반 DB 결과
      ...(dbResults?.articles || []).map((article: any) => ({
        ...article,
        sourceType: 'DB',
        isExternal: false,
        isFromUserFeed: false
      }))
    ];
    
    // URL 기반 중복 제거
    const uniqueArticles = Array.from(
      new Map(allArticles.map(article => [article.url, article])).values()
    );
    
    // 6. 관련성 점수 계산 및 정렬
    const scoredArticles = await Promise.all(
      uniqueArticles.map(async (article) => {
        const score = await calculatePersonalizedScore(article, keywords, dbUserId);
        return { ...article, relevanceScore: score };
      })
    );
    
    // 점수 기준 정렬
    scoredArticles.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // 상위 10개만 반환
    const topArticles = scoredArticles.slice(0, 10);
    
    // 검색 기록 저장
    if (dbUserId) {
      try {
        await prisma.newsSearch.create({
          data: {
            userId: dbUserId,
            transcript,
            keywords,
            resultCount: topArticles.length
          }
        });
      } catch (error) {
        console.error('Error saving search history:', error);
      }
    }
    
    return NextResponse.json({
      query: transcript,
      keywords,
      totalResults: uniqueArticles.length,
      userFeedCount: userFeedResults?.length || 0,
      articles: topArticles.map((article, index) => ({
        ...article,
        selectionNumber: index + 1, // 음성 선택을 위한 번호
        sourceInfo: {
          type: article.sourceType,
          name: article.source,
          isUserSubscribed: article.isFromUserFeed
        }
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