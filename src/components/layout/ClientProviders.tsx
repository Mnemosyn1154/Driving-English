'use client';

import { AuthProvider } from '@/hooks/useAuth';
import { ServiceWorkerProvider } from '@/components/ServiceWorkerProvider';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ServiceWorkerProvider>
        {children}
      </ServiceWorkerProvider>
    </AuthProvider>
  );
}