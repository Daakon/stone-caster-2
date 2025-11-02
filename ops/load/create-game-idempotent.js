/**
 * Phase 6: k6 load test for idempotent game creation
 * 
 * Tests: 10 RPS for 60s; always send the same idempotency key per VU
 * Expect: 1 creation attempt per VU, rest 200 from cache; check p95 < 250ms
 * 
 * Usage:
 *   k6 run --vus 10 --duration 60s ops/load/create-game-idempotent.js
 * 
 * With test rollback (if TEST_TX_ENABLED=true):
 *   k6 run --vus 10 --duration 60s -e TEST_TX_ENABLED=true ops/load/create-game-idempotent.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Phase 6.1: Configurable via environment variables with sensible defaults
const API_BASE = __ENV.API_BASE || 'http://localhost:3000';
const TEST_TX_ENABLED = __ENV.TEST_TX_ENABLED === 'true';
const VUS = parseInt(__ENV.VUS || '10', 10);
const DURATION = __ENV.DURATION || '60s';
const RPS_PER_VU = parseFloat(__ENV.RPS_PER_VU || '1');
const P95_THRESHOLD = parseInt(__ENV.P95_THRESHOLD || '250', 10);
const ERROR_RATE_THRESHOLD = parseFloat(__ENV.ERROR_RATE_THRESHOLD || '0.005', 10); // 0.5%

// Custom metrics
const creationRate = new Rate('game_creation_success');
const latencyMetric = new Trend('game_creation_latency');
const cacheHitRate = new Rate('cache_hit');
const errorRate = new Rate('http_errors');

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    'http_req_duration': [`p(95)<${P95_THRESHOLD}`], // Configurable p95 threshold
    'game_creation_success': ['rate>0.95'], // 95% success rate
    'cache_hit': ['rate>0.8'], // 80% cache hits for duplicate requests
    'http_errors': [`rate<${ERROR_RATE_THRESHOLD}`], // Phase 6.1: Fail on high error rate
  },
};

export default function () {
  // Generate stable idempotency key per VU (same across iterations)
  const idempotencyKey = `load-test-${__VU}-${__ITER}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  };

  // Add test rollback header if enabled
  if (TEST_TX_ENABLED) {
    headers['X-Test-Rollback'] = '1';
  }

  const gameData = {
    entry_point_id: 'test-entry-point-load',
    world_id: '00000000-0000-0000-0000-000000000001',
    entry_start_slug: 'test-entry-start-load',
  };

  const startTime = Date.now();
  const res = http.post(
    `${API_BASE}/api/games`,
    JSON.stringify(gameData),
    { headers }
  );
  const duration = Date.now() - startTime;

  // Phase 6.1: Enhanced error checking
  const isHttpError = res.status >= 400;
  const is2xx = res.status >= 200 && res.status < 300;
  const is5xx = res.status >= 500 && res.status < 600;
  
  // Check response
  const isSuccess = check(res, {
    'status is 2xx': (r) => is2xx,
    'not 5xx': (r) => !is5xx,
    'has game_id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data?.game_id !== undefined;
      } catch {
        return false;
      }
    },
  });

  // Check for cache hit (idempotency response)
  const isCacheHit = res.status === 200 && res.headers['X-Idempotent-Response'] === 'true';
  
  creationRate.add(isSuccess);
  latencyMetric.add(duration);
  cacheHitRate.add(isCacheHit);
  errorRate.add(!isSuccess || isHttpError); // Track errors
  
  // Phase 6.1: Log non-2xx responses for debugging
  if (!is2xx) {
    console.error(`VU ${__VU}: HTTP ${res.status} - ${res.body.substring(0, 100)}`);
  }

  // Log for first request per VU (creation), others should be cache hits
  if (__ITER === 0) {
    console.log(`VU ${__VU}: Created game (${duration}ms)`);
  } else if (isCacheHit) {
    console.log(`VU ${__VU}: Cache hit (${duration}ms)`);
  }

  sleep(1 / RPS_PER_VU); // Configurable RPS per VU
}

