'use client';

import { useEffect, useState } from 'react';
import { registerServiceWorker, serviceWorkerManager } from '@/utils/serviceWorker';
import { useToast } from '@/hooks/useToast';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { OfflineIndicator } from '@/components/OfflineIndicator';

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
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
        toast.warning('오프라인 모드: 캐시된 콘텐츠를 표시합니다.');
      },
      onOnline: () => {
        setIsOffline(false);
        toast.success('온라인 모드: 인터넷에 다시 연결되었습니다.');
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
    if (registration?.waiting && serviceWorkerManager) {
      // Tell service worker to skip waiting
      await serviceWorkerManager.skipWaiting();
      setShowUpdatePrompt(false);
    }
  };

  return (
    <>
      {children}
      
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
      
      {/* Offline Indicator */}
      <OfflineIndicator />

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