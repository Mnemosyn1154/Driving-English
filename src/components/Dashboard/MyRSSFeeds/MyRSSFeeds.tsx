'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORY_LABELS } from '@/data/recommended-rss-feeds';
import styles from './MyRSSFeeds.module.css';

interface RSSFeed {
  id: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
  lastFetch?: string;
}

interface CategoryGroup {
  category: string;
  feeds: RSSFeed[];
  newArticles: number;
}

export const MyRSSFeeds: React.FC = () => {
  const router = useRouter();
  const [feedGroups, setFeedGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadFeeds();
  }, []);

  const loadFeeds = async () => {
    try {
      const deviceId = localStorage.getItem('deviceId');
      const params = new URLSearchParams();
      if (deviceId) params.append('deviceId', deviceId);
      
      const response = await fetch(`/api/rss/sources?type=USER_RSS&${params}`);
      if (response.ok) {
        const data = await response.json();
        
        // 카테고리별로 그룹화
        const grouped = (data.sources || data.feeds || []).reduce((acc: any, feed: RSSFeed) => {
          const category = feed.category || 'general';
          if (!acc[category]) {
            acc[category] = {
              category,
              feeds: [],
              newArticles: Math.floor(Math.random() * 10) // TODO: 실제 새 기사 수 API에서 가져오기
            };
          }
          acc[category].feeds.push(feed);
          return acc;
        }, {});
        
        setFeedGroups(Object.values(grouped));
      }
    } catch (error) {
      console.error('Failed to load RSS feeds:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAllFeeds = async () => {
    setUpdating(true);
    try {
      const deviceId = localStorage.getItem('deviceId');
      // TODO: Update to use new batch endpoint
      const response = await fetch('/api/rss/sources/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
      });
      
      if (response.ok) {
        await loadFeeds();
      }
    } catch (error) {
      console.error('Failed to update feeds:', error);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>📰 내 뉴스 피드</h2>
        <div className={styles.loading}>로딩 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>📰 내 뉴스 피드</h2>
        <button
          className={styles.updateButton}
          onClick={updateAllFeeds}
          disabled={updating}
        >
          {updating ? '업데이트 중...' : '모두 업데이트'}
        </button>
      </div>

      {feedGroups.length === 0 ? (
        <div className={styles.empty}>
          <p>아직 추가한 RSS 피드가 없습니다</p>
          <button
            className={styles.addButton}
            onClick={() => router.push('/settings?tab=rss')}
          >
            피드 추가하기
          </button>
        </div>
      ) : (
        <div className={styles.feedGroups}>
          {feedGroups.map((group) => (
            <div key={group.category} className={styles.categoryGroup}>
              <div className={styles.categoryHeader}>
                <h3>{CATEGORY_LABELS[group.category] || group.category}</h3>
                {group.newArticles > 0 && (
                  <span className={styles.newBadge}>
                    🔔 {group.newArticles} new
                  </span>
                )}
              </div>
              <div className={styles.feedList}>
                {group.feeds.map((feed) => (
                  <div key={feed.id} className={styles.feedItem}>
                    <span className={styles.feedName}>{feed.name}</span>
                    <span className={`${styles.status} ${feed.enabled ? styles.active : styles.inactive}`}>
                      {feed.enabled ? '활성' : '비활성'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className={styles.manageButton}
        onClick={() => router.push('/settings?tab=rss')}
      >
        피드 관리
      </button>
    </div>
  );
};