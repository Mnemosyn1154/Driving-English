'use client';

import React, { useState, useEffect } from 'react';
import styles from './RSSFeedManager.module.css';

interface RSSFeed {
  id: string;
  name: string;
  url: string;
  category?: string;
  enabled: boolean;
  createdAt: string;
}

interface RSSFeedManagerProps {
  userId: string;
}

export const RSSFeedManager: React.FC<RSSFeedManagerProps> = ({ userId }) => {
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');

  // Load user's RSS feeds
  useEffect(() => {
    loadFeeds();
  }, [userId]);

  const loadFeeds = async () => {
    try {
      const deviceId = localStorage.getItem('deviceId');
      const params = new URLSearchParams();
      if (deviceId) params.append('deviceId', deviceId);
      
      const response = await fetch(`/api/rss?${params}`);
      if (response.ok) {
        const data = await response.json();
        setFeeds(data.feeds);
      }
    } catch (error) {
      console.error('Failed to load RSS feeds:', error);
    }
  };

  const addFeed = async () => {
    if (!newFeedUrl.trim()) return;
    
    setProcessing(true);
    setMessage('');
    
    try {
      // 먼저 URL 유효성 검사
      const validateResponse = await fetch('/api/rss/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newFeedUrl })
      });
      
      const validateData = await validateResponse.json();
      
      if (!validateData.valid) {
        setMessage(`❌ ${validateData.error}`);
        return;
      }
      
      // RSS 피드 추가
      const deviceId = localStorage.getItem('deviceId');
      const response = await fetch('/api/rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: newFeedUrl,
          name: validateData.feedInfo?.title,
          deviceId 
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage(`✅ ${data.message}`);
        setNewFeedUrl('');
        loadFeeds(); // Reload feeds
        
        // 피드에서 뉴스 수집
        fetch('/api/rss/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            feedId: data.feed.id,
            deviceId 
          })
        });
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Failed to add RSS feed');
    } finally {
      setProcessing(false);
    }
  };

  const toggleFeed = async (feedId: string, enabled: boolean) => {
    try {
      const deviceId = localStorage.getItem('deviceId');
      const response = await fetch('/api/rss', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId, enabled, deviceId })
      });
      
      if (response.ok) {
        loadFeeds();
      }
    } catch (error) {
      console.error('Failed to update feed:', error);
    }
  };

  const deleteFeed = async (feedId: string) => {
    if (!confirm('이 RSS 피드를 삭제하시겠습니까?')) return;
    
    try {
      const deviceId = localStorage.getItem('deviceId');
      const params = new URLSearchParams({ feedId });
      if (deviceId) params.append('deviceId', deviceId);
      
      const response = await fetch(`/api/rss?${params}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        loadFeeds();
        setMessage('✅ RSS 피드가 삭제되었습니다');
      }
    } catch (error) {
      console.error('Failed to delete feed:', error);
    }
  };

  const updateAllFeeds = async () => {
    setUpdating(true);
    setMessage('');
    
    try {
      const deviceId = localStorage.getItem('deviceId');
      const response = await fetch('/api/rss/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage(`✅ ${data.totalProcessed}개의 새 뉴스를 가져왔습니다`);
        // 3초 후 메시지 제거
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ 피드 업데이트에 실패했습니다');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3>RSS 피드 관리</h3>
      
      {/* Add new feed */}
      <div className={styles.addFeed}>
        <input
          type="url"
          placeholder="RSS 피드 URL을 입력하세요 (예: https://example.com/rss)"
          value={newFeedUrl}
          onChange={(e) => setNewFeedUrl(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addFeed()}
          disabled={processing}
        />
        <button onClick={addFeed} disabled={processing || !newFeedUrl.trim()}>
          {processing ? '처리 중...' : '피드 추가'}
        </button>
      </div>
      
      {message && (
        <div className={styles.message}>{message}</div>
      )}
      
      {/* Feed list header with update button */}
      {feeds.length > 0 && (
        <div className={styles.feedListHeader}>
          <h4>등록된 RSS 피드</h4>
          <button 
            className={styles.updateAllButton}
            onClick={updateAllFeeds}
            disabled={updating}
          >
            {updating ? '업데이트 중...' : '모든 피드 업데이트'}
          </button>
        </div>
      )}
      
      {/* Feed list */}
      <div className={styles.feedList}>
        {feeds.length === 0 ? (
          <p className={styles.empty}>RSS 피드가 없습니다. 위에서 추가해주세요.</p>
        ) : (
          feeds.map(feed => (
            <div key={feed.id} className={styles.feedItem}>
              <div className={styles.feedInfo}>
                <h4>{feed.name}</h4>
                <p>{feed.url}</p>
                <span className={styles.date}>
                  추가됨: {new Date(feed.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <div className={styles.feedActions}>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={feed.enabled}
                    onChange={(e) => toggleFeed(feed.id, e.target.checked)}
                  />
                  <span>{feed.enabled ? '활성' : '비활성'}</span>
                </label>
                <button 
                  className={styles.deleteButton}
                  onClick={() => deleteFeed(feed.id)}
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Sample RSS feeds */}
      <div className={styles.samples}>
        <h4>추천 RSS 피드</h4>
        <ul>
          <li>BBC News: https://feeds.bbci.co.uk/news/rss.xml</li>
          <li>CNN Top Stories: http://rss.cnn.com/rss/cnn_topstories.rss</li>
          <li>TechCrunch: https://techcrunch.com/feed/</li>
          <li>The Verge: https://www.theverge.com/rss/index.xml</li>
        </ul>
      </div>
    </div>
  );
};