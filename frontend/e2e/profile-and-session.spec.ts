import { test, expect } from '@playwright/test';

test.describe('Profile and Session Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test.describe('Profile Access Control', () => {
    test('should redirect guest users to sign in when accessing profile', async ({ page }) => {
      // Try to access profile as guest
      await page.goto('/profile');
      
      // Should show authentication required message
      await expect(page.getByText('Authentication Required')).toBeVisible();
      await expect(page.getByText(/You're currently browsing as a guest/)).toBeVisible();
      
      // Should have sign in button
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });

    test('should allow authenticated users to access profile', async ({ page }) => {
      // Mock authenticated user
      await page.addInitScript(() => {
        // Mock auth store to return authenticated user
        window.localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: 'user-123', email: 'test@example.com' }
        }));
      });

      // Mock profile API response
      await page.route('**/api/profile/access', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              canAccess: true,
              isGuest: false,
              userId: 'user-123',
              requiresAuth: false,
            },
          }),
        });
      });

      await page.route('**/api/profile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'profile-123',
              displayName: 'Test User',
              avatarUrl: 'https://example.com/avatar.jpg',
              email: 'test@example.com',
              preferences: {
                showTips: true,
                theme: 'auto',
                notifications: {
                  email: true,
                  push: false,
                },
              },
              createdAt: '2024-01-01T00:00:00Z',
              lastSeen: '2024-01-01T00:00:00Z',
            },
          }),
        });
      });

      await page.goto('/profile');
      
      // Should show profile content
      await expect(page.getByText('Profile')).toBeVisible();
      await expect(page.getByText('Test User')).toBeVisible();
      await expect(page.getByText('test@example.com')).toBeVisible();
    });
  });

  test.describe('Profile Management', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authenticated user and profile data
      await page.addInitScript(() => {
        window.localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: 'user-123', email: 'test@example.com' }
        }));
      });

      await page.route('**/api/profile/access', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              canAccess: true,
              isGuest: false,
              userId: 'user-123',
              requiresAuth: false,
            },
          }),
        });
      });

      await page.route('**/api/profile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'profile-123',
              displayName: 'Test User',
              avatarUrl: '',
              email: 'test@example.com',
              preferences: {
                showTips: true,
                theme: 'auto',
                notifications: {
                  email: true,
                  push: false,
                },
              },
              createdAt: '2024-01-01T00:00:00Z',
              lastSeen: '2024-01-01T00:00:00Z',
            },
          }),
        });
      });

      await page.route('**/api/profile/csrf-token', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              csrfToken: 'mock-csrf-token',
            },
          }),
        });
      });
    });

    test('should allow editing profile information', async ({ page }) => {
      await page.goto('/profile');
      
      // Click edit button
      await page.getByRole('button', { name: 'Edit' }).click();
      
      // Should show edit form
      await expect(page.getByLabel('Display Name')).toBeVisible();
      await expect(page.getByLabel('Avatar URL')).toBeVisible();
      
      // Update display name
      await page.getByLabel('Display Name').fill('Updated Name');
      
      // Mock successful update
      await page.route('**/api/profile', async (route) => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              ok: true,
              data: {
                id: 'profile-123',
                displayName: 'Updated Name',
                avatarUrl: '',
                email: 'test@example.com',
                preferences: {
                  showTips: true,
                  theme: 'auto',
                  notifications: {
                    email: true,
                    push: false,
                  },
                },
                createdAt: '2024-01-01T00:00:00Z',
                lastSeen: '2024-01-01T00:00:00Z',
              },
            }),
          });
        } else {
          await route.continue();
        }
      });
      
      // Save changes
      await page.getByRole('button', { name: 'Save' }).click();
      
      // Should show success message
      await expect(page.getByText('Profile Updated')).toBeVisible();
    });

    test('should allow canceling profile edits', async ({ page }) => {
      await page.goto('/profile');
      
      // Click edit button
      await page.getByRole('button', { name: 'Edit' }).click();
      
      // Make changes
      await page.getByLabel('Display Name').fill('Changed Name');
      
      // Cancel changes
      await page.getByRole('button', { name: 'Cancel' }).click();
      
      // Should revert to original values
      await expect(page.getByText('Test User')).toBeVisible();
    });

    test('should allow revoking other sessions', async ({ page }) => {
      await page.goto('/profile');
      
      // Mock session revocation
      await page.route('**/api/profile/revoke-sessions', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              revokedCount: 2,
              currentSessionPreserved: true,
            },
          }),
        });
      });
      
      // Click revoke sessions button
      await page.getByRole('button', { name: 'Revoke Other Sessions' }).click();
      
      // Should show success message
      await expect(page.getByText('Sessions Revoked')).toBeVisible();
      await expect(page.getByText('Successfully revoked 2 other sessions')).toBeVisible();
    });
  });

  test.describe('Guest Account Linking', () => {
    test('should link guest account after authentication', async ({ page }) => {
      // Start as guest user
      await page.goto('/');
      
      // Mock guest cookie
      await page.addInitScript(() => {
        document.cookie = 'guestId=guest-cookie-123; path=/';
      });
      
      // Mock guest linking API
      await page.route('**/api/profile/link-guest', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              success: true,
              alreadyLinked: false,
              message: 'Guest account successfully linked',
            },
          }),
        });
      });
      
      // Mock authentication success
      await page.route('**/api/profile/access', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              canAccess: true,
              isGuest: false,
              userId: 'user-123',
              requiresAuth: false,
            },
          }),
        });
      });
      
      // Navigate to auth page
      await page.goto('/auth/signin');
      
      // Mock successful sign in
      await page.addInitScript(() => {
        window.localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: 'user-123', email: 'test@example.com' }
        }));
      });
      
      // The guest linking should happen automatically after auth
      // This would be tested in the auth flow integration
    });

    test('should handle already linked guest account', async ({ page }) => {
      // Mock already linked response
      await page.route('**/api/profile/link-guest', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              success: true,
              alreadyLinked: true,
              message: 'Guest account already linked to this user',
            },
          }),
        });
      });
      
      // This would be tested in the auth flow integration
    });
  });

  test.describe('Error Handling', () => {
    test('should show error when profile loading fails', async ({ page }) => {
      // Mock authenticated user
      await page.addInitScript(() => {
        window.localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: 'user-123', email: 'test@example.com' }
        }));
      });

      await page.route('**/api/profile/access', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              canAccess: true,
              isGuest: false,
              userId: 'user-123',
              requiresAuth: false,
            },
          }),
        });
      });

      // Mock profile API failure
      await page.route('**/api/profile', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            error: {
              code: 'PROFILE_LOAD_ERROR',
              message: 'Failed to load profile',
              http: 500,
            },
          }),
        });
      });

      await page.goto('/profile');
      
      // Should show error banner
      await expect(page.getByText('Failed to load profile')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
    });

    test('should show error when CSRF token generation fails', async ({ page }) => {
      // Mock authenticated user
      await page.addInitScript(() => {
        window.localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: 'user-123', email: 'test@example.com' }
        }));
      });

      await page.route('**/api/profile/access', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              canAccess: true,
              isGuest: false,
              userId: 'user-123',
              requiresAuth: false,
            },
          }),
        });
      });

      await page.route('**/api/profile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'profile-123',
              displayName: 'Test User',
              avatarUrl: '',
              email: 'test@example.com',
              preferences: {
                showTips: true,
                theme: 'auto',
                notifications: {
                  email: true,
                  push: false,
                },
              },
              createdAt: '2024-01-01T00:00:00Z',
              lastSeen: '2024-01-01T00:00:00Z',
            },
          }),
        });
      });

      // Mock CSRF token failure
      await page.route('**/api/profile/csrf-token', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: false,
            error: {
              code: 'CSRF_TOKEN_ERROR',
              message: 'Failed to generate CSRF token',
              http: 500,
            },
          }),
        });
      });

      await page.goto('/profile');
      
      // Should show profile but with disabled edit functionality
      await expect(page.getByText('Test User')).toBeVisible();
      
      // Try to edit
      await page.getByRole('button', { name: 'Edit' }).click();
      await page.getByLabel('Display Name').fill('New Name');
      
      // Try to save - should show error
      await page.getByRole('button', { name: 'Save' }).click();
      
      // Should show security error
      await expect(page.getByText('Security Error')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should be accessible for screen readers', async ({ page }) => {
      // Mock authenticated user
      await page.addInitScript(() => {
        window.localStorage.setItem('supabase.auth.token', JSON.stringify({
          access_token: 'mock-token',
          user: { id: 'user-123', email: 'test@example.com' }
        }));
      });

      await page.route('**/api/profile/access', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              canAccess: true,
              isGuest: false,
              userId: 'user-123',
              requiresAuth: false,
            },
          }),
        });
      });

      await page.route('**/api/profile', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: {
              id: 'profile-123',
              displayName: 'Test User',
              avatarUrl: '',
              email: 'test@example.com',
              preferences: {
                showTips: true,
                theme: 'auto',
                notifications: {
                  email: true,
                  push: false,
                },
              },
              createdAt: '2024-01-01T00:00:00Z',
              lastSeen: '2024-01-01T00:00:00Z',
            },
          }),
        });
      });

      await page.goto('/profile');
      
      // Check for proper heading structure
      await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Basic Information' })).toBeVisible();
      
      // Check for proper form labels
      await page.getByRole('button', { name: 'Edit' }).click();
      await expect(page.getByLabel('Display Name')).toBeVisible();
      await expect(page.getByLabel('Avatar URL')).toBeVisible();
      
      // Check for proper button labels
      await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    });
  });
});
