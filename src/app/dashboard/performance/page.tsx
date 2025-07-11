'use client';

import React from 'react';
import { withAuth } from '@/components/Auth/withAuth';
import { PerformanceDashboard } from '@/components/Dashboard/PerformanceDashboard';
import styles from './page.module.css';

function PerformancePage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>성능 모니터링 대시보드</h1>
        <p>실시간 애플리케이션 성능 메트릭</p>
      </header>
      
      <PerformanceDashboard />
    </div>
  );
}

export default withAuth(PerformancePage, { requireAdmin: true });