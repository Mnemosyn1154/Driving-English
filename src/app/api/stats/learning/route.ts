import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAuthContext } from '@/lib/api-auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    
    // Skip auth 모드일 때는 샘플 데이터 사용
    if (!auth.isAuthenticated) {
      return NextResponse.json({
        todayMinutes: 25,
        weekMinutes: 180,
        streak: 7,
        totalArticles: 42,
        weeklyData: [
          { day: '월', minutes: 30 },
          { day: '화', minutes: 45 },
          { day: '수', minutes: 20 },
          { day: '목', minutes: 35 },
          { day: '금', minutes: 25 },
          { day: '토', minutes: 15 },
          { day: '일', minutes: 25 },
        ]
      });
    }
    
    const userId = auth.userId!;
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfWeek = new Date(startOfDay.getTime() - (startOfDay.getDay() * 24 * 60 * 60 * 1000));
    
    // 오늘 통계 조회
    const todayStats = await prisma.dailyStats.findUnique({
      where: {
        userId_date: {
          userId,
          date: startOfDay
        }
      }
    });
    
    const todayMinutes = todayStats?.studyMinutes || 0;
    
    // 이번 주 통계 조회
    const weekStats = await prisma.dailyStats.findMany({
      where: {
        userId,
        date: {
          gte: startOfWeek,
          lt: new Date(startOfWeek.getTime() + (7 * 24 * 60 * 60 * 1000))
        }
      },
      orderBy: {
        date: 'asc'
      }
    });
    
    const weekMinutes = weekStats.reduce((sum, stat) => sum + stat.studyMinutes, 0);
    
    // 연속 학습 일수 계산
    let streak = 0;
    const currentDate = new Date(startOfDay);
    
    while (streak < 365) { // 최대 1년까지만 확인
      const dayStats = await prisma.dailyStats.findUnique({
        where: {
          userId_date: {
            userId,
            date: currentDate
          }
        }
      });
      
      if (dayStats && dayStats.studyMinutes > 0) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    // 읽은 기사 수
    const totalArticles = await prisma.userArticleProgress.count({
      where: {
        userId,
        isCompleted: true
      }
    });
    
    // 주간 학습 데이터
    const weeklyData = [];
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek.getTime() + (i * 24 * 60 * 60 * 1000));
      const dayStats = weekStats.find(stat => 
        stat.date.toDateString() === day.toDateString()
      );
      
      weeklyData.push({
        day: days[day.getDay()],
        minutes: dayStats?.studyMinutes || 0
      });
    }
    
    return NextResponse.json({
      todayMinutes,
      weekMinutes,
      streak,
      totalArticles,
      weeklyData
    });
    
  } catch (error) {
    console.error('Error fetching learning stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch learning stats' },
      { status: 500 }
    );
  }
}