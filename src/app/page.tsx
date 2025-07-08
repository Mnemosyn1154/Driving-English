import styles from './page.module.css';
import Link from 'next/link';
import { NewsList } from '@/components/NewsList';

// 서버에서 데이터를 가져오는 함수
async function getArticles() {
  try {
    // 실제 API 엔드포인트로 변경 필요
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/news/articles?limit=10`, {
      cache: 'no-store' // 항상 최신 데이터를 가져오도록 설정
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch articles');
    }
    
    const data = await response.json();
    return data.articles || [];
  } catch (error) {
    console.error('Error fetching articles:', error);
    return [];
  }
}

export default async function Home() {
  const articles = await getArticles();
  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Driving English</h1>
        <p className={styles.subtitle}>
          운전하며 배우는 AI 영어 뉴스 서비스
        </p>
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
        <Link href="/driving" className={styles.primaryButton}>
          운전 모드 시작하기
        </Link>
        
        <Link href="/test-wakeword" className={styles.secondaryButton}>
          음성 인식 테스트
        </Link>
      </div>

      <section className={styles.newsSection}>
        <h2 className={styles.sectionTitle}>최신 뉴스</h2>
        <NewsList initialArticles={articles} />
      </section>

      <div className={styles.info}>
        <p className={styles.notice}>
          ⚠️ 운전 중에는 반드시 안전운전에 집중하세요. 
          이 서비스는 정차 중이거나 동승자가 조작할 때 사용하시기 바랍니다.
        </p>
      </div>
    </main>
  );
}