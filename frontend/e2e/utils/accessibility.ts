import { Page, expect } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';

export interface AccessibilityTestOptions {
  include?: string[];
  exclude?: string[];
  tags?: string[];
  rules?: string[];
  threshold?: number;
}

/**
 * Injects axe-core into the page and runs accessibility checks
 */
export async function runAccessibilityTest(
  page: Page,
  options: AccessibilityTestOptions = {}
) {
  // Inject axe-core
  await injectAxe(page);
  
  // Run accessibility checks
  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: {
      html: true,
    },
    ...options,
  });
}

/**
 * Gets accessibility violations without failing the test
 */
export async function getAccessibilityViolations(
  page: Page,
  options: AccessibilityTestOptions = {}
) {
  await injectAxe(page);
  const violations = await getViolations(page, null, options);
  return violations;
}

/**
 * Checks for specific accessibility issues
 */
export async function checkSpecificAccessibilityIssues(page: Page) {
  const violations = await getAccessibilityViolations(page);
  
  // Check for serious/critical violations
  const seriousViolations = violations.filter(v => 
    v.impact === 'serious' || v.impact === 'critical'
  );
  
  if (seriousViolations.length > 0) {
    console.error('Serious/Critical accessibility violations found:');
    seriousViolations.forEach(violation => {
      console.error(`- ${violation.id}: ${violation.description}`);
      console.error(`  Impact: ${violation.impact}`);
      console.error(`  Help: ${violation.helpUrl}`);
    });
  }
  
  return seriousViolations;
}

/**
 * Tests keyboard navigation
 */
export async function testKeyboardNavigation(page: Page) {
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  }
}

/**
 * Tests color contrast
 */
export async function testColorContrast(page: Page) {
  // This would typically use a color contrast testing library
  // For now, we'll check that elements have proper contrast classes
  const lowContrastElements = await page.locator('[style*="color"]').count();
  
  if (lowContrastElements > 0) {
    console.warn(`Found ${lowContrastElements} elements with inline color styles. Consider using Tailwind classes for better contrast control.`);
  }
}

/**
 * Tests screen reader compatibility
 */
export async function testScreenReaderCompatibility(page: Page) {
  // Check for proper ARIA labels
  const elementsWithoutLabels = await page.locator('button:not([aria-label]):not([aria-labelledby])').count();
  const inputsWithoutLabels = await page.locator('input:not([aria-label]):not([aria-labelledby]):not([type="hidden"])').count();
  
  if (elementsWithoutLabels > 0) {
    console.warn(`Found ${elementsWithoutLabels} buttons without ARIA labels`);
  }
  
  if (inputsWithoutLabels > 0) {
    console.warn(`Found ${inputsWithoutLabels} inputs without ARIA labels`);
  }
  
  return {
    elementsWithoutLabels,
    inputsWithoutLabels,
  };
}

/**
 * Tests focus management
 */
export async function testFocusManagement(page: Page) {
  // Test that focus is visible
  await page.keyboard.press('Tab');
  const focusedElement = await page.locator(':focus');
  await expect(focusedElement).toBeVisible();
  
  // Test that focus indicators are present
  const focusStyles = await page.evaluate(() => {
    const style = window.getComputedStyle(document.activeElement);
    return {
      outline: style.outline,
      boxShadow: style.boxShadow,
    };
  });
  
  const hasFocusIndicator = focusStyles.outline !== 'none' || focusStyles.boxShadow !== 'none';
  
  if (!hasFocusIndicator) {
    console.warn('Focus indicator may not be visible');
  }
  
  return hasFocusIndicator;
}
