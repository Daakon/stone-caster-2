/**
 * k6 load test for v3 spawn endpoint
 * Tests game creation with ramping arrival rate
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    spawn: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 2,
      maxVUs: 50,
      stages: [
        { duration: '30s', target: 5 },   // Ramp up to 5 RPS
        { duration: '2m', target: 10 },    // Hold at 10 RPS
        { duration: '30s', target: 0 },   // Ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<600'], // SLO: 600ms for spawn
    errors: ['rate<0.005'],           // Error rate < 0.5%
  },
};

const API_BASE = __ENV.API_BASE || 'http://localhost:3000';
const VUS = parseInt(__ENV.VUS || '10');
const DURATION = __ENV.DURATION || '2m';
const P95_BUDGET_MS = parseInt(__ENV.P95_BUDGET_MS || '600');
const ERROR_RATE_BUDGET = parseFloat(__ENV.ERROR_RATE_BUDGET || '0.005');

export default function () {
  const entryPointId = '00000000-0000-0000-0000-000000000002'; // Test fixture entry point
  const worldId = '00000000-0000-0000-0000-000000000001'; // Test fixture world
  const idempotencyKey = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  const payload = {
    entry_point_id: entryPointId,
    world_id: worldId,
    entry_start_slug: 'forest_meet',
    ruleset_slug: 'core.default',
    ownerId: `test-user-${Math.random().toString(36).substring(7)}`,
    isGuest: true,
    idempotency_key: idempotencyKey,
  };

  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...(__ENV.TEST_ROLLBACK === '1' ? { 'X-Test-Rollback': '1' } : {}),
    },
    timeout: '10s',
  };

  const res = http.post(`${API_BASE}/api/games`, JSON.stringify(payload), params);

  const success = check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'response has game_id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.ok === true && !!body.data?.game_id;
      } catch {
        return false;
      }
    },
    'p95 within budget': (r) => r.timings.duration < P95_BUDGET_MS,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  sleep(1);
}

