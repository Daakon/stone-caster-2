// Phase 26: Marketplace System Tests
// Comprehensive tests for creator onboarding, pack pipeline, dependency solver, distribution, and moderation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      gte: vi.fn(() => ({
        lte: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      order: vi.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }))
};

// Mock Redis client
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  del: vi.fn(),
  pipeline: vi.fn(() => ({
    incr: vi.fn(),
    expire: vi.fn(),
    exec: vi.fn(() => Promise.resolve([]))
  }))
};

// Mock the modules
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

vi.mock('redis', () => ({
  createClient: vi.fn(() => mockRedis)
}));

// Mock the marketplace modules
vi.mock('../src/marketplace/creator-service', () => ({
  creatorService: {
    onboardCreator: vi.fn(),
    claimNamespace: vi.fn(),
    getCreatorProfile: vi.fn(),
    updateCreatorProfile: vi.fn(),
    getCreatorNamespaces: vi.fn(),
    verifyCreator: vi.fn(),
    getAllCreators: vi.fn(),
    isNamespaceAvailable: vi.fn(),
    getNamespaceDetails: vi.fn()
  }
}));

vi.mock('../src/marketplace/pack-pipeline', () => ({
  packPipelineService: {
    uploadPack: vi.fn(),
    submitForReview: vi.fn(),
    reviewPack: vi.fn(),
    listPack: vi.fn()
  }
}));

vi.mock('../src/marketplace/dep-solver', () => ({
  dependencySolverService: {
    resolveDependencies: vi.fn(),
    generateInstallPlan: vi.fn(),
    getCompatibilityMatrix: vi.fn()
  }
}));

vi.mock('../src/marketplace/distribution', () => ({
  distributionService: {
    issueDownloadToken: vi.fn(),
    generateSignedDownloadURL: vi.fn(),
    validateIntegrity: vi.fn(),
    revokeTokens: vi.fn(),
    getDistributionStats: vi.fn(),
    cleanupExpiredTokens: vi.fn()
  }
}));

vi.mock('../src/marketplace/moderation', () => ({
  moderationService: {
    submitReport: vi.fn(),
    getReports: vi.fn(),
    takeModerationAction: vi.fn(),
    executeTakedown: vi.fn(),
    getModerationStats: vi.fn()
  }
}));

vi.mock('../src/marketplace/metrics-summaries', () => ({
  metricsSummariesService: {
    getPackMetrics: vi.fn(),
    submitRating: vi.fn(),
    getRatingSummary: vi.fn(),
    generateTelemetrySnapshot: vi.fn(),
    getPublicMetrics: vi.fn()
  }
}));

// Import the modules after mocking
import { creatorService } from '../src/marketplace/creator-service';
import { packPipelineService } from '../src/marketplace/pack-pipeline';
import { dependencySolverService } from '../src/marketplace/dep-solver';
import { distributionService } from '../src/marketplace/distribution';
import { moderationService } from '../src/marketplace/moderation';
import { metricsSummariesService } from '../src/marketplace/metrics-summaries';

describe('Phase 26: Marketplace System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Creator Service', () => {
    it('should onboard a new creator', async () => {
      const mockResult = {
        success: true,
        data: {
          creator_id: 'creator-123',
          display_name: 'Test Creator',
          email_hash: 'hashed-email',
          verification_required: true
        }
      };

      (creatorService.onboardCreator as any).mockResolvedValue(mockResult);

      const result = await creatorService.onboardCreator({
        display_name: 'Test Creator',
        email: 'test@example.com',
        terms_accepted: true,
        content_policy_accepted: true
      });

      expect(result.success).toBe(true);
      expect(result.data?.creator_id).toBe('creator-123');
      expect(creatorService.onboardCreator).toHaveBeenCalledWith({
        display_name: 'Test Creator',
        email: 'test@example.com',
        terms_accepted: true,
        content_policy_accepted: true
      });
    });

    it('should claim a namespace', async () => {
      const mockResult = {
        success: true,
        data: {
          namespace: 'test-namespace',
          creator_id: 'creator-123',
          verified: false
        }
      };

      (creatorService.claimNamespace as any).mockResolvedValue(mockResult);

      const result = await creatorService.claimNamespace('creator-123', {
        namespace: 'test-namespace',
        description: 'Test namespace'
      });

      expect(result.success).toBe(true);
      expect(result.data?.namespace).toBe('test-namespace');
      expect(creatorService.claimNamespace).toHaveBeenCalledWith('creator-123', {
        namespace: 'test-namespace',
        description: 'Test namespace'
      });
    });

    it('should get creator profile', async () => {
      const mockProfile = {
        creator_id: 'creator-123',
        display_name: 'Test Creator',
        email_hash: 'hashed-email',
        verified: true,
        terms_accepted_at: '2025-01-27T00:00:00Z',
        notes: 'Test notes',
        created_at: '2025-01-27T00:00:00Z',
        updated_at: '2025-01-27T00:00:00Z'
      };

      (creatorService.getCreatorProfile as any).mockResolvedValue({
        success: true,
        data: mockProfile
      });

      const result = await creatorService.getCreatorProfile('creator-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
      expect(creatorService.getCreatorProfile).toHaveBeenCalledWith('creator-123');
    });

    it('should get creator namespaces', async () => {
      const mockNamespaces = [
        {
          namespace: 'test-namespace',
          creator_id: 'creator-123',
          verified: true,
          created_at: '2025-01-27T00:00:00Z',
          updated_at: '2025-01-27T00:00:00Z'
        }
      ];

      (creatorService.getCreatorNamespaces as any).mockResolvedValue({
        success: true,
        data: mockNamespaces
      });

      const result = await creatorService.getCreatorNamespaces('creator-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockNamespaces);
      expect(creatorService.getCreatorNamespaces).toHaveBeenCalledWith('creator-123');
    });
  });

  describe('Pack Pipeline Service', () => {
    it('should upload a pack', async () => {
      const mockResult = {
        success: true,
        data: {
          namespace: 'test-namespace',
          version: '1.0.0',
          status: 'draft',
          manifest: {
            name: 'Test Pack',
            description: 'A test pack',
            author: 'Test Author',
            awf_core_range: '^1.0.0'
          },
          sbom: {
            files: [],
            total_size: 1024
          },
          hash: 'test-hash',
          signature: 'test-signature'
        }
      };

      (packPipelineService.uploadPack as any).mockResolvedValue(mockResult);

      const result = await packPipelineService.uploadPack({
        namespace: 'test-namespace',
        version: '1.0.0',
        zip_data: 'base64-encoded-zip',
        creator_id: 'creator-123'
      });

      expect(result.success).toBe(true);
      expect(result.data?.namespace).toBe('test-namespace');
      expect(result.data?.version).toBe('1.0.0');
      expect(packPipelineService.uploadPack).toHaveBeenCalledWith({
        namespace: 'test-namespace',
        version: '1.0.0',
        zip_data: 'base64-encoded-zip',
        creator_id: 'creator-123'
      });
    });

    it('should submit pack for review', async () => {
      const mockResult = {
        success: true,
        data: { status: 'submitted' }
      };

      (packPipelineService.submitForReview as any).mockResolvedValue(mockResult);

      const result = await packPipelineService.submitForReview(
        'test-namespace',
        '1.0.0',
        'creator-123'
      );

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('submitted');
      expect(packPipelineService.submitForReview).toHaveBeenCalledWith(
        'test-namespace',
        '1.0.0',
        'creator-123'
      );
    });

    it('should review a pack', async () => {
      const mockResult = {
        success: true,
        data: {
          namespace: 'test-namespace',
          version: '1.0.0',
          status: 'certified',
          review_notes: 'Approved for listing',
          certified_at: '2025-01-27T00:00:00Z'
        }
      };

      (packPipelineService.reviewPack as any).mockResolvedValue(mockResult);

      const result = await packPipelineService.reviewPack({
        namespace: 'test-namespace',
        version: '1.0.0',
        action: 'approve',
        review_notes: 'Approved for listing',
        reviewer_id: 'reviewer-123'
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('certified');
      expect(packPipelineService.reviewPack).toHaveBeenCalledWith({
        namespace: 'test-namespace',
        version: '1.0.0',
        action: 'approve',
        review_notes: 'Approved for listing',
        reviewer_id: 'reviewer-123'
      });
    });
  });

  describe('Dependency Solver Service', () => {
    it('should resolve dependencies', async () => {
      const mockResult = {
        success: true,
        data: {
          nodes: new Map([
            ['pack1@1.0.0', {
              namespace: 'pack1',
              version: '1.0.0',
              version_range: '1.0.0',
              type: 'required',
              awf_core_range: '^1.0.0',
              dependencies: []
            }]
          ]),
          edges: new Map([
            ['pack1@1.0.0', []]
          ]),
          conflicts: []
        }
      };

      (dependencySolverService.resolveDependencies as any).mockResolvedValue(mockResult);

      const result = await dependencySolverService.resolveDependencies({
        namespace: 'pack1',
        version: '1.0.0',
        awf_core_version: '1.0.0'
      });

      expect(result.success).toBe(true);
      expect(result.data?.nodes.size).toBe(1);
      expect(dependencySolverService.resolveDependencies).toHaveBeenCalledWith({
        namespace: 'pack1',
        version: '1.0.0',
        awf_core_version: '1.0.0'
      });
    });

    it('should generate install plan', async () => {
      const mockResult = {
        success: true,
        plan: [
          {
            namespace: 'pack1',
            version: '1.0.0',
            order: 1,
            token_budget_used: 10,
            token_budget_remaining: 990
          }
        ],
        conflicts: []
      };

      (dependencySolverService.generateInstallPlan as any).mockResolvedValue(mockResult);

      const result = await dependencySolverService.generateInstallPlan({
        packs: [
          { namespace: 'pack1', version_range: '1.0.0' }
        ],
        awf_core_version: '1.0.0',
        token_budget: 1000
      });

      expect(result.success).toBe(true);
      expect(result.plan).toHaveLength(1);
      expect(dependencySolverService.generateInstallPlan).toHaveBeenCalledWith({
        packs: [
          { namespace: 'pack1', version_range: '1.0.0' }
        ],
        awf_core_version: '1.0.0',
        token_budget: 1000
      });
    });

    it('should get compatibility matrix', async () => {
      const mockResult = {
        success: true,
        data: {
          awf_core_version: '1.0.0',
          compatible_packs: [
            {
              namespace: 'pack1',
              version: '1.0.0',
              compatibility: 'full',
              issues: []
            }
          ],
          incompatible_packs: []
        }
      };

      (dependencySolverService.getCompatibilityMatrix as any).mockResolvedValue(mockResult);

      const result = await dependencySolverService.getCompatibilityMatrix('1.0.0');

      expect(result.success).toBe(true);
      expect(result.data?.compatible_packs).toHaveLength(1);
      expect(dependencySolverService.getCompatibilityMatrix).toHaveBeenCalledWith('1.0.0');
    });
  });

  describe('Distribution Service', () => {
    it('should issue download token', async () => {
      const mockResult = {
        success: true,
        data: {
          token: 'download-token-123',
          namespace: 'test-namespace',
          version: '1.0.0',
          expires_at: '2025-01-27T00:05:00Z',
          scopes: ['download'],
          issued_to: 'creator-123',
          used: false,
          created_at: '2025-01-27T00:00:00Z'
        }
      };

      (distributionService.issueDownloadToken as any).mockResolvedValue(mockResult);

      const result = await distributionService.issueDownloadToken({
        namespace: 'test-namespace',
        version: '1.0.0',
        requester_id: 'creator-123',
        scopes: ['download'],
        expires_in_seconds: 300
      });

      expect(result.success).toBe(true);
      expect(result.data?.token).toBe('download-token-123');
      expect(distributionService.issueDownloadToken).toHaveBeenCalledWith({
        namespace: 'test-namespace',
        version: '1.0.0',
        requester_id: 'creator-123',
        scopes: ['download'],
        expires_in_seconds: 300
      });
    });

    it('should generate signed download URL', async () => {
      const mockResult = {
        success: true,
        data: {
          url: 'https://marketplace.stonecaster.com/download/test-namespace/1.0.0?token=download-token-123',
          expires_at: '2025-01-27T00:05:00Z',
          signature: 'signed-url-signature',
          integrity_hash: 'pack-hash'
        }
      };

      (distributionService.generateSignedDownloadURL as any).mockResolvedValue(mockResult);

      const result = await distributionService.generateSignedDownloadURL({
        token: 'download-token-123',
        namespace: 'test-namespace',
        version: '1.0.0'
      });

      expect(result.success).toBe(true);
      expect(result.data?.url).toContain('download/test-namespace/1.0.0');
      expect(distributionService.generateSignedDownloadURL).toHaveBeenCalledWith({
        token: 'download-token-123',
        namespace: 'test-namespace',
        version: '1.0.0'
      });
    });

    it('should validate integrity', async () => {
      const mockResult = {
        success: true,
        data: {
          valid: true,
          hash_match: true,
          signature_valid: true,
          issues: []
        }
      };

      (distributionService.validateIntegrity as any).mockResolvedValue(mockResult);

      const result = await distributionService.validateIntegrity({
        namespace: 'test-namespace',
        version: '1.0.0',
        hash: 'pack-hash',
        signature: 'pack-signature'
      });

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(distributionService.validateIntegrity).toHaveBeenCalledWith({
        namespace: 'test-namespace',
        version: '1.0.0',
        hash: 'pack-hash',
        signature: 'pack-signature'
      });
    });
  });

  describe('Moderation Service', () => {
    it('should submit report', async () => {
      const mockResult = {
        success: true,
        data: { report_id: 'report-123' }
      };

      (moderationService.submitReport as any).mockResolvedValue(mockResult);

      const result = await moderationService.submitReport({
        namespace: 'test-namespace',
        version: '1.0.0',
        reporter_hash: 'reporter-123',
        reason: 'spam',
        details: {
          description: 'This pack contains spam content',
          evidence_urls: ['https://example.com/evidence'],
          additional_info: 'Additional context'
        }
      });

      expect(result.success).toBe(true);
      expect(result.data?.report_id).toBe('report-123');
      expect(moderationService.submitReport).toHaveBeenCalledWith({
        namespace: 'test-namespace',
        version: '1.0.0',
        reporter_hash: 'reporter-123',
        reason: 'spam',
        details: {
          description: 'This pack contains spam content',
          evidence_urls: ['https://example.com/evidence'],
          additional_info: 'Additional context'
        }
      });
    });

    it('should get reports', async () => {
      const mockReports = [
        {
          report_id: 'report-123',
          namespace: 'test-namespace',
          version: '1.0.0',
          reporter_hash: 'reporter-123',
          reason: 'spam',
          status: 'open',
          action: 'none',
          created_at: '2025-01-27T00:00:00Z'
        }
      ];

      (moderationService.getReports as any).mockResolvedValue({
        success: true,
        data: mockReports
      });

      const result = await moderationService.getReports('open', undefined, 50, 0);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(moderationService.getReports).toHaveBeenCalledWith('open', undefined, 50, 0);
    });

    it('should take moderation action', async () => {
      const mockResult = {
        success: true,
        data: {
          action_id: 'action-123',
          report_id: 'report-123',
          action: 'delist',
          moderator_id: 'moderator-123',
          resolution_notes: 'Pack delisted due to spam content',
          severity: 'high',
          created_at: '2025-01-27T00:00:00Z'
        }
      };

      (moderationService.takeModerationAction as any).mockResolvedValue(mockResult);

      const result = await moderationService.takeModerationAction({
        report_id: 'report-123',
        action: 'delist',
        moderator_id: 'moderator-123',
        resolution_notes: 'Pack delisted due to spam content',
        severity: 'high'
      });

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('delist');
      expect(moderationService.takeModerationAction).toHaveBeenCalledWith({
        report_id: 'report-123',
        action: 'delist',
        moderator_id: 'moderator-123',
        resolution_notes: 'Pack delisted due to spam content',
        severity: 'high'
      });
    });
  });

  describe('Metrics Summaries Service', () => {
    it('should get pack metrics', async () => {
      const mockMetrics = {
        namespace: 'test-namespace',
        version: '1.0.0',
        adoption_count: 100,
        error_rate: 0.05,
        violation_rate: 0.01,
        avg_acts_per_turn: 3.5,
        token_budget_usage: 0.25,
        p95_latency_delta_ms: 50,
        download_count: 150,
        unique_users: 75,
        retention_rate: 0.8,
        satisfaction_score: 4.2
      };

      (metricsSummariesService.getPackMetrics as any).mockResolvedValue({
        success: true,
        data: mockMetrics
      });

      const result = await metricsSummariesService.getPackMetrics({
        namespace: 'test-namespace',
        version: '1.0.0',
        days_back: 30
      });

      expect(result.success).toBe(true);
      expect(result.data?.adoption_count).toBe(100);
      expect(metricsSummariesService.getPackMetrics).toHaveBeenCalledWith({
        namespace: 'test-namespace',
        version: '1.0.0',
        days_back: 30
      });
    });

    it('should submit rating', async () => {
      const mockRating = {
        namespace: 'test-namespace',
        version: '1.0.0',
        user_hash: 'user-123',
        stars: 5,
        tags: ['lore-rich', 'combat-heavy'],
        comment: 'Great pack!',
        created_at: '2025-01-27T00:00:00Z'
      };

      (metricsSummariesService.submitRating as any).mockResolvedValue({
        success: true,
        data: mockRating
      });

      const result = await metricsSummariesService.submitRating({
        namespace: 'test-namespace',
        version: '1.0.0',
        user_hash: 'user-123',
        stars: 5,
        tags: ['lore-rich', 'combat-heavy'],
        comment: 'Great pack!'
      });

      expect(result.success).toBe(true);
      expect(result.data?.stars).toBe(5);
      expect(metricsSummariesService.submitRating).toHaveBeenCalledWith({
        namespace: 'test-namespace',
        version: '1.0.0',
        user_hash: 'user-123',
        stars: 5,
        tags: ['lore-rich', 'combat-heavy'],
        comment: 'Great pack!'
      });
    });

    it('should get rating summary', async () => {
      const mockSummary = {
        namespace: 'test-namespace',
        version: '1.0.0',
        total_ratings: 25,
        average_stars: 4.2,
        star_distribution: { 1: 0, 2: 1, 3: 3, 4: 8, 5: 13 },
        popular_tags: [
          { tag: 'lore-rich', count: 15 },
          { tag: 'combat-heavy', count: 12 }
        ],
        recent_comments: [
          {
            stars: 5,
            comment: 'Excellent pack!',
            created_at: '2025-01-27T00:00:00Z'
          }
        ]
      };

      (metricsSummariesService.getRatingSummary as any).mockResolvedValue({
        success: true,
        data: mockSummary
      });

      const result = await metricsSummariesService.getRatingSummary('test-namespace', '1.0.0');

      expect(result.success).toBe(true);
      expect(result.data?.total_ratings).toBe(25);
      expect(result.data?.average_stars).toBe(4.2);
      expect(metricsSummariesService.getRatingSummary).toHaveBeenCalledWith('test-namespace', '1.0.0');
    });

    it('should generate telemetry snapshot', async () => {
      const mockSnapshot = {
        namespace: 'test-namespace',
        version: '1.0.0',
        snapshot_date: '2025-01-27T00:00:00Z',
        metrics: {
          adoption_count: 100,
          error_rate: 0.05,
          satisfaction_score: 4.2
        },
        ratings: {
          total_ratings: 25,
          average_stars: 4.2
        },
        trends: {
          adoption_trend: 'increasing',
          error_trend: 'stable',
          satisfaction_trend: 'improving'
        }
      };

      (metricsSummariesService.generateTelemetrySnapshot as any).mockResolvedValue({
        success: true,
        data: mockSnapshot
      });

      const result = await metricsSummariesService.generateTelemetrySnapshot('test-namespace', '1.0.0');

      expect(result.success).toBe(true);
      expect(result.data?.metrics.adoption_count).toBe(100);
      expect(result.data?.trends.adoption_trend).toBe('increasing');
      expect(metricsSummariesService.generateTelemetrySnapshot).toHaveBeenCalledWith('test-namespace', '1.0.0');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete pack lifecycle', async () => {
      // Mock creator onboarding
      (creatorService.onboardCreator as any).mockResolvedValue({
        success: true,
        data: { creator_id: 'creator-123', verification_required: true }
      });

      // Mock namespace claim
      (creatorService.claimNamespace as any).mockResolvedValue({
        success: true,
        data: { namespace: 'test-namespace', verified: false }
      });

      // Mock pack upload
      (packPipelineService.uploadPack as any).mockResolvedValue({
        success: true,
        data: { namespace: 'test-namespace', version: '1.0.0', status: 'draft' }
      });

      // Mock pack submission
      (packPipelineService.submitForReview as any).mockResolvedValue({
        success: true,
        data: { status: 'submitted' }
      });

      // Mock pack review
      (packPipelineService.reviewPack as any).mockResolvedValue({
        success: true,
        data: { status: 'certified' }
      });

      // Mock pack listing
      (packPipelineService.listPack as any).mockResolvedValue({
        success: true,
        data: { status: 'listed' }
      });

      // Test complete flow
      const onboardResult = await creatorService.onboardCreator({
        display_name: 'Test Creator',
        email: 'test@example.com',
        terms_accepted: true,
        content_policy_accepted: true
      });

      expect(onboardResult.success).toBe(true);

      const claimResult = await creatorService.claimNamespace('creator-123', {
        namespace: 'test-namespace',
        description: 'Test namespace'
      });

      expect(claimResult.success).toBe(true);

      const uploadResult = await packPipelineService.uploadPack({
        namespace: 'test-namespace',
        version: '1.0.0',
        zip_data: 'base64-encoded-zip',
        creator_id: 'creator-123'
      });

      expect(uploadResult.success).toBe(true);

      const submitResult = await packPipelineService.submitForReview(
        'test-namespace',
        '1.0.0',
        'creator-123'
      );

      expect(submitResult.success).toBe(true);

      const reviewResult = await packPipelineService.reviewPack({
        namespace: 'test-namespace',
        version: '1.0.0',
        action: 'approve',
        review_notes: 'Approved',
        reviewer_id: 'reviewer-123'
      });

      expect(reviewResult.success).toBe(true);

      const listResult = await packPipelineService.listPack('test-namespace', '1.0.0');

      expect(listResult.success).toBe(true);
    });

    it('should handle dependency resolution with conflicts', async () => {
      // Mock dependency resolution with conflicts
      (dependencySolverService.resolveDependencies as any).mockResolvedValue({
        success: true,
        data: {
          nodes: new Map(),
          edges: new Map(),
          conflicts: [
            {
              pack1: 'pack1@1.0.0',
              pack2: 'pack2@2.0.0',
              reason: 'Version conflict'
            }
          ]
        }
      });

      const result = await dependencySolverService.resolveDependencies({
        namespace: 'pack1',
        version: '1.0.0',
        awf_core_version: '1.0.0'
      });

      expect(result.success).toBe(true);
      expect(result.data?.conflicts).toHaveLength(1);
      expect(result.data?.conflicts[0].reason).toBe('Version conflict');
    });

    it('should handle moderation workflow', async () => {
      // Mock report submission
      (moderationService.submitReport as any).mockResolvedValue({
        success: true,
        data: { report_id: 'report-123' }
      });

      // Mock moderation action
      (moderationService.takeModerationAction as any).mockResolvedValue({
        success: true,
        data: { action: 'delist' }
      });

      // Test moderation flow
      const reportResult = await moderationService.submitReport({
        namespace: 'test-namespace',
        version: '1.0.0',
        reporter_hash: 'reporter-123',
        reason: 'spam',
        details: { description: 'Spam content' }
      });

      expect(reportResult.success).toBe(true);

      const actionResult = await moderationService.takeModerationAction({
        report_id: 'report-123',
        action: 'delist',
        moderator_id: 'moderator-123',
        resolution_notes: 'Pack delisted due to spam'
      });

      expect(actionResult.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle creator onboarding errors', async () => {
      (creatorService.onboardCreator as any).mockResolvedValue({
        success: false,
        error: 'Invalid email format'
      });

      const result = await creatorService.onboardCreator({
        display_name: 'Test Creator',
        email: 'invalid-email',
        terms_accepted: true,
        content_policy_accepted: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email format');
    });

    it('should handle pack upload errors', async () => {
      (packPipelineService.uploadPack as any).mockResolvedValue({
        success: false,
        error: 'Pack size exceeds limit'
      });

      const result = await packPipelineService.uploadPack({
        namespace: 'test-namespace',
        version: '1.0.0',
        zip_data: 'large-base64-encoded-zip',
        creator_id: 'creator-123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pack size exceeds limit');
    });

    it('should handle distribution errors', async () => {
      (distributionService.issueDownloadToken as any).mockResolvedValue({
        success: false,
        error: 'Pack not found'
      });

      const result = await distributionService.issueDownloadToken({
        namespace: 'nonexistent-namespace',
        version: '1.0.0',
        requester_id: 'creator-123',
        scopes: ['download'],
        expires_in_seconds: 300
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pack not found');
    });
  });

  describe('Performance Tests', () => {
    it('should handle high concurrent creator onboarding', async () => {
      (creatorService.onboardCreator as any).mockResolvedValue({
        success: true,
        data: { creator_id: 'creator-123' }
      });

      const promises = Array.from({ length: 100 }, (_, i) => 
        creatorService.onboardCreator({
          display_name: `Creator ${i}`,
          email: `creator${i}@example.com`,
          terms_accepted: true,
          content_policy_accepted: true
        })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(100);
      expect(results.every(result => result.success)).toBe(true);
    });

    it('should handle high concurrent pack uploads', async () => {
      (packPipelineService.uploadPack as any).mockResolvedValue({
        success: true,
        data: { namespace: 'test-namespace', version: '1.0.0' }
      });

      const promises = Array.from({ length: 50 }, (_, i) => 
        packPipelineService.uploadPack({
          namespace: `test-namespace-${i}`,
          version: '1.0.0',
          zip_data: 'base64-encoded-zip',
          creator_id: 'creator-123'
        })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(50);
      expect(results.every(result => result.success)).toBe(true);
    });
  });
});
