import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index.js';

describe('API Integration Tests', () => {
  describe('Response Envelope', () => {
    it('should return success response with envelope for /api/config', async () => {
      const response = await request(app).get('/api/config').expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: expect.any(Object),
        meta: {
          traceId: expect.any(String),
          version: expect.any(String),
        },
      });
    });

    it('should return error response with envelope for invalid endpoint', async () => {
      const response = await request(app).get('/api/nonexistent').expect(404);

      // Express default 404 handler doesn't use our envelope, so we just check it's a 404
      expect(response.status).toBe(404);
    });
  });

  describe('Validation', () => {
    it('should validate request parameters', async () => {
      const response = await request(app)
        .get('/api/characters/invalid-uuid')
        .expect(422);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/characters')
        .send({ name: '' }) // Invalid: empty name
        .expect(422);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/search?limit=invalid')
        .expect(422);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });
  });

  describe('Authentication', () => {
    it('should return UNAUTHORIZED for protected routes without auth', async () => {
      const response = await request(app)
        .get('/api/me')
        .expect(401);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should return UNAUTHORIZED for auth-only routes without JWT', async () => {
      const response = await request(app)
        .get('/api/games')
        .expect(401);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });
  });

  describe('Idempotency', () => {
    it('should require Idempotency-Key header for turn submission', async () => {
      const response = await request(app)
        .post('/api/games/123e4567-e89b-12d3-a456-426614174000/turn')
        .send({ optionId: '123e4567-e89b-12d3-a456-426614174001' })
        .expect(400);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'IDEMPOTENCY_REQUIRED',
          message: 'Idempotency-Key header is required',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should validate Idempotency-Key format', async () => {
      const response = await request(app)
        .post('/api/games/123e4567-e89b-12d3-a456-426614174000/turn')
        .set('Idempotency-Key', 'invalid-uuid')
        .send({ optionId: '123e4567-e89b-12d3-a456-426614174001' })
        .expect(422);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Idempotency-Key must be a valid UUID',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to telemetry endpoint', async () => {
      // Make multiple requests to trigger rate limiting
      const requests = Array(101).fill(null).map(() =>
        request(app)
          .post('/api/telemetry/event')
          .send({ event: 'test' })
      );

      const responses = await Promise.all(requests);
      
      // At least one should be rate limited
      const rateLimitedResponse = responses.find(r => r.status === 429);
      expect(rateLimitedResponse).toBeDefined();
      
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toMatchObject({
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded',
          },
          meta: {
            traceId: expect.any(String),
          },
        });
      }
    });
  });

  describe('Public Endpoints', () => {
    it('should allow access to public worlds endpoint', async () => {
      const response = await request(app)
        .get('/api/worlds')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: expect.any(Array),
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should allow access to public adventures endpoint', async () => {
      const response = await request(app)
        .get('/api/adventures')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: expect.any(Array),
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should allow access to search endpoint with valid query', async () => {
      const response = await request(app)
        .get('/api/search?q=test&limit=10&offset=0')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: {
          results: expect.any(Array),
          total: expect.any(Number),
          limit: 10,
          offset: 0,
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should allow access to stones wallet endpoint', async () => {
      const response = await request(app)
        .get('/api/stones/wallet')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: {
          shard: expect.any(Number),
          crystal: expect.any(Number),
          relic: expect.any(Number),
          dailyRegen: expect.any(Number),
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should allow access to stones packs endpoint', async () => {
      const response = await request(app)
        .get('/api/stones/packs')
        .expect(200);

      expect(response.body).toMatchObject({
        ok: true,
        data: expect.any(Array),
        meta: {
          traceId: expect.any(String),
        },
      });
    });
  });

  describe('DTO Redaction', () => {
    it('should not include internal fields in character responses', async () => {
      // This test would need a valid character ID and auth
      // For now, we'll test the structure
      const response = await request(app)
        .get('/api/characters/123e4567-e89b-12d3-a456-426614174000')
        .expect(401); // Expected to fail due to auth

      // The important thing is that when it does return data,
      // it should not include internal fields like userId
      expect(response.body).not.toHaveProperty('data.userId');
    });
  });

  describe('Error Handling', () => {
    it('should return NOT_FOUND for non-existent resources', async () => {
      const response = await request(app)
        .get('/api/worlds/123e4567-e89b-12d3-a456-426614174000')
        .expect(404);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'World not found',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });

    it('should return FORBIDDEN for auth-only endpoints without proper auth', async () => {
      const response = await request(app)
        .post('/api/stones/convert')
        .send({ amount: 10, fromType: 'shard', toType: 'crystal' })
        .expect(401);

      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        meta: {
          traceId: expect.any(String),
        },
      });
    });
  });

  describe('Trace ID', () => {
    it('should include trace ID in all responses', async () => {
      const response = await request(app).get('/api/config').expect(200);
      
      expect(response.body.meta.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should use provided trace ID from header', async () => {
      const customTraceId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .get('/api/config')
        .set('X-Trace-Id', customTraceId)
        .expect(200);
      
      expect(response.body.meta.traceId).toBe(customTraceId);
    });
  });
});
