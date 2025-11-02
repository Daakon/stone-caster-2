/**
 * Phase 6: k6 load test for turns pagination
 * 
 * Tests: For an existing game with 300 turns, hit GET /turns?limit=50
 * Fan-out: 20 VUs
 * Expect: p95 < 150ms and no 5xx
 * 
 * Usage:
 *   k6 run --vus 20 --duration 30s -e GAME_ID=<uuid> ops/load/turns-pagination.js
 * 
 * With test rollback:
 *   k6 run --vus 20 --duration 30s -e GAME_ID=<uuid> -e TEST_TX_ENABLED=true ops/load/turns-pagination.js
 */

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Phase 6.1: Configurable via environment variables
const API_BASE = __ENV.API_BASE || 'http://localhost:3000';
const GAME_ID = __ENV.GAME_ID;
const TEST_TX_ENABLED = __ENV.TEST_TX_ENABLED === 'true';
const VUS = parseInt(__ENV.VUS || '20', 10);
const DURATION = __ENV.DURATION || '30s';
const RPS_PER_VU = parseFloat(__ENV.RPS_PER_VU || '2');
const P95_THRESHOLD = parseInt(__ENV.P95_THRESHOLD || '150', 10);
const ERROR_RATE_THRESHOLD = parseFloat(__ENV.ERROR_RATE_THRESHOLD || '0.005', 10); // 0.5%

if (!GAME_ID) {
  throw new Error('GAME_ID environment variable required');
}

// Custom metrics
const successRate = new Rate('pagination_success');
const latencyMetric = new Trend('pagination_latency');
const errorRate = new Rate('http_errors');

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    'http_req_duration': [`p(95)<${P95_THRESHOLD}`], // Configurable p95 threshold
    'pagination_success': ['rate>0.99'], // 99% success rate
    'http_req_failed': ['rate<0.01'], // <1% 5xx errors
    'http_errors': [`rate<${ERROR_RATE_THRESHOLD}`], // Phase 6.1: Fail on high error rate
  },
};

export default function () {
  const headers = {};
  
  if (TEST_TX_ENABLED) {
    headers['X-Test-Rollback'] = '1';
  }

  // Test pagination with different cursor positions
  const afterTurn = __ITER * 50; // Each iteration tests a different page
  const params = {
    limit: 50,
    ...(afterTurn > 0 ? { afterTurn } : {}),
  };

  const queryString = new URLSearchParams(params).toString();
  const url = `${API_BASE}/api/games/${GAME_ID}/turns?${queryString}`;

  const startTime = Date.now();
  const res = http.get(url, { headers });
  const duration = Date.now() - startTime;

  // Phase 6.1: Enhanced error checking
  const isHttpError = res.status >= 400;
  const is2xx = res.status >= 200 && res.status < 300;
  const is5xx = res.status >= 500 && res.status < 600;

  const isSuccess = check(res, {
    'status is 2xx': (r) => is2xx,
    'not 5xx': (r) => !is5xx,
    'has turns array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.data) || Array.isArray(body.data?.turns);
      } catch {
        return false;
      }
    },
  });

  successRate.add(isSuccess);
  latencyMetric.add(duration);
  errorRate.add(!isSuccess || isHttpError); // Track errors
  
  // Phase 6.1: Log non-2xx responses for debugging
  if (!is2xx) {
    console.error(`VU ${__VU}: HTTP ${res.status} at afterTurn=${afterTurn} - ${res.body.substring(0, 100)}`);
  }

  // Verify index is being used (should be fast even with large datasets)
  if (duration > 200) {
    console.warn(`Slow pagination query: ${duration}ms (afterTurn=${afterTurn})`);
  }

  sleep(1 / RPS_PER_VU); // Configurable RPS per VU
}

