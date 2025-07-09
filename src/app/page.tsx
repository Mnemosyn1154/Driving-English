'use client';

import styles from './page.module.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NewsList } from '@/components/NewsList';
import { AuthModal } from '@/components/Auth/AuthModal';
import { NewsSelector } from '@/components/NewsSelector/NewsSelector';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';

export default function Home() {
  const { user, loading, signOut, isAuthenticated } = useAuth();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showNewsSelector, setShowNewsSelector] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    // 디바이스 ID 생성 또는 가져오기
    let id = localStorage.getItem('deviceId');
    if (!id) {
      id = 'device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('deviceId', id);
    }
    setDeviceId(id);
  }, []);

  return (
    <main className={styles.main}>
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          <div className={styles.logo}>Driving English</div>
          <div className={styles.authSection}>
          {loading ? (
            <span>로딩중...</span>
          ) : user ? (
            <div className={styles.userInfo}>
              <span>👤 {user.email}</span>
              <button onClick={signOut} className={styles.logoutButton}>
                로그아웃
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)} 
              className={styles.loginButton}
            >
              로그인
            </button>
          )}
          </div>
        </div>
      </nav>
      <div className={styles.hero}>
        <h1 className={styles.title}>Driving English</h1>
        <p className={styles.subtitle}>
          운전하며 배우는 AI 영어 뉴스 서비스
        </p>
        <div className={styles.ctaSection}>
          <button
            className={styles.ctaButton}
            onClick={() => {
              if (user || localStorage.getItem('skipAuth') === 'true') {
                router.push('/dashboard');
              } else {
                setShowAuthModal(true);
              }
            }}
          >
            🚀 시작하기
          </button>
          <p className={styles.ctaText}>
            로그인 후 개인화된 학습 경험을 시작하세요
          </p>
        </div>
      </div>

      <div className={styles.features}>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>🎙️</div>
          <h3>음성 직접 인식</h3>
          <p>STT 변환 없이 AI가 직접 음성을 이해합니다</p>
        </div>
        
        <div className={styles.feature}>
          <div className={styles.featureIcon}>📰</div>
          <h3>실시간 뉴스</h3>
          <p>매일 업데이트되는 최신 영어 뉴스로 학습</p>
        </div>
        
        <div className={styles.feature}>
          <div className={styles.featureIcon}>🚗</div>
          <h3>운전 안전 모드</h3>
          <p>운전 중에도 안전하게 사용할 수 있는 UI/UX</p>
        </div>
      </div>

      <div className={styles.actions}>
        <button 
          className={styles.primaryButton}
          onClick={() => {
            if (isAuthenticated) {
              router.push('/learn');
            } else {
              setShowAuthModal(true);
            }
          }}
        >
          🎧 경험해보기
        </button>
        
        <Link href="/test-wakeword" className={styles.secondaryButton}>
          🎤 음성 인식 테스트
        </Link>
      </div>

      <section className={styles.newsSection}>
        <div className={styles.newsSectionHeader}>
          <h2 className={styles.sectionTitle}>최신 뉴스</h2>
          <button 
            className={styles.personalizeButton}
            onClick={() => setShowNewsSelector(true)}
          >
            ⚙️ 개인화 설정
          </button>
        </div>
        <NewsList />
      </section>

      <div className={styles.info}>
        <p className={styles.notice}>
          ⚠️ 운전 중에는 반드시 안전운전에 집중하세요. 
          이 서비스는 정차 중이거나 동승자가 조작할 때 사용하시기 바랍니다.
        </p>
      </div>

      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          router.push('/dashboard');
        }}
      />

      {showNewsSelector && (
        <div className={styles.modalOverlay}>
          <NewsSelector onClose={() => setShowNewsSelector(false)} />
        </div>
      )}
    </main>
  );
}