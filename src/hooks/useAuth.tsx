'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { authHelpers } from '@/lib/supabase-client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSkipAuth: boolean;
  deviceId: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  skipAuth: () => void;
  clearSkipAuth: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  isSkipAuth: false,
  deviceId: null,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  skipAuth: () => {},
  clearSkipAuth: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isSkipAuth, setIsSkipAuth] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Check for development mode skip auth
  const isDevelopment = process.env.NODE_ENV === 'development';
  const autoSkipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

  useEffect(() => {
    setMounted(true);
    
    // Initialize device ID
    let id = localStorage.getItem('deviceId');
    if (!id) {
      id = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('deviceId', id);
    }
    setDeviceId(id);

    // Check skipAuth status
    const skipAuthStored = localStorage.getItem('skipAuth') === 'true';
    setIsSkipAuth(skipAuthStored || (isDevelopment && autoSkipAuth));
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // If skipAuth is enabled, don't check session
    if (isSkipAuth) {
      setLoading(false);
      return;
    }

    // 초기 세션 확인
    authHelpers.getSession().then((session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('Auth session error:', error);
      setLoading(false);
    });

    // Auth 상태 변경 리스너
    const { data: { subscription } } = authHelpers.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [mounted, isSkipAuth]);

  const signIn = async (email: string, password: string) => {
    const { error } = await authHelpers.signInWithEmail(email, password);
    if (!error) {
      setIsSkipAuth(false);
      localStorage.removeItem('skipAuth');
    }
    return { error };
  };

  const signOut = async () => {
    await authHelpers.signOut();
    setUser(null);
  };

  const skipAuth = () => {
    setIsSkipAuth(true);
    localStorage.setItem('skipAuth', 'true');
    setLoading(false);
  };

  const clearSkipAuth = () => {
    setIsSkipAuth(false);
    localStorage.removeItem('skipAuth');
  };

  const isAuthenticated = !!user || isSkipAuth;

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isAuthenticated,
      isSkipAuth,
      deviceId,
      signIn,
      signOut,
      skipAuth,
      clearSkipAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};