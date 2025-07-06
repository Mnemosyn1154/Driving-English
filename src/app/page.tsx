import styles from './page.module.css';
import Link from 'next/link';

export default function Home() {
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
        
        <Link href="/news" className={styles.secondaryButton}>
          뉴스 목록 보기
        </Link>
      </div>

      <div className={styles.info}>
        <p className={styles.notice}>
          ⚠️ 운전 중에는 반드시 안전운전에 집중하세요. 
          이 서비스는 정차 중이거나 동승자가 조작할 때 사용하시기 바랍니다.
        </p>
      </div>
    </main>
  );
}