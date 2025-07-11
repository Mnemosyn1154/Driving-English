'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface UserBehaviorData {
  pageViews: {
    [page: string]: number;
  };
  sessionDuration: {
    short: number; // < 30s
    medium: number; // 30s - 5m
    long: number; // > 5m
  };
  deviceTypes: {
    mobile: number;
    desktop: number;
  };
  bounceRate: number;
  avgSessionDuration: number;
  totalSessions: number;
}

interface Props {
  data?: UserBehaviorData;
  timeRange: string;
}

export function UserBehaviorChart({ data, timeRange }: Props) {
  if (!data) {
    return <div>데이터가 없습니다.</div>;
  }

  // Page Views Chart Data
  const pageViewsData = {
    labels: Object.keys(data.pageViews),
    datasets: [
      {
        data: Object.values(data.pageViews),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40'
        ],
        borderWidth: 0
      }
    ]
  };

  // Session Duration Chart Data
  const sessionDurationData = {
    labels: ['짧은 세션 (<30초)', '보통 세션 (30초-5분)', '긴 세션 (>5분)'],
    datasets: [
      {
        data: [data.sessionDuration.short, data.sessionDuration.medium, data.sessionDuration.long],
        backgroundColor: ['#FF6384', '#FFCE56', '#4BC0C0'],
        borderWidth: 0
      }
    ]
  };

  // Device Types Chart Data
  const deviceTypesData = {
    labels: ['모바일', '데스크톱'],
    datasets: [
      {
        data: [data.deviceTypes.mobile, data.deviceTypes.desktop],
        backgroundColor: ['#36A2EB', '#9966FF'],
        borderWidth: 0
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#e0e0e0',
          padding: 20
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  return (
    <div style={{ height: '400px' }}>
      {/* Summary Stats */}
      <div style={{ 
        marginBottom: '20px', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
        gap: '10px', 
        fontSize: '12px' 
      }}>
        <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
          <div style={{ fontWeight: 'bold', color: '#4BC0C0' }}>{data.totalSessions}</div>
          <div>총 세션</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
          <div style={{ fontWeight: 'bold', color: '#FFCE56' }}>{(data.avgSessionDuration / 60).toFixed(1)}분</div>
          <div>평균 세션</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
          <div style={{ fontWeight: 'bold', color: data.bounceRate > 0.5 ? '#FF6384' : '#4BC0C0' }}>
            {(data.bounceRate * 100).toFixed(1)}%
          </div>
          <div>이탈률</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '20px', 
        height: 'calc(100% - 100px)' 
      }}>
        <div>
          <h5 style={{ margin: '0 0 10px 0', textAlign: 'center', color: '#e0e0e0' }}>페이지뷰</h5>
          <Doughnut data={pageViewsData} options={chartOptions} />
        </div>
        
        <div>
          <h5 style={{ margin: '0 0 10px 0', textAlign: 'center', color: '#e0e0e0' }}>세션 길이</h5>
          <Doughnut data={sessionDurationData} options={chartOptions} />
        </div>
        
        <div>
          <h5 style={{ margin: '0 0 10px 0', textAlign: 'center', color: '#e0e0e0' }}>기기 유형</h5>
          <Doughnut data={deviceTypesData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
}