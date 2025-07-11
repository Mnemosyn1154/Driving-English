/**
 * Server-side Authentication Service
 * This file contains server-only authentication logic
 */

import { createClient } from '@/lib/supabase-server';
import { userService } from '@/lib/user-service';
import { AuthContext } from './authService';

export class AuthServiceServer {
  /**
   * Get authentication context for server-side requests
   */
  static async getServerAuthContext(request: Request): Promise<AuthContext> {
    const supabase = await createClient();
    
    // Get deviceId from query params or headers
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('deviceId') || 
                     request.headers.get('x-device-id') || 
                     null;

    // Check for authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Ensure user exists in our database
      const dbUser = await userService.ensureUser(user, null);
      return {
        userId: dbUser.id,
        deviceId: deviceId,
        isAuthenticated: true,
        isSkipAuth: false,
        user: dbUser,
        email: user.email,
      };
    }

    // Check for skipAuth with deviceId
    if (deviceId) {
      const dbUser = await userService.ensureUser(null, deviceId);
      return {
        userId: dbUser.id,
        deviceId: deviceId,
        isAuthenticated: true,
        isSkipAuth: true,
        user: dbUser,
      };
    }

    // Not authenticated
    return {
      userId: null,
      deviceId: null,
      isAuthenticated: false,
      isSkipAuth: false,
      user: null,
    };
  }

  /**
   * Require authentication for server-side requests
   */
  static async requireServerAuth(request: Request): Promise<AuthContext> {
    const auth = await this.getServerAuthContext(request);
    
    if (!auth.isAuthenticated) {
      throw new Error('Authentication required');
    }
    
    return auth;
  }
}