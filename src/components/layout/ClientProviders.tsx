'use client';

import { AuthProvider } from '@/hooks/useAuth';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}