import { NextRequest } from 'next/server';
import { AuthContext } from '@/lib/authService';
import { AuthServiceServer } from '@/lib/authService.server';

// Re-export types for backward compatibility
export type { AuthContext };

/**
 * Get authentication context from request
 * @deprecated Use AuthServiceServer.getServerAuthContext instead
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext> {
  return AuthServiceServer.getServerAuthContext(request);
}

/**
 * Helper function to require authentication
 * @deprecated Use AuthServiceServer.requireServerAuth instead
 */
export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  return AuthServiceServer.requireServerAuth(request);
}