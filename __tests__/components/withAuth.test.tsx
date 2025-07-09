import React from 'react';
import { render, screen } from '@testing-library/react';
import { withAuth } from '@/components/Auth/withAuth';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

// Mock hooks
jest.mock('@/hooks/useAuth');
jest.mock('next/navigation');

const TestComponent = () => <div>Protected Content</div>;

describe('withAuth HOC', () => {
  const mockPush = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
  });

  it('should show loading state while authenticating', () => {
    (useAuth as jest.Mock).mockReturnValue({
      loading: true,
      isAuthenticated: false,
      isSkipAuth: false
    });

    const ProtectedComponent = withAuth(TestComponent);
    render(<ProtectedComponent />);

    expect(screen.getByText('로딩 중...')).toBeInTheDocument();
  });

  it('should render component for authenticated users', () => {
    (useAuth as jest.Mock).mockReturnValue({
      loading: false,
      isAuthenticated: true,
      isSkipAuth: false,
      user: { email: 'test@example.com' }
    });

    const ProtectedComponent = withAuth(TestComponent);
    render(<ProtectedComponent />);

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should render component for skipAuth users when allowed', () => {
    (useAuth as jest.Mock).mockReturnValue({
      loading: false,
      isAuthenticated: true,
      isSkipAuth: true,
      user: null
    });

    const ProtectedComponent = withAuth(TestComponent, { allowSkipAuth: true });
    render(<ProtectedComponent />);

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect skipAuth users when not allowed', () => {
    (useAuth as jest.Mock).mockReturnValue({
      loading: false,
      isAuthenticated: true,
      isSkipAuth: true,
      user: null
    });

    const ProtectedComponent = withAuth(TestComponent, { allowSkipAuth: false });
    render(<ProtectedComponent />);

    expect(mockPush).toHaveBeenCalledWith('/');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should redirect unauthenticated users', () => {
    (useAuth as jest.Mock).mockReturnValue({
      loading: false,
      isAuthenticated: false,
      isSkipAuth: false,
      user: null
    });

    const ProtectedComponent = withAuth(TestComponent);
    render(<ProtectedComponent />);

    expect(mockPush).toHaveBeenCalledWith('/');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should use custom redirect path', () => {
    (useAuth as jest.Mock).mockReturnValue({
      loading: false,
      isAuthenticated: false,
      isSkipAuth: false,
      user: null
    });

    const ProtectedComponent = withAuth(TestComponent, { redirectTo: '/login' });
    render(<ProtectedComponent />);

    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('should not show loader when showLoader is false', () => {
    (useAuth as jest.Mock).mockReturnValue({
      loading: true,
      isAuthenticated: false,
      isSkipAuth: false
    });

    const ProtectedComponent = withAuth(TestComponent, { showLoader: false });
    render(<ProtectedComponent />);

    expect(screen.queryByText('로딩 중...')).not.toBeInTheDocument();
  });
});