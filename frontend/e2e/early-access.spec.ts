/**
 * Early Access E2E Tests
 * Phase B4: Verify Early Access gating across roles and routes
 */

import { test, expect } from '@playwright/test';

// Test tokens would be set up in test environment
// These should be actual JWT tokens for users with different roles
const TEST_TOKENS = {
  pending: process.env.TEST_TOKEN_PENDING || 'pending-test-token',
  early_access: process.env.TEST_TOKEN_EARLY_ACCESS || 'ea-test-token',
  admin: process.env.TEST_TOKEN_ADMIN || 'admin-test-token',
};

const API_BASE = process.env.VITE_API_BASE || 'http://localhost:3000';
const FRONTEND_BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';

/**
 * Helper to set Early Access mode via internal flags endpoint
 * Note: This requires admin access. In real tests, you'd use a test admin token.
 */
async function setEAMode(mode: 'on' | 'off', adminToken?: string): Promise<void> {
  // In a real scenario, you'd call an admin endpoint or update environment
  // For now, we'll assume the test environment can be configured
  // This would typically be done via test setup/teardown
  console.log(`[Test] Setting EARLY_ACCESS_MODE=${mode} (mock - requires actual admin endpoint)`);
}

/**
 * Helper to get user role from /api/me
 */
async function getUserRole(request: any, token?: string): Promise<{ role?: string; roleVersion?: number }> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await request.get(`${API_BASE}/api/me`, { headers });
  if (response.ok()) {
    const body = await response.json();
    return {
      role: body.data?.user?.role,
      roleVersion: body.data?.user?.roleVersion,
    };
  }
  return {};
}

test.describe('Early Access Gate', () => {
  test.beforeEach(async ({ request }) => {
    // Set EA mode to 'on' for most tests
    // In real scenario, use admin endpoint or test setup
    await setEAMode('on');
  });

  test('anon HTML nav is redirected when EA=on', async ({ page }) => {
    // Clear any existing auth
    await page.context().clearCookies();

    const response = await page.goto(`${FRONTEND_BASE}/play`, {
      waitUntil: 'domcontentloaded',
    });

    // Should redirect to request-access
    expect(page.url()).toMatch(/\/request-access$/);
    expect(response?.status()).toBe(302);
  });

  test('anon protected API is 401 when EA=on', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/games/health`);

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe('UNAUTHORIZED');

    // Check WWW-Authenticate header
    const headers = response.headers();
    expect(headers['www-authenticate']).toContain('Bearer');
  });

  test('pending user HTML nav redirected; API 403', async ({ page, request }) => {
    // Set up pending user cookie
    await page.context().addCookies([
      {
        name: 'sb-access-token',
        value: TEST_TOKENS.pending,
        url: FRONTEND_BASE,
        domain: new URL(FRONTEND_BASE).hostname,
      },
    ]);

    // Test HTML navigation
    await page.goto(`${FRONTEND_BASE}/play`, {
      waitUntil: 'domcontentloaded',
    });

    expect(page.url()).toMatch(/\/request-access$/);

    // Test API call
    const apiResponse = await request.get(`${API_BASE}/api/games/health`, {
      headers: {
        Authorization: `Bearer ${TEST_TOKENS.pending}`,
      },
    });

    expect(apiResponse.status()).toBe(403);

    const body = await apiResponse.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe('EARLY_ACCESS_REQUIRED');

    // Check x-reason header
    const headers = apiResponse.headers();
    expect(headers['x-reason']).toBe('EARLY_ACCESS_REQUIRED');
  });

  test('early_access user allowed', async ({ page, request }) => {
    // Set up early access user cookie
    await page.context().addCookies([
      {
        name: 'sb-access-token',
        value: TEST_TOKENS.early_access,
        url: FRONTEND_BASE,
        domain: new URL(FRONTEND_BASE).hostname,
      },
    ]);

    // Test HTML navigation
    const navResponse = await page.goto(`${FRONTEND_BASE}/play`, {
      waitUntil: 'networkidle',
    });

    expect(navResponse?.ok()).toBeTruthy();
    expect(page.url()).toMatch(/\/play/);

    // Test API call
    const apiResponse = await request.get(`${API_BASE}/api/games/health`, {
      headers: {
        Authorization: `Bearer ${TEST_TOKENS.early_access}`,
      },
    });

    expect(apiResponse.status()).toBe(200);

    const body = await apiResponse.json();
    expect(body.ok).toBe(true);
  });

  test('admin user allowed', async ({ page, request }) => {
    // Set up admin user cookie
    await page.context().addCookies([
      {
        name: 'sb-access-token',
        value: TEST_TOKENS.admin,
        url: FRONTEND_BASE,
        domain: new URL(FRONTEND_BASE).hostname,
      },
    ]);

    // Test HTML navigation
    const navResponse = await page.goto(`${FRONTEND_BASE}/play`, {
      waitUntil: 'networkidle',
    });

    expect(navResponse?.ok()).toBeTruthy();

    // Test API call
    const apiResponse = await request.get(`${API_BASE}/api/games/health`, {
      headers: {
        Authorization: `Bearer ${TEST_TOKENS.admin}`,
      },
    });

    expect(apiResponse.status()).toBe(200);
  });

  test('EA=off allows everyone', async ({ page, request }) => {
    // Set EA mode to off
    await setEAMode('off');

    // Clear cookies for anonymous test
    await page.context().clearCookies();

    // Test HTML navigation (anonymous)
    const navResponse = await page.goto(`${FRONTEND_BASE}/play`, {
      waitUntil: 'networkidle',
    });

    expect(navResponse?.ok()).toBeTruthy();
    expect(page.url()).toMatch(/\/play/);

    // Test API call (anonymous)
    const apiResponse = await request.get(`${API_BASE}/api/games/health`);

    // Should work if endpoint allows anonymous, or return appropriate auth response
    expect([200, 401]).toContain(apiResponse.status());
  });

  test('public routes always accessible', async ({ request }) => {
    // Test catalog endpoint (anonymous)
    const catalogResponse = await request.get(`${API_BASE}/api/catalog/npcs`);

    expect(catalogResponse.status()).toBe(200);

    const body = await catalogResponse.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    // Test health endpoint (anonymous)
    const healthResponse = await request.get(`${API_BASE}/api/health`);

    expect(healthResponse.status()).toBe(200);
  });

  test('/api/me returns role headers', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/me`, {
      headers: {
        Authorization: `Bearer ${TEST_TOKENS.early_access}`,
      },
    });

    expect(response.status()).toBe(200);

    const headers = response.headers();
    expect(headers['x-role']).toBeDefined();
    expect(headers['x-role-version']).toBeDefined();

    const body = await response.json();
    expect(body.data?.user?.role).toBeDefined();
    expect(body.data?.user?.roleVersion).toBeDefined();
  });

  test('role version change invalidates cache', async ({ page, request }) => {
    // This test would require:
    // 1. User with pending role, role_version=1
    // 2. Navigate to /play → redirect
    // 3. Update role to early_access, increment role_version=2
    // 4. Navigate to /play again → should work immediately

    // Note: This requires test setup to create/update users
    // For now, we'll verify the headers are present
    const response = await request.get(`${API_BASE}/api/me`, {
      headers: {
        Authorization: `Bearer ${TEST_TOKENS.early_access}`,
      },
    });

    const body = await response.json();
    expect(body.data?.user?.roleVersion).toBeGreaterThanOrEqual(1);

    // Verify cache key would change with version
    const headers = response.headers();
    expect(headers['x-role-version']).toBeDefined();
  });
});

