// Phase 24: Metrics System Tests
// Comprehensive tests for rollup jobs, KPI calculators, alerts, and API endpoints

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => ({
                data: null,
                error: null,
              })),
            })),
          })),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(() => ({
            single: vi.fn(() => ({
              data: null,
              error: null,
            })),
          })),
        })),
      })),
      gte: vi.fn(() => ({
        lte: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
        order: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
      lte: vi.fn(() => ({
        order: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
      order: vi.fn(() => ({
        data: [],
        error: null,
      })),
    })),
    insert: vi.fn(() => ({
      data: { id: 'test-id' },
      error: null,
    })),
    upsert: vi.fn(() => ({
      data: { id: 'test-id' },
      error: null,
    })),
    update: vi.fn(() => ({
      data: { id: 'test-id' },
      error: null,
    })),
  })),
};

// Mock environment variables
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Mock the modules that use Supabase
vi.mock('../src/metrics/rollup-jobs', () => ({
  rollupJobs: {
    runHourlyRollup: vi.fn(),
    runDailyRollup: vi.fn(),
  },
}));

vi.mock('../src/slos/awf-slo-alerts', () => ({
  sloAlerts: {
    evaluateThresholds: vi.fn(),
    getIncidentStats: vi.fn(),
  },
}));

vi.mock('../src/experiments/reporting', () => ({
  experimentReporter: {
    generateReport: vi.fn(),
    exportReportCSV: vi.fn(),
    exportReportJSON: vi.fn(),
  },
}));

// Import after mocking
import { rollupJobs } from '../src/metrics/rollup-jobs';
import { KPICalculator } from '../src/metrics/kpi';
import { sloAlerts } from '../src/slos/awf-slo-alerts';
import { experimentReporter } from '../src/experiments/reporting';

describe('Phase 24: Metrics System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('RollupJobs', () => {
    it('should process hourly rollup successfully', async () => {
      const mockEvents = [
        {
          id: '1',
          session_id: 'session-1',
          user_id_hash: 'hash-1',
          event_type: 'turn_complete',
          timestamp: new Date().toISOString(),
          properties: { latency_ms: 1000, tokens: { in: 100, out: 200 } },
          world_ref: 'world.forest',
          adventure_ref: 'adventure.quest',
          locale: 'en',
          model: 'gpt-4',
          experiment: 'test',
          variation: 'control',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                data: mockEvents,
                error: null,
              })),
            })),
          })),
        })),
        upsert: vi.fn(() => ({
          data: { id: 'test-id' },
          error: null,
        })),
      });

      await rollupJobs.runHourlyRollup();
      expect(mockSupabase.from).toHaveBeenCalledWith('analytics_events');
    });

    it('should process daily rollup successfully', async () => {
      const mockEvents = [
        {
          id: '1',
          session_id: 'session-1',
          user_id_hash: 'hash-1',
          event_type: 'turn_complete',
          timestamp: new Date().toISOString(),
          properties: { latency_ms: 1000, tokens: { in: 100, out: 200 } },
          world_ref: 'world.forest',
          adventure_ref: 'adventure.quest',
          locale: 'en',
          model: 'gpt-4',
          experiment: 'test',
          variation: 'control',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          gte: vi.fn(() => ({
            lt: vi.fn(() => ({
              order: vi.fn(() => ({
                data: mockEvents,
                error: null,
              })),
            })),
          })),
        })),
        upsert: vi.fn(() => ({
          data: { id: 'test-id' },
          error: null,
        })),
      });

      await rollupJobs.runDailyRollup();
      expect(mockSupabase.from).toHaveBeenCalledWith('analytics_events');
    });

    it('should handle empty event data gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      });

      await rollupJobs.runHourlyRollup();
      expect(mockSupabase.from).toHaveBeenCalledWith('analytics_events');
    });
  });

  describe('KPICalculator', () => {
    const mockData = [
      {
        session_id: 'session-1',
        turn_id: 1,
        event_type: 'turn_complete',
        timestamp: new Date().toISOString(),
        world: 'world.forest',
        adventure: 'adventure.quest',
        locale: 'en',
        model: 'gpt-4',
        experiment: 'test',
        variation: 'control',
      },
      {
        session_id: 'session-2',
        turn_id: 5,
        event_type: 'turn_complete',
        timestamp: new Date().toISOString(),
        world: 'world.forest',
        adventure: 'adventure.quest',
        locale: 'en',
        model: 'gpt-4',
        experiment: 'test',
        variation: 'control',
      },
    ];

    it('should calculate stuck rate correctly', () => {
      const result = KPICalculator.calculateStuckRate(mockData);
      
      expect(result).toHaveProperty('total_sessions');
      expect(result).toHaveProperty('stuck_sessions');
      expect(result).toHaveProperty('stuck_rate');
      expect(result).toHaveProperty('avg_stuck_duration');
      expect(typeof result.stuck_rate).toBe('number');
    });

    it('should calculate economy velocity correctly', () => {
      const economyData = [
        ...mockData,
        {
          session_id: 'session-1',
          event_type: 'economy_change',
          gold_delta: 100,
          timestamp: new Date().toISOString(),
        },
        {
          session_id: 'session-1',
          event_type: 'turn_complete',
          timestamp: new Date().toISOString(),
        },
      ];

      const result = KPICalculator.calculateEconomyVelocity(economyData);
      
      expect(result).toHaveProperty('total_gold_delta');
      expect(result).toHaveProperty('total_turns');
      expect(result).toHaveProperty('velocity');
      expect(result).toHaveProperty('avg_gold_per_turn');
      expect(typeof result.velocity).toBe('number');
    });

    it('should calculate TTK percentiles correctly', () => {
      const ttkData = [
        ...mockData,
        {
          session_id: 'session-1',
          event_type: 'combat_resolution',
          ttk_seconds: 30,
          timestamp: new Date().toISOString(),
        },
        {
          session_id: 'session-2',
          event_type: 'combat_resolution',
          ttk_seconds: 60,
          timestamp: new Date().toISOString(),
        },
      ];

      const result = KPICalculator.calculateTTK(ttkData);
      
      expect(result).toHaveProperty('p25');
      expect(result).toHaveProperty('p50');
      expect(result).toHaveProperty('p75');
      expect(result).toHaveProperty('p90');
      expect(result).toHaveProperty('p95');
      expect(result).toHaveProperty('mean');
      expect(typeof result.p50).toBe('number');
    });

    it('should calculate craft success rate correctly', () => {
      const craftData = [
        ...mockData,
        {
          session_id: 'session-1',
          event_type: 'craft_attempt',
          success: true,
          difficulty: 5,
          timestamp: new Date().toISOString(),
        },
        {
          session_id: 'session-2',
          event_type: 'craft_attempt',
          success: false,
          difficulty: 8,
          timestamp: new Date().toISOString(),
        },
      ];

      const result = KPICalculator.calculateCraftSuccess(craftData);
      
      expect(result).toHaveProperty('total_attempts');
      expect(result).toHaveProperty('successful_attempts');
      expect(result).toHaveProperty('success_rate');
      expect(result).toHaveProperty('avg_difficulty');
      expect(typeof result.success_rate).toBe('number');
    });

    it('should calculate choice diversity correctly', () => {
      const choiceData = [
        ...mockData,
        {
          session_id: 'session-1',
          event_type: 'choice',
          choice_id: 'choice-1',
          timestamp: new Date().toISOString(),
        },
        {
          session_id: 'session-1',
          event_type: 'choice',
          choice_id: 'choice-2',
          timestamp: new Date().toISOString(),
        },
        {
          session_id: 'session-2',
          event_type: 'choice',
          choice_id: 'choice-1',
          timestamp: new Date().toISOString(),
        },
      ];

      const result = KPICalculator.calculateChoiceDiversity(choiceData);
      
      expect(result).toHaveProperty('total_choices');
      expect(result).toHaveProperty('unique_choices');
      expect(result).toHaveProperty('entropy');
      expect(result).toHaveProperty('diversity_index');
      expect(typeof result.diversity_index).toBe('number');
    });

    it('should apply filters correctly', () => {
      const filteredData = [
        { world: 'world.forest', adventure: 'adventure.quest', locale: 'en' },
        { world: 'world.desert', adventure: 'adventure.quest', locale: 'en' },
        { world: 'world.forest', adventure: 'adventure.other', locale: 'en' },
      ];

      const result = KPICalculator.calculateStuckRate(filteredData, { world: 'world.forest' });
      expect(result).toBeDefined();
    });
  });

  describe('SLOAlerts', () => {
    it('should evaluate thresholds successfully', async () => {
      const mockThresholds = [
        {
          id: 'threshold-1',
          scope: 'global',
          kpi_name: 'retry_rate',
          threshold_value: 0.05,
          threshold_operator: '>',
          severity: 'warning',
          enabled: true,
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: mockThresholds,
            error: null,
          })),
        })),
      });

      await sloAlerts.evaluateThresholds();
      expect(mockSupabase.from).toHaveBeenCalledWith('awf_kpi_thresholds');
    });

    it('should get incident statistics', async () => {
      const mockIncidents = [
        {
          severity: 'warning',
          status: 'new',
          created_at: new Date().toISOString(),
        },
        {
          severity: 'critical',
          status: 'acknowledged',
          created_at: new Date().toISOString(),
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              data: mockIncidents,
              error: null,
            })),
          })),
        })),
      });

      const stats = await sloAlerts.getIncidentStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('by_severity');
      expect(stats).toHaveProperty('by_status');
    });

    it('should handle threshold evaluation errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: new Error('Database error'),
          })),
        })),
      });

      await expect(sloAlerts.evaluateThresholds()).rejects.toThrow();
    });
  });

  describe('ExperimentReporter', () => {
    const mockRollupData = [
      {
        date: '2024-01-01',
        world: 'world.forest',
        adventure: 'adventure.quest',
        experiment: 'test',
        variation: 'control',
        sessions: 100,
        completion_rate: 0.8,
        p95_latency_ms: 1000,
        retry_rate: 0.05,
        stuck_rate: 0.1,
        econ_velocity: 50,
      },
      {
        date: '2024-01-01',
        world: 'world.forest',
        adventure: 'adventure.quest',
        experiment: 'test',
        variation: 'treatment',
        sessions: 100,
        completion_rate: 0.85,
        p95_latency_ms: 900,
        retry_rate: 0.03,
        stuck_rate: 0.08,
        econ_velocity: 55,
      },
    ];

    it('should generate experiment report successfully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                data: mockRollupData,
                error: null,
              })),
            })),
          })),
        })),
      });

      const query = {
        experiment: 'test',
        from: '2024-01-01',
        to: '2024-01-02',
        include_significance: true,
        confidence_level: 0.95,
      };

      const report = await experimentReporter.generateReport(query);
      
      expect(report).toHaveProperty('experiment');
      expect(report).toHaveProperty('total_sessions');
      expect(report).toHaveProperty('variations');
      expect(report).toHaveProperty('overall_stats');
      expect(report).toHaveProperty('significance_summary');
      expect(Array.isArray(report.variations)).toBe(true);
    });

    it('should export CSV report successfully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                data: mockRollupData,
                error: null,
              })),
            })),
          })),
        })),
      });

      const query = {
        experiment: 'test',
        from: '2024-01-01',
        to: '2024-01-02',
        include_significance: true,
        confidence_level: 0.95,
      };

      const csv = await experimentReporter.exportReportCSV(query);
      expect(typeof csv).toBe('string');
      expect(csv).toContain('variation,sessions,completion_rate');
    });

    it('should export JSON report successfully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                data: mockRollupData,
                error: null,
              })),
            })),
          })),
        })),
      });

      const query = {
        experiment: 'test',
        from: '2024-01-01',
        to: '2024-01-02',
        include_significance: true,
        confidence_level: 0.95,
      };

      const json = await experimentReporter.exportReportJSON(query);
      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('experiment');
    });

    it('should handle missing data gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      });

      const query = {
        experiment: 'nonexistent',
        from: '2024-01-01',
        to: '2024-01-02',
        include_significance: true,
        confidence_level: 0.95,
      };

      await expect(experimentReporter.generateReport(query)).rejects.toThrow('No data found');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete metrics workflow', async () => {
      // Mock analytics events
      const mockEvents = [
        {
          id: '1',
          session_id: 'session-1',
          user_id_hash: 'hash-1',
          event_type: 'turn_complete',
          timestamp: new Date().toISOString(),
          properties: { latency_ms: 1000, tokens: { in: 100, out: 200 } },
          world_ref: 'world.forest',
          adventure_ref: 'adventure.quest',
          locale: 'en',
          model: 'gpt-4',
          experiment: 'test',
          variation: 'control',
        },
      ];

      // Mock rollup data
      const mockRollupData = [
        {
          date: '2024-01-01',
          world: 'world.forest',
          adventure: 'adventure.quest',
          experiment: 'test',
          variation: 'control',
          sessions: 100,
          turns: 500,
          p95_latency_ms: 1000,
          retry_rate: 0.05,
          stuck_rate: 0.1,
        },
      ];

      // Mock Supabase responses
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'analytics_events') {
          return {
            select: vi.fn(() => ({
              gte: vi.fn(() => ({
                lte: vi.fn(() => ({
                  order: vi.fn(() => ({
                    data: mockEvents,
                    error: null,
                  })),
                })),
              })),
            })),
          };
        } else if (table === 'awf_rollup_daily') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    data: mockRollupData,
                    error: null,
                  })),
                })),
              })),
            })),
          };
        } else if (table === 'awf_kpi_thresholds') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            data: [],
            error: null,
          })),
        };
      });

      // Test rollup job
      await rollupJobs.runHourlyRollup();
      expect(mockSupabase.from).toHaveBeenCalledWith('analytics_events');

      // Test KPI calculation
      const kpiResult = KPICalculator.calculateStuckRate(mockEvents);
      expect(kpiResult).toHaveProperty('stuck_rate');

      // Test experiment reporting
      const experimentQuery = {
        experiment: 'test',
        from: '2024-01-01',
        to: '2024-01-02',
        include_significance: true,
        confidence_level: 0.95,
      };

      const report = await experimentReporter.generateReport(experimentQuery);
      expect(report).toHaveProperty('experiment');
    });

    it('should handle error scenarios gracefully', async () => {
      // Mock database error
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                data: null,
                error: new Error('Database connection failed'),
              })),
            })),
          })),
        })),
      });

      // Test error handling in rollup job
      await expect(rollupJobs.runHourlyRollup()).rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        session_id: `session-${i}`,
        turn_id: i,
        event_type: 'turn_complete',
        timestamp: new Date().toISOString(),
        world: 'world.forest',
        adventure: 'adventure.quest',
        locale: 'en',
        model: 'gpt-4',
        experiment: 'test',
        variation: 'control',
      }));

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                data: largeDataset,
                error: null,
              })),
            })),
          })),
        })),
        upsert: vi.fn(() => ({
          data: { id: 'test-id' },
          error: null,
        })),
      });

      const startTime = Date.now();
      await rollupJobs.runHourlyRollup();
      const endTime = Date.now();
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should handle concurrent operations', async () => {
      const promises = [
        rollupJobs.runHourlyRollup(),
        rollupJobs.runDailyRollup(),
        sloAlerts.evaluateThresholds(),
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
        upsert: vi.fn(() => ({
          data: { id: 'test-id' },
          error: null,
        })),
      });

      await Promise.all(promises);
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });
});
