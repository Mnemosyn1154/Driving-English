'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { authHelpers } from '@/lib/supabase-client';
import { config } from '@/lib/env';
import { AuthService } from '@/lib/authService';

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

  useEffect(() => {
    setMounted(true);
    
    // Initialize auth context from AuthService
    AuthService.getClientAuthContext().then((authContext) => {
      setDeviceId(authContext.deviceId);
      setIsSkipAuth(authContext.isSkipAuth);
      setUser(authContext.user);
      setLoading(false);
    }).catch((error) => {
      console.error('Failed to initialize auth context:', error);
      setLoading(false);
    });
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
      AuthService.setSkipAuth(false);
      setIsSkipAuth(false);
    }
    return { error };
  };

  const signOut = async () => {
    await authHelpers.signOut();
    setUser(null);
  };

  const skipAuth = () => {
    AuthService.setSkipAuth(true);
    setIsSkipAuth(true);
    setLoading(false);
  };

  const clearSkipAuth = () => {
    AuthService.setSkipAuth(false);
    setIsSkipAuth(false);
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