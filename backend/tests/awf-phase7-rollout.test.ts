/**
 * Phase 7 Rollout Tests
 * Tests for golden test harness, canary rollout, SLO monitoring, and audit logging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRolloutManager, initializeRolloutManager } from '../src/rollout/canary-rollout.js';
import { getSLOMonitor, initializeSLOMonitor } from '../src/slos/awf-slos.js';
import { getAuditLogger, initializeAuditLogger } from '../src/audit/audit-logger.js';

describe('Phase 7: Production Rollout', () => {
  describe('Canary Rollout Controls', () => {
    let rolloutManager: ReturnType<typeof getRolloutManager>;

    beforeEach(() => {
      rolloutManager = initializeRolloutManager();
    });

    it('should respect global disabled state', () => {
      rolloutManager.setGlobalEnabled(false, 'test-admin');
      
      const decision = rolloutManager.isEnabled({ sessionId: 'test-session' });
      expect(decision.enabled).toBe(false);
      expect(decision.reason).toBe('global_disabled');
    });

    it('should respect global enabled state', () => {
      rolloutManager.setGlobalEnabled(true, 'test-admin');
      rolloutManager.setPercentRollout(100, 'test-admin'); // Set to 100% to enable all
      
      const decision = rolloutManager.isEnabled({ sessionId: 'test-session' });
      expect(decision.enabled).toBe(true);
      expect(decision.reason).toBe('percent_bucket');
    });

    it('should respect percentage rollout', () => {
      rolloutManager.setGlobalEnabled(true, 'test-admin');
      rolloutManager.setPercentRollout(50, 'test-admin');
      
      // Test multiple sessions to verify consistent bucketing
      const decisions: any[] = [];
      for (let i = 0; i < 100; i++) {
        const decision = rolloutManager.isEnabled({ sessionId: `session-${i}` });
        decisions.push(decision);
      }
      
      const enabledCount = decisions.filter((d: any) => d.enabled).length;
      expect(enabledCount).toBeGreaterThan(0);
      expect(enabledCount).toBeLessThan(100);
    });

    it('should respect session override', () => {
      rolloutManager.setGlobalEnabled(false, 'test-admin');
      rolloutManager.setSessionOverride('test-session', true, 'test-admin');
      
      const decision = rolloutManager.isEnabled({ sessionId: 'test-session' });
      expect(decision.enabled).toBe(true);
      expect(decision.reason).toBe('session_override');
    });

    it('should respect user override', () => {
      rolloutManager.setGlobalEnabled(false, 'test-admin');
      rolloutManager.setUserOverride('test-user', true, 'test-admin');
      
      const decision = rolloutManager.isEnabled({ userId: 'test-user' });
      expect(decision.enabled).toBe(true);
      expect(decision.reason).toBe('user_override');
    });

    it('should prioritize session override over user override', () => {
      rolloutManager.setGlobalEnabled(false, 'test-admin');
      rolloutManager.setUserOverride('test-user', true, 'test-admin');
      rolloutManager.setSessionOverride('test-session', false, 'test-admin');
      
      const decision = rolloutManager.isEnabled({ 
        sessionId: 'test-session', 
        userId: 'test-user' 
      });
      expect(decision.enabled).toBe(false);
      expect(decision.reason).toBe('session_override');
    });

    it('should provide consistent bucketing for same identifier', () => {
      rolloutManager.setGlobalEnabled(true, 'test-admin');
      rolloutManager.setPercentRollout(50, 'test-admin');
      
      const decision1 = rolloutManager.isEnabled({ sessionId: 'consistent-session' });
      const decision2 = rolloutManager.isEnabled({ sessionId: 'consistent-session' });
      
      expect(decision1.enabled).toBe(decision2.enabled);
      expect(decision1.bucket).toBe(decision2.bucket);
    });

    it('should handle percentage rollout edge cases', () => {
      rolloutManager.setGlobalEnabled(true, 'test-admin');
      
      // Test 0% rollout
      rolloutManager.setPercentRollout(0, 'test-admin');
      const decision0 = rolloutManager.isEnabled({ sessionId: 'test-session' });
      expect(decision0.enabled).toBe(false);
      expect(decision0.reason).toBe('percent_bucket');
      
      // Test 100% rollout
      rolloutManager.setPercentRollout(100, 'test-admin');
      const decision100 = rolloutManager.isEnabled({ sessionId: 'test-session' });
      expect(decision100.enabled).toBe(true);
      expect(decision100.reason).toBe('percent_bucket');
    });

    it('should track override counts in status', () => {
      rolloutManager.setUserOverride('user1', true, 'test-admin');
      rolloutManager.setUserOverride('user2', false, 'test-admin');
      rolloutManager.setSessionOverride('session1', true, 'test-admin');
      
      const status = rolloutManager.getStatus();
      expect(status.userOverrideCount).toBe(2);
      expect(status.sessionOverrideCount).toBe(1);
    });
  });

  describe('SLO Monitoring', () => {
    let sloMonitor: ReturnType<typeof getSLOMonitor>;

    beforeEach(() => {
      sloMonitor = initializeSLOMonitor();
    });

    it('should track turn metrics', () => {
      sloMonitor.recordTurn(1000, false, false);
      sloMonitor.recordTurn(2000, true, false);
      sloMonitor.recordTurn(3000, false, true);
      
      const status = sloMonitor.getStatus();
      expect(status.metrics.totalTurns).toBe(3);
      expect(status.metrics.retryTurns).toBe(1);
      expect(status.metrics.fallbackTurns).toBe(1);
    });

    it('should calculate retry rate correctly', () => {
      sloMonitor.recordTurn(1000, false, false);
      sloMonitor.recordTurn(2000, true, false);
      sloMonitor.recordTurn(3000, true, false);
      
      const status = sloMonitor.getStatus();
      expect(status.metrics.invalidRetryRate).toBeCloseTo(66.67, 1); // 2/3 * 100
    });

    it('should calculate fallback rate correctly', () => {
      sloMonitor.recordTurn(1000, false, false);
      sloMonitor.recordTurn(2000, false, true);
      sloMonitor.recordTurn(3000, false, true);
      
      const status = sloMonitor.getStatus();
      expect(status.metrics.fallbackRate).toBeCloseTo(66.67, 1); // 2/3 * 100
    });

    it('should track latency P95', () => {
      sloMonitor.recordTurn(1000, false, false);
      sloMonitor.recordTurn(2000, false, false);
      sloMonitor.recordTurn(500, false, false);
      
      const status = sloMonitor.getStatus();
      expect(status.metrics.turnLatencyP95).toBe(2000);
    });

    it('should trigger alerts when SLOs are violated', () => {
      const alertCallback = vi.fn();
      sloMonitor.onAlert(alertCallback);
      
      // Simulate high latency
      sloMonitor.updateMetrics({ turnLatencyP95: 10000 });
      
      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          slo: 'turn_latency_p95',
          severity: 'warning',
          currentValue: 10000
        })
      );
    });

    it('should provide suggested actions for SLO violations', () => {
      const alertCallback = vi.fn();
      sloMonitor.onAlert(alertCallback);
      
      // Simulate high fallback rate
      sloMonitor.updateMetrics({ fallbackRate: 5.0 });
      
      expect(alertCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          slo: 'fallback_rate',
          severity: 'critical',
          suggestedActions: expect.arrayContaining([
            'Investigate consecutive validation failures',
            'Check model provider health',
            'Consider reducing AWF_PERCENT_ROLLOUT to 0'
          ])
        })
      );
    });

    it('should reset metrics correctly', () => {
      sloMonitor.recordTurn(1000, true, false);
      sloMonitor.resetMetrics();
      
      const status = sloMonitor.getStatus();
      expect(status.metrics.totalTurns).toBe(0);
      expect(status.metrics.retryTurns).toBe(0);
      expect(status.metrics.fallbackTurns).toBe(0);
    });
  });

  describe('Audit Logging', () => {
    let auditLogger: ReturnType<typeof getAuditLogger>;

    beforeEach(() => {
      auditLogger = initializeAuditLogger();
    });

    it('should log audit events', () => {
      auditLogger.log('admin', 'flag_change', 'awf_bundle', {
        previous: false,
        current: true
      });
      
      const logs = auditLogger.getRecentLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].actor).toBe('admin');
      expect(logs[0].action).toBe('flag_change');
      expect(logs[0].entity).toBe('awf_bundle');
    });

    it('should filter logs by actor', () => {
      auditLogger.log('admin1', 'flag_change', 'awf_bundle', {});
      auditLogger.log('admin2', 'rollout_change', 'awf_rollout', {});
      auditLogger.log('admin1', 'override_change', 'user_override', {});
      
      const admin1Logs = auditLogger.getLogsByActor('admin1');
      expect(admin1Logs).toHaveLength(2);
      expect(admin1Logs.every(log => log.actor === 'admin1')).toBe(true);
    });

    it('should filter logs by action', () => {
      auditLogger.log('admin', 'flag_change', 'awf_bundle', {});
      auditLogger.log('admin', 'rollout_change', 'awf_rollout', {});
      auditLogger.log('admin', 'flag_change', 'other_flag', {});
      
      const flagChangeLogs = auditLogger.getLogsByAction('flag_change');
      expect(flagChangeLogs).toHaveLength(2);
      expect(flagChangeLogs.every(log => log.action === 'flag_change')).toBe(true);
    });

    it('should provide audit statistics', () => {
      auditLogger.log('admin1', 'flag_change', 'awf_bundle', {});
      auditLogger.log('admin2', 'rollout_change', 'awf_rollout', {});
      auditLogger.log('admin1', 'override_change', 'user_override', {});
      
      const stats = auditLogger.getStats();
      expect(stats.totalLogs).toBe(3);
      expect(stats.logsByActor['admin1']).toBe(2);
      expect(stats.logsByActor['admin2']).toBe(1);
      expect(stats.logsByAction['flag_change']).toBe(1);
      expect(stats.logsByAction['rollout_change']).toBe(1);
      expect(stats.logsByAction['override_change']).toBe(1);
    });

    it('should clear logs', () => {
      auditLogger.log('admin', 'flag_change', 'awf_bundle', {});
      expect(auditLogger.getRecentLogs()).toHaveLength(1);
      
      auditLogger.clearLogs();
      expect(auditLogger.getRecentLogs()).toHaveLength(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete rollout workflow', () => {
      const rolloutManager = initializeRolloutManager();
      const auditLogger = initializeAuditLogger();
      
      // Set up rollout
      rolloutManager.setGlobalEnabled(true, 'admin');
      rolloutManager.setPercentRollout(25, 'admin');
      
      // Check that some sessions are enabled
      const decisions: any[] = [];
      for (let i = 0; i < 20; i++) {
        const decision = rolloutManager.isEnabled({ sessionId: `session-${i}` });
        decisions.push(decision);
      }
      
      const enabledCount = decisions.filter((d: any) => d.enabled).length;
      expect(enabledCount).toBeGreaterThan(0);
      expect(enabledCount).toBeLessThan(20);
    });

    it('should handle SLO monitoring workflow', () => {
      const sloMonitor = initializeSLOMonitor();
      const alertCallback = vi.fn();
      sloMonitor.onAlert(alertCallback);
      
      // Simulate normal operation
      sloMonitor.recordTurn(1000, false, false);
      sloMonitor.recordTurn(1500, false, false);
      
      // Simulate SLO violation
      sloMonitor.updateMetrics({ turnLatencyP95: 10000 });
      
      expect(alertCallback).toHaveBeenCalled();
    });

    it('should handle audit logging workflow', () => {
      const auditLogger = initializeAuditLogger();
      
      // Log various events
      auditLogger.log('admin', 'flag_change', 'awf_bundle', { previous: false, current: true });
      auditLogger.log('admin', 'rollout_change', 'awf_rollout', { previous: 0, current: 25 });
      auditLogger.log('admin', 'override_change', 'user_override', { userId: 'user123', enabled: true });
      
      // Verify logs
      const logs = auditLogger.getRecentLogs();
      expect(logs).toHaveLength(3);
      
      // Verify statistics
      const stats = auditLogger.getStats();
      expect(stats.totalLogs).toBe(3);
      expect(stats.logsByActor['admin']).toBe(3);
    });
  });
});
