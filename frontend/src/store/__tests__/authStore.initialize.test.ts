import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock the auth service before importing the store
vi.mock('../../services/auth/AuthService', () => ({
  authService: {
    subscribe: vi.fn(),
    getCurrentUser: vi.fn(),
    initialize: vi.fn(),
  }
}));

import { useAuthStore } from '../auth';
import { authService } from '../../services/auth/AuthService';

const mockAuthService = vi.mocked(authService);

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('AuthStore initialize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();

    // Setup auth service mocks
    mockAuthService.subscribe.mockReturnValue(vi.fn()); // Returns unsubscribe function
    mockAuthService.getCurrentUser.mockReturnValue(null);
    mockAuthService.initialize.mockResolvedValue(null);

    // Reset the store state
    useAuthStore.setState({
      user: null,
      profile: null,
      loading: true,
    });
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should subscribe to auth service before calling initialize', async () => {
    const mockUser = {
      state: 'authenticated' as const,
      id: 'user-123',
      email: 'test@example.com',
      key: 'token-123',
    };

    mockAuthService.initialize.mockResolvedValue(mockUser);
    mockAuthService.getCurrentUser.mockReturnValue(mockUser);

    await useAuthStore.getState().initialize();

    // Verify subscription was called before initialize
    expect(mockAuthService.subscribe).toHaveBeenCalledTimes(1);
    expect(mockAuthService.initialize).toHaveBeenCalledTimes(1);
    
    // Verify subscription was called first by checking call order
    const subscribeCallOrder = mockAuthService.subscribe.mock.invocationCallOrder[0];
    const initializeCallOrder = mockAuthService.initialize.mock.invocationCallOrder[0];
    expect(subscribeCallOrder).toBeLessThan(initializeCallOrder);
  });

  it('should handle early SIGNED_IN notification during initialization', async () => {
    let subscriptionCallback: ((user: any) => void) | null = null;
    
    // Capture the subscription callback
    mockAuthService.subscribe.mockImplementation((callback) => {
      subscriptionCallback = callback;
      return vi.fn(); // unsubscribe function
    });

    const mockUser = {
      state: 'authenticated' as const,
      id: 'user-123',
      email: 'test@example.com',
      key: 'token-123',
    };

    // Mock initialize to trigger the subscription callback before resolving
    mockAuthService.initialize.mockImplementation(async () => {
      // Simulate early notification during initialization
      if (subscriptionCallback) {
        subscriptionCallback(mockUser);
      }
      return mockUser;
    });

    mockAuthService.getCurrentUser.mockReturnValue(mockUser);

    await useAuthStore.getState().initialize();

    // Verify the store state is properly set
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.userId).toBe('user-123');
    expect(state.authToken).toBe('token-123');
  });

  it('should sync state from getCurrentUser after initialization', async () => {
    const mockUser = {
      state: 'authenticated' as const,
      id: 'user-123',
      email: 'test@example.com',
      key: 'token-123',
    };

    const mockCurrentUser = {
      state: 'authenticated' as const,
      id: 'user-123',
      email: 'test@example.com',
      key: 'token-123',
      profile: { id: 'profile-123', displayName: 'Test User' },
    };

    mockAuthService.initialize.mockResolvedValue(mockUser);
    mockAuthService.getCurrentUser.mockReturnValue(mockCurrentUser);

    await useAuthStore.getState().initialize();

    // Verify the store uses the current user from getCurrentUser
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockCurrentUser);
    expect(state.profile).toEqual(mockCurrentUser.profile);
    expect(state.isAuthenticated).toBe(true);
    expect(state.loading).toBe(false);
  });

  it('should only register subscription once on multiple initialize calls', async () => {
    const mockUser = {
      state: 'authenticated' as const,
      id: 'user-123',
      email: 'test@example.com',
      key: 'token-123',
    };

    mockAuthService.initialize.mockResolvedValue(mockUser);
    mockAuthService.getCurrentUser.mockReturnValue(mockUser);

    // Call initialize multiple times
    await useAuthStore.getState().initialize();
    await useAuthStore.getState().initialize();
    await useAuthStore.getState().initialize();

    // Verify subscription was only called once
    expect(mockAuthService.subscribe).toHaveBeenCalledTimes(1);
    expect(mockAuthService.initialize).toHaveBeenCalledTimes(3);
  });

  it('should handle initialization errors gracefully', async () => {
    const error = new Error('Initialization failed');
    mockAuthService.initialize.mockRejectedValue(error);

    await useAuthStore.getState().initialize();

    // Verify error handling
    expect(mockConsoleError).toHaveBeenCalledWith('[AuthStore] Initialization error:', error);
    
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.isAuthenticated).toBe(false);
  });

  it('should handle subscription callback updates', async () => {
    let subscriptionCallback: ((user: any) => void) | null = null;
    
    mockAuthService.subscribe.mockImplementation((callback) => {
      subscriptionCallback = callback;
      return vi.fn(); // unsubscribe function
    });

    const initialUser = {
      state: 'guest' as const,
      id: 'guest-123',
    };

    const authenticatedUser = {
      state: 'authenticated' as const,
      id: 'user-123',
      email: 'test@example.com',
      key: 'token-123',
    };

    mockAuthService.initialize.mockResolvedValue(initialUser);
    mockAuthService.getCurrentUser.mockReturnValue(initialUser);

    await useAuthStore.getState().initialize();

    // Verify initial state
    let state = useAuthStore.getState();
    expect(state.user).toEqual(initialUser);
    expect(state.isAuthenticated).toBe(false);

    // Simulate auth state change via subscription
    if (subscriptionCallback) {
      subscriptionCallback(authenticatedUser);
    }

    // Verify updated state
    state = useAuthStore.getState();
    expect(state.user).toEqual(authenticatedUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.loading).toBe(false);
  });
});
