import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import charactersRouter from './characters.js';
import { supabase } from '../services/supabase.js';
import { ApiErrorCode } from 'shared';

// Mock the supabase service
vi.mock('../services/supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            single: vi.fn(),
            then: vi.fn()
          }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn()
      }))
    }))
  }
}));

// Mock the content service for world validation
vi.mock('../services/content.service.js', () => ({
  contentService: {
    getWorlds: vi.fn(() => Promise.resolve([
      { slug: 'mystika', name: 'Mystika' },
      { slug: 'aetherium', name: 'Aetherium' },
      { slug: 'voidreach', name: 'Voidreach' }
    ]))
  }
}));

const app = express();
app.use(express.json());
app.use('/api/characters', charactersRouter);

describe('Layer M1 - Character CRUD Operations', () => {
  const mockUserId = uuidv4();
  const mockGuestId = uuidv4();
  const mockCharacterId = uuidv4();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Character Creation (POST /api/characters)', () => {
    it('should create character for authenticated user with valid worldSlug', async () => {
      const characterData = {
        name: 'Test Character',
        race: 'Human',
        class: 'Warrior',
        level: 1,
        experience: 0,
        attributes: {
          strength: 15,
          dexterity: 12,
          constitution: 14,
          intelligence: 10,
          wisdom: 13,
          charisma: 11
        },
        skills: ['Swordsmanship'],
        inventory: [],
        currentHealth: 10,
        maxHealth: 10,
        worldSlug: 'mystika'
      };

      const mockCharacter = {
        id: mockCharacterId,
        userId: mockUserId,
        ...characterData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mock successful character creation
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockCharacter, error: null }))
          }))
        }))
      } as any);

      const response = await request(app)
        .post('/api/characters')
        .set('Authorization', `Bearer valid-jwt-token`)
        .send(characterData)
        .expect(201);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.id).toBe(mockCharacterId);
      expect(response.body.data.name).toBe('Test Character');
      expect(response.body.data.worldSlug).toBe('mystika');
      expect(response.body.meta.traceId).toBeDefined();
    });

    it('should create character for guest user with valid worldSlug', async () => {
      const characterData = {
        name: 'Guest Character',
        race: 'Elf',
        class: 'Mage',
        level: 1,
        experience: 0,
        attributes: {
          strength: 10,
          dexterity: 14,
          constitution: 12,
          intelligence: 16,
          wisdom: 15,
          charisma: 13
        },
        skills: ['Magic'],
        inventory: [],
        currentHealth: 8,
        maxHealth: 8,
        worldSlug: 'aetherium'
      };

      const mockCharacter = {
        id: mockCharacterId,
        userId: mockGuestId,
        ...characterData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mock successful character creation for guest
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockCharacter, error: null }))
          }))
        }))
      } as any);

      const response = await request(app)
        .post('/api/characters')
        .set('Cookie', `guestId=${mockGuestId}`)
        .send(characterData)
        .expect(201);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.id).toBe(mockCharacterId);
      expect(response.body.data.name).toBe('Guest Character');
      expect(response.body.data.worldSlug).toBe('aetherium');
      expect(response.body.meta.traceId).toBeDefined();
    });

    it('should reject character creation with invalid worldSlug', async () => {
      const characterData = {
        name: 'Test Character',
        race: 'Human',
        class: 'Warrior',
        level: 1,
        experience: 0,
        attributes: {
          strength: 15,
          dexterity: 12,
          constitution: 14,
          intelligence: 10,
          wisdom: 13,
          charisma: 11
        },
        skills: ['Swordsmanship'],
        inventory: [],
        currentHealth: 10,
        maxHealth: 10,
        worldSlug: 'invalid-world'
      };

      const response = await request(app)
        .post('/api/characters')
        .set('Authorization', `Bearer valid-jwt-token`)
        .send(characterData)
        .expect(422);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.VALIDATION_FAILED);
      expect(response.body.error.message).toContain('Invalid world');
      expect(response.body.meta.traceId).toBeDefined();
    });

    it('should reject character creation without authentication', async () => {
      const characterData = {
        name: 'Test Character',
        race: 'Human',
        class: 'Warrior',
        level: 1,
        experience: 0,
        attributes: {
          strength: 15,
          dexterity: 12,
          constitution: 14,
          intelligence: 10,
          wisdom: 13,
          charisma: 11
        },
        skills: ['Swordsmanship'],
        inventory: [],
        currentHealth: 10,
        maxHealth: 10,
        worldSlug: 'mystika'
      };

      const response = await request(app)
        .post('/api/characters')
        .send(characterData)
        .expect(401);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
      expect(response.body.meta.traceId).toBeDefined();
    });
  });

  describe('Character Listing (GET /api/characters)', () => {
    it('should list characters for authenticated user', async () => {
      const mockCharacters = [
        {
          id: mockCharacterId,
          userId: mockUserId,
          name: 'Character 1',
          race: 'Human',
          class: 'Warrior',
          level: 1,
          experience: 0,
          attributes: { strength: 15, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 13, charisma: 11 },
          skills: ['Swordsmanship'],
          inventory: [],
          currentHealth: 10,
          maxHealth: 10,
          worldSlug: 'mystika',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // Mock successful character listing
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockCharacters, error: null }))
          }))
        }))
      } as any);

      const response = await request(app)
        .get('/api/characters')
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(mockCharacterId);
      expect(response.body.data[0].name).toBe('Character 1');
      expect(response.body.meta.traceId).toBeDefined();
    });

    it('should list characters for guest user', async () => {
      const mockCharacters = [
        {
          id: mockCharacterId,
          userId: mockGuestId,
          name: 'Guest Character',
          race: 'Elf',
          class: 'Mage',
          level: 1,
          experience: 0,
          attributes: { strength: 10, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 15, charisma: 13 },
          skills: ['Magic'],
          inventory: [],
          currentHealth: 8,
          maxHealth: 8,
          worldSlug: 'aetherium',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // Mock successful character listing for guest
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockCharacters, error: null }))
          }))
        }))
      } as any);

      const response = await request(app)
        .get('/api/characters')
        .set('Cookie', `guestId=${mockGuestId}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(mockCharacterId);
      expect(response.body.data[0].name).toBe('Guest Character');
      expect(response.body.meta.traceId).toBeDefined();
    });

    it('should reject character listing without authentication', async () => {
      const response = await request(app)
        .get('/api/characters')
        .expect(401);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.UNAUTHORIZED);
      expect(response.body.meta.traceId).toBeDefined();
    });
  });

  describe('Character Reading (GET /api/characters/:id)', () => {
    it('should read character for authenticated user', async () => {
      const mockCharacter = {
        id: mockCharacterId,
        userId: mockUserId,
        name: 'Character 1',
        race: 'Human',
        class: 'Warrior',
        level: 1,
        experience: 0,
        attributes: { strength: 15, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 13, charisma: 11 },
        skills: ['Swordsmanship'],
        inventory: [],
        currentHealth: 10,
        maxHealth: 10,
        worldSlug: 'mystika',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mock successful character reading
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: mockCharacter, error: null }))
            }))
          }))
        }))
      } as any);

      const response = await request(app)
        .get(`/api/characters/${mockCharacterId}`)
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.id).toBe(mockCharacterId);
      expect(response.body.data.name).toBe('Character 1');
      expect(response.body.meta.traceId).toBeDefined();
    });

    it('should reject reading character from different user', async () => {
      const otherUserId = uuidv4();
      const mockCharacter = {
        id: mockCharacterId,
        userId: otherUserId, // Different user
        name: 'Other Character',
        race: 'Human',
        class: 'Warrior',
        level: 1,
        experience: 0,
        attributes: { strength: 15, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 13, charisma: 11 },
        skills: ['Swordsmanship'],
        inventory: [],
        currentHealth: 10,
        maxHealth: 10,
        worldSlug: 'mystika',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mock character found but different owner
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } }))
            }))
          }))
        }))
      } as any);

      const response = await request(app)
        .get(`/api/characters/${mockCharacterId}`)
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(404);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.NOT_FOUND);
      expect(response.body.meta.traceId).toBeDefined();
    });
  });

  describe('Character Update (PATCH /api/characters/:id)', () => {
    it('should update character for authenticated user', async () => {
      const updateData = {
        name: 'Updated Character',
        level: 2
      };

      const mockUpdatedCharacter = {
        id: mockCharacterId,
        userId: mockUserId,
        name: 'Updated Character',
        race: 'Human',
        class: 'Warrior',
        level: 2,
        experience: 0,
        attributes: { strength: 15, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 13, charisma: 11 },
        skills: ['Swordsmanship'],
        inventory: [],
        currentHealth: 10,
        maxHealth: 10,
        worldSlug: 'mystika',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mock successful character update
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: mockUpdatedCharacter, error: null }))
              }))
            }))
          }))
        }))
      } as any);

      const response = await request(app)
        .patch(`/api/characters/${mockCharacterId}`)
        .set('Authorization', `Bearer valid-jwt-token`)
        .send(updateData)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.id).toBe(mockCharacterId);
      expect(response.body.data.name).toBe('Updated Character');
      expect(response.body.data.level).toBe(2);
      expect(response.body.meta.traceId).toBeDefined();
    });

    it('should reject updating character from different user', async () => {
      const updateData = {
        name: 'Hacked Character'
      };

      // Mock update fails due to ownership check
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } }))
              }))
            }))
          }))
        }))
      } as any);

      const response = await request(app)
        .patch(`/api/characters/${mockCharacterId}`)
        .set('Authorization', `Bearer valid-jwt-token`)
        .send(updateData)
        .expect(404);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.NOT_FOUND);
      expect(response.body.meta.traceId).toBeDefined();
    });
  });

  describe('Character Deletion (DELETE /api/characters/:id)', () => {
    it('should delete character for authenticated user', async () => {
      // Mock successful character deletion
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null }))
          }))
        }))
      } as any);

      const response = await request(app)
        .delete(`/api/characters/${mockCharacterId}`)
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(204);

      expect(response.body).toEqual({});
    });

    it('should reject deleting character from different user', async () => {
      // Mock deletion fails due to ownership check
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: { code: 'PGRST116' } }))
          }))
        }))
      } as any);

      const response = await request(app)
        .delete(`/api/characters/${mockCharacterId}`)
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(500);

      expect(response.body.ok).toBe(false);
      expect(response.body.error.code).toBe(ApiErrorCode.INTERNAL_ERROR);
      expect(response.body.meta.traceId).toBeDefined();
    });
  });

  describe('DTO Redaction', () => {
    it('should not include internal fields in character responses', async () => {
      const mockCharacter = {
        id: mockCharacterId,
        userId: mockUserId,
        name: 'Test Character',
        race: 'Human',
        class: 'Warrior',
        level: 1,
        experience: 0,
        attributes: { strength: 15, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 13, charisma: 11 },
        skills: ['Swordsmanship'],
        inventory: [],
        currentHealth: 10,
        maxHealth: 10,
        worldSlug: 'mystika',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Internal fields that should be redacted
        internalFlags: ['test_flag'],
        systemMetadata: { source: 'test' }
      };

      // Mock successful character reading
      const mockSupabase = vi.mocked(supabase);
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: mockCharacter, error: null }))
            }))
          }))
        }))
      } as any);

      const response = await request(app)
        .get(`/api/characters/${mockCharacterId}`)
        .set('Authorization', `Bearer valid-jwt-token`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.data.id).toBe(mockCharacterId);
      expect(response.body.data.name).toBe('Test Character');
      // Internal fields should not be present
      expect(response.body.data.internalFlags).toBeUndefined();
      expect(response.body.data.systemMetadata).toBeUndefined();
      expect(response.body.data.userId).toBeUndefined(); // userId should be redacted
      expect(response.body.meta.traceId).toBeDefined();
    });
  });
});
