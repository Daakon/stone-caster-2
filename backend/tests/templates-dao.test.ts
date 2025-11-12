/**
 * Templates DAO Tests
 * Tests for template publish and versioning
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { publishNewVersion, getTemplateHistory, getActiveTemplates } from '../src/services/templates.service.js';
import { upsertSlot } from '../src/services/slots.service.js';
import { supabaseAdmin } from '../src/services/supabase.js';

describe('Templates DAO', () => {
  const testType = 'world' as const;
  const testSlot = 'test-slot-dao';

  beforeAll(async () => {
    // Ensure slot exists
    await upsertSlot({
      type: testType,
      name: testSlot,
      description: 'Test slot for DAO tests',
      max_len: 500,
      priority: 1,
    });
  });

  afterAll(async () => {
    // Cleanup
    await supabaseAdmin
      .from('templates')
      .delete()
      .eq('type', testType)
      .eq('slot', testSlot);
    
    await supabaseAdmin
      .from('slots')
      .delete()
      .eq('type', testType)
      .eq('name', testSlot);
  });

  it('should publish a new version of a template', async () => {
    const template = await publishNewVersion({
      type: testType,
      slot: testSlot,
      body: 'Test template body v1',
    });

    expect(template.version).toBe(1);
    expect(template.status).toBe('published');
    expect(template.body).toBe('Test template body v1');
  });

  it('should increment version on subsequent publishes', async () => {
    const template2 = await publishNewVersion({
      type: testType,
      slot: testSlot,
      body: 'Test template body v2',
    });

    expect(template2.version).toBe(2);
    expect(template2.body).toBe('Test template body v2');
  });

  it('should get template history', async () => {
    const history = await getTemplateHistory(testType, testSlot);

    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].version).toBeGreaterThanOrEqual(history[1].version);
    expect(history.every(h => h.status === 'published')).toBe(true);
  });

  it('should get active templates', async () => {
    const active = await getActiveTemplates(testType);

    const testTemplate = active.find(t => t.slot === testSlot);
    expect(testTemplate).toBeDefined();
    expect(testTemplate?.version).toBe(2); // Latest version
    expect(testTemplate?.status).toBe('published');
  });

  it('should get templates by specific version', async () => {
    const templates = await getActiveTemplates(testType, 1);

    const testTemplate = templates.find(t => t.slot === testSlot);
    expect(testTemplate).toBeDefined();
    expect(testTemplate?.version).toBe(1);
  });
});

