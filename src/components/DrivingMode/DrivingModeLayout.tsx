'use client';

import React, { ReactNode } from 'react';
import styles from './DrivingModeLayout.module.css';

interface DrivingModeLayoutProps {
  children: ReactNode;
  isDrivingMode: boolean;
}

export const DrivingModeLayout: React.FC<DrivingModeLayoutProps> = ({
  children,
  isDrivingMode,
}) => {
  return (
    <div className={`${styles.container} ${isDrivingMode ? styles.drivingMode : ''}`}>
      {isDrivingMode && (
        <div className={styles.drivingModeIndicator}>
          <span className={styles.indicator}>운전 모드</span>
        </div>
      )}
      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
};