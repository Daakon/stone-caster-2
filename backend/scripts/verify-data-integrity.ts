#!/usr/bin/env tsx

/**
 * Data Integrity Verification Script
 * Phase 8: Validates manually entered data (Worlds, Rulesets) against Zod schemas
 * 
 * Prevents "Silent Failures" by catching:
 * - Missing required fields
 * - Incorrect enum values (case-sensitive)
 * - Orphaned dependencies
 * - Invalid JSON structures
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { RulesetDefinitionSchema, WorldDefinitionSchema } from '../../shared/src/types/chimera-authoring.js';
import type { RulesetDefinition, WorldDefinition } from '../../shared/src/types/chimera-authoring.js';
import type { Database } from '../src/db/supabase-client.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

interface ValidationError {
  id: string;
  reason: string;
  field?: string;
}

interface ValidationReport {
  rulesetsChecked: number;
  worldsChecked: number;
  invalidRulesets: ValidationError[];
  invalidWorlds: ValidationError[];
  orphanedDependencies: Array<{
    rulesetId: string;
    missingDependency: string;
  }>;
  worldsWithoutTags: string[];
}

async function verifyRulesets(allRulesetIds: Set<string>): Promise<{
  checked: number;
  invalid: ValidationError[];
  orphaned: Array<{ rulesetId: string; missingDependency: string }>;
}> {
  console.log('🔍 Fetching rulesets from database...');
  
  const { data, error } = await supabase
    .from('chimera_ruleset_templates')
    .select('id, key, ui_category, definition, dependencies');

  if (error) {
    throw new Error(`Failed to fetch rulesets: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No rulesets found in database');
    return { checked: 0, invalid: [], orphaned: [] };
  }

  const invalid: ValidationError[] = [];
  const orphaned: Array<{ rulesetId: string; missingDependency: string }> = [];

  console.log(`📊 Validating ${data.length} rulesets...`);

  for (const row of data) {
    const rulesetId = row.key || row.id;
    
    // Check ui_category (case-sensitive enum)
    if (row.ui_category) {
      const validCategories = ['foundation', 'expansion', 'flavor'];
      if (!validCategories.includes(row.ui_category)) {
        invalid.push({
          id: rulesetId,
          reason: `ui_category '${row.ui_category}' must be one of: ${validCategories.join(', ')} (case-sensitive)`,
          field: 'ui_category',
        });
      }
    }

    // Validate definition against Zod schema
    if (row.definition) {
      try {
        const parsed = RulesetDefinitionSchema.parse(row.definition);
        
        // Additional validation: check that actions and state_contributions are objects
        if (parsed.actions && typeof parsed.actions !== 'object') {
          invalid.push({
            id: rulesetId,
            reason: `actions must be an object, got ${typeof parsed.actions}`,
            field: 'actions',
          });
        }
        
        if (parsed.state_contributions && typeof parsed.state_contributions !== 'object') {
          invalid.push({
            id: rulesetId,
            reason: `state_contributions must be an object, got ${typeof parsed.state_contributions}`,
            field: 'state_contributions',
          });
        }

        // Check dependencies for orphaned references
        if (parsed.dependencies && Array.isArray(parsed.dependencies)) {
          for (const depId of parsed.dependencies) {
            if (!allRulesetIds.has(depId)) {
              orphaned.push({
                rulesetId,
                missingDependency: depId,
              });
            }
          }
        }
      } catch (error) {
        let reason = 'Failed to parse RulesetDefinition schema';
        if (error instanceof Error) {
          // Try to parse Zod error for better formatting
          try {
            const zodError = JSON.parse(error.message);
            if (Array.isArray(zodError)) {
              reason = zodError.map((err: any) => 
                `${err.path?.join('.') || 'root'}: ${err.message}`
              ).join('; ');
            } else {
              reason = error.message;
            }
          } catch {
            reason = error.message;
          }
        }
        invalid.push({
          id: rulesetId,
          reason,
          field: 'definition',
        });
      }
    } else {
      invalid.push({
        id: rulesetId,
        reason: 'definition field is missing or null',
        field: 'definition',
      });
    }
  }

  return {
    checked: data.length,
    invalid,
    orphaned,
  };
}

async function verifyWorlds(): Promise<{
  checked: number;
  invalid: ValidationError[];
  withoutTags: string[];
}> {
  console.log('🔍 Fetching worlds from database...');
  
  const { data, error } = await supabase
    .from('chimera_worlds')
    .select('id, key, definition');

  if (error) {
    throw new Error(`Failed to fetch worlds: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No worlds found in database');
    return { checked: 0, invalid: [], withoutTags: [] };
  }

  const invalid: ValidationError[] = [];
  const withoutTags: string[] = [];

  console.log(`📊 Validating ${data.length} worlds...`);

  for (const row of data) {
    const worldId = row.key || row.id;
    
    if (row.definition) {
      try {
        const parsed = WorldDefinitionSchema.parse(row.definition);
        
        // Validate character_schema_extensions is a valid object
        if (parsed.character_schema_extensions && typeof parsed.character_schema_extensions !== 'object') {
          invalid.push({
            id: worldId,
            reason: `character_schema_extensions must be an object, got ${typeof parsed.character_schema_extensions}`,
            field: 'character_schema_extensions',
          });
        }

        // Wizard compatibility check: warn if world has no tags/meta for filtering
        // Note: tags are not in the Zod schema but are used in the frontend
        const worldDef = row.definition as any;
        const hasTags = worldDef.tags && Array.isArray(worldDef.tags) && worldDef.tags.length > 0;
        const hasGenre = worldDef.genre && typeof worldDef.genre === 'string' && worldDef.genre.trim() !== '';
        
        if (!hasTags && !hasGenre) {
          withoutTags.push(worldId);
        }
      } catch (error) {
        let reason = 'Failed to parse WorldDefinition schema';
        if (error instanceof Error) {
          // Try to parse Zod error for better formatting
          try {
            const zodError = JSON.parse(error.message);
            if (Array.isArray(zodError)) {
              reason = zodError.map((err: any) => 
                `${err.path?.join('.') || 'root'}: ${err.message}`
              ).join('; ');
            } else {
              reason = error.message;
            }
          } catch {
            reason = error.message;
          }
        }
        invalid.push({
          id: worldId,
          reason,
          field: 'definition',
        });
      }
    } else {
      invalid.push({
        id: worldId,
        reason: 'definition field is missing or null',
        field: 'definition',
      });
    }
  }

  return {
    checked: data.length,
    invalid,
    withoutTags,
  };
}

async function getAllRulesetIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('chimera_ruleset_templates')
    .select('id, key');

  if (error) {
    throw new Error(`Failed to fetch ruleset IDs: ${error.message}`);
  }

  const ids = new Set<string>();
  if (data) {
    for (const row of data) {
      if (row.key) ids.add(row.key);
      if (row.id) ids.add(row.id);
    }
  }

  return ids;
}

async function main() {
  console.log('🚀 Starting Data Integrity Verification...\n');

  try {
    // First, collect all ruleset IDs for dependency checking
    const allRulesetIds = await getAllRulesetIds();
    console.log(`📋 Found ${allRulesetIds.size} unique ruleset IDs\n`);

    // Verify rulesets
    const rulesetResults = await verifyRulesets(allRulesetIds);
    console.log('');

    // Verify worlds
    const worldResults = await verifyWorlds();
    console.log('');

    // Generate report
    const report: ValidationReport = {
      rulesetsChecked: rulesetResults.checked,
      worldsChecked: worldResults.checked,
      invalidRulesets: rulesetResults.invalid,
      invalidWorlds: worldResults.invalid,
      orphanedDependencies: rulesetResults.orphaned,
      worldsWithoutTags: worldResults.withoutTags,
    };

    // Print summary table
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    VERIFICATION REPORT                     ');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`📊 Rulesets Checked: ${report.rulesetsChecked}`);
    console.log(`🌍 Worlds Checked: ${report.worldsChecked}`);
    console.log(`❌ Invalid Records Found: ${report.invalidRulesets.length + report.invalidWorlds.length}`);
    console.log(`🔗 Orphaned Dependencies: ${report.orphanedDependencies.length}`);
    console.log(`🏷️  Worlds Without Tags: ${report.worldsWithoutTags.length}\n`);

    // Print invalid rulesets
    if (report.invalidRulesets.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('                  INVALID RULESETS                         ');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      for (const error of report.invalidRulesets) {
        console.log(`ID: ${error.id}`);
        console.log(`  Reason: ${error.reason}`);
        if (error.field) {
          console.log(`  Field: ${error.field}`);
        }
        console.log('');
      }
    }

    // Print invalid worlds
    if (report.invalidWorlds.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('                   INVALID WORLDS                          ');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      for (const error of report.invalidWorlds) {
        console.log(`ID: ${error.id}`);
        console.log(`  Reason: ${error.reason}`);
        if (error.field) {
          console.log(`  Field: ${error.field}`);
        }
        console.log('');
      }
    }

    // Print orphaned dependencies
    if (report.orphanedDependencies.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('              ORPHANED DEPENDENCIES                        ');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      for (const orphan of report.orphanedDependencies) {
        console.log(`Ruleset: ${orphan.rulesetId}`);
        console.log(`  Missing Dependency: ${orphan.missingDependency}`);
        console.log('');
      }
    }

    // Print worlds without tags (warnings)
    if (report.worldsWithoutTags.length > 0) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('         WORLDS WITHOUT TAGS (Wizard Compatibility)         ');
      console.log('═══════════════════════════════════════════════════════════\n');
      
      console.log('⚠️  These worlds may not appear in the Wizard filter:');
      for (const worldId of report.worldsWithoutTags) {
        console.log(`  - ${worldId}`);
      }
      console.log('');
    }

    // Final summary
    const totalErrors = report.invalidRulesets.length + report.invalidWorlds.length + report.orphanedDependencies.length;
    
    if (totalErrors === 0) {
      console.log('✅ All data passed validation!');
      process.exit(0);
    } else {
      console.log(`❌ Found ${totalErrors} issue(s) that need to be fixed.`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

main();

