import { NextRequest } from 'next/server';
import { getAuthContext, requireAuth } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase-server';
import { userService } from '@/lib/user-service';

// Mock dependencies
jest.mock('@/lib/supabase-server');
jest.mock('@/lib/user-service');

describe('API Authentication Middleware', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com'
  };

  const mockDeviceUser = {
    id: 'device-user-456',
    deviceId: 'device-789',
    email: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthContext', () => {
    it('should return authenticated context for logged-in user', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'supabase-123', email: 'test@example.com' } }
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      (userService.ensureUser as jest.Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/test');
      const auth = await getAuthContext(request);

      expect(auth).toEqual({
        userId: 'user-123',
        deviceId: null,
        isAuthenticated: true,
        isSkipAuth: false,
        user: mockUser
      });
    });

    it('should return skipAuth context with deviceId from query', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null }
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      (userService.ensureUser as jest.Mock).mockResolvedValue(mockDeviceUser);

      const request = new NextRequest('http://localhost:3000/api/test?deviceId=device-789');
      const auth = await getAuthContext(request);

      expect(auth).toEqual({
        userId: 'device-user-456',
        deviceId: 'device-789',
        isAuthenticated: true,
        isSkipAuth: true,
        user: mockDeviceUser
      });
    });

    it('should return skipAuth context with deviceId from header', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null }
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      (userService.ensureUser as jest.Mock).mockResolvedValue(mockDeviceUser);

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'x-device-id': 'device-789'
        }
      });
      const auth = await getAuthContext(request);

      expect(auth).toEqual({
        userId: 'device-user-456',
        deviceId: 'device-789',
        isAuthenticated: true,
        isSkipAuth: true,
        user: mockDeviceUser
      });
    });

    it('should return unauthenticated context when no auth', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null }
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/test');
      const auth = await getAuthContext(request);

      expect(auth).toEqual({
        userId: null,
        deviceId: null,
        isAuthenticated: false,
        isSkipAuth: false,
        user: null
      });
    });

    it('should prioritize authenticated user over deviceId', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'supabase-123', email: 'test@example.com' } }
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      (userService.ensureUser as jest.Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/test?deviceId=device-789');
      const auth = await getAuthContext(request);

      expect(auth.isAuthenticated).toBe(true);
      expect(auth.isSkipAuth).toBe(false);
      expect(auth.userId).toBe('user-123');
      expect(auth.deviceId).toBe('device-789'); // deviceId is still captured
    });
  });

  describe('requireAuth', () => {
    it('should return auth context for authenticated user', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'supabase-123', email: 'test@example.com' } }
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      (userService.ensureUser as jest.Mock).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/test');
      const auth = await requireAuth(request);

      expect(auth.isAuthenticated).toBe(true);
      expect(auth.userId).toBe('user-123');
    });

    it('should throw error for unauthenticated user', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null }
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/test');
      
      await expect(requireAuth(request)).rejects.toThrow('Authentication required');
    });

    it('should accept skipAuth users as authenticated', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null }
          })
        }
      };
      (createClient as jest.Mock).mockResolvedValue(mockSupabase);
      (userService.ensureUser as jest.Mock).mockResolvedValue(mockDeviceUser);

      const request = new NextRequest('http://localhost:3000/api/test?deviceId=device-789');
      const auth = await requireAuth(request);

      expect(auth.isAuthenticated).toBe(true);
      expect(auth.isSkipAuth).toBe(true);
      expect(auth.userId).toBe('device-user-456');
    });
  });
});