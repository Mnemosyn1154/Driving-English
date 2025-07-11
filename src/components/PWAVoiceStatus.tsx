'use client';

import { useState, useEffect } from 'react';
import { useVoicePWAIntegration } from '@/hooks/usePWAIntegration';
import { useHybridSpeechRecognition } from '@/hooks/useHybridSpeechRecognition';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface PWAVoiceStatusProps {
  className?: string;
  variant?: 'floating' | 'navbar' | 'minimal';
}

export function PWAVoiceStatus({ className = '', variant = 'floating' }: PWAVoiceStatusProps) {
  const {
    isOnline,
    isOfflineReady,
    cacheStats,
    getCacheStats,
    preloadVoiceContent,
    syncOfflineData,
    clearCache,
    formatCacheSize,
  } = useVoicePWAIntegration();

  const [showDetails, setShowDetails] = useState(false);
  const [voiceSystemReady, setVoiceSystemReady] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Check if voice system is ready
  useEffect(() => {
    const checkVoiceReady = async () => {
      const hasSTT = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
      const hasTTS = 'speechSynthesis' in window;
      const hasAudio = 'AudioContext' in window || 'webkitAudioContext' in window;
      
      setVoiceSystemReady(hasSTT && hasTTS && hasAudio);
    };

    checkVoiceReady();
  }, []);

  // Get status color based on system state
  const getStatusColor = () => {
    if (!voiceSystemReady) return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
    if (!isOnline && !isOfflineReady) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' };
    if (!isOnline && isOfflineReady) return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' };
    return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' };
  };

  // Get status text
  const getStatusText = () => {
    if (!voiceSystemReady) return '음성 시스템 오류';
    if (!isOnline && !isOfflineReady) return '오프라인 (제한됨)';
    if (!isOnline && isOfflineReady) return '오프라인 (사용 가능)';
    return '온라인';
  };

  // Get short status text for navbar
  const getShortStatusText = () => {
    if (!voiceSystemReady) return '오류';
    if (!isOnline && !isOfflineReady) return '오프라인';
    if (!isOnline && isOfflineReady) return '오프라인';
    return '온라인';
  };

  // Get status icon
  const getStatusIcon = () => {
    if (!voiceSystemReady) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    }

    if (!isOnline) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
        </svg>
      );
    }

    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    );
  };

  // Should show indicator?
  const shouldShow = !isOnline || !voiceSystemReady || !isOfflineReady;

  if (!shouldShow && variant !== 'navbar') return null;

  const colors = getStatusColor();

  // Navbar variant - always visible but subtle
  if (variant === 'navbar') {
    return (
      <div className={`relative ${className}`}>
        <button
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
            shouldShow 
              ? `${colors.bg} ${colors.text} ${colors.border} border hover:opacity-80` 
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
          }`}
          onClick={() => setShowDetails(!showDetails)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-label="음성 시스템 상태"
        >
          {getStatusIcon()}
          <span className="hidden sm:inline">{getShortStatusText()}</span>
        </button>

        {/* Tooltip */}
        {showTooltip && !showDetails && (
          <div className="absolute top-full mt-2 right-0 bg-gray-900 text-white text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap z-50">
            {getStatusText()}
          </div>
        )}

        {/* Dropdown details */}
        {showDetails && (
          <div className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-[280px] z-50">
            <h4 className="font-medium text-sm mb-3">음성 시스템 상태</h4>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600">네트워크</span>
                <span className={isOnline ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                  {isOnline ? '온라인' : '오프라인'}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600">음성 인식</span>
                <span className={voiceSystemReady ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {voiceSystemReady ? '사용 가능' : '사용 불가'}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-600">오프라인 모드</span>
                <span className={isOfflineReady ? 'text-green-600 font-medium' : 'text-gray-500'}>
                  {isOfflineReady ? '준비됨' : '준비 안됨'}
                </span>
              </div>
            </div>

            {(!isOnline || !voiceSystemReady || !isOfflineReady) && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-600">
                  {!voiceSystemReady && '마이크 권한을 허용해주세요'}
                  {!isOfflineReady && voiceSystemReady && '오프라인 사용을 위해 콘텐츠를 다운로드하세요'}
                  {!isOnline && '네트워크 연결을 확인해주세요'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Minimal variant
  if (variant === 'minimal') {
    return (
      <div className={`${className}`}>
        <div
          className={`w-2 h-2 rounded-full ${colors.bg} ${colors.border} border cursor-pointer`}
          onClick={() => setShowDetails(!showDetails)}
          title={getStatusText()}
        />
      </div>
    );
  }

  // Default floating variant
  return (
    <>
      {/* Status indicator */}
      <div className={`fixed top-4 right-4 z-40 ${className}`}>
        <div
          className={`${colors.bg} ${colors.text} ${colors.border} border px-3 py-2 rounded-lg shadow-md cursor-pointer transition-all duration-300 hover:shadow-lg`}
          onClick={() => setShowDetails(!showDetails)}
        >
          <div className="flex items-center">
            {getStatusIcon()}
            <span className="ml-2 text-sm font-medium">{getStatusText()}</span>
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
            className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">음성 인식 시스템 상태</h3>
            
            <div className="space-y-4">
              {/* System Status */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">시스템 상태</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">네트워크</span>
                    <span className={`font-medium ${isOnline ? 'text-green-600' : 'text-yellow-600'}`}>
                      {isOnline ? '온라인' : '오프라인'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">음성 인식</span>
                    <span className={`font-medium ${voiceSystemReady ? 'text-green-600' : 'text-red-600'}`}>
                      {voiceSystemReady ? '사용 가능' : '사용 불가'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">오프라인 모드</span>
                    <span className={`font-medium ${isOfflineReady ? 'text-green-600' : 'text-gray-600'}`}>
                      {isOfflineReady ? '준비됨' : '준비 안됨'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cache Statistics */}
              {cacheStats && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">캐시 사용량</h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(cacheStats).map(([name, stats]: [string, any]) => (
                      <div key={name} className="flex justify-between">
                        <span className="text-gray-600">
                          {name === 'AUDIO' ? '음성 파일' : 
                           name === 'API' ? 'API 데이터' : 
                           name === 'STATIC' ? '정적 파일' : name}
                        </span>
                        <span className="font-medium">
                          {stats.count}개 ({stats.sizeFormatted})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Features */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3">사용 가능한 기능</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">음성 명령</span>
                    <span className={`font-medium ${voiceSystemReady ? 'text-green-600' : 'text-red-600'}`}>
                      {voiceSystemReady ? '사용 가능' : '사용 불가'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">웨이크워드 감지</span>
                    <span className={`font-medium ${voiceSystemReady ? 'text-green-600' : 'text-red-600'}`}>
                      {voiceSystemReady ? '사용 가능' : '사용 불가'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">오프라인 TTS</span>
                    <span className={`font-medium ${isOfflineReady ? 'text-green-600' : 'text-gray-600'}`}>
                      {isOfflineReady ? '사용 가능' : '온라인 전용'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">캐시된 음성</span>
                    <span className={`font-medium ${cacheStats?.AUDIO?.count ? 'text-green-600' : 'text-gray-600'}`}>
                      {cacheStats?.AUDIO?.count || 0}개 파일
                    </span>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {(!isOnline || !voiceSystemReady || !isOfflineReady) && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 text-yellow-800">권장사항</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {!voiceSystemReady && (
                      <li>• 마이크 권한을 허용하고 페이지를 새로고침해주세요</li>
                    )}
                    {!isOfflineReady && (
                      <li>• 오프라인 사용을 위해 몇 개의 기사를 미리 저장해주세요</li>
                    )}
                    {!isOnline && (
                      <li>• 네트워크 연결이 복구되면 자동으로 동기화됩니다</li>
                    )}
                  </ul>
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
              
              <button
                onClick={async () => {
                  await getCacheStats();
                  setShowDetails(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                새로고침
              </button>
              
              {isOnline && (
                <button
                  onClick={async () => {
                    await syncOfflineData();
                    setShowDetails(false);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  동기화
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}