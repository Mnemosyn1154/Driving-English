'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface ApiMetricsData {
  endpoints: {
    [endpoint: string]: {
      count: number;
      avgDuration: number;
      errorRate: number;
      timeline: Array<{
        timestamp: string;
        duration: number;
        success: boolean;
      }>;
    };
  };
}

interface Props {
  data?: ApiMetricsData;
  timeRange: string;
}

export function ApiPerformanceChart({ data, timeRange }: Props) {
  if (!data || Object.keys(data.endpoints).length === 0) {
    return <div>데이터가 없습니다.</div>;
  }

  const colors = [
    'rgb(255, 99, 132)',
    'rgb(54, 162, 235)', 
    'rgb(255, 206, 86)',
    'rgb(75, 192, 192)',
    'rgb(153, 102, 255)',
    'rgb(255, 159, 64)'
  ];

  const datasets = Object.entries(data.endpoints).slice(0, 6).map(([endpoint, metrics], index) => {
    // Aggregate timeline data
    const aggregatedData = metrics.timeline.reduce((acc, item) => {
      const timeKey = new Date(item.timestamp).toISOString().slice(0, timeRange === '1h' ? 16 : 13);
      
      if (!acc[timeKey]) {
        acc[timeKey] = { durations: [], total: 0 };
      }
      
      acc[timeKey].durations.push(item.duration);
      acc[timeKey].total++;
      
      return acc;
    }, {} as any);

    const timeKeys = Object.keys(aggregatedData).sort();
    
    return {
      label: endpoint,
      data: timeKeys.map(key => ({
        x: key,
        y: aggregatedData[key].durations.reduce((a: number, b: number) => a + b, 0) / aggregatedData[key].durations.length
      })),
      borderColor: colors[index % colors.length],
      backgroundColor: colors[index % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
      tension: 0.1
    };
  });

  const chartData = {
    datasets
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#e0e0e0'
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const endpoint = context.dataset.label;
            const value = context.parsed.y;
            const endpointData = data.endpoints[endpoint];
            return [
              `${endpoint}: ${value.toFixed(2)}ms`,
              `에러율: ${(endpointData.errorRate * 100).toFixed(1)}%`,
              `총 요청: ${endpointData.count}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: timeRange === '1h' ? 'minute' : timeRange === '24h' ? 'hour' : 'day'
        },
        ticks: {
          color: '#a0a0a0'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      y: {
        ticks: {
          color: '#a0a0a0',
          callback: function(value: any) {
            return value + 'ms';
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    }
  };

  return (
    <div style={{ height: '400px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#e0e0e0' }}>상위 API 엔드포인트</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '12px' }}>
          {Object.entries(data.endpoints).slice(0, 6).map(([endpoint, metrics]) => (
            <div key={endpoint} style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{endpoint}</div>
              <div>평균: {metrics.avgDuration.toFixed(1)}ms</div>
              <div>에러율: {(metrics.errorRate * 100).toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>
      <Line data={chartData} options={options} />
    </div>
  );
}