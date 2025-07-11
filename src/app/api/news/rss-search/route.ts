import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/server/database/prisma';
import { RECOMMENDED_RSS_FEEDS } from '@/data/recommended-rss-feeds';

// RSS 피드 이름 별칭 매핑
const RSS_ALIASES: { [key: string]: string[] } = {
  'techcrunch': ['테크크런치', 'tech crunch', 'TC', '텍크런치'],
  'bloomberg': ['블룸버그', '블룸버그 뉴스', 'bloomberg news'],
  'the verge': ['더버지', '더 버지', 'verge'],
  'bbc': ['BBC', '비비씨', 'bbc news'],
  'reuters': ['로이터', '로이터스', 'reuters news'],
  'financial times': ['파이낸셜타임스', 'FT', '파이낸셜 타임스'],
  'wired': ['와이어드', '와이얼드'],
  'ars technica': ['아스테크니카', '아스 테크니카'],
  'mit technology review': ['MIT', 'MIT 테크놀로지', 'MIT 리뷰'],
  'forbes': ['포브스', '포브즈'],
  'wsj': ['월스트리트저널', 'WSJ', '월스트리트 저널'],
  'nature': ['네이처', '네이쳐'],
  'science daily': ['사이언스데일리', '사이언스 데일리'],
  'new scientist': ['뉴사이언티스트', '뉴 사이언티스트'],
  'health news': ['헬스뉴스', '헬스 뉴스'],
  'medical news today': ['메디컬뉴스투데이', '메디컬 뉴스 투데이'],
  'espn': ['ESPN', '이에스피엔'],
  'bbc sport': ['BBC 스포츠', '비비씨 스포츠'],
  'the athletic': ['디애슬레틱', '디 애슬레틱'],
  'variety': ['버라이어티', '베라이어티'],
  'hollywood reporter': ['헐리우드리포터', '헐리우드 리포터'],
  'entertainment weekly': ['엔터테인먼트위클리', '엔터테인먼트 위클리'],
  'al jazeera': ['알자지라', '알 자지라'],
  'politico': ['폴리티코'],
  'the hill': ['더힐', '더 힐'],
  'foreign policy': ['포린폴리시', '포린 폴리시']
};

// 카테고리 별칭
const CATEGORY_ALIASES: { [key: string]: string[] } = {
  'technology': ['기술', 'tech', '테크', 'IT', '아이티'],
  'business': ['비즈니스', '경제', '금융', '비지니스'],
  'science': ['과학', '사이언스'],
  'health': ['건강', '의료', '헬스'],
  'sports': ['스포츠', '운동'],
  'entertainment': ['엔터테인먼트', '연예', '엔터'],
  'world': ['국제', '세계', '월드'],
  'politics': ['정치', '정책']
};

// RSS 피드 이름을 정규화
function normalizeSourceName(name: string): string {
  const lowerName = name.toLowerCase().trim();
  
  // 별칭 확인
  for (const [canonical, aliases] of Object.entries(RSS_ALIASES)) {
    if (aliases.some(alias => lowerName.includes(alias.toLowerCase()))) {
      return canonical;
    }
  }
  
  return lowerName;
}

// 카테고리 이름을 정규화
function normalizeCategoryName(name: string): string | null {
  const lowerName = name.toLowerCase().trim();
  
  for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (canonical === lowerName || aliases.some(alias => alias.toLowerCase() === lowerName)) {
      return canonical;
    }
  }
  
  return null;
}

// RSS 피드 URL 찾기
function findRssFeedUrl(sourceName: string): string | null {
  const normalizedName = normalizeSourceName(sourceName);
  
  // 모든 카테고리의 RSS 피드에서 검색
  for (const category of Object.values(RECOMMENDED_RSS_FEEDS)) {
    const feed = category.find(f => 
      f.name.toLowerCase() === normalizedName ||
      f.name.toLowerCase().includes(normalizedName)
    );
    
    if (feed) {
      return feed.url;
    }
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { source, category, count = 5, userId, deviceId } = await request.json();
    
    let feedUrls: string[] = [];
    const sourceInfo: { name?: string; category?: string } = {};
    
    // 1. 특정 소스 검색
    if (source) {
      const feedUrl = findRssFeedUrl(source);
      if (feedUrl) {
        feedUrls = [feedUrl];
        sourceInfo.name = source;
      } else {
        return NextResponse.json(
          { error: `"${source}" RSS 피드를 찾을 수 없습니다.` },
          { status: 404 }
        );
      }
    }
    
    // 2. 카테고리 검색
    else if (category) {
      const normalizedCategory = normalizeCategoryName(category);
      if (normalizedCategory && RECOMMENDED_RSS_FEEDS[normalizedCategory]) {
        feedUrls = RECOMMENDED_RSS_FEEDS[normalizedCategory].map(f => f.url);
        sourceInfo.category = normalizedCategory;
      } else {
        return NextResponse.json(
          { error: `"${category}" 카테고리를 찾을 수 없습니다.` },
          { status: 404 }
        );
      }
    }
    
    // 3. 사용자 구독 피드에서 검색
    else if (userId || deviceId) {
      const userFeeds = await prisma.userRssFeed.findMany({
        where: {
          OR: [
            userId ? { userId } : {},
            deviceId ? { deviceId } : {}
          ].filter(Boolean),
          enabled: true
        },
        select: { url: true }
      });
      
      if (userFeeds.length > 0) {
        feedUrls = userFeeds.map(f => f.url);
        sourceInfo.name = '구독 중인 피드';
      }
    }
    
    if (feedUrls.length === 0) {
      return NextResponse.json(
        { error: 'RSS 피드를 지정해주세요. 예: "테크크런치 뉴스 5개"' },
        { status: 400 }
      );
    }
    
    // 기사 검색
    const articles = await prisma.article.findMany({
      where: {
        source: {
          url: { in: feedUrls }
        }
      },
      include: {
        source: true
      },
      orderBy: { publishedAt: 'desc' },
      take: count
    });
    
    // 응답 포맷팅
    const formattedArticles = articles.map((article, index) => ({
      id: article.id,
      title: article.title,
      summary: article.summary || article.content?.substring(0, 200) + '...',
      source: article.source.name,
      url: article.url,
      publishedAt: article.publishedAt,
      selectionNumber: index + 1,
      category: article.category
    }));
    
    return NextResponse.json({
      source: sourceInfo.name || sourceInfo.category,
      count: formattedArticles.length,
      requestedCount: count,
      articles: formattedArticles
    });
    
  } catch (error) {
    console.error('RSS search error:', error);
    return NextResponse.json(
      { error: 'RSS 피드 검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}