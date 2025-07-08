import { prisma } from '@/lib/prisma';
import { User } from '@supabase/supabase-js';

export const userService = {
  // Supabase Auth 사용자를 Prisma User로 매핑
  async ensureUser(supabaseUser: User | null, deviceId?: string) {
    if (!supabaseUser && !deviceId) {
      throw new Error('Either supabaseUser or deviceId is required');
    }

    // 인증된 사용자의 경우
    if (supabaseUser) {
      let user = await prisma.user.findUnique({
        where: { supabaseId: supabaseUser.id }
      });

      if (!user) {
        // 기존 deviceId로 생성된 사용자가 있는지 확인
        if (deviceId) {
          const existingUser = await prisma.user.findUnique({
            where: { deviceId }
          });

          if (existingUser) {
            // deviceId 사용자를 인증된 사용자로 업데이트
            user = await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                supabaseId: supabaseUser.id,
                email: supabaseUser.email,
                name: supabaseUser.user_metadata?.name
              }
            });
          }
        }

        // 새 사용자 생성
        if (!user) {
          user = await prisma.user.create({
            data: {
              supabaseId: supabaseUser.id,
              email: supabaseUser.email,
              name: supabaseUser.user_metadata?.name,
              deviceId: deviceId || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }
          });
        }
      }

      return user;
    }

    // 비인증 사용자 (deviceId만 사용)
    if (deviceId) {
      let user = await prisma.user.findUnique({
        where: { deviceId }
      });

      if (!user) {
        user = await prisma.user.create({
          data: { deviceId }
        });
      }

      return user;
    }
  },

  // 사용자 선호도 업데이트
  async updatePreferences(userId: string, preferences: {
    preferredLevel?: number;
    dailyGoal?: number;
    categories?: string[];
  }) {
    const { preferredLevel, dailyGoal, categories } = preferences;

    // 사용자 기본 정보 업데이트
    if (preferredLevel !== undefined || dailyGoal !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(preferredLevel !== undefined && { preferredLevel }),
          ...(dailyGoal !== undefined && { dailyGoal })
        }
      });
    }

    // 카테고리 선호도 업데이트
    if (categories) {
      await prisma.userPreference.upsert({
        where: { 
          userId_key: { 
            userId, 
            key: 'categories' 
          } 
        },
        update: { value: JSON.stringify(categories) },
        create: {
          userId,
          key: 'categories',
          value: JSON.stringify(categories)
        }
      });
    }
  },

  // 사용자 키워드 추가/업데이트
  async addKeyword(userId: string, keyword: string) {
    await prisma.userKeyword.upsert({
      where: {
        userId_keyword: { userId, keyword }
      },
      update: {
        weight: { increment: 0.1 }, // 빈도 증가
        updatedAt: new Date()
      },
      create: {
        userId,
        keyword,
        weight: 1.0
      }
    });
  },

  // 사용자의 키워드 가져오기
  async getUserKeywords(userId: string, limit = 10) {
    return prisma.userKeyword.findMany({
      where: { userId },
      orderBy: { weight: 'desc' },
      take: limit
    });
  },

  // 사용자 RSS 피드 추가
  async addRssFeed(userId: string, feed: {
    name: string;
    url: string;
    category?: string;
  }) {
    return prisma.userRssFeed.create({
      data: {
        userId,
        ...feed
      }
    });
  },

  // 사용자의 RSS 피드 가져오기
  async getUserRssFeeds(userId: string) {
    return prisma.userRssFeed.findMany({
      where: { userId, enabled: true }
    });
  },

  // 검색 기록 저장
  async saveSearchHistory(userId: string, search: {
    transcript: string;
    keywords: string[];
    resultCount: number;
    selectedId?: string;
  }) {
    // 검색 기록 저장
    await prisma.newsSearch.create({
      data: {
        userId,
        ...search
      }
    });

    // 키워드 가중치 업데이트
    for (const keyword of search.keywords) {
      await this.addKeyword(userId, keyword);
    }
  }
};