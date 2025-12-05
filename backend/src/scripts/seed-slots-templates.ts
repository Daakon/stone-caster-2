/**
 * Seed Slots and Templates
 * Seeds database from in-memory registries if empty
 */

import { upsertSlot } from '../services/slots.service.js';
import { publishNewVersion } from '../services/templates.service.js';
import { slotRegistry, templateRegistry, seedSlotsAndTemplates } from '../slots/registry.js';

/**
 * Seed slots and templates from in-memory registries to database
 */
export async function seedSlotsAndTemplatesToDB(createdBy?: string): Promise<void> {
  // Re-seed in-memory first to ensure we have the data
  seedSlotsAndTemplates();

  // Get all slots from in-memory registry
  const slots = slotRegistry.getAll();
  
  // Upsert all slots
  for (const slot of slots) {
    try {
      await upsertSlot({
        type: slot.type,
        name: slot.name,
        description: slot.description,
        max_len: slot.max_len,
        priority: slot.priority || 0,
      });
    } catch (error) {
      console.error(`[seedSlotsAndTemplatesToDB] Failed to upsert slot ${slot.type}.${slot.name}:`, error);
    }
  }

  // Get all templates from in-memory registry
  const templates = templateRegistry.getAll();
  
  // Group by (type, slot) and publish the latest
  const templatesBySlot = new Map<string, typeof templates[0]>();
  for (const template of templates) {
    const key = `${template.type}:${template.slot}`;
    const existing = templatesBySlot.get(key);
    if (!existing || template.version.localeCompare(existing.version) > 0) {
      templatesBySlot.set(key, template);
    }
  }

  // Publish all templates (only if templates table exists)
  // Check if templates table exists first
  const { supabaseAdmin } = await import('../services/supabase.js');
  const { error: tableCheckError } = await supabaseAdmin
    .from('templates')
    .select('id')
    .limit(1);

  if (tableCheckError) {
    // Templates table doesn't exist - skip template seeding
    if (tableCheckError.code === 'PGRST205' || tableCheckError.message?.includes('Could not find the table')) {
      console.log('[seedSlotsAndTemplatesToDB] Templates table not found - skipping template seeding (legacy table)');
      return;
    }
    // Other error - log and continue with slots only
    console.warn('[seedSlotsAndTemplatesToDB] Error checking templates table:', tableCheckError);
    return;
  }

  // Templates table exists - proceed with seeding
  for (const template of templatesBySlot.values()) {
    try {
      // Parse version string to number (e.g., "1.0.0" -> 1)
      const versionNum = parseInt(template.version.split('.')[0] || '1', 10);
      
      await publishNewVersion({
        type: template.type,
        slot: template.slot,
        body: template.body,
        baseVersion: versionNum - 1, // Will increment to versionNum
        created_by: createdBy,
      });
    } catch (error) {
      console.error(`[seedSlotsAndTemplatesToDB] Failed to publish template ${template.type}.${template.slot}:`, error);
    }
  }
}

/**
 * Check if database is empty and seed if needed
 */
export async function seedIfEmpty(): Promise<void> {
  const { supabaseAdmin } = await import('../services/supabase.js');
  
  // Check if slots table is empty
  const { data: slots, error: slotsError } = await supabaseAdmin
    .from('slots')
    .select('id')
    .limit(1);

  if (slotsError) {
    console.error('[seedIfEmpty] Error checking slots:', slotsError);
    return;
  }

  // Check if templates table exists and is empty
  // Note: templates table may not exist in all environments (legacy table)
  let templatesEmpty = true;
  const { data: templates, error: templatesError } = await supabaseAdmin
    .from('templates')
    .select('id')
    .limit(1);

  if (templatesError) {
    // Table doesn't exist - this is OK, templates are legacy
    if (templatesError.code === 'PGRST205' || templatesError.message?.includes('Could not find the table')) {
      console.log('[seedIfEmpty] Templates table not found - skipping template seeding (legacy table)');
      templatesEmpty = false; // Don't seed if table doesn't exist
    } else {
      console.error('[seedIfEmpty] Error checking templates:', templatesError);
      return;
    }
  } else {
    templatesEmpty = !templates || templates.length === 0;
  }

  // Seed if slots table is empty
  // Only seed templates if the table exists and is empty
  if (!slots || slots.length === 0) {
    console.log('[seedIfEmpty] Database is empty, seeding slots...');
    await seedSlotsAndTemplatesToDB();
    console.log('[seedIfEmpty] Seeding complete');
  } else if (templatesEmpty) {
    // Slots exist but templates don't - seed templates only
    console.log('[seedIfEmpty] Templates table is empty, seeding templates...');
    await seedSlotsAndTemplatesToDB();
    console.log('[seedIfEmpty] Template seeding complete');
  }
}

