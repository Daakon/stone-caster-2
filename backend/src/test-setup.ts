import { vi } from 'vitest';
import { createConfigServiceMock } from './test-utils/config-mock.js';
import { createSupabaseAdminMock } from './test-utils/supabase-mock.js';

// Shared config service mock
const { mockConfigService } = createConfigServiceMock();
vi.mock('./services/config.service.js', () => ({
  configService: mockConfigService,
  configServiceReady: Promise.resolve(),
}));

// Shared Supabase admin mock
const { mockSupabaseAdmin } = createSupabaseAdminMock();
vi.mock('./services/supabase.js', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

// Mock Supabase client for auth
const mockSupabaseAuth = {
  getUser: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  exchangeCodeForSession: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: mockSupabaseAuth,
  })),
}));

// Make mock available globally for tests
(global as any).mockSupabaseAuth = mockSupabaseAuth;
(global as any).mockSupabaseAdmin = mockSupabaseAdmin;
(global as any).mockConfigService = mockConfigService;
