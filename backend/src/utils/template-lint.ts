/**
 * Template Linting
 * Health checks for templates
 */

import { getActiveTemplates } from '../services/templates.service.js';
import { listSlots } from '../services/slots.service.js';
import { renderSlotsForPack, type SlotPack } from '../slots/render-db.js';
import type { SlotType } from '../slots/registry.js';
import Mustache from 'mustache';

export interface LintWarning {
  type: 'missing_slot' | 'unknown_field' | 'truncated' | 'syntax_error';
  severity: 'error' | 'warning';
  message: string;
  template?: {
    type: SlotType;
    slot: string;
    version: number;
  };
}

/**
 * Extract Mustache variables from template body
 */
function extractMustacheVars(body: string): string[] {
  const vars = new Set<string>();
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  while ((match = regex.exec(body)) !== null) {
    const varName = match[1].trim();
    // Remove helpers and filters
    if (!varName.includes('(') && !varName.includes('|')) {
      vars.add(varName.split('.')[0]); // Get root variable name
    }
  }
  return Array.from(vars);
}

/**
 * Check if variable is known for a pack type
 */
function isKnownVariable(varName: string, packType: SlotType): boolean {
  const knownVars: Record<SlotType, string[]> = {
    world: ['world', 'join', 'truncate', 'first', 'last'],
    ruleset: ['ruleset', 'join', 'truncate', 'first', 'last'],
    npc: ['npc', 'join', 'truncate', 'first', 'last'],
    scenario: ['scenario', 'join', 'truncate', 'first', 'last'],
    module: ['module', 'join', 'truncate', 'first', 'last'],
    ux: ['ux', 'join', 'truncate', 'first', 'last'],
  };

  return knownVars[packType]?.includes(varName) || false;
}

/**
 * Lint templates for a specific version
 */
export async function lintTemplates(
  templatesVersion?: number
): Promise<LintWarning[]> {
  const warnings: LintWarning[] = [];

  // Get all slots
  const allSlots = await listSlots();
  const slotsByType = new Map<SlotType, typeof allSlots>();
  for (const slot of allSlots) {
    if (!slotsByType.has(slot.type)) {
      slotsByType.set(slot.type, []);
    }
    slotsByType.get(slot.type)!.push(slot);
  }

  // Get active templates
  const templates = await getActiveTemplates(undefined, templatesVersion);

  // Check for missing published templates
  for (const slot of allSlots) {
    const hasTemplate = templates.some(
      t => t.type === slot.type && t.slot === slot.name
    );
    if (!hasTemplate) {
      warnings.push({
        type: 'missing_slot',
        severity: 'error',
        message: `Missing published template for ${slot.type}.${slot.name}`,
      });
    }
  }

  // Check each template for issues
  for (const template of templates) {
    // Check for unknown fields
    const vars = extractMustacheVars(template.body);
    for (const varName of vars) {
      if (!isKnownVariable(varName, template.type)) {
        warnings.push({
          type: 'unknown_field',
          severity: 'warning',
          message: `Template ${template.type}.${template.slot} references unknown variable: ${varName}`,
          template: {
            type: template.type,
            slot: template.slot,
            version: template.version,
          },
        });
      }
    }

    // Check syntax (try to render with empty context)
    try {
      Mustache.render(template.body, {});
    } catch (error) {
      warnings.push({
        type: 'syntax_error',
        severity: 'error',
        message: `Template ${template.type}.${template.slot} has syntax error: ${error instanceof Error ? error.message : String(error)}`,
        template: {
          type: template.type,
          slot: template.slot,
          version: template.version,
        },
      });
    }

    // Check truncation (use sample fixture)
    const slotDef = allSlots.find(s => s.type === template.type && s.name === template.slot);
    if (slotDef?.max_len) {
      const samplePack: SlotPack = {
        type: template.type,
        id: 'sample',
        data: {
          [template.type]: {
            name: 'Sample',
            [template.slot]: 'Sample value',
          },
        },
      };

      try {
        const rendered = await renderSlotsForPack(samplePack, { templatesVersion });
        const renderedText = rendered[template.slot] || '';
        if (renderedText.length > slotDef.max_len) {
          warnings.push({
            type: 'truncated',
            severity: 'warning',
            message: `Template ${template.type}.${template.slot} renders to ${renderedText.length} chars (max: ${slotDef.max_len})`,
            template: {
              type: template.type,
              slot: template.slot,
              version: template.version,
            },
          });
        }
      } catch (error) {
        // Skip truncation check if rendering fails
      }
    }
  }

  return warnings;
}

