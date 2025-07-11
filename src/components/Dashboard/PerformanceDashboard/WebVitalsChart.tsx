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
import 'chartjs-adapter-date-fns';

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

interface WebVitalsData {
  lcp: Array<{ timestamp: string; value: number }>;
  fid: Array<{ timestamp: string; value: number }>;
  cls: Array<{ timestamp: string; value: number }>;
  fcp: Array<{ timestamp: string; value: number }>;
  ttfb: Array<{ timestamp: string; value: number }>;
}

interface Props {
  data?: WebVitalsData;
  timeRange: string;
}

export function WebVitalsChart({ data, timeRange }: Props) {
  if (!data) {
    return <div>데이터가 없습니다.</div>;
  }

  const chartData = {
    datasets: [
      {
        label: 'LCP (Largest Contentful Paint)',
        data: data.lcp.map(d => ({ x: d.timestamp, y: d.value })),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        tension: 0.1
      },
      {
        label: 'FID (First Input Delay)',
        data: data.fid.map(d => ({ x: d.timestamp, y: d.value })),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        tension: 0.1
      },
      {
        label: 'CLS (Cumulative Layout Shift)',
        data: data.cls.map(d => ({ x: d.timestamp, y: d.value * 1000 })), // Scale for visibility
        borderColor: 'rgb(255, 206, 86)',
        backgroundColor: 'rgba(255, 206, 86, 0.5)',
        tension: 0.1
      },
      {
        label: 'FCP (First Contentful Paint)',
        data: data.fcp.map(d => ({ x: d.timestamp, y: d.value })),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1
      },
      {
        label: 'TTFB (Time to First Byte)',
        data: data.ttfb.map(d => ({ x: d.timestamp, y: d.value })),
        borderColor: 'rgb(153, 102, 255)',
        backgroundColor: 'rgba(153, 102, 255, 0.5)',
        tension: 0.1
      }
    ]
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
      title: {
        display: false
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(2) + 'ms';
            }
            return label;
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
      <Line data={chartData} options={options} />
    </div>
  );
}