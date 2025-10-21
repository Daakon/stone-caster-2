import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from './auth';
import { authService } from '../services/auth/AuthService';
import { vi } from 'vitest';

// Mock the auth service
vi.mock('../services/auth/AuthService');
const mockAuthService = vi.mocked(authService);

// Mock console.log to capture logs
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuthStore());
    
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('should initialize auth service and set user', async () => {
    const mockUser = {
      state: 'authenticated' as const,
      id: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User'
    };

    mockAuthService.initialize.mockResolvedValue(mockUser);
    mockAuthService.subscribe.mockReturnValue(vi.fn());

    const { result } = renderHook(() => useAuthStore());
    
    await act(async () => {
      await result.current.initialize();
    });

    expect(mockAuthService.initialize).toHaveBeenCalled();
    expect(mockAuthService.subscribe).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.user).toEqual(mockUser);
  });

  it('should handle initialization error', async () => {
    const error = new Error('Initialization failed');
    mockAuthService.initialize.mockRejectedValue(error);
    mockAuthService.subscribe.mockReturnValue(vi.fn());

    const { result } = renderHook(() => useAuthStore());
    
    await act(async () => {
      await result.current.initialize();
    });

    expect(mockAuthService.initialize).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should handle sign in', async () => {
    const mockUser = {
      state: 'authenticated' as const,
      id: 'user-123',
      email: 'test@example.com',
      displayName: 'Test User'
    };

    mockAuthService.signIn.mockResolvedValue(undefined);
    mockAuthService.subscribe.mockReturnValue(vi.fn());

    const { result } = renderHook(() => useAuthStore());
    
    await act(async () => {
      await result.current.signIn('test@example.com', 'password');
    });

    expect(mockAuthService.signIn).toHaveBeenCalledWith('test@example.com', 'password');
  });

  it('should handle sign in error', async () => {
    const error = new Error('Sign in failed');
    mockAuthService.signIn.mockRejectedValue(error);
    mockAuthService.subscribe.mockReturnValue(vi.fn());

    const { result } = renderHook(() => useAuthStore());
    
    await act(async () => {
      try {
        await result.current.signIn('test@example.com', 'password');
      } catch (e) {
        // Expected to throw
      }
    });

    expect(mockAuthService.signIn).toHaveBeenCalledWith('test@example.com', 'password');
    expect(result.current.loading).toBe(false);
  });

  it('should handle sign up', async () => {
    mockAuthService.signUp.mockResolvedValue(undefined);
    mockAuthService.subscribe.mockReturnValue(vi.fn());

    const { result } = renderHook(() => useAuthStore());
    
    await act(async () => {
      await result.current.signUp('test@example.com', 'password');
    });

    expect(mockAuthService.signUp).toHaveBeenCalledWith('test@example.com', 'password');
  });

  it('should handle OAuth sign in', async () => {
    mockAuthService.signInWithOAuth.mockResolvedValue(undefined);
    mockAuthService.subscribe.mockReturnValue(vi.fn());

    const { result } = renderHook(() => useAuthStore());
    
    await act(async () => {
      await result.current.signInWithOAuth('google');
    });

    expect(mockAuthService.signInWithOAuth).toHaveBeenCalledWith('google');
  });

  it('should handle sign out', async () => {
    mockAuthService.signOut.mockResolvedValue(undefined);
    mockAuthService.subscribe.mockReturnValue(vi.fn());

    const { result } = renderHook(() => useAuthStore());
    
    await act(async () => {
      await result.current.signOut();
    });

    expect(mockAuthService.signOut).toHaveBeenCalled();
  });
});
