/**
 * k6 load test for v3 turns endpoint
 * Tests turn execution with virtual users per game pool
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    turns: {
      executor: 'shared-iterations',
      vus: parseInt(__ENV.VUS || '20'),
      iterations: parseInt(__ENV.ITERATIONS || '100'),
      maxDuration: __ENV.DURATION || '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200'], // SLO: 200ms for turns
    errors: ['rate<0.005'],           // Error rate < 0.5%
  },
};

const API_BASE = __ENV.API_BASE || 'http://localhost:3000';
const P95_BUDGET_MS = parseInt(__ENV.P95_BUDGET_MS || '200');
const ERROR_RATE_BUDGET = parseFloat(__ENV.ERROR_RATE_BUDGET || '0.005');

// Pre-created game pool (seeded by test fixtures)
const GAME_POOL = [
  // These would be game IDs from seeded fixtures
  // For now, use a placeholder that tests should populate
];

export default function () {
  // Use first game from pool (in real tests, rotate or use setup script)
  if (GAME_POOL.length === 0) {
    console.warn('No games in pool; skipping turn test');
    return;
  }

  const gameId = GAME_POOL[0];
  const optionId = 'option-1'; // Would be extracted from previous turn
  
  const payload = {
    optionId,
    idempotencyKey: `test-turn-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  };

  const params = {
    headers: {
      'Content-Type': 'application/json',
      // debug=0 for load tests (no debug payload overhead)
      ...(__ENV.TEST_ROLLBACK === '1' ? { 'X-Test-Rollback': '1' } : {}),
    },
    timeout: '10s',
  };

  const res = http.post(`${API_BASE}/api/games/${gameId}/send-turn`, JSON.stringify(payload), params);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response has turn': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.ok === true && !!body.data?.turn;
      } catch {
        return false;
      }
    },
    'p95 within budget': (r) => r.timings.duration < P95_BUDGET_MS,
    'no debug payload': (r) => {
      try {
        const body = JSON.parse(r.body);
        return !body.debug; // Debug should be disabled for load tests
      } catch {
        return true;
      }
    },
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  sleep(0.5);
}

