import { test, expect } from '@playwright/test';

test.describe('Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication - in real tests, this would be actual auth flow
    await page.goto('/');
    
    // Mock successful authentication
    await page.evaluate(() => {
      localStorage.setItem('auth-token', 'mock-jwt-token');
      localStorage.setItem('user-id', 'user-123');
    });
  });

  test('should display profile information', async ({ page }) => {
    // Mock profile API response
    await page.route('**/api/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            id: 'user-123',
            displayName: 'Test User',
            avatarUrl: 'https://example.com/avatar.jpg',
            email: 'test@example.com',
            preferences: {
              showTips: true,
              theme: 'dark',
              notifications: {
                email: true,
                push: false,
              },
            },
            createdAt: '2023-01-01T00:00:00Z',
            lastSeen: '2023-01-02T00:00:00Z',
          },
          meta: {
            traceId: 'test-trace-id',
          },
        }),
      });
    });

    await page.goto('/profile');
    
    // Check that profile information is displayed
    await expect(page.locator('[data-testid="profile-display-name"]')).toHaveText('Test User');
    await expect(page.locator('[data-testid="profile-email"]')).toHaveText('test@example.com');
    await expect(page.locator('[data-testid="profile-avatar"]')).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    
    // Check that internal fields are not exposed
    await expect(page.locator('[data-testid="profile-provider-id"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="profile-access-tokens"]')).not.toBeVisible();
  });

  test('should update profile successfully', async ({ page }) => {
    let updateCallCount = 0;
    
    // Mock profile API responses
    await page.route('**/api/profile', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'user-123',
              displayName: 'Test User',
              avatarUrl: 'https://example.com/avatar.jpg',
              email: 'test@example.com',
              preferences: {
                showTips: true,
                theme: 'dark',
                notifications: {
                  email: true,
                  push: false,
                },
              },
              createdAt: '2023-01-01T00:00:00Z',
              lastSeen: '2023-01-02T00:00:00Z',
            },
            meta: { traceId: 'test-trace-id' },
          }),
        });
      } else if (route.request().method() === 'PUT') {
        updateCallCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'user-123',
              displayName: 'Updated Name',
              avatarUrl: 'https://example.com/new-avatar.jpg',
              email: 'test@example.com',
              preferences: {
                showTips: false,
                theme: 'light',
                notifications: {
                  email: false,
                  push: true,
                },
              },
              createdAt: '2023-01-01T00:00:00Z',
              lastSeen: '2023-01-02T00:00:00Z',
            },
            meta: { traceId: 'test-trace-id' },
          }),
        });
      }
    });

    await page.goto('/profile');
    
    // Update profile fields
    await page.fill('[data-testid="profile-display-name-input"]', 'Updated Name');
    await page.fill('[data-testid="profile-avatar-url-input"]', 'https://example.com/new-avatar.jpg');
    await page.check('[data-testid="profile-show-tips-checkbox"]');
    await page.selectOption('[data-testid="profile-theme-select"]', 'light');
    await page.check('[data-testid="profile-email-notifications-checkbox"]');
    await page.check('[data-testid="profile-push-notifications-checkbox"]');
    
    // Submit the form
    await page.click('[data-testid="profile-save-button"]');
    
    // Wait for success message
    await expect(page.locator('[data-testid="profile-success-message"]')).toBeVisible();
    
    // Verify the update was called
    expect(updateCallCount).toBe(1);
    
    // Verify updated values are displayed
    await expect(page.locator('[data-testid="profile-display-name"]')).toHaveText('Updated Name');
    await expect(page.locator('[data-testid="profile-avatar"]')).toHaveAttribute('src', 'https://example.com/new-avatar.jpg');
  });

  test('should handle profile update validation errors', async ({ page }) => {
    // Mock profile API responses
    await page.route('**/api/profile', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'user-123',
              displayName: 'Test User',
              avatarUrl: 'https://example.com/avatar.jpg',
              email: 'test@example.com',
              preferences: {
                showTips: true,
                theme: 'dark',
                notifications: {
                  email: true,
                  push: false,
                },
              },
              createdAt: '2023-01-01T00:00:00Z',
              lastSeen: '2023-01-02T00:00:00Z',
            },
            meta: { traceId: 'test-trace-id' },
          }),
        });
      } else if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Display name must be between 1 and 100 characters',
            },
            meta: { traceId: 'test-trace-id' },
          }),
        });
      }
    });

    await page.goto('/profile');
    
    // Enter invalid data
    await page.fill('[data-testid="profile-display-name-input"]', 'a'.repeat(101)); // Too long
    
    // Submit the form
    await page.click('[data-testid="profile-save-button"]');
    
    // Check for validation error message
    await expect(page.locator('[data-testid="profile-error-message"]')).toHaveText(
      'Display name must be between 1 and 100 characters'
    );
  });

  test('should revoke other sessions successfully', async ({ page }) => {
    let csrfTokenCallCount = 0;
    let revokeCallCount = 0;
    
    // Mock API responses
    await page.route('**/api/profile/csrf-token', async (route) => {
      csrfTokenCallCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { csrfToken: 'mock-csrf-token' },
          meta: { traceId: 'test-trace-id' },
        }),
      });
    });

    await page.route('**/api/profile/revoke-sessions', async (route) => {
      revokeCallCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            revokedCount: 2,
            currentSessionPreserved: true,
          },
          meta: { traceId: 'test-trace-id' },
        }),
      });
    });

    await page.goto('/profile');
    
    // Click revoke sessions button
    await page.click('[data-testid="revoke-sessions-button"]');
    
    // Confirm the action
    await page.click('[data-testid="confirm-revoke-sessions-button"]');
    
    // Wait for success message
    await expect(page.locator('[data-testid="revoke-sessions-success-message"]')).toBeVisible();
    
    // Verify API calls were made
    expect(csrfTokenCallCount).toBe(1);
    expect(revokeCallCount).toBe(1);
  });

  test('should handle CSRF token validation failure', async ({ page }) => {
    // Mock API responses
    await page.route('**/api/profile/csrf-token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: { csrfToken: 'mock-csrf-token' },
          meta: { traceId: 'test-trace-id' },
        }),
      });
    });

    await page.route('**/api/profile/revoke-sessions', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'CSRF_TOKEN_INVALID',
            message: 'Invalid or expired CSRF token',
          },
          meta: { traceId: 'test-trace-id' },
        }),
      });
    });

    await page.goto('/profile');
    
    // Click revoke sessions button
    await page.click('[data-testid="revoke-sessions-button"]');
    
    // Confirm the action
    await page.click('[data-testid="confirm-revoke-sessions-button"]');
    
    // Check for error message
    await expect(page.locator('[data-testid="revoke-sessions-error-message"]')).toHaveText(
      'Invalid or expired CSRF token'
    );
  });

  test('should handle unauthenticated requests', async ({ page }) => {
    // Clear authentication
    await page.evaluate(() => {
      localStorage.removeItem('auth-token');
      localStorage.removeItem('user-id');
    });

    // Mock unauthorized response
    await page.route('**/api/profile', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
          },
          meta: { traceId: 'test-trace-id' },
        }),
      });
    });

    await page.goto('/profile');
    
    // Should redirect to login or show auth error
    await expect(page.locator('[data-testid="auth-error-message"]')).toBeVisible();
  });

  test('should handle rate limiting', async ({ page }) => {
    let updateCallCount = 0;
    
    // Mock profile API responses
    await page.route('**/api/profile', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'user-123',
              displayName: 'Test User',
              avatarUrl: 'https://example.com/avatar.jpg',
              email: 'test@example.com',
              preferences: {
                showTips: true,
                theme: 'dark',
                notifications: {
                  email: true,
                  push: false,
                },
              },
              createdAt: '2023-01-01T00:00:00Z',
              lastSeen: '2023-01-02T00:00:00Z',
            },
            meta: { traceId: 'test-trace-id' },
          }),
        });
      } else if (route.request().method() === 'PUT') {
        updateCallCount++;
        if (updateCallCount > 10) {
          // Simulate rate limiting after 10 requests
          await route.fulfill({
            status: 429,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: false,
              error: {
                code: 'RATE_LIMITED',
                message: 'Rate limit exceeded',
                details: {
                  limit: 10,
                  windowMs: 60000,
                  resetTime: new Date(Date.now() + 60000).toISOString(),
                },
              },
              meta: { traceId: 'test-trace-id' },
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: {
                id: 'user-123',
                displayName: 'Test User',
                avatarUrl: 'https://example.com/avatar.jpg',
                email: 'test@example.com',
                preferences: {
                  showTips: true,
                  theme: 'dark',
                  notifications: {
                    email: true,
                    push: false,
                  },
                },
                createdAt: '2023-01-01T00:00:00Z',
                lastSeen: '2023-01-02T00:00:00Z',
              },
              meta: { traceId: 'test-trace-id' },
            }),
          });
        }
      }
    });

    await page.goto('/profile');
    
    // Make multiple rapid updates to trigger rate limiting
    for (let i = 0; i < 12; i++) {
      await page.fill('[data-testid="profile-display-name-input"]', `Test User ${i}`);
      await page.click('[data-testid="profile-save-button"]');
      
      if (i === 11) {
        // Check for rate limit error on the 11th request
        await expect(page.locator('[data-testid="profile-error-message"]')).toHaveText(
          'Rate limit exceeded'
        );
      } else {
        // Wait for success message for successful requests
        await expect(page.locator('[data-testid="profile-success-message"]')).toBeVisible();
      }
    }
  });
});
