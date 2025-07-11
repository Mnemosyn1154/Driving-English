/**
 * Centralized Authentication Service
 * Handles authentication logic for both client and server
 */

import { User } from '@supabase/supabase-js';
import { authHelpers } from '@/lib/supabase-client';
import { config } from '@/lib/env';

export interface AuthContext {
  userId: string | null;
  deviceId: string | null;
  isAuthenticated: boolean;
  isSkipAuth: boolean;
  user: any;
  email?: string | null;
}

export class AuthService {

  /**
   * Get authentication context for client-side
   */
  static async getClientAuthContext(): Promise<AuthContext> {
    // Check if we're in the browser
    if (typeof window === 'undefined') {
      return {
        userId: null,
        deviceId: null,
        isAuthenticated: false,
        isSkipAuth: false,
        user: null,
      };
    }

    // Get deviceId from localStorage
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('deviceId', deviceId);
    }

    // Check skipAuth status
    const skipAuthStored = localStorage.getItem('skipAuth') === 'true';
    const isSkipAuth = skipAuthStored || (config.env.isDevelopment && config.auth.skipAuth);

    // If skipAuth is enabled, return guest context
    if (isSkipAuth) {
      return {
        userId: deviceId,
        deviceId: deviceId,
        isAuthenticated: true,
        isSkipAuth: true,
        user: null,
      };
    }

    // Check for authenticated user
    try {
      const session = await authHelpers.getSession();
      if (session?.user) {
        return {
          userId: session.user.id,
          deviceId: deviceId,
          isAuthenticated: true,
          isSkipAuth: false,
          user: session.user,
          email: session.user.email,
        };
      }
    } catch (error) {
      console.error('Error getting auth session:', error);
    }

    // Not authenticated
    return {
      userId: null,
      deviceId: deviceId,
      isAuthenticated: false,
      isSkipAuth: false,
      user: null,
    };
  }


  /**
   * Set skip auth status (client-side only)
   */
  static setSkipAuth(skipAuth: boolean): void {
    if (typeof window !== 'undefined') {
      if (skipAuth) {
        localStorage.setItem('skipAuth', 'true');
      } else {
        localStorage.removeItem('skipAuth');
      }
    }
  }

  /**
   * Clear all auth data (client-side only)
   */
  static clearAuthData(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('skipAuth');
      // Keep deviceId for analytics
    }
  }
}