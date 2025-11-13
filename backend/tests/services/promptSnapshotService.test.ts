/**
 * Prompt Snapshot Service Tests
 * Phase 5: Unit tests for prompt snapshot service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPromptSnapshotForEntity, getLatestSnapshot, getSnapshotById } from '../../src/services/promptSnapshotService.js';
import { supabaseAdmin } from '../../src/services/supabase.js';
import { EntryPointAssemblerV3, CORE_PROMPT } from '../../src/prompts/entry-point-assembler-v3.js';
import { emitPublishingEvent } from '../../src/telemetry/publishingTelemetry.js';

// Mock dependencies
vi.mock('../../src/services/supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('../../src/prompts/entry-point-assembler-v3.js', () => ({
  EntryPointAssemblerV3: vi.fn(),
  CORE_PROMPT: '# Core Prompt',
}));

vi.mock('../../src/telemetry/publishingTelemetry.js', () => ({
  emitPublishingEvent: vi.fn(),
}));

describe('Prompt Snapshot Service', () => {
  const mockUserId = 'user-123';
  const mockPublishRequestId = 'publish-request-456';
  const mockEntryPointId = 'story-789';
  const mockWorldId = 'world-abc';
  const mockRulesetId = 'ruleset-def';
  const mockCoverMediaId = 'media-cover-123';
  const mockGalleryMediaId = 'media-gallery-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPromptSnapshotForEntity', () => {
    it('should create snapshot with version 1 when no prior snapshot exists', async () => {
      // Mock entry point
      const mockEntryPoint = {
        id: mockEntryPointId,
        slug: 'test-story',
        type: 'adventure',
        world_id: mockWorldId,
        prompt: null,
        doc: { prompt: { text: '# Story prompt' } },
        cover_media_id: mockCoverMediaId,
      };

      // Mock world
      const mockWorld = {
        id: mockWorldId,
        version: 'v1',
        doc: { prompt: { text: '# World prompt' } },
      };

      // Mock ruleset
      const mockRuleset = {
        id: mockRulesetId,
        slug: 'classic',
        version: 'v1',
        doc: { prompt: { text: '# Ruleset prompt' } },
      };

      // Mock gallery links
      const mockGalleryLinks = [
        {
          media_assets: {
            id: mockGalleryMediaId,
            status: 'ready',
            image_review_status: 'approved',
          },
        },
      ];

      // Mock assembler
      const mockAssembler = {
        extractRulesetPrompt: vi.fn().mockReturnValue('# Ruleset prompt'),
        extractWorldPrompt: vi.fn().mockReturnValue('# World prompt'),
      };
      (EntryPointAssemblerV3 as any).mockImplementation(() => mockAssembler);

      // Mock Supabase queries
      const mockEntryPointQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockEntryPoint, error: null }),
      };

      const mockWorldQuery = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: mockWorld, error: null }),
      };

      const mockRulesetQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { rulesets: mockRuleset },
          error: null,
        }),
      };

      const mockGalleryQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockGalleryLinks, error: null }),
      };

      const mockExistingSnapshotsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }), // No existing snapshots
      };

      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'snapshot-123',
            version: 1,
          },
          error: null,
        }),
      };

      (supabaseAdmin.from as any)
        .mockReturnValueOnce(mockEntryPointQuery) // entry_points
        .mockReturnValueOnce(mockWorldQuery) // worlds
        .mockReturnValueOnce(mockRulesetQuery) // entry_point_rulesets
        .mockReturnValueOnce(mockGalleryQuery) // media_links
        .mockReturnValueOnce(mockExistingSnapshotsQuery) // prompt_snapshots (check existing)
        .mockReturnValueOnce(mockInsertQuery); // prompt_snapshots (insert)

      const result = await createPromptSnapshotForEntity({
        entityType: 'story',
        entityId: mockEntryPointId,
        approvedByUserId: mockUserId,
        sourcePublishRequestId: mockPublishRequestId,
      });

      expect(result.version).toBe(1);
      expect(result.snapshotId).toBe('snapshot-123');
      expect(mockInsertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'story',
          entity_id: mockEntryPointId,
          version: 1,
          created_by: mockUserId,
          source_publish_request_id: mockPublishRequestId,
          data: expect.objectContaining({
            corePrompt: CORE_PROMPT,
            rulesetPrompt: '# Ruleset prompt',
            worldPrompt: '# World prompt',
            storyPrompt: '# Story prompt',
            coverMediaId: mockCoverMediaId,
            galleryMediaIds: [mockGalleryMediaId],
          }),
        })
      );
      expect(emitPublishingEvent).toHaveBeenCalledWith('publish.snapshot_created', expect.objectContaining({
        entity_type: 'story',
        entity_id: mockEntryPointId,
        snapshot_id: 'snapshot-123',
        version: 1,
        prompt_snapshot_id: 'snapshot-123',
        source_publish_request_id: mockPublishRequestId,
      }));
    });

    it('should create snapshot with incremented version when prior snapshots exist', async () => {
      // Mock existing snapshot
      const mockExistingSnapshots = [{ version: 3 }];

      const mockExistingSnapshotsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockExistingSnapshots, error: null }),
      };

      // Mock other queries (simplified)
      const mockEntryPointQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockEntryPointId,
            slug: 'test-story',
            world_id: mockWorldId,
            doc: {},
            cover_media_id: null,
          },
          error: null,
        }),
      };

      const mockWorldQuery = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: mockWorldId, version: 'v1', doc: {} },
          error: null,
        }),
      };

      const mockRulesetQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { rulesets: { id: mockRulesetId, doc: {} } },
          error: null,
        }),
      };

      const mockGalleryQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'snapshot-456', version: 4 },
          error: null,
        }),
      };

      const mockAssembler = {
        extractRulesetPrompt: vi.fn().mockReturnValue(''),
        extractWorldPrompt: vi.fn().mockReturnValue(''),
      };
      (EntryPointAssemblerV3 as any).mockImplementation(() => mockAssembler);

      (supabaseAdmin.from as any)
        .mockReturnValueOnce(mockEntryPointQuery)
        .mockReturnValueOnce(mockWorldQuery)
        .mockReturnValueOnce(mockRulesetQuery)
        .mockReturnValueOnce(mockGalleryQuery)
        .mockReturnValueOnce(mockExistingSnapshotsQuery)
        .mockReturnValueOnce(mockInsertQuery);

      const result = await createPromptSnapshotForEntity({
        entityType: 'story',
        entityId: mockEntryPointId,
        approvedByUserId: mockUserId,
      });

      expect(result.version).toBe(4);
      expect(mockInsertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 4,
        })
      );
    });

    it('should only include approved and ready gallery media', async () => {
      const mockGalleryLinks = [
        {
          media_assets: {
            id: 'media-1',
            status: 'ready',
            image_review_status: 'approved',
          },
        },
        {
          media_assets: {
            id: 'media-2',
            status: 'ready',
            image_review_status: 'pending', // Not approved
          },
        },
        {
          media_assets: {
            id: 'media-3',
            status: 'pending', // Not ready
            image_review_status: 'approved',
          },
        },
      ];

      const mockEntryPointQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockEntryPointId,
            slug: 'test-story',
            world_id: mockWorldId,
            doc: {},
            cover_media_id: null,
          },
          error: null,
        }),
      };

      const mockWorldQuery = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: mockWorldId, version: 'v1', doc: {} },
          error: null,
        }),
      };

      const mockRulesetQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { rulesets: { id: mockRulesetId, doc: {} } },
          error: null,
        }),
      };

      const mockGalleryQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockGalleryLinks, error: null }),
      };

      const mockExistingSnapshotsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockInsertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'snapshot-789', version: 1 },
          error: null,
        }),
      };

      const mockAssembler = {
        extractRulesetPrompt: vi.fn().mockReturnValue(''),
        extractWorldPrompt: vi.fn().mockReturnValue(''),
      };
      (EntryPointAssemblerV3 as any).mockImplementation(() => mockAssembler);

      (supabaseAdmin.from as any)
        .mockReturnValueOnce(mockEntryPointQuery)
        .mockReturnValueOnce(mockWorldQuery)
        .mockReturnValueOnce(mockRulesetQuery)
        .mockReturnValueOnce(mockGalleryQuery)
        .mockReturnValueOnce(mockExistingSnapshotsQuery)
        .mockReturnValueOnce(mockInsertQuery);

      await createPromptSnapshotForEntity({
        entityType: 'story',
        entityId: mockEntryPointId,
        approvedByUserId: mockUserId,
      });

      expect(mockInsertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            galleryMediaIds: ['media-1'], // Only approved and ready
          }),
        })
      );
    });

    it('should throw error with consistent code on failure', async () => {
      const mockEntryPointQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Entry point not found' },
        }),
      };

      (supabaseAdmin.from as any).mockReturnValue(mockEntryPointQuery);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        createPromptSnapshotForEntity({
          entityType: 'story',
          entityId: mockEntryPointId,
          approvedByUserId: mockUserId,
        })
      ).rejects.toThrow('Entry point');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[snapshot.create_failed]'),
        expect.stringContaining('entityType=story'),
        expect.stringContaining('entityId=' + mockEntryPointId)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return highest-version snapshot for given entity', async () => {
      const mockSnapshots = [
        { id: 'snapshot-1', version: 2, data: { worldPrompt: 'v2' } },
        { id: 'snapshot-2', version: 1, data: { worldPrompt: 'v1' } },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockSnapshots[0],
          error: null,
        }),
      };

      (supabaseAdmin.from as any).mockReturnValue(mockQuery);

      const result = await getLatestSnapshot('story', mockEntryPointId);

      expect(result).toEqual({
        id: 'snapshot-1',
        version: 2,
        data: { worldPrompt: 'v2' },
      });
      expect(mockQuery.eq).toHaveBeenCalledWith('entity_type', 'story');
      expect(mockQuery.eq).toHaveBeenCalledWith('entity_id', mockEntryPointId);
      expect(mockQuery.order).toHaveBeenCalledWith('version', { ascending: false });
    });

    it('should return null when no snapshot exists', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      (supabaseAdmin.from as any).mockReturnValue(mockQuery);

      const result = await getLatestSnapshot('story', mockEntryPointId);

      expect(result).toBeNull();
    });
  });

  describe('getSnapshotById', () => {
    it('should return snapshot by ID', async () => {
      const mockSnapshot = {
        id: 'snapshot-123',
        version: 1,
        entity_type: 'story',
        entity_id: mockEntryPointId,
        data: { worldPrompt: 'test' },
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockSnapshot,
          error: null,
        }),
      };

      (supabaseAdmin.from as any).mockReturnValue(mockQuery);

      const result = await getSnapshotById('snapshot-123');

      expect(result).toEqual({
        id: 'snapshot-123',
        version: 1,
        entity_type: 'story',
        entity_id: mockEntryPointId,
        data: { worldPrompt: 'test' },
      });
    });

    it('should return null when snapshot not found', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      (supabaseAdmin.from as any).mockReturnValue(mockQuery);

      const result = await getSnapshotById('non-existent');

      expect(result).toBeNull();
    });
  });
});


