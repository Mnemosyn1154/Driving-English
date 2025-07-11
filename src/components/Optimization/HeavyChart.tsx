'use client';

import React, { useEffect, useState } from 'react';

// Simulated heavy chart component
const HeavyChart: React.FC = () => {
  const [data, setData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate heavy data processing
    const timer = setTimeout(() => {
      const chartData = Array.from({ length: 100 }, (_, i) => 
        Math.sin(i * 0.1) * 50 + Math.random() * 20
      );
      setData(chartData);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div style={{ 
        height: '300px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        color: '#a0a0a0'
      }}>
        차트 데이터 처리 중...
      </div>
    );
  }

  return (
    <div style={{ 
      height: '300px', 
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <h3 style={{ color: '#e0e0e0', marginBottom: '20px' }}>
        성능 메트릭 차트 (지연 로딩됨)
      </h3>
      <svg width="100%" height="200" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        
        <polyline
          points={data.map((value, index) => 
            `${(index / data.length) * 100}%,${((100 - value) / 100) * 200}`
          ).join(' ')}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
        />
        
        <polygon
          points={[
            '0%,200',
            ...data.map((value, index) => 
              `${(index / data.length) * 100}%,${((100 - value) / 100) * 200}`
            ),
            '100%,200'
          ].join(' ')}
          fill="url(#chartGradient)"
        />
      </svg>
      
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        right: '10px', 
        background: 'rgba(34, 197, 94, 0.2)',
        color: '#4ade80',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.8rem'
      }}>
        ✓ 최적화됨
      </div>
    </div>
  );
};

export default HeavyChart;