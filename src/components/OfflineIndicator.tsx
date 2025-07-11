'use client';

import { useOffline } from '@/hooks/useOffline';
import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export function OfflineIndicator() {
  const {
    isOnline,
    isServiceWorkerReady,
    pendingSyncCount,
    failedSyncCount,
    lastSyncTime,
    cachedArticleCount,
    forceSync,
    getCacheStats,
  } = useOffline();

  const [showDetails, setShowDetails] = useState(false);
  const [cacheStats, setCacheStats] = useState<any>(null);

  useEffect(() => {
    if (showDetails) {
      getCacheStats().then(setCacheStats);
    }
  }, [showDetails, getCacheStats]);

  // Don't show anything if online and no pending syncs
  if (isOnline && pendingSyncCount === 0 && failedSyncCount === 0) {
    return null;
  }

  const getStatusColor = () => {
    if (!isOnline) return 'bg-yellow-500';
    if (failedSyncCount > 0) return 'bg-red-500';
    if (pendingSyncCount > 0) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!isOnline) return '오프라인';
    if (failedSyncCount > 0) return '동기화 오류';
    if (pendingSyncCount > 0) return '동기화 대기 중';
    return '온라인';
  };

  return (
    <>
      {/* Main indicator */}
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
        <div
          className={`${getStatusColor()} text-white px-4 py-2 rounded-lg shadow-lg cursor-pointer transition-all duration-300 hover:scale-105`}
          onClick={() => setShowDetails(!showDetails)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {!isOnline ? (
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                  />
                </svg>
              )}
              <span className="text-sm font-medium">{getStatusText()}</span>
            </div>
            
            {(pendingSyncCount > 0 || failedSyncCount > 0) && (
              <div className="ml-4 flex items-center text-xs">
                {pendingSyncCount > 0 && (
                  <span className="mr-2">대기: {pendingSyncCount}</span>
                )}
                {failedSyncCount > 0 && (
                  <span>실패: {failedSyncCount}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details modal */}
      {showDetails && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetails(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">오프라인 상태</h3>
            
            <div className="space-y-3">
              {/* Connection status */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">연결 상태</span>
                <span className={`font-medium ${isOnline ? 'text-green-600' : 'text-yellow-600'}`}>
                  {isOnline ? '온라인' : '오프라인'}
                </span>
              </div>

              {/* Service Worker status */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Service Worker</span>
                <span className={`font-medium ${isServiceWorkerReady ? 'text-green-600' : 'text-red-600'}`}>
                  {isServiceWorkerReady ? '활성' : '비활성'}
                </span>
              </div>

              {/* Cached articles */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">캐시된 기사</span>
                <span className="font-medium">{cachedArticleCount}개</span>
              </div>

              {/* Pending syncs */}
              {pendingSyncCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">동기화 대기</span>
                  <span className="font-medium text-blue-600">{pendingSyncCount}개</span>
                </div>
              )}

              {/* Failed syncs */}
              {failedSyncCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">동기화 실패</span>
                  <span className="font-medium text-red-600">{failedSyncCount}개</span>
                </div>
              )}

              {/* Last sync time */}
              {lastSyncTime && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">마지막 동기화</span>
                  <span className="text-sm">
                    {formatDistanceToNow(lastSyncTime, { 
                      addSuffix: true, 
                      locale: ko 
                    })}
                  </span>
                </div>
              )}

              {/* Cache stats */}
              {cacheStats && (
                <div className="pt-3 border-t">
                  <h4 className="font-medium mb-2">캐시 사용량</h4>
                  <div className="space-y-1 text-sm">
                    {Object.entries(cacheStats).map(([name, stats]: [string, any]) => (
                      <div key={name} className="flex justify-between">
                        <span className="text-gray-600">{name}</span>
                        <span>{stats.count}개 ({stats.sizeFormatted})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDetails(false)}
                className="flex-1 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                닫기
              </button>
              
              {isOnline && (pendingSyncCount > 0 || failedSyncCount > 0) && (
                <button
                  onClick={() => {
                    forceSync();
                    setShowDetails(false);
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  지금 동기화
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}