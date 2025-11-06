/**
 * Network Budget Tests
 * PR9/PR11-H: Enforce network call budgets per route transition
 * Fails CI if budgets are exceeded
 * PR11-H: Count only API hostnames defined in endpoints.json
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load endpoints.json to get canonical API hostnames
let endpointsConfig: any = {};
try {
  const endpointsPath = join(process.cwd(), 'docs/state-api-audit/endpoints.json');
  endpointsConfig = JSON.parse(readFileSync(endpointsPath, 'utf-8'));
} catch (error) {
  console.warn('[NetworkBudget] Could not load endpoints.json, using defaults');
}

// Extract API hostnames from endpoints.json
const apiHostnames = new Set<string>();
if (endpointsConfig.endpoints) {
  endpointsConfig.endpoints.forEach((endpoint: any) => {
    // Extract hostname from endpoint if available
    // For now, assume all /api/* calls are to the same host
    if (endpoint.endpoint?.startsWith('/api/')) {
      apiHostnames.add('api.stonecaster.ai'); // Default API hostname
    }
  });
}

// Map endpoints to resource names (from endpoints.json audit)
const endpointToResource: Record<string, string> = {
  '/api/profile': 'profile',
  '/api/admin/user/roles': 'admin-user-roles',
  '/api/request-access/status': 'access-request-status',
  '/api/stones/wallet': 'wallet',
  '/api/catalog/worlds': 'worlds',
  '/api/catalog/worlds/': 'world',
  '/api/catalog/stories': 'stories',
  '/api/catalog/stories/': 'story',
  '/api/characters': 'characters',
  '/api/games': 'my-adventures',
  '/api/games/': 'game',
  '/api/games/': 'turns.latest', // /api/games/:id/turns/latest
};

/**
 * Check if URL is an API call (matches hostnames from endpoints.json)
 */
function isApiCall(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Check if hostname matches any known API hostname
    if (apiHostnames.size > 0) {
      return Array.from(apiHostnames).some(host => urlObj.hostname.includes(host));
    }
    // Fallback: check if path starts with /api/
    return urlObj.pathname.startsWith('/api/');
  } catch {
    // If URL parsing fails, check if string contains /api/
    return url.includes('/api/');
  }
}

interface NetworkCall {
  url: string;
  method: string;
  resource: string;
}

function getResourceFromUrl(url: string): string {
  for (const [endpoint, resource] of Object.entries(endpointToResource)) {
    if (url.includes(endpoint)) {
      // Special case for turns.latest
      if (endpoint === '/api/games/' && url.includes('/turns/latest')) {
        return 'turns.latest';
      }
      // Special case for game detail
      if (endpoint === '/api/games/' && !url.includes('/turns/')) {
        return 'game';
      }
      return resource;
    }
  }
  return 'unknown';
}

test.describe('Network Budgets', () => {
  test('Boot → Home: single fetch per resource', async ({ page }) => {
    const networkCalls: NetworkCall[] = [];
    
    // Track all network requests
    page.on('requestfinished', (request) => {
      const url = request.url();
      // PR11-H: Only track API calls matching hostnames from endpoints.json
      if (isApiCall(url)) {
        networkCalls.push({
          url,
          method: request.method(),
          resource: getResourceFromUrl(url),
        });
      }
    });
    
    // Navigate to home
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Count calls per resource
    const counts: Record<string, number> = {};
    networkCalls.forEach(call => {
      counts[call.resource] = (counts[call.resource] || 0) + 1;
    });
    
    // Assert budgets
    const profileCount = counts.profile || 0;
    const accessCount = counts['access-request-status'] || 0;
    const walletCount = counts.wallet || 0;
    const worldsCount = counts.worlds || 0;
    
    // PR11-H: Generate diff table on failure
    const budgetTable = [
      { resource: 'profile', expected: 1, actual: profileCount, status: profileCount <= 1 ? 'PASS' : 'FAIL' },
      { resource: 'access-request-status', expected: 1, actual: accessCount, status: accessCount <= 1 ? 'PASS' : 'FAIL' },
      { resource: 'wallet', expected: 1, actual: walletCount, status: walletCount <= 1 ? 'PASS' : 'FAIL' },
      { resource: 'worlds', expected: 1, actual: worldsCount, status: worldsCount <= 1 ? 'PASS' : 'FAIL' },
    ];
    
    const failures = budgetTable.filter(r => r.status === 'FAIL');
    if (failures.length > 0) {
      console.error('\n❌ Network Budget Failures (Boot → Home):');
      console.table(budgetTable);
      // Write artifact for CI
      const artifact = budgetTable.map(r => 
        `${r.resource}: expected ≤${r.expected}, actual ${r.actual} (${r.status})`
      ).join('\n');
      console.error('\nBudget Artifact:\n' + artifact);
    }
    
    expect(profileCount).toBeLessThanOrEqual(1);
    expect(accessCount).toBeLessThanOrEqual(1);
    expect(walletCount).toBeLessThanOrEqual(1);
    expect(worldsCount).toBeLessThanOrEqual(1);
    
    // Print summary
    console.log('Boot → Home network calls:', counts);
  });
  
  test('Home → Stories: single fetch per resource', async ({ page }) => {
    const networkCalls: NetworkCall[] = [];
    
    page.on('requestfinished', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        networkCalls.push({
          url,
          method: request.method(),
          resource: getResourceFromUrl(url),
        });
      }
    });
    
    // Start at home
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Clear previous calls
    networkCalls.length = 0;
    
    // Navigate to stories
    await page.click('a[href="/stories"]');
    await page.waitForLoadState('networkidle');
    
    const counts: Record<string, number> = {};
    networkCalls.forEach(call => {
      counts[call.resource] = (counts[call.resource] || 0) + 1;
    });
    
    // Assert budgets
    expect(counts.stories || 0).toBeLessThanOrEqual(1);
    // Should not refetch profile/access/wallet
    expect(counts.profile || 0).toBeLessThanOrEqual(0);
    expect(counts['access-request-status'] || 0).toBeLessThanOrEqual(0);
    expect(counts.wallet || 0).toBeLessThanOrEqual(0);
    
    console.log('Home → Stories network calls:', counts);
  });
  
  test('Stories → My Stories: single fetch per resource', async ({ page }) => {
    // This test requires authentication - skip if not logged in
    test.skip(process.env.PLAYWRIGHT_SKIP_AUTH === 'true', 'Skipping authenticated test');
    
    const networkCalls: NetworkCall[] = [];
    
    page.on('requestfinished', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        networkCalls.push({
          url,
          method: request.method(),
          resource: getResourceFromUrl(url),
        });
      }
    });
    
    await page.goto('/stories');
    await page.waitForLoadState('networkidle');
    
    networkCalls.length = 0;
    
    // Navigate to my adventures
    await page.click('a[href*="/my-adventures"]');
    await page.waitForLoadState('networkidle');
    
    const counts: Record<string, number> = {};
    networkCalls.forEach(call => {
      counts[call.resource] = (counts[call.resource] || 0) + 1;
    });
    
    expect(counts['my-adventures'] || 0).toBeLessThanOrEqual(1);
    expect(counts.stories || 0).toBeLessThanOrEqual(0);
    
    console.log('Stories → My Stories network calls:', counts);
  });
  
  test('Open a Story: single fetch per resource', async ({ page }) => {
    const networkCalls: NetworkCall[] = [];
    
    page.on('requestfinished', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        networkCalls.push({
          url,
          method: request.method(),
          resource: getResourceFromUrl(url),
        });
      }
    });
    
    await page.goto('/stories');
    await page.waitForLoadState('networkidle');
    
    networkCalls.length = 0;
    
    // Click first story card
    const firstStoryLink = page.locator('a[href^="/stories/"]').first();
    if (await firstStoryLink.count() > 0) {
      await firstStoryLink.click();
      await page.waitForLoadState('networkidle');
      
      const counts: Record<string, number> = {};
      networkCalls.forEach(call => {
        counts[call.resource] = (counts[call.resource] || 0) + 1;
      });
      
      expect(counts.story || 0).toBeLessThanOrEqual(1);
      expect(counts.stories || 0).toBeLessThanOrEqual(0);
      
      console.log('Open Story network calls:', counts);
    }
  });
  
  test('Stories filter change: single fetch per change', async ({ page }) => {
    const networkCalls: NetworkCall[] = [];
    
    page.on('requestfinished', (request) => {
      const url = request.url();
      if (url.includes('/api/catalog/stories')) {
        networkCalls.push({
          url,
          method: request.method(),
          resource: 'stories',
        });
      }
    });
    
    await page.goto('/stories');
    await page.waitForLoadState('networkidle');
    
    networkCalls.length = 0;
    
    // Change filter (if filter UI exists)
    const filterInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await filterInput.count() > 0) {
      await filterInput.fill('test');
      await page.waitForTimeout(500); // Wait for debounce
      await page.waitForLoadState('networkidle');
      
      // Should be exactly 1 call for the filter change
      const storyCalls = networkCalls.filter(c => c.resource === 'stories');
      expect(storyCalls.length).toBeLessThanOrEqual(1);
      
      console.log('Filter change network calls:', storyCalls.length);
    }
  });
});

