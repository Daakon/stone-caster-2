import { vi } from 'vitest';

/**
 * Creates a comprehensive Supabase admin mock that properly chains methods
 * This fixes the common issue where tests fail because method chaining doesn't work
 */
export function createSupabaseAdminMock() {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    rangeGt: vi.fn().mockReturnThis(),
    rangeGte: vi.fn().mockReturnThis(),
    rangeLt: vi.fn().mockReturnThis(),
    rangeLte: vi.fn().mockReturnThis(),
    rangeAdjacent: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    csv: vi.fn().mockResolvedValue({ data: '', error: null }),
    geojson: vi.fn().mockResolvedValue({ data: null, error: null }),
    explain: vi.fn().mockResolvedValue({ data: null, error: null }),
    rollback: vi.fn().mockResolvedValue({ data: null, error: null }),
    returns: vi.fn().mockReturnThis(),
  };

  const mockAuthAdmin = {
    signOut: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
    createUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    updateUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    deleteUser: vi.fn().mockResolvedValue({ data: null, error: null }),
    generateLink: vi.fn().mockResolvedValue({ data: null, error: null }),
    inviteUserByEmail: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  };

  const mockSupabaseAdmin = {
    from: vi.fn().mockReturnValue(mockQueryBuilder),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      admin: mockAuthAdmin,
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        list: vi.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: '' }, error: null }),
        createSignedUrls: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    },
    realtime: {
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue({ data: null, error: null }),
        unsubscribe: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
  };

  return {
    mockSupabaseAdmin,
    mockQueryBuilder,
    mockAuthAdmin,
  };
}

/**
 * Sets up the global Supabase admin mock for tests
 */
export function setupSupabaseAdminMock() {
  const { mockSupabaseAdmin } = createSupabaseAdminMock();
  
  vi.mock('../config/supabase.js', () => ({
    supabaseAdmin: mockSupabaseAdmin,
  }));

  return mockSupabaseAdmin;
}
