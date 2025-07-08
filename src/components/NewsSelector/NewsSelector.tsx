'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { userService } from '@/lib/user-service';
import styles from './NewsSelector.module.css';

interface NewsSelectorProps {
  onClose?: () => void;
}

export const NewsSelector: React.FC<NewsSelectorProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [rssFeedUrl, setRssFeedUrl] = useState('');
  const [rssFeedName, setRssFeedName] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const categories = [
    { id: 'technology', name: '기술', emoji: '💻' },
    { id: 'business', name: '비즈니스', emoji: '💼' },
    { id: 'science', name: '과학', emoji: '🔬' },
    { id: 'health', name: '건강', emoji: '🏥' },
    { id: 'sports', name: '스포츠', emoji: '⚽' },
    { id: 'entertainment', name: '엔터테인먼트', emoji: '🎬' },
    { id: 'world', name: '국제', emoji: '🌍' },
    { id: 'politics', name: '정치', emoji: '🏛️' },
  ];

  const difficultyLevels = [
    { level: 1, name: '초급', description: '기초 어휘와 간단한 문장' },
    { level: 2, name: '초중급', description: '일상적인 어휘와 쉬운 구조' },
    { level: 3, name: '중급', description: '다양한 어휘와 표준 문장' },
    { level: 4, name: '중상급', description: '전문 어휘와 복잡한 구조' },
    { level: 5, name: '상급', description: '고급 어휘와 학술적 표현' },
  ];

  // 기존 선호도 불러오기
  useEffect(() => {
    if (user) {
      // TODO: 사용자 선호도 불러오기 API 호출
      // 임시로 로컬 스토리지에서 가져오기
      const saved = localStorage.getItem('newsPreferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        setSelectedCategories(prefs.categories || []);
        setSelectedLevel(prefs.level || 3);
        setKeywords(prefs.keywords || []);
      }
    }
  }, [user]);

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

  const savePreferences = async () => {
    setLoading(true);
    setSavedMessage('');

    try {
      // 로컬 스토리지에 저장 (임시)
      const preferences = {
        categories: selectedCategories,
        level: selectedLevel,
        keywords,
      };
      localStorage.setItem('newsPreferences', JSON.stringify(preferences));

      // 사용자가 로그인한 경우 서버에 저장
      if (user) {
        const deviceId = localStorage.getItem('deviceId');
        const dbUser = await userService.ensureUser(user, deviceId || undefined);
        
        await userService.updatePreferences(dbUser.id, {
          preferredLevel: selectedLevel,
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

  const addRssFeed = async () => {
    if (!rssFeedUrl.trim() || !rssFeedName.trim()) return;
    
    try {
      if (user) {
        const deviceId = localStorage.getItem('deviceId');
        const dbUser = await userService.ensureUser(user, deviceId || undefined);
        await userService.addRssFeed(dbUser.id, {
          name: rssFeedName,
          url: rssFeedUrl,
        });
      }
      
      // 로컬에도 저장
      const feeds = JSON.parse(localStorage.getItem('customRssFeeds') || '[]');
      feeds.push({ name: rssFeedName, url: rssFeedUrl });
      localStorage.setItem('customRssFeeds', JSON.stringify(feeds));
      
      setRssFeedUrl('');
      setRssFeedName('');
      setSavedMessage('RSS 피드가 추가되었습니다!');
    } catch (error) {
      console.error('Failed to add RSS feed:', error);
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

      {/* 카테고리 선택 */}
      <section className={styles.section}>
        <h3>관심 카테고리</h3>
        <p className={styles.description}>선호하는 뉴스 카테고리를 선택하세요</p>
        <div className={styles.categoryGrid}>
          {categories.map(category => (
            <button
              key={category.id}
              className={`${styles.categoryCard} ${selectedCategories.includes(category.id) ? styles.selected : ''}`}
              onClick={() => toggleCategory(category.id)}
            >
              <span className={styles.emoji}>{category.emoji}</span>
              <span className={styles.name}>{category.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 난이도 선택 */}
      <section className={styles.section}>
        <h3>영어 난이도</h3>
        <p className={styles.description}>현재 영어 실력에 맞는 난이도를 선택하세요</p>
        <div className={styles.levelList}>
          {difficultyLevels.map(level => (
            <label
              key={level.level}
              className={`${styles.levelOption} ${selectedLevel === level.level ? styles.selected : ''}`}
            >
              <input
                type="radio"
                name="difficulty"
                value={level.level}
                checked={selectedLevel === level.level}
                onChange={() => setSelectedLevel(level.level)}
              />
              <div className={styles.levelInfo}>
                <strong>{level.name}</strong>
                <span>{level.description}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* 키워드 설정 */}
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

      {/* RSS 피드 추가 */}
      <section className={styles.section}>
        <h3>커스텀 RSS 피드</h3>
        <p className={styles.description}>원하는 뉴스 사이트의 RSS 피드를 추가하세요</p>
        <div className={styles.rssInput}>
          <input
            type="text"
            placeholder="RSS 피드 이름"
            value={rssFeedName}
            onChange={(e) => setRssFeedName(e.target.value)}
          />
          <input
            type="url"
            placeholder="RSS 피드 URL"
            value={rssFeedUrl}
            onChange={(e) => setRssFeedUrl(e.target.value)}
          />
          <button onClick={addRssFeed}>추가</button>
        </div>
      </section>

      {/* 저장 버튼 */}
      <div className={styles.footer}>
        {savedMessage && (
          <p className={styles.savedMessage}>{savedMessage}</p>
        )}
        <button
          className={styles.saveButton}
          onClick={savePreferences}
          disabled={loading || selectedCategories.length === 0}
        >
          {loading ? '저장 중...' : '설정 저장하기'}
        </button>
      </div>
    </div>
  );
};