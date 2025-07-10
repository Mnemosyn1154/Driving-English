'use client';

import { useEffect, useState } from 'react';
import { registerServiceWorker, serviceWorkerManager } from '@/utils/serviceWorker';
import { useToast } from '@/hooks/useToast';

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Register service worker
    registerServiceWorker({
      onUpdate: (reg) => {
        setRegistration(reg);
        setShowUpdatePrompt(true);
      },
      onSuccess: (reg) => {
        console.log('Service Worker registered successfully');
      },
      onError: (error) => {
        console.error('Service Worker registration failed:', error);
      },
      onOffline: () => {
        setIsOffline(true);
        toast({
          title: '오프라인 모드',
          description: '인터넷 연결이 끊어졌습니다. 캐시된 콘텐츠를 표시합니다.',
          variant: 'warning',
        });
      },
      onOnline: () => {
        setIsOffline(false);
        toast({
          title: '온라인 모드',
          description: '인터넷에 다시 연결되었습니다.',
          variant: 'success',
        });
      },
    });

    // Listen for app updates
    const handleCacheUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Cache updated:', customEvent.detail);
    };

    window.addEventListener('sw-cache-updated', handleCacheUpdate);

    return () => {
      window.removeEventListener('sw-cache-updated', handleCacheUpdate);
    };
  }, [toast]);

  const handleUpdate = async () => {
    if (registration?.waiting) {
      // Tell service worker to skip waiting
      await serviceWorkerManager.skipWaiting();
      setShowUpdatePrompt(false);
    }
  };

  return (
    <>
      {children}
      
      {/* Offline indicator */}
      {isOffline && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50">
          <div className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
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
            <span className="text-sm font-medium">오프라인 모드</span>
          </div>
        </div>
      )}

      {/* Update prompt */}
      {showUpdatePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2">업데이트 사용 가능</h3>
            <p className="text-gray-600 mb-4">
              새로운 버전이 준비되었습니다. 지금 업데이트하시겠습니까?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowUpdatePrompt(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                나중에
              </button>
              <button
                onClick={handleUpdate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                업데이트
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}