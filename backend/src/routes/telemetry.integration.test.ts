import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { supabaseAdmin } from '../services/supabase.js';
import { configService } from '../services/config.service.js';

describe('Telemetry Endpoints Integration Tests', () => {
  beforeEach(async () => {
    // Clean up any existing telemetry events
    await supabaseAdmin.from('telemetry_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  afterEach(async () => {
    // Clean up test data
    await supabaseAdmin.from('telemetry_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  describe('POST /api/telemetry/event', () => {
    it('should record a basic telemetry event', async () => {
      const eventData = {
        name: 'test_event',
        props: {
          testProp: 'testValue',
        },
      };

      const response = await request(app)
        .post('/api/telemetry/event')
        .send(eventData)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.meta.traceId).toBeDefined();
    });

    it('should handle invalid event data', async () => {
      const invalidEventData = {
        name: '', // Empty name should fail validation
        props: 'invalid', // Props should be object
      };

      const response = await request(app)
        .post('/api/telemetry/event')
        .send(invalidEventData)
        .expect(422);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should respect rate limiting', async () => {
      const eventData = {
        name: 'test_event',
        props: {},
      };

      // Send multiple requests rapidly to trigger rate limiting
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/telemetry/event')
          .send(eventData)
      );

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/telemetry/gameplay', () => {
    it('should record a gameplay telemetry event', async () => {
      const gameplayEvent = {
        name: 'turn_started',
        props: {
          gameId: 'test-game-123',
          characterId: 'test-char-456',
          worldId: 'test-world-789',
          turnNumber: 1,
        },
      };

      const response = await request(app)
        .post('/api/telemetry/gameplay')
        .send(gameplayEvent)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.eventId).toBeDefined();
      expect(response.body.meta.traceId).toBeDefined();
    });

    it('should validate gameplay event schema', async () => {
      const invalidGameplayEvent = {
        name: 'invalid_event_name', // Not in allowed enum
        props: {
          gameId: 'test-game-123',
        },
      };

      const response = await request(app)
        .post('/api/telemetry/gameplay')
        .send(invalidGameplayEvent)
        .expect(422);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should enhance props with user context for authenticated users', async () => {
      // Mock authenticated user context
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      const gameplayEvent = {
        name: 'turn_completed',
        props: {
          gameId: 'test-game-123',
          duration: 1500,
        },
      };

      const response = await request(app)
        .post('/api/telemetry/gameplay')
        .set('Authorization', 'Bearer valid-token')
        .send(gameplayEvent)
        .expect(200);

      expect(response.body.ok).toBe(true);
      
      // Check that event was stored with user context
      const { data: events } = await supabaseAdmin
        .from('telemetry_events')
        .select('*')
        .eq('name', 'turn_completed')
        .limit(1);

      expect(events).toHaveLength(1);
      expect(events![0].props).toMatchObject({
        gameId: 'test-game-123',
        duration: 1500,
        ownerKind: 'user',
      });
    });

    it('should handle guest users correctly', async () => {
      const gameplayEvent = {
        name: 'spawn_success',
        props: {
          gameId: 'test-game-123',
          characterId: 'test-char-456',
        },
      };

      const response = await request(app)
        .post('/api/telemetry/gameplay')
        .set('X-Guest-Cookie-Id', 'guest-cookie-123')
        .send(gameplayEvent)
        .expect(200);

      expect(response.body.ok).toBe(true);
      
      // Check that event was stored with guest context
      const { data: events } = await supabaseAdmin
        .from('telemetry_events')
        .select('*')
        .eq('name', 'spawn_success')
        .limit(1);

      expect(events).toHaveLength(1);
      expect(events![0].props).toMatchObject({
        gameId: 'test-game-123',
        characterId: 'test-char-456',
        ownerKind: 'guest',
      });
      expect(events![0].cookie_id).toBe('guest-cookie-123');
    });

    it('should handle all gameplay event types', async () => {
      const eventTypes = [
        'turn_started',
        'turn_completed',
        'turn_failed',
        'spawn_success',
        'spawn_conflict',
        'guest_to_auth_merge',
        'purchase_attempt',
        'purchase_success',
        'purchase_failed',
        'error_shown',
        'retry_attempted',
        'game_loaded',
      ];

      for (const eventType of eventTypes) {
        const eventData = {
          name: eventType,
          props: {
            testProp: 'testValue',
          },
        };

        const response = await request(app)
          .post('/api/telemetry/gameplay')
          .send(eventData)
          .expect(200);

        expect(response.body.ok).toBe(true);
      }
    });
  });

  describe('GET /api/telemetry/config', () => {
    it('should return telemetry configuration', async () => {
      const response = await request(app)
        .get('/api/telemetry/config')
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveProperty('enabled');
      expect(response.body.data).toHaveProperty('sampleRate');
      expect(response.body.data).toHaveProperty('features');
      expect(response.body.data).toHaveProperty('environment');
    });

    it('should include traceId in response', async () => {
      const response = await request(app)
        .get('/api/telemetry/config')
        .expect(200);

      expect(response.body.meta.traceId).toBeDefined();
    });

    it('should handle config service errors gracefully', async () => {
      // Mock config service to throw error
      const originalGetFeatures = configService.getFeatures;
      configService.getFeatures = () => {
        throw new Error('Config service error');
      };

      const response = await request(app)
        .get('/api/telemetry/config')
        .expect(500);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');

      // Restore original method
      configService.getFeatures = originalGetFeatures;
    });
  });

  describe('Telemetry Service Integration', () => {
    it('should respect telemetry feature flag', async () => {
      // Mock config to disable telemetry
      const originalGetFeatures = configService.getFeatures;
      configService.getFeatures = () => [
        { key: 'telemetry_enabled', enabled: false },
      ];

      const gameplayEvent = {
        name: 'turn_started',
        props: {
          gameId: 'test-game-123',
        },
      };

      const response = await request(app)
        .post('/api/telemetry/gameplay')
        .send(gameplayEvent)
        .expect(200);

      expect(response.body.ok).toBe(true);
      
      // Check that no event was stored in database
      const { data: events } = await supabaseAdmin
        .from('telemetry_events')
        .select('*')
        .eq('name', 'turn_started');

      expect(events).toHaveLength(0);

      // Restore original method
      configService.getFeatures = originalGetFeatures;
    });

    it('should apply sampling rate correctly', async () => {
      // Mock config with 0% sampling rate
      const originalGetApp = configService.getApp;
      configService.getApp = () => ({
        telemetrySampleRate: 0.0,
      });

      const gameplayEvent = {
        name: 'turn_started',
        props: {
          gameId: 'test-game-123',
        },
      };

      const response = await request(app)
        .post('/api/telemetry/gameplay')
        .send(gameplayEvent)
        .expect(200);

      expect(response.body.ok).toBe(true);
      
      // Check that no event was stored in database
      const { data: events } = await supabaseAdmin
        .from('telemetry_events')
        .select('*')
        .eq('name', 'turn_started');

      expect(events).toHaveLength(0);

      // Restore original method
      configService.getApp = originalGetApp;
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database to throw error
      const originalInsert = supabaseAdmin.from('telemetry_events').insert;
      supabaseAdmin.from('telemetry_events').insert = () => {
        throw new Error('Database connection failed');
      };

      const gameplayEvent = {
        name: 'turn_started',
        props: {
          gameId: 'test-game-123',
        },
      };

      const response = await request(app)
        .post('/api/telemetry/gameplay')
        .send(gameplayEvent)
        .expect(200);

      // Should still return success to not break user flow
      expect(response.body.ok).toBe(true);

      // Restore original method
      supabaseAdmin.from('telemetry_events').insert = originalInsert;
    });

    it('should handle malformed request bodies', async () => {
      const response = await request(app)
        .post('/api/telemetry/gameplay')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.ok).toBe(false);
    });
  });

  describe('Response Format', () => {
    it('should include traceId in all responses', async () => {
      const responses = await Promise.all([
        request(app).get('/api/telemetry/config'),
        request(app).post('/api/telemetry/event').send({ name: 'test' }),
        request(app).post('/api/telemetry/gameplay').send({ name: 'turn_started', props: {} }),
      ]);

      responses.forEach(response => {
        expect(response.body.meta.traceId).toBeDefined();
        expect(typeof response.body.meta.traceId).toBe('string');
      });
    });

    it('should maintain consistent response envelope format', async () => {
      const response = await request(app)
        .post('/api/telemetry/gameplay')
        .send({
          name: 'turn_started',
          props: { gameId: 'test-123' },
        })
        .expect(200);

      expect(response.body).toHaveProperty('ok');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('traceId');
      expect(response.body.meta).toHaveProperty('version');
    });
  });
});
