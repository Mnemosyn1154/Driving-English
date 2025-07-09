import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase-client';

// Mock Supabase client
jest.mock('@/lib/supabase-client', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } }
      })),
      signInWithPassword: jest.fn(),
      signOut: jest.fn()
    }
  }))
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: jest.fn()
  })
}));

describe('useAuth Hook', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle skipAuth mode', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    act(() => {
      result.current.skipAuth();
    });

    expect(result.current.isSkipAuth).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('skipAuth')).toBe('true');
    expect(localStorage.getItem('deviceId')).toBeTruthy();
  });

  it('should clear skipAuth mode', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    act(() => {
      result.current.skipAuth();
    });

    expect(result.current.isSkipAuth).toBe(true);

    act(() => {
      result.current.clearSkipAuth();
    });

    expect(result.current.isSkipAuth).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('skipAuth')).toBe(null);
  });

  it('should handle sign in', async () => {
    const mockSignIn = jest.fn().mockResolvedValue({ error: null });
    const supabase = createClient();
    (supabase.auth.signInWithPassword as jest.Mock) = mockSignIn;

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      const response = await result.current.signIn('test@example.com', 'password');
      expect(response.error).toBe(null);
    });

    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password'
    });
  });

  it('should handle sign out', async () => {
    const mockSignOut = jest.fn().mockResolvedValue({ error: null });
    const supabase = createClient();
    (supabase.auth.signOut as jest.Mock) = mockSignOut;

    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(result.current.user).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
  });
});