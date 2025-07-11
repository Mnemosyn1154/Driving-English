'use client';

import { AuthProvider } from '@/hooks/useAuth';
import { ServiceWorkerProvider } from '@/components/ServiceWorkerProvider';
import { PerformanceProvider } from '@/components/layout/PerformanceProvider';
import { AnalyticsProvider } from '@/providers/AnalyticsProvider';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ServiceWorkerProvider>
        <PerformanceProvider>
          <AnalyticsProvider>
            {children}
          </AnalyticsProvider>
        </PerformanceProvider>
      </ServiceWorkerProvider>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </AuthProvider>
  );
}