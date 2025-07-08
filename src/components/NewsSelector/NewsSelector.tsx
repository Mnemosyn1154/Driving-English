'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/lib/user-service';
import { RECOMMENDED_RSS_FEEDS, CATEGORY_LABELS } from '@/data/recommended-rss-feeds';
import styles from './NewsSelector.module.css';

interface NewsSelectorProps {
  onClose?: () => void;
}

interface RSSFeed {
  id: string;
  name: string;
  url: string;
  category?: string;
  enabled: boolean;
  createdAt: string;
}

type TabType = 'categories' | 'keywords' | 'rss';

export const NewsSelector: React.FC<NewsSelectorProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('categories');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  
  // RSS 피드 관련 상태
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [newFeedName, setNewFeedName] = useState('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedCategory, setNewFeedCategory] = useState('general');
  const [validatingUrl, setValidatingUrl] = useState(false);
  const [urlValidation, setUrlValidation] = useState<{ valid: boolean; message: string } | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedMessage, setFeedMessage] = useState('');

  const categories = [
    { 
      id: 'technology', 
      name: '기술', 
      emoji: '💻',
      examples: 'TechCrunch, The Verge, Wired'
    },
    { 
      id: 'business', 
      name: '비즈니스', 
      emoji: '💼',
      examples: 'Bloomberg, Financial Times, WSJ'
    },
    { 
      id: 'science', 
      name: '과학', 
      emoji: '🔬',
      examples: 'Science Daily, Nature News, New Scientist'
    },
    { 
      id: 'health', 
      name: '건강', 
      emoji: '🏥',
      examples: 'Health News, Medical News Today'
    },
    { 
      id: 'sports', 
      name: '스포츠', 
      emoji: '⚽',
      examples: 'ESPN, BBC Sport, The Athletic'
    },
    { 
      id: 'entertainment', 
      name: '엔터테인먼트', 
      emoji: '🎬',
      examples: 'Variety, Hollywood Reporter, Entertainment Weekly'
    },
    { 
      id: 'world', 
      name: '국제', 
      emoji: '🌍',
      examples: 'BBC News, Reuters, Al Jazeera'
    },
    { 
      id: 'politics', 
      name: '정치', 
      emoji: '🏛️',
      examples: 'Politico, The Hill, Foreign Policy'
    },
  ];

  // RSS 카테고리별 선택 상태
  const [selectedRssCategory, setSelectedRssCategory] = useState<string | null>(null);
  const [selectedFeeds, setSelectedFeeds] = useState<Set<string>>(new Set());
  const [showCustomForm, setShowCustomForm] = useState(false);


  // 기존 선호도 불러오기
  useEffect(() => {
    if (user) {
      // TODO: 사용자 선호도 불러오기 API 호출
      // 임시로 로컬 스토리지에서 가져오기
      const saved = localStorage.getItem('newsPreferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        setSelectedCategories(prefs.categories || []);
        setKeywords(prefs.keywords || []);
      }
    }
    
    // RSS 피드 불러오기
    loadFeeds();
  }, [user]);

  // RSS 피드 불러오기
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

  // URL 유효성 검사 (디바운스)
  useEffect(() => {
    if (!newFeedUrl) {
      setUrlValidation(null);
      return;
    }

    const timer = setTimeout(async () => {
      setValidatingUrl(true);
      try {
        const response = await fetch('/api/rss/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: newFeedUrl })
        });
        
        const data = await response.json();
        
        if (data.valid) {
          setUrlValidation({ valid: true, message: '✅ 유효한 RSS 피드입니다' });
          if (!newFeedName && data.feedInfo?.title) {
            setNewFeedName(data.feedInfo.title);
          }
        } else {
          setUrlValidation({ valid: false, message: `❌ ${data.error}` });
        }
      } catch (error) {
        setUrlValidation({ valid: false, message: '❌ URL 검증 중 오류가 발생했습니다' });
      } finally {
        setValidatingUrl(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [newFeedUrl]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  // RSS 피드 추가
  const addRssFeed = async () => {
    if (!newFeedUrl || !urlValidation?.valid) return;
    
    setFeedLoading(true);
    setFeedMessage('');
    
    try {
      const deviceId = localStorage.getItem('deviceId');
      const response = await fetch('/api/rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: newFeedUrl,
          name: newFeedName || new URL(newFeedUrl).hostname,
          category: newFeedCategory,
          deviceId 
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setFeedMessage('✅ RSS 피드가 추가되었습니다');
        setNewFeedName('');
        setNewFeedUrl('');
        setNewFeedCategory('general');
        loadFeeds();
        
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
        setFeedMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setFeedMessage('❌ RSS 피드 추가에 실패했습니다');
    } finally {
      setFeedLoading(false);
      setTimeout(() => setFeedMessage(''), 3000);
    }
  };

  // RSS 피드 토글
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

  // RSS 피드 삭제
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
        setFeedMessage('✅ RSS 피드가 삭제되었습니다');
        setTimeout(() => setFeedMessage(''), 3000);
      }
    } catch (error) {
      console.error('Failed to delete feed:', error);
    }
  };

  // 선택된 피드 토글
  const toggleFeedSelection = (url: string) => {
    const newSelection = new Set(selectedFeeds);
    if (newSelection.has(url)) {
      newSelection.delete(url);
    } else {
      newSelection.add(url);
    }
    setSelectedFeeds(newSelection);
  };

  // 선택된 피드들 한번에 추가
  const addSelectedFeeds = async () => {
    if (selectedFeeds.size === 0 || !selectedRssCategory) return;
    
    setFeedLoading(true);
    setFeedMessage('');
    
    try {
      const deviceId = localStorage.getItem('deviceId');
      const feedsToAdd = Array.from(selectedFeeds).map(url => {
        const feed = RECOMMENDED_RSS_FEEDS[selectedRssCategory].find(f => f.url === url);
        return {
          url,
          name: feed?.name || '',
          category: selectedRssCategory,
        };
      });
      
      // 다중 RSS 피드 추가 API 호출
      const response = await fetch('/api/rss/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeds: feedsToAdd, deviceId })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const { results } = data;
        if (results.added.length > 0) {
          setFeedMessage(`✅ ${results.added.length}개의 RSS 피드가 추가되었습니다`);
        }
        if (results.skipped.length > 0) {
          console.log('Skipped feeds:', results.skipped);
        }
        if (results.errors.length > 0) {
          console.error('Feed errors:', results.errors);
        }
        
        setSelectedFeeds(new Set());
        setSelectedRssCategory(null);
        loadFeeds();
      } else {
        setFeedMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setFeedMessage('❌ RSS 피드 추가에 실패했습니다');
    } finally {
      setFeedLoading(false);
      setTimeout(() => setFeedMessage(''), 3000);
    }
  };

  const savePreferences = async () => {
    setLoading(true);
    setSavedMessage('');

    try {
      // 로컬 스토리지에 저장 (임시)
      const preferences = {
        categories: selectedCategories,
        keywords,
      };
      localStorage.setItem('newsPreferences', JSON.stringify(preferences));

      // 사용자가 로그인한 경우 서버에 저장
      if (user) {
        const deviceId = localStorage.getItem('deviceId');
        const dbUser = await userService.ensureUser(user, deviceId || undefined);
        
        await userService.updatePreferences(dbUser.id, {
          categories: selectedCategories,
        });

        // 키워드 저장
        for (const keyword of keywords) {
          await userService.addKeyword(dbUser.id, keyword);
        }
      }

      setSavedMessage('선호도가 저장되었습니다!');
      setTimeout(() => {
        setSavedMessage('');
        if (onClose) onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setSavedMessage('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>뉴스 개인화 설정</h2>
        {onClose && (
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'categories' ? styles.active : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          카테고리
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'keywords' ? styles.active : ''}`}
          onClick={() => setActiveTab('keywords')}
        >
          키워드
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'rss' ? styles.active : ''}`}
          onClick={() => setActiveTab('rss')}
        >
          RSS 피드
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      <div className={styles.tabContent}>
        {/* 카테고리 탭 */}
        {activeTab === 'categories' && (
          <section className={styles.section}>
            <h3>관심 카테고리</h3>
            <p className={styles.description}>선호하는 뉴스 카테고리를 선택하세요</p>
            
            {/* 카테고리 선택의 이점 설명 */}
            <div className={styles.benefitsBox}>
              <h4>🎯 카테고리를 선택하면...</h4>
              <ul className={styles.benefitsList}>
                <li>음성 검색 시 관련 뉴스가 우선 표시됩니다</li>
                <li>선택한 분야의 고품질 RSS 피드를 추천받을 수 있습니다</li>
                <li>대시보드에서 맞춤형 뉴스를 자동으로 큐레이션합니다</li>
                <li>관심 분야의 전문 용어와 표현을 집중적으로 학습할 수 있습니다</li>
              </ul>
            </div>
            
            <div className={styles.categoryGrid}>
              {categories.map(category => (
                <button
                  key={category.id}
                  className={`${styles.categoryCard} ${selectedCategories.includes(category.id) ? styles.selected : ''}`}
                  onClick={() => toggleCategory(category.id)}
                  title={`예시: ${category.examples}`}
                >
                  <span className={styles.emoji}>{category.emoji}</span>
                  <span className={styles.name}>{category.name}</span>
                  <span className={styles.tooltip}>📰 {category.examples}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 키워드 탭 */}
        {activeTab === 'keywords' && (
          <section className={styles.section}>
            <h3>관심 키워드</h3>
            <p className={styles.description}>특정 주제나 키워드를 추가하세요</p>
            <div className={styles.keywordInput}>
              <input
                type="text"
                placeholder="예: AI, 전기차, 스타트업"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
              />
              <button onClick={addKeyword}>추가</button>
            </div>
            <div className={styles.keywordList}>
              {keywords.map(keyword => (
                <span key={keyword} className={styles.keyword}>
                  {keyword}
                  <button onClick={() => removeKeyword(keyword)}>×</button>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* RSS 피드 탭 */}
        {activeTab === 'rss' && (
          <section className={styles.section}>
            <h3>RSS 피드 관리</h3>
            <p className={styles.description}>카테고리별로 추천되는 RSS 피드를 선택하거나 직접 추가하세요</p>
            
            {feedMessage && (
              <p className={feedMessage.includes('✅') ? styles.successMessage : styles.errorMessage}>
                {feedMessage}
              </p>
            )}

            {/* 카테고리별 추천 RSS */}
            {!showCustomForm && (
              <div className={styles.recommendedSection}>
                <h4>카테고리별 추천 RSS 피드</h4>
                
                {/* 카테고리 선택 */}
                <div className={styles.categoryCards}>
                  {Object.keys(RECOMMENDED_RSS_FEEDS).map(categoryKey => (
                    <button
                      key={categoryKey}
                      className={`${styles.categoryCard} ${selectedRssCategory === categoryKey ? styles.selected : ''}`}
                      onClick={() => {
                        setSelectedRssCategory(categoryKey);
                        setSelectedFeeds(new Set());
                      }}
                    >
                      <span className={styles.emoji}>
                        {categories.find(c => c.id === categoryKey)?.emoji || '📰'}
                      </span>
                      <span className={styles.name}>{CATEGORY_LABELS[categoryKey]}</span>
                    </button>
                  ))}
                </div>

                {/* 선택된 카테고리의 RSS 피드 목록 */}
                {selectedRssCategory && (
                  <div className={styles.feedsList}>
                    <h5>{CATEGORY_LABELS[selectedRssCategory]} RSS 피드</h5>
                    <div className={styles.feedCheckboxList}>
                      {RECOMMENDED_RSS_FEEDS[selectedRssCategory].map((feed, index) => {
                        const isAlreadyAdded = feeds.some(f => f.url === feed.url);
                        return (
                          <label
                            key={index}
                            className={`${styles.feedCheckbox} ${isAlreadyAdded ? styles.disabled : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedFeeds.has(feed.url)}
                              onChange={() => !isAlreadyAdded && toggleFeedSelection(feed.url)}
                              disabled={isAlreadyAdded}
                            />
                            <div className={styles.feedCheckboxInfo}>
                              <strong>{feed.name}</strong>
                              <span>{feed.description}</span>
                              {isAlreadyAdded && <span className={styles.addedLabel}>이미 추가됨</span>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    
                    {selectedFeeds.size > 0 && (
                      <button
                        className={styles.addSelectedButton}
                        onClick={addSelectedFeeds}
                        disabled={feedLoading}
                      >
                        {feedLoading ? '추가 중...' : `선택한 ${selectedFeeds.size}개 피드 추가`}
                      </button>
                    )}
                  </div>
                )}

                <button
                  className={styles.customFeedButton}
                  onClick={() => setShowCustomForm(true)}
                >
                  🔗 직접 RSS 피드 추가하기
                </button>
              </div>
            )}

            {/* 커스텀 RSS 피드 추가 폼 */}
            {showCustomForm && (
              <div className={styles.customFeedSection}>
                <button
                  className={styles.backButton}
                  onClick={() => {
                    setShowCustomForm(false);
                    setNewFeedUrl('');
                    setNewFeedName('');
                    setUrlValidation(null);
                  }}
                >
                  ← 추천 피드로 돌아가기
                </button>
                
                <h4>커스텀 RSS 피드 추가</h4>
                <div className={styles.rssForm}>
                  <div className={styles.formRow}>
                    <input
                      type="text"
                      placeholder="피드 이름 (예: BBC 테크놀로지)"
                      value={newFeedName}
                      onChange={(e) => setNewFeedName(e.target.value)}
                      className={styles.formInput}
                    />
                    <select
                      value={newFeedCategory}
                      onChange={(e) => setNewFeedCategory(e.target.value)}
                      className={styles.formSelect}
                    >
                      <option value="general">일반</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formRow}>
                    <input
                      type="url"
                      placeholder="RSS 피드 URL (예: https://example.com/rss)"
                      value={newFeedUrl}
                      onChange={(e) => setNewFeedUrl(e.target.value)}
                      className={`${styles.formInput} ${styles.urlInput}`}
                    />
                    <button
                      onClick={addRssFeed}
                      disabled={feedLoading || !urlValidation?.valid}
                      className={styles.addButton}
                    >
                      {feedLoading ? '추가 중...' : '피드 추가'}
                    </button>
                  </div>
                  {validatingUrl && <p className={styles.validating}>🔄 URL 검증 중...</p>}
                  {urlValidation && (
                    <p className={urlValidation.valid ? styles.validMessage : styles.errorMessage}>
                      {urlValidation.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 사용자 RSS 피드 목록 */}
            <div className={styles.userFeeds}>
              <h4>내 RSS 피드</h4>
              {feeds.length === 0 ? (
                <p className={styles.empty}>등록된 RSS 피드가 없습니다</p>
              ) : (
                <div className={styles.feedsList}>
                  {feeds.map(feed => (
                    <div key={feed.id} className={styles.feedItem}>
                      <div className={styles.feedInfo}>
                        <h5>{feed.name}</h5>
                        <p>{feed.url}</p>
                        <span className={styles.feedDate}>
                          추가일: {new Date(feed.createdAt).toLocaleDateString('ko-KR')}
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
                          onClick={() => deleteFeed(feed.id)}
                          className={styles.deleteButton}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* 저장 버튼 */}
      <div className={styles.footer}>
        {savedMessage && (
          <p className={styles.savedMessage}>{savedMessage}</p>
        )}
        <button
          className={styles.saveButton}
          onClick={savePreferences}
          disabled={loading || (selectedCategories.length === 0 && keywords.length === 0)}
        >
          {loading ? '저장 중...' : '설정 저장하기'}
        </button>
      </div>
    </div>
  );
};