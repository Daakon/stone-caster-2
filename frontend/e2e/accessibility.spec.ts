import { test, expect } from '@playwright/test';
import { 
  runAccessibilityTest, 
  checkSpecificAccessibilityIssues,
  testKeyboardNavigation,
  testScreenReaderCompatibility,
  testFocusManagement
} from './utils/accessibility';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('Homepage should be accessible', async ({ page }) => {
    // Run comprehensive accessibility test
    await runAccessibilityTest(page, {
      threshold: 0, // Allow no violations
    });

    // Check for specific issues
    const violations = await checkSpecificAccessibilityIssues(page);
    expect(violations).toHaveLength(0);

    // Test keyboard navigation
    const navigationSelectors = [
      'a[href="/auth"]',
      'a[href="/characters"]',
      'a[href="/worlds"]',
    ];
    await testKeyboardNavigation(page, navigationSelectors);

    // Test screen reader compatibility
    const screenReaderIssues = await testScreenReaderCompatibility(page);
    expect(screenReaderIssues.elementsWithoutLabels).toBe(0);
    expect(screenReaderIssues.inputsWithoutLabels).toBe(0);

    // Test focus management
    const hasFocusIndicator = await testFocusManagement(page);
    expect(hasFocusIndicator).toBe(true);
  });

  test('Auth page should be accessible', async ({ page }) => {
    await page.goto('/auth');

    // Run accessibility test
    await runAccessibilityTest(page, {
      threshold: 0,
    });

    // Check for specific issues
    const violations = await checkSpecificAccessibilityIssues(page);
    expect(violations).toHaveLength(0);

    // Test form accessibility
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    // Check that inputs have proper labels
    await expect(emailInput).toHaveAttribute('aria-required', 'true');
    await expect(passwordInput).toHaveAttribute('aria-required', 'true');

    // Test keyboard navigation through form
    await emailInput.focus();
    await page.keyboard.press('Tab');
    await expect(passwordInput).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(submitButton).toBeFocused();

    // Test screen reader compatibility
    const screenReaderIssues = await testScreenReaderCompatibility(page);
    expect(screenReaderIssues.elementsWithoutLabels).toBe(0);
    expect(screenReaderIssues.inputsWithoutLabels).toBe(0);
  });

  test('Mobile navigation should be accessible', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    // Test hamburger menu accessibility
    const hamburgerButton = page.locator('button[aria-label="Toggle menu"]');
    await expect(hamburgerButton).toBeVisible();
    await expect(hamburgerButton).toHaveAttribute('aria-label', 'Toggle menu');

    // Test drawer navigation
    await hamburgerButton.click();
    
    // Wait for drawer to open
    await page.waitForSelector('[role="dialog"]', { state: 'visible' });

    // Test keyboard navigation in drawer
    await page.keyboard.press('Tab');
    const firstFocusable = page.locator(':focus');
    await expect(firstFocusable).toBeVisible();

    // Test escape key closes drawer
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role="dialog"]', { state: 'hidden' });

    // Run accessibility test on mobile
    await runAccessibilityTest(page, {
      threshold: 0,
    });
  });

  test('Dark mode toggle should be accessible', async ({ page }) => {
    // Test theme toggle button
    const themeToggle = page.locator('button[aria-label="Toggle theme"]');
    await expect(themeToggle).toBeVisible();
    await expect(themeToggle).toHaveAttribute('aria-label', 'Toggle theme');

    // Test keyboard navigation to theme toggle
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be able to activate with Enter or Space
    await themeToggle.press('Enter');
    
    // Test that dropdown opens
    await page.waitForSelector('[role="menu"]', { state: 'visible' });

    // Test keyboard navigation in dropdown
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // Run accessibility test
    await runAccessibilityTest(page, {
      threshold: 0,
    });
  });

  test('Responsive design should be accessible at all breakpoints', async ({ page }) => {
    const breakpoints = [
      { width: 375, height: 812, name: 'Mobile' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 1024, height: 768, name: 'Desktop' },
      { width: 1920, height: 1080, name: 'Large Desktop' },
    ];

    for (const breakpoint of breakpoints) {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      
      // Run accessibility test at each breakpoint
      await runAccessibilityTest(page, {
        threshold: 0,
      });

      // Check for specific issues
      const violations = await checkSpecificAccessibilityIssues(page);
      expect(violations).toHaveLength(0);

      // Test focus management
      const hasFocusIndicator = await testFocusManagement(page);
      expect(hasFocusIndicator).toBe(true);
    }
  });

  test('Form validation should be accessible', async ({ page }) => {
    await page.goto('/auth');

    // Test form validation accessibility
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Check for error messages with proper ARIA attributes
    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveAttribute('role', 'alert');

    // Test that error is associated with form fields
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('aria-invalid', 'true');

    // Run accessibility test with validation errors
    await runAccessibilityTest(page, {
      threshold: 0,
    });
  });

  test('Loading states should be accessible', async ({ page }) => {
    // Test loading spinner accessibility
    const loadingSpinner = page.locator('[role="status"]');
    await expect(loadingSpinner).toHaveAttribute('role', 'status');
    await expect(loadingSpinner).toHaveAttribute('aria-label', 'Loading');

    // Test that loading state is announced to screen readers
    const loadingText = page.locator('.sr-only');
    await expect(loadingText).toContainText('Loading...');

    // Run accessibility test
    await runAccessibilityTest(page, {
      threshold: 0,
    });
  });
});
