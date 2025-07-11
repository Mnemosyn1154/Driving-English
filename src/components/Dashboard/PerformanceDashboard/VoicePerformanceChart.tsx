'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface VoiceMetricsData {
  sttSuccessRate: number;
  ttsSuccessRate: number;
  avgSttDuration: number;
  avgTtsDuration: number;
  totalSttCalls: number;
  totalTtsCalls: number;
  timeline: Array<{
    timestamp: string;
    sttDuration: number;
    ttsDuration: number;
    sttSuccess: boolean;
    ttsSuccess: boolean;
  }>;
}

interface Props {
  data?: VoiceMetricsData;
  timeRange: string;
}

export function VoicePerformanceChart({ data, timeRange }: Props) {
  if (!data) {
    return <div>데이터가 없습니다.</div>;
  }

  // Aggregate data by time intervals
  const aggregatedData = data.timeline.reduce((acc, item) => {
    const timeKey = new Date(item.timestamp).toISOString().slice(0, timeRange === '1h' ? 16 : 13);
    
    if (!acc[timeKey]) {
      acc[timeKey] = {
        sttDurations: [],
        ttsDurations: [],
        sttSuccesses: 0,
        ttsSuccesses: 0,
        sttTotal: 0,
        ttsTotal: 0
      };
    }
    
    if (item.sttDuration > 0) {
      acc[timeKey].sttDurations.push(item.sttDuration);
      acc[timeKey].sttTotal++;
      if (item.sttSuccess) acc[timeKey].sttSuccesses++;
    }
    
    if (item.ttsDuration > 0) {
      acc[timeKey].ttsDurations.push(item.ttsDuration);
      acc[timeKey].ttsTotal++;
      if (item.ttsSuccess) acc[timeKey].ttsSuccesses++;
    }
    
    return acc;
  }, {} as any);

  const labels = Object.keys(aggregatedData).sort();
  
  const chartData = {
    labels: labels.map(label => new Date(label)),
    datasets: [
      {
        label: 'STT 평균 처리 시간 (ms)',
        data: labels.map(label => {
          const data = aggregatedData[label];
          const avg = data.sttDurations.length > 0 
            ? data.sttDurations.reduce((a: number, b: number) => a + b, 0) / data.sttDurations.length 
            : 0;
          return avg;
        }),
        backgroundColor: 'rgba(255, 99, 132, 0.8)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      },
      {
        label: 'TTS 평균 처리 시간 (ms)',
        data: labels.map(label => {
          const data = aggregatedData[label];
          const avg = data.ttsDurations.length > 0 
            ? data.ttsDurations.reduce((a: number, b: number) => a + b, 0) / data.ttsDurations.length 
            : 0;
          return avg;
        }),
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
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
      tooltip: {
        callbacks: {
          afterLabel: (context: any) => {
            const label = context.datasetIndex === 0 ? 'STT' : 'TTS';
            const dataPoint = aggregatedData[labels[context.dataIndex]];
            const successRate = context.datasetIndex === 0 
              ? (dataPoint.sttSuccesses / dataPoint.sttTotal * 100).toFixed(1)
              : (dataPoint.ttsSuccesses / dataPoint.ttsTotal * 100).toFixed(1);
            return `성공률: ${successRate}%`;
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
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-around', fontSize: '14px' }}>
        <div>
          <strong>STT 성공률:</strong> {data.sttSuccessRate.toFixed(1)}%
        </div>
        <div>
          <strong>TTS 성공률:</strong> {data.ttsSuccessRate.toFixed(1)}%
        </div>
        <div>
          <strong>총 요청:</strong> STT {data.totalSttCalls}, TTS {data.totalTtsCalls}
        </div>
      </div>
      <Bar data={chartData} options={options} />
    </div>
  );
}