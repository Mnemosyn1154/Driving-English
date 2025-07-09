import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthContext } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user or device user
    const auth = await getAuthContext(request);
    
    // 사용자 선호도 가져오기
    let preferences = {
      categories: [] as string[],
      level: 3,
      keywords: [] as string[],
    };

    if (auth.isAuthenticated && auth.userId) {
      // DB에서 사용자 선호도 가져오기
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        include: {
          preferences: true,
          keywords: {
            orderBy: { weight: 'desc' },
            take: 10
          }
        }
      });

      if (user) {
        preferences.level = user.preferredLevel;
        
        const categoriesPref = user.preferences.find(p => p.key === 'categories');
        if (categoriesPref) {
          preferences.categories = JSON.parse(categoriesPref.value);
        }
        
        preferences.keywords = user.keywords.map(k => k.keyword);
      }
    } else {
      // 로컬 스토리지에서 가져오기 (비로그인 사용자)
      // 임시로 로컬 스토리지 대신 기본값 사용
      preferences = {
        categories: ['technology', 'business', 'science'],
        level: 3,
        keywords: []
      };
    }

    // 개인화된 뉴스 가져오기
    const articles = await prisma.article.findMany({
      where: {
        AND: [
          preferences.categories.length > 0 ? {
            category: { in: preferences.categories }
          } : {},
          {
            difficulty: {
              gte: Math.max(1, preferences.level - 1),
              lte: Math.min(5, preferences.level + 1)
            }
          },
          {
            publishedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 최근 7일
            }
          }
        ]
      },
      orderBy: [
        { publishedAt: 'desc' }
      ],
      take: 20,
      include: {
        source: true,
        sentences: {
          take: 3,
          orderBy: { order: 'asc' }
        }
      }
    });

    // 키워드 기반 가중치 계산
    const scoredArticles = articles.map(article => {
      let score = 0;
      
      // 키워드 매칭
      preferences.keywords.forEach(keyword => {
        if (article.title.toLowerCase().includes(keyword.toLowerCase()) ||
            article.summary.toLowerCase().includes(keyword.toLowerCase())) {
          score += 10;
        }
      });
      
      // 최신성
      const ageInDays = (Date.now() - article.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - ageInDays);
      
      // 난이도 일치도
      const diffMatch = Math.abs(article.difficulty - preferences.level);
      score += Math.max(0, 5 - diffMatch * 2);
      
      return { ...article, score };
    });

    // 점수 기준 정렬
    scoredArticles.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      articles: scoredArticles.map(({ score, ...article }) => article),
      preferences,
      total: scoredArticles.length
    });
  } catch (error) {
    console.error('Personalized news fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personalized news' },
      { status: 500 }
    );
  }
}