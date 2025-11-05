/**
 * Early Access Guard Integration Tests
 * Phase B2: Verify Early Access enforcement on protected routes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { earlyAccessGuard } from '../src/middleware/earlyAccessGuard.js';
import * as featureFlags from '../src/config/featureFlags.js';
import * as roleResolver from '../src/services/roleResolver.js';

// Mock modules
vi.mock('../src/config/featureFlags.js');
vi.mock('../src/services/roleResolver.js');

describe('Early Access Guard', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', earlyAccessGuard);

    // Mock protected route
    app.get('/api/games/:id', (req, res) => {
      res.json({ ok: true, data: { id: req.params.id } });
    });

    // Mock allowlisted route
    app.get('/api/catalog/npcs', (req, res) => {
      res.json({ ok: true, data: [] });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('EA on, anon → 401', () => {
    it('should return 401 UNAUTHORIZED for anonymous requests to protected routes', async () => {
      vi.mocked(featureFlags.isEarlyAccessOn).mockReturnValue(true);
      vi.mocked(roleResolver.resolveRole).mockResolvedValue({
        role: null,
        authed: false,
      });

      const response = await request(app).get('/api/games/xyz');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Sign in required.',
      });
      expect(response.headers['www-authenticate']).toBe('Bearer realm="StoneCaster API"');
    });
  });

  describe('EA on, authed pending → 403', () => {
    it('should return 403 EARLY_ACCESS_REQUIRED for authenticated pending users', async () => {
      vi.mocked(featureFlags.isEarlyAccessOn).mockReturnValue(true);
      vi.mocked(roleResolver.resolveRole).mockResolvedValue({
        role: 'pending',
        authed: true,
      });

      const response = await request(app)
        .get('/api/games/xyz')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        ok: false,
        code: 'EARLY_ACCESS_REQUIRED',
        message: 'Early access approval required.',
      });
      expect(response.headers['x-reason']).toBe('EARLY_ACCESS_REQUIRED');
    });
  });

  describe('EA on, authed early_access → 200', () => {
    it('should allow access for early_access users', async () => {
      vi.mocked(featureFlags.isEarlyAccessOn).mockReturnValue(true);
      vi.mocked(roleResolver.resolveRole).mockResolvedValue({
        role: 'early_access',
        authed: true,
      });

      const response = await request(app)
        .get('/api/games/xyz')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: { id: 'xyz' },
      });
    });

    it('should allow access for admin users', async () => {
      vi.mocked(featureFlags.isEarlyAccessOn).mockReturnValue(true);
      vi.mocked(roleResolver.resolveRole).mockResolvedValue({
        role: 'admin',
        authed: true,
      });

      const response = await request(app)
        .get('/api/games/xyz')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: { id: 'xyz' },
      });
    });
  });

  describe('EA off, anon → 200', () => {
    it('should bypass guard when Early Access mode is off', async () => {
      vi.mocked(featureFlags.isEarlyAccessOn).mockReturnValue(false);
      // resolveRole should not be called when EA is off
      vi.mocked(roleResolver.resolveRole).mockResolvedValue({
        role: null,
        authed: false,
      });

      const response = await request(app).get('/api/games/xyz');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: { id: 'xyz' },
      });
      // Should not call resolveRole when EA is off
      expect(roleResolver.resolveRole).not.toHaveBeenCalled();
    });
  });

  describe('Allowlisted routes unaffected', () => {
    it('should allow access to /api/catalog routes regardless of EA mode', async () => {
      vi.mocked(featureFlags.isEarlyAccessOn).mockReturnValue(true);
      vi.mocked(roleResolver.resolveRole).mockResolvedValue({
        role: 'pending',
        authed: false,
      });

      const response = await request(app).get('/api/catalog/npcs');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: [],
      });
      // Should not call resolveRole for allowlisted routes
      expect(roleResolver.resolveRole).not.toHaveBeenCalled();
    });

    it('should allow access to /api/health regardless of EA mode', async () => {
      app.get('/api/health', (req, res) => {
        res.json({ status: 'ok' });
      });

      vi.mocked(featureFlags.isEarlyAccessOn).mockReturnValue(true);
      vi.mocked(roleResolver.resolveRole).mockResolvedValue({
        role: 'pending',
        authed: false,
      });

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
      expect(roleResolver.resolveRole).not.toHaveBeenCalled();
    });
  });

  describe('Header contract', () => {
    it('should include x-reason header in 403 responses', async () => {
      vi.mocked(featureFlags.isEarlyAccessOn).mockReturnValue(true);
      vi.mocked(roleResolver.resolveRole).mockResolvedValue({
        role: 'pending',
        authed: true,
      });

      const response = await request(app)
        .get('/api/games/xyz')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(403);
      expect(response.headers['x-reason']).toBe('EARLY_ACCESS_REQUIRED');
    });
  });

  describe('Member role', () => {
    it('should block access for member users (only early_access and admin allowed)', async () => {
      vi.mocked(featureFlags.isEarlyAccessOn).mockReturnValue(true);
      vi.mocked(roleResolver.resolveRole).mockResolvedValue({
        role: 'member',
        authed: true,
      });

      const response = await request(app)
        .get('/api/games/xyz')
        .set('Authorization', 'Bearer test-token');

      // Member role should be blocked (only early_access and admin are allowed)
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('EARLY_ACCESS_REQUIRED');
    });
  });
});

