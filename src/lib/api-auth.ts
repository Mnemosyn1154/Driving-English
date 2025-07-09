import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { userService } from '@/lib/user-service';

export interface AuthContext {
  userId: string | null;
  deviceId: string | null;
  isAuthenticated: boolean;
  isSkipAuth: boolean;
  user: any;
}

export async function getAuthContext(request: NextRequest): Promise<AuthContext> {
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
      user: dbUser
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
      user: dbUser
    };
  }

  // Not authenticated
  return {
    userId: null,
    deviceId: null,
    isAuthenticated: false,
    isSkipAuth: false,
    user: null
  };
}

// Helper function to require authentication
export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const auth = await getAuthContext(request);
  
  if (!auth.isAuthenticated) {
    throw new Error('Authentication required');
  }
  
  return auth;
}