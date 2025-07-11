'use client';

import React, { useState, useEffect } from 'react';
import { VirtualScrollList } from './OptimizedComponents';

interface DataItem {
  id: number;
  name: string;
  value: number;
  status: 'active' | 'inactive' | 'pending';
  timestamp: string;
}

const DataTable: React.FC = () => {
  const [data, setData] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [useVirtualScroll, setUseVirtualScroll] = useState(true);

  useEffect(() => {
    // Simulate large dataset
    const timer = setTimeout(() => {
      const tableData = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `항목 ${i + 1}`,
        value: Math.floor(Math.random() * 10000),
        status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)] as DataItem['status'],
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      }));
      setData(tableData);
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4ade80';
      case 'inactive': return '#f87171';
      case 'pending': return '#fbbf24';
      default: return '#a0a0a0';
    }
  };

  const renderItem = (item: DataItem, index: number) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr 100px 80px 150px',
        gap: '15px',
        padding: '10px 15px',
        background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}
    >
      <div style={{ color: '#a0a0a0', fontSize: '0.9rem' }}>{item.id}</div>
      <div style={{ color: '#e0e0e0' }}>{item.name}</div>
      <div style={{ color: '#60a5fa', textAlign: 'right' }}>
        {item.value.toLocaleString()}
      </div>
      <div
        style={{
          color: getStatusColor(item.status),
          fontSize: '0.8rem',
          textAlign: 'center',
          padding: '4px 8px',
          borderRadius: '4px',
          background: `${getStatusColor(item.status)}20`
        }}
      >
        {item.status}
      </div>
      <div style={{ color: '#a0a0a0', fontSize: '0.8rem' }}>
        {new Date(item.timestamp).toLocaleDateString()}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ 
        height: '400px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        color: '#a0a0a0'
      }}>
        대용량 데이터 로딩 중...
      </div>
    );
  }

  return (
    <div style={{ 
      height: '400px', 
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <div style={{ 
        padding: '15px', 
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ color: '#e0e0e0', margin: 0 }}>
          데이터 테이블 ({data.length.toLocaleString()}개 항목)
        </h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e0e0e0' }}>
          <input
            type="checkbox"
            checked={useVirtualScroll}
            onChange={(e) => setUseVirtualScroll(e.target.checked)}
          />
          가상 스크롤 사용
        </label>
      </div>

      {/* Table Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60px 1fr 100px 80px 150px',
          gap: '15px',
          padding: '10px 15px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#e0e0e0',
          fontSize: '0.9rem',
          fontWeight: 600
        }}
      >
        <div>ID</div>
        <div>이름</div>
        <div style={{ textAlign: 'right' }}>값</div>
        <div style={{ textAlign: 'center' }}>상태</div>
        <div>날짜</div>
      </div>

      {/* Table Body */}
      <div style={{ height: 'calc(100% - 120px)' }}>
        {useVirtualScroll ? (
          <VirtualScrollList
            items={data}
            itemHeight={45}
            containerHeight={280}
            renderItem={renderItem}
          />
        ) : (
          <div style={{ height: '100%', overflow: 'auto' }}>
            {data.map((item, index) => (
              <div key={item.id} style={{ height: '45px' }}>
                {renderItem(item, index)}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        right: '10px', 
        background: useVirtualScroll ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
        color: useVirtualScroll ? '#4ade80' : '#f87171',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.8rem'
      }}>
        {useVirtualScroll ? '✓ 가상 스크롤' : '⚠ 전체 렌더링'}
      </div>
    </div>
  );
};

export default DataTable;