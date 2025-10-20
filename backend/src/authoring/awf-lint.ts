import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
// @ts-ignore - glob module types
import { glob } from 'glob';

export interface LintRule {
  name: string;
  severity: 'error' | 'warning';
  check: (doc: any, path: string) => LintIssue[];
}

export interface LintIssue {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  path: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface LintConfig {
  rules: {
    [key: string]: {
      enabled: boolean;
      severity?: 'error' | 'warning';
      options?: any;
    };
  };
  ignore: string[];
  strict: boolean;
}

export interface LintResult {
  path: string;
  issues: LintIssue[];
  passed: boolean;
  errorCount: number;
  warningCount: number;
}

export interface LintReport {
  timestamp: string;
  config: LintConfig;
  results: LintResult[];
  summary: {
    totalFiles: number;
    passedFiles: number;
    failedFiles: number;
    totalErrors: number;
    totalWarnings: number;
  };
}

export class AwfLinter {
  private config: LintConfig;
  private rules: LintRule[] = [];

  constructor(configPath?: string | LintConfig) {
    if (typeof configPath === 'string' || !configPath) {
      this.config = this.loadConfig(configPath);
    } else {
      this.config = configPath;
    }
    this.registerRules();
  }

  private loadConfig(configPath?: string): LintConfig {
    const defaultConfig: LintConfig = {
      rules: {
        schema_validation: { enabled: true, severity: 'error' },
        tone_policy: { enabled: true, severity: 'error' },
        acts_budget: { enabled: true, severity: 'warning' },
        first_turn_rules: { enabled: true, severity: 'error' },
        slice_coverage: { enabled: true, severity: 'warning' },
        stable_ids: { enabled: true, severity: 'error' },
        time_bands: { enabled: true, severity: 'error' },
        npc_validation: { enabled: true, severity: 'error' },
        bundle_npc_validation: { enabled: true, severity: 'warning' },
        scenario_validation: { enabled: true, severity: 'error' },
        bundle_scenario_validation: { enabled: true, severity: 'warning' },
        world_validation: { enabled: true, severity: 'error' },
        adventure_validation: { enabled: true, severity: 'error' },
        bundle_world_adv_validation: { enabled: true, severity: 'warning' },
        injection_map_validation: { enabled: true, severity: 'error' },
        bundle_injection_validation: { enabled: true, severity: 'warning' },
        bundle_entry_validation: { enabled: true, severity: 'warning' }
      },
      ignore: ['node_modules/**', '.git/**'],
      strict: false
    };

    if (configPath && existsSync(configPath)) {
      try {
        const configContent = readFileSync(configPath, 'utf-8');
        const userConfig = JSON.parse(configContent);
        return { ...defaultConfig, ...userConfig };
      } catch (error) {
        console.warn(`Failed to load config from ${configPath}, using defaults`);
      }
    }

    return defaultConfig;
  }

  private registerRules(): void {
    // Schema validation rule
    this.rules.push({
      name: 'schema_validation',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check required fields based on document type
        if (path.includes('core/contract')) {
          if (!doc.contract) {
            issues.push({
              rule: 'schema_validation',
              severity: 'error',
              message: 'Missing required field: contract',
              path
            });
          }
          if (!doc.contract?.acts) {
            issues.push({
              rule: 'schema_validation',
              severity: 'error',
              message: 'Missing required field: contract.acts',
              path
            });
          }
        }

        if (path.includes('worlds/')) {
          if (!doc.world) {
            issues.push({
              rule: 'schema_validation',
              severity: 'error',
              message: 'Missing required field: world',
              path
            });
          }
        }

        if (path.includes('adventures/')) {
          if (!doc.adventure) {
            issues.push({
              rule: 'schema_validation',
              severity: 'error',
              message: 'Missing required field: adventure',
              path
            });
          }
        }

        if (path.includes('start/')) {
          if (!doc.adventure_start) {
            issues.push({
              rule: 'schema_validation',
              severity: 'error',
              message: 'Missing required field: adventure_start',
              path
            });
          }
        }

        return issues;
      }
    });

    // Core Contract V2 validation rule
    this.rules.push({
      name: 'core_contract_v2',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Core contracts should NOT have narrative fields (moved to rulesets)
        if (doc.contract?.['scn.phases']) {
          issues.push({
            rule: 'core_contract_v2',
            severity: 'error',
            message: 'Core contracts should not contain scn.phases (moved to rulesets)',
            path,
            suggestion: 'Remove scn.phases from core contract - use rulesets instead'
          });
        }

        if (doc.contract?.['txt.policy']) {
          issues.push({
            rule: 'core_contract_v2',
            severity: 'error',
            message: 'Core contracts should not contain txt.policy (moved to rulesets)',
            path,
            suggestion: 'Remove txt.policy from core contract - use rulesets instead'
          });
        }

        if (doc.contract?.['choices.policy']) {
          issues.push({
            rule: 'core_contract_v2',
            severity: 'error',
            message: 'Core contracts should not contain choices.policy (moved to rulesets)',
            path,
            suggestion: 'Remove choices.policy from core contract - use rulesets instead'
          });
        }

        if (doc.defaults) {
          issues.push({
            rule: 'core_contract_v2',
            severity: 'error',
            message: 'Core contracts should not contain defaults (moved to rulesets)',
            path,
            suggestion: 'Remove defaults from core contract - use rulesets instead'
          });
        }

        // Core contracts should have required framework fields
        if (!doc.contract?.name) {
          issues.push({
            rule: 'core_contract_v2',
            severity: 'error',
            message: 'Core contract missing required contract.name',
            path,
            suggestion: 'Add contract.name field'
          });
        }

        if (!doc.contract?.awf_return) {
          issues.push({
            rule: 'core_contract_v2',
            severity: 'error',
            message: 'Core contract missing required contract.awf_return',
            path,
            suggestion: 'Add contract.awf_return field'
          });
        }

        if (!doc.contract?.keys?.required || !Array.isArray(doc.contract.keys.required) || doc.contract.keys.required.length === 0) {
          issues.push({
            rule: 'core_contract_v2',
            severity: 'error',
            message: 'Core contract missing required contract.keys.required array',
            path,
            suggestion: 'Add contract.keys.required array with required keys'
          });
        }

        if (!doc.core?.acts_catalog || !Array.isArray(doc.core.acts_catalog) || doc.core.acts_catalog.length === 0) {
          issues.push({
            rule: 'core_contract_v2',
            severity: 'error',
            message: 'Core contract missing required core.acts_catalog array',
            path,
            suggestion: 'Add core.acts_catalog array with act definitions'
          });
        }

        if (!doc.core?.scales) {
          issues.push({
            rule: 'core_contract_v2',
            severity: 'error',
            message: 'Core contract missing required core.scales',
            path,
            suggestion: 'Add core.scales with skill and relationship scales'
          });
        }

        return issues;
      }
    });

    // Ruleset validation rule
    this.rules.push({
      name: 'games_only_state',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check that games.state_snapshot.meta contains required fields
        if (path.includes('games/') && doc.state_snapshot?.meta) {
          const meta = doc.state_snapshot.meta;
          
          if (!meta.world_ref) {
            issues.push({
              rule: 'games_only_state',
              severity: 'error',
              message: 'games.state_snapshot.meta must contain world_ref',
              path,
              suggestion: 'Add world_ref to games.state_snapshot.meta'
            });
          }
          
          if (!meta.adventure_ref) {
            issues.push({
              rule: 'games_only_state',
              severity: 'error',
              message: 'games.state_snapshot.meta must contain adventure_ref',
              path,
              suggestion: 'Add adventure_ref to games.state_snapshot.meta'
            });
          }
          
          if (!meta.ruleset_ref) {
            issues.push({
              rule: 'games_only_state',
              severity: 'warning',
              message: 'games.state_snapshot.meta should contain ruleset_ref (will default to ruleset.core.default@1.0.0)',
              path,
              suggestion: 'Add ruleset_ref to games.state_snapshot.meta'
            });
          }
          
          if (!meta.locale) {
            issues.push({
              rule: 'games_only_state',
              severity: 'warning',
              message: 'games.state_snapshot.meta should contain locale (will default to en-US)',
              path,
              suggestion: 'Add locale to games.state_snapshot.meta'
            });
          }
        }
        
        return issues;
      }
    });

    this.rules.push({
      name: 'ruleset_validation',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Only apply to ruleset documents
        if (!path.includes('rulesets/') && !doc.ruleset) {
          return issues;
        }

        // Rulesets must have required narrative fields
        if (!doc.ruleset?.['scn.phases'] || !Array.isArray(doc.ruleset['scn.phases']) || doc.ruleset['scn.phases'].length === 0) {
          issues.push({
            rule: 'ruleset_validation',
            severity: 'error',
            message: 'Ruleset missing required scn.phases array',
            path,
            suggestion: 'Add scn.phases array with phase names'
          });
        }

        if (!doc.ruleset?.['txt.policy'] || typeof doc.ruleset['txt.policy'] !== 'string') {
          issues.push({
            rule: 'ruleset_validation',
            severity: 'error',
            message: 'Ruleset missing required txt.policy string',
            path,
            suggestion: 'Add txt.policy string with narrative guidelines'
          });
        }

        if (!doc.ruleset?.['choices.policy'] || typeof doc.ruleset['choices.policy'] !== 'string') {
          issues.push({
            rule: 'ruleset_validation',
            severity: 'error',
            message: 'Ruleset missing required choices.policy string',
            path,
            suggestion: 'Add choices.policy string with choice guidelines'
          });
        }

        if (!doc.ruleset?.defaults || typeof doc.ruleset.defaults !== 'object') {
          issues.push({
            rule: 'ruleset_validation',
            severity: 'error',
            message: 'Ruleset missing required defaults object',
            path,
            suggestion: 'Add defaults object with txt_sentences_min, txt_sentences_max, etc.'
          });
        }

        // Check txt.policy sentence bounds (2-6 sentences)
        if (doc.ruleset?.['txt.policy']) {
          const sentences = doc.ruleset['txt.policy'].split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
          if (sentences.length < 2 || sentences.length > 6) {
            issues.push({
              rule: 'ruleset_validation',
              severity: 'error',
              message: `txt.policy must have 2-6 sentences, found ${sentences.length}`,
              path,
              suggestion: 'Adjust sentence count to be between 2-6 sentences'
            });
          }
        }

        // Check for mechanics in txt (should be in acts, not txt)
        if (doc.ruleset?.['txt.policy']) {
          const mechanics = ['[', ']', '{', '}', 'roll', 'dice', 'skill', 'check'];
          const hasMechanics = mechanics.some(mech => 
            doc.ruleset['txt.policy'].toLowerCase().includes(mech)
          );
          if (hasMechanics) {
            issues.push({
              rule: 'ruleset_validation',
              severity: 'error',
              message: 'txt.policy should not contain mechanics (use acts instead)',
              path,
              suggestion: 'Move mechanical content to acts section'
            });
          }
        }

        return issues;
      }
    });

    // Acts catalog validation rule (updated for V2 structure)
    this.rules.push({
      name: 'acts_catalog_validation',
      severity: 'warning',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check acts_catalog structure in core.acts_catalog (V2)
        const actsCatalog = doc.core?.acts_catalog || doc.acts_catalog;
        if (actsCatalog) {
          if (!Array.isArray(actsCatalog)) {
            issues.push({
              rule: 'acts_catalog_validation',
              severity: 'error',
              message: 'acts_catalog must be an array',
              path,
              suggestion: 'Convert acts_catalog to an array format'
            });
          } else if (actsCatalog.length === 0) {
            issues.push({
              rule: 'acts_catalog_validation',
              severity: 'warning',
              message: 'acts_catalog is empty',
              path,
              suggestion: 'Add act definitions to acts_catalog'
            });
          } else {
            // Validate each act in the catalog
            actsCatalog.forEach((act: any, index: number) => {
              if (!act.type || typeof act.type !== 'string') {
                issues.push({
                  rule: 'acts_catalog_validation',
                  severity: 'error',
                  message: `acts_catalog[${index}] missing or invalid type`,
                  path: `${path}.acts_catalog[${index}]`,
                  suggestion: 'Add valid type string to act definition'
                });
              }
              if (!act.mode || typeof act.mode !== 'string') {
                issues.push({
                  rule: 'acts_catalog_validation',
                  severity: 'error',
                  message: `acts_catalog[${index}] missing or invalid mode`,
                  path: `${path}.acts_catalog[${index}]`,
                  suggestion: 'Add valid mode string to act definition'
                });
              }
              if (!act.target || typeof act.target !== 'string') {
                issues.push({
                  rule: 'acts_catalog_validation',
                  severity: 'error',
                  message: `acts_catalog[${index}] missing or invalid target`,
                  path: `${path}.acts_catalog[${index}]`,
                  suggestion: 'Add valid target string to act definition'
                });
              }
            });
          }
        } else {
          issues.push({
            rule: 'acts_catalog_validation',
            severity: 'error',
            message: 'Missing required acts_catalog',
            path,
            suggestion: 'Add acts_catalog array with act definitions'
          });
        }

        return issues;
      }
    });

    // First-turn rules
    this.rules.push({
      name: 'first_turn_rules',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Start docs must set rules.no_time_advance=true
        if (path.includes('start/')) {
          if (!doc.adventure_start?.rules?.no_time_advance) {
            issues.push({
              rule: 'first_turn_rules',
              severity: 'error',
              message: 'Start documents must set rules.no_time_advance=true',
              path,
              suggestion: 'Add "rules": {"no_time_advance": true} to adventure_start'
            });
          }
        }

        return issues;
      }
    });

    // Slice coverage rule
    this.rules.push({
      name: 'slice_coverage',
      severity: 'warning',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Warn if missing slice names for world/adventure
        if (path.includes('worlds/') && doc.world) {
          if (!doc.world.slices || Object.keys(doc.world.slices).length === 0) {
            issues.push({
              rule: 'slice_coverage',
              severity: 'warning',
              message: 'World document missing slice definitions',
              path,
              suggestion: 'Add slice definitions to reduce token usage'
            });
          }
        }

        if (path.includes('adventures/') && doc.adventure) {
          if (!doc.adventure.slices || Object.keys(doc.adventure.slices).length === 0) {
            issues.push({
              rule: 'slice_coverage',
              severity: 'warning',
              message: 'Adventure document missing slice definitions',
              path,
              suggestion: 'Add slice definitions to reduce token usage'
            });
          }
        }

        return issues;
      }
    });

    // Stable IDs rule
    this.rules.push({
      name: 'stable_ids',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check for stable IDs in locations/npcs/objectives
        const checkIds = (items: any[], type: string) => {
          items?.forEach((item: any, index: number) => {
            if (item.id) {
              // Forbid whitespace/uppercase
              if (item.id !== item.id.toLowerCase()) {
                issues.push({
                  rule: 'stable_ids',
                  severity: 'error',
                  message: `${type} ${index + 1} ID contains uppercase: "${item.id}"`,
                  path,
                  suggestion: `Use lowercase ID: "${item.id.toLowerCase()}"`
                });
              }
              if (item.id.includes(' ')) {
                issues.push({
                  rule: 'stable_ids',
                  severity: 'error',
                  message: `${type} ${index + 1} ID contains whitespace: "${item.id}"`,
                  path,
                  suggestion: `Use underscore or kebab-case: "${item.id.replace(/\s+/g, '_')}"`
                });
              }
            }
          });
        };

        if (doc.world?.places) {
          checkIds(doc.world.places, 'Place');
        }
        if (doc.world?.npcs) {
          checkIds(doc.world.npcs, 'NPC');
        }
        if (doc.adventure?.objectives) {
          checkIds(doc.adventure.objectives, 'Objective');
        }

        return issues;
      }
    });

    // Time bands rule
    this.rules.push({
      name: 'time_bands',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        if (path.includes('worlds/') && doc.world?.timeworld?.bands) {
          const bands = doc.world.timeworld.bands;
          
          // Check for at least 4 bands
          if (bands.length < 4) {
            issues.push({
              rule: 'time_bands',
              severity: 'error',
              message: `World must have ≥4 time bands, found ${bands.length}`,
              path,
              suggestion: 'Add more time bands to create a cyclic schedule'
            });
          }

          // Check that bands sum to cyclic schedule
          const totalTicks = bands.reduce((sum: number, band: any) => sum + (band.ticks || 0), 0);
          if (totalTicks === 0) {
            issues.push({
              rule: 'time_bands',
              severity: 'error',
              message: 'Time bands must have non-zero tick values',
              path,
              suggestion: 'Set appropriate tick values for each band'
            });
          }
        }

        return issues;
      }
    });

    // NPC validation rule
    this.rules.push({
      name: 'npc_validation',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Only apply to NPC documents
        if (!path.includes('npcs/') && !doc.npc) {
          return issues;
        }

        // NPCs must have required fields
        if (!doc.npc?.display_name || typeof doc.npc.display_name !== 'string') {
          issues.push({
            rule: 'npc_validation',
            severity: 'error',
            message: 'NPC missing required display_name',
            path,
            suggestion: 'Add display_name string to NPC'
          });
        }

        if (!doc.npc?.summary || typeof doc.npc.summary !== 'string') {
          issues.push({
            rule: 'npc_validation',
            severity: 'error',
            message: 'NPC missing required summary',
            path,
            suggestion: 'Add summary string to NPC (≤160 chars)'
          });
        }

        // Check summary length
        if (doc.npc?.summary && doc.npc.summary.length > 160) {
          issues.push({
            rule: 'npc_validation',
            severity: 'error',
            message: `NPC summary too long: ${doc.npc.summary.length} chars (max 160)`,
            path,
            suggestion: 'Shorten summary to ≤160 characters'
          });
        }

        // Check display_name length
        if (doc.npc?.display_name && doc.npc.display_name.length > 64) {
          issues.push({
            rule: 'npc_validation',
            severity: 'error',
            message: `NPC display_name too long: ${doc.npc.display_name.length} chars (max 64)`,
            path,
            suggestion: 'Shorten display_name to ≤64 characters'
          });
        }

        // Check traits/skills ranges
        if (doc.npc?.traits) {
          for (const [trait, value] of Object.entries(doc.npc.traits)) {
            if (typeof value !== 'number' || value < 0 || value > 100) {
              issues.push({
                rule: 'npc_validation',
                severity: 'error',
                message: `NPC trait '${trait}' must be 0-100, found ${value}`,
                path,
                suggestion: 'Set trait value between 0-100'
              });
            }
          }
        }

        if (doc.npc?.skills) {
          for (const [skill, value] of Object.entries(doc.npc.skills)) {
            if (typeof value !== 'number' || value < 0 || value > 100) {
              issues.push({
                rule: 'npc_validation',
                severity: 'error',
                message: `NPC skill '${skill}' must be 0-100, found ${value}`,
                path,
                suggestion: 'Set skill value between 0-100'
              });
            }
          }
        }

        return issues;
      }
    });

    // Bundle NPC validation rule
    this.rules.push({
      name: 'bundle_npc_validation',
      severity: 'warning',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check bundle NPCs array
        if (path.includes('bundles/') && doc.awf_bundle?.npcs) {
          const npcs = doc.awf_bundle.npcs;
          
          if (!Array.isArray(npcs)) {
            issues.push({
              rule: 'bundle_npc_validation',
              severity: 'error',
              message: 'Bundle npcs must be an array',
              path,
              suggestion: 'Convert npcs to array format'
            });
          } else {
            // Check NPC count against ruleset cap
            const ruleset = doc.awf_bundle?.core?.ruleset;
            const cap = ruleset?.token_discipline?.npcs_active_cap ?? 5;
            
            if (npcs.length > cap) {
              issues.push({
                rule: 'bundle_npc_validation',
                severity: 'warning',
                message: `Bundle has ${npcs.length} NPCs, exceeds cap of ${cap}`,
                path,
                suggestion: 'Reduce NPC count or increase ruleset cap'
              });
            }

            // Validate each NPC structure
            npcs.forEach((npc: any, index: number) => {
              if (!npc.name || typeof npc.name !== 'string') {
                issues.push({
                  rule: 'bundle_npc_validation',
                  severity: 'error',
                  message: `Bundle NPC ${index} missing name`,
                  path: `${path}.npcs[${index}]`,
                  suggestion: 'Add name string to NPC'
                });
              }
              
              if (!npc.summary || typeof npc.summary !== 'string') {
                issues.push({
                  rule: 'bundle_npc_validation',
                  severity: 'error',
                  message: `Bundle NPC ${index} missing summary`,
                  path: `${path}.npcs[${index}]`,
                  suggestion: 'Add summary string to NPC'
                });
              }
            });
          }
        }
        
        return issues;
      }
    });

    // Scenario validation rules
    this.rules.push({
      name: 'scenario_validation',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check if this is a scenario document
        if (!path.includes('scenarios/') && !doc.scenario) {
          return issues;
        }

        // Validate scenario structure
        if (!doc.scenario?.display_name || typeof doc.scenario.display_name !== 'string') {
          issues.push({
            rule: 'scenario_validation',
            severity: 'error',
            message: 'Scenario missing required display_name',
            path,
            suggestion: 'Add scenario.display_name string'
          });
        }

        if (!doc.scenario?.start_scene || typeof doc.scenario.start_scene !== 'string') {
          issues.push({
            rule: 'scenario_validation',
            severity: 'error',
            message: 'Scenario missing required start_scene',
            path,
            suggestion: 'Add scenario.start_scene string'
          });
        }

        // Check length constraints
        if (doc.scenario?.display_name && doc.scenario.display_name.length > 64) {
          issues.push({
            rule: 'scenario_validation',
            severity: 'error',
            message: 'Scenario display_name exceeds 64 characters',
            path,
            suggestion: 'Shorten scenario.display_name to 64 characters or less'
          });
        }

        if (doc.scenario?.synopsis && doc.scenario.synopsis.length > 160) {
          issues.push({
            rule: 'scenario_validation',
            severity: 'error',
            message: 'Scenario synopsis exceeds 160 characters',
            path,
            suggestion: 'Shorten scenario.synopsis to 160 characters or less'
          });
        }

        // Check array limits
        if (doc.scenario?.fixed_npcs && Array.isArray(doc.scenario.fixed_npcs) && doc.scenario.fixed_npcs.length > 12) {
          issues.push({
            rule: 'scenario_validation',
            severity: 'error',
            message: 'Scenario fixed_npcs exceeds limit of 12',
            path,
            suggestion: 'Reduce fixed_npcs array to 12 items or less'
          });
        }

        if (doc.scenario?.starting_party && Array.isArray(doc.scenario.starting_party) && doc.scenario.starting_party.length > 6) {
          issues.push({
            rule: 'scenario_validation',
            severity: 'error',
            message: 'Scenario starting_party exceeds limit of 6',
            path,
            suggestion: 'Reduce starting_party array to 6 items or less'
          });
        }

        return issues;
      }
    });

    // Bundle scenario validation
    this.rules.push({
      name: 'bundle_scenario_validation',
      severity: 'warning',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check bundle scenario block
        if (path.includes('bundles/') && doc.awf_bundle?.scenario) {
          const scenario = doc.awf_bundle.scenario;
          
          if (!scenario.name || typeof scenario.name !== 'string') {
            issues.push({
              rule: 'bundle_scenario_validation',
              severity: 'error',
              message: 'Bundle scenario missing name',
              path,
              suggestion: 'Add scenario.name string'
            });
          }
          
          if (!scenario.start_scene || typeof scenario.start_scene !== 'string') {
            issues.push({
              rule: 'bundle_scenario_validation',
              severity: 'error',
              message: 'Bundle scenario missing start_scene',
              path,
              suggestion: 'Add scenario.start_scene string'
            });
          }

          // Check fixed_npcs array
          if (scenario.fixed_npcs && Array.isArray(scenario.fixed_npcs)) {
            if (scenario.fixed_npcs.length > 8) {
              issues.push({
                rule: 'bundle_scenario_validation',
                severity: 'warning',
                message: `Bundle scenario has ${scenario.fixed_npcs.length} fixed_npcs, exceeds cap of 8`,
                path,
                suggestion: 'Reduce fixed_npcs array to 8 items or less'
              });
            }
          }
        }

        return issues;
      }
    });

    // World validation rules (flexible)
    this.rules.push({
      name: 'world_validation',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check if this is a world document
        if (!path.includes('worlds/') && !doc.name) {
          return issues;
        }

        // Validate required fields
        if (!doc.name || typeof doc.name !== 'string') {
          issues.push({
            rule: 'world_validation',
            severity: 'error',
            message: 'World missing required name',
            path,
            suggestion: 'Add world.name string'
          });
        }

        // Warn if timeworld missing (allowed but recommended)
        if (!doc.timeworld) {
          issues.push({
            rule: 'world_validation',
            severity: 'warning',
            message: 'World missing timeworld (recommended)',
            path,
            suggestion: 'Add timeworld object with timezone and calendar'
          });
        }

        // Check for large unknown objects (prevent bloat)
        Object.keys(doc).forEach(key => {
          if (!['id', 'name', 'version', 'timeworld', 'slices', 'i18n'].includes(key)) {
            const value = doc[key];
            if (typeof value === 'object' && value !== null) {
              const serialized = JSON.stringify(value);
              if (serialized.length > 2048) { // 2KB limit
                issues.push({
                  rule: 'world_validation',
                  severity: 'warning',
                  message: `World custom field '${key}' exceeds 2KB (${Math.round(serialized.length/1024)}KB)`,
                  path,
                  suggestion: 'Consider splitting large custom fields or reducing size'
                });
              }
            }
          }
        });

        return issues;
      }
    });

    // Adventure validation rules (flexible)
    this.rules.push({
      name: 'adventure_validation',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check if this is an adventure document
        if (!path.includes('adventures/') && !doc.name) {
          return issues;
        }

        // Validate required fields
        if (!doc.name || typeof doc.name !== 'string') {
          issues.push({
            rule: 'adventure_validation',
            severity: 'error',
            message: 'Adventure missing required name',
            path,
            suggestion: 'Add adventure.name string'
          });
        }

        if (!doc.world_ref || typeof doc.world_ref !== 'string') {
          issues.push({
            rule: 'adventure_validation',
            severity: 'error',
            message: 'Adventure missing required world_ref',
            path,
            suggestion: 'Add adventure.world_ref string'
          });
        }

        // Check cast length
        if (doc.cast && Array.isArray(doc.cast) && doc.cast.length > 12) {
          issues.push({
            rule: 'adventure_validation',
            severity: 'warning',
            message: `Adventure cast has ${doc.cast.length} NPCs, exceeds recommended limit of 12`,
            path,
            suggestion: 'Reduce cast size or consider splitting into multiple adventures'
          });
        }

        // Check for large unknown objects (prevent bloat)
        Object.keys(doc).forEach(key => {
          if (!['id', 'name', 'version', 'world_ref', 'synopsis', 'cast', 'slices', 'i18n'].includes(key)) {
            const value = doc[key];
            if (typeof value === 'object' && value !== null) {
              const serialized = JSON.stringify(value);
              if (serialized.length > 2048) { // 2KB limit
                issues.push({
                  rule: 'adventure_validation',
                  severity: 'warning',
                  message: `Adventure custom field '${key}' exceeds 2KB (${Math.round(serialized.length/1024)}KB)`,
                  path,
                  suggestion: 'Consider splitting large custom fields or reducing size'
                });
              }
            }
          }
        });

        return issues;
      }
    });

    // Bundle world/adventure validation
    this.rules.push({
      name: 'bundle_world_adv_validation',
      severity: 'warning',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check bundle world/adventure blocks
        if (path.includes('bundles/') && doc.awf_bundle) {
          const bundle = doc.awf_bundle;
          
          // Check world block
          if (bundle.world) {
            if (!bundle.world.name || typeof bundle.world.name !== 'string') {
              issues.push({
                rule: 'bundle_world_adv_validation',
                severity: 'error',
                message: 'Bundle world missing name',
                path,
                suggestion: 'Add world.name string'
              });
            }
          }
          
          // Check adventure block
          if (bundle.adventure) {
            if (!bundle.adventure.name || typeof bundle.adventure.name !== 'string') {
              issues.push({
                rule: 'bundle_world_adv_validation',
                severity: 'error',
                message: 'Bundle adventure missing name',
                path,
                suggestion: 'Add adventure.name string'
              });
            }

            // Check adventure cast length
            if (bundle.adventure.cast && Array.isArray(bundle.adventure.cast)) {
              if (bundle.adventure.cast.length > 12) {
                issues.push({
                  rule: 'bundle_world_adv_validation',
                  severity: 'warning',
                  message: `Bundle adventure cast has ${bundle.adventure.cast.length} NPCs, may have been trimmed`,
                  path,
                  suggestion: 'Check if cast was trimmed due to token limits'
                });
              }
            }
          }
        }

        return issues;
      }
    });

    // Injection Map validation rules
    this.rules.push({
      name: 'injection_map_validation',
      severity: 'error',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check if this is an injection map document
        if (!path.includes('injection-maps/') && !doc.rules) {
          return issues;
        }

        // Validate injection map structure
        if (!doc.rules || !Array.isArray(doc.rules)) {
          issues.push({
            rule: 'injection_map_validation',
            severity: 'error',
            message: 'Injection map missing required rules array',
            path,
            suggestion: 'Add rules array with injection rules'
          });
        } else if (doc.rules.length === 0) {
          issues.push({
            rule: 'injection_map_validation',
            severity: 'error',
            message: 'Injection map rules array is empty',
            path,
            suggestion: 'Add at least one injection rule'
          });
        } else {
          // Validate each rule
          doc.rules.forEach((rule: any, index: number) => {
            if (!rule.from || typeof rule.from !== 'string') {
              issues.push({
                rule: 'injection_map_validation',
                severity: 'error',
                message: `Rule ${index + 1} missing required 'from' field`,
                path,
                suggestion: 'Add from field with source JSON pointer'
              });
            }

            if (!rule.to || typeof rule.to !== 'string') {
              issues.push({
                rule: 'injection_map_validation',
                severity: 'error',
                message: `Rule ${index + 1} missing required 'to' field`,
                path,
                suggestion: 'Add to field with target JSON pointer'
              });
            }

            // Validate JSON pointer format
            if (rule.to && !rule.to.startsWith('/')) {
              issues.push({
                rule: 'injection_map_validation',
                severity: 'error',
                message: `Rule ${index + 1} 'to' field must be absolute JSON pointer (start with /)`,
                path,
                suggestion: 'Change to field to start with /'
              });
            }

            // Validate limit configuration
            if (rule.limit) {
              if (!rule.limit.units || !['tokens', 'count'].includes(rule.limit.units)) {
                issues.push({
                  rule: 'injection_map_validation',
                  severity: 'error',
                  message: `Rule ${index + 1} limit.units must be 'tokens' or 'count'`,
                  path,
                  suggestion: 'Set limit.units to either "tokens" or "count"'
                });
              }

              if (!rule.limit.max || typeof rule.limit.max !== 'number' || rule.limit.max <= 0) {
                issues.push({
                  rule: 'injection_map_validation',
                  severity: 'error',
                  message: `Rule ${index + 1} limit.max must be positive number`,
                  path,
                  suggestion: 'Set limit.max to positive number'
                });
              }
            }
          });
        }

        return issues;
      }
    });

    // Bundle injection map validation
    this.rules.push({
      name: 'bundle_injection_validation',
      severity: 'warning',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check bundle structure for injection map compliance
        if (path.includes('bundles/') && doc.awf_bundle) {
          const bundle = doc.awf_bundle;
          
          // Check for required bundle roots
          const requiredRoots = ['meta', 'contract', 'world', 'adventure', 'npcs', 'player'];
          for (const root of requiredRoots) {
            if (!bundle[root]) {
              issues.push({
                rule: 'bundle_injection_validation',
                severity: 'warning',
                message: `Bundle missing required root: ${root}`,
                path,
                suggestion: `Add ${root} field to bundle structure`
              });
            }
          }

          // Check for token budget warnings
          const bundleSize = JSON.stringify(bundle).length;
          const estimatedTokens = Math.ceil(bundleSize / 4);
          
          if (estimatedTokens > 50000) { // 50k token warning
            issues.push({
              rule: 'bundle_injection_validation',
              severity: 'warning',
              message: `Bundle size is large: ${estimatedTokens.toLocaleString()} tokens`,
              path,
              suggestion: 'Consider trimming bundle size or using injection map limits'
            });
          }

          // Check for determinism issues
          if (bundle.meta && bundle.meta.timestamp) {
            const timestamp = new Date(bundle.meta.timestamp);
            const now = new Date();
            const ageMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);
            
            if (ageMinutes > 5) { // 5 minute age warning
              issues.push({
                rule: 'bundle_injection_validation',
                severity: 'warning',
                message: `Bundle timestamp is ${Math.round(ageMinutes)} minutes old`,
                path,
                suggestion: 'Ensure bundle is generated fresh for each request'
              });
            }
          }
        }

        return issues;
      }
    });

    // Bundle entry validation
    this.rules.push({
      name: 'bundle_entry_validation',
      severity: 'warning',
      check: (doc: any, path: string) => {
        const issues: LintIssue[] = [];
        
        // Check bundle structure for scenario presence
        if (path.includes('bundles/') && doc.awf_bundle) {
          const bundle = doc.awf_bundle;
          
          // Check if scenario_ref exists in meta
          if (bundle.meta && bundle.meta.scenario_ref) {
            const scenarioRef = bundle.meta.scenario_ref;
            
            // Check if scenario exists in bundle
            if (!bundle.scenario) {
              issues.push({
                rule: 'bundle_entry_validation',
                severity: 'warning',
                message: `Bundle references scenario '${scenarioRef}' but scenario field is missing`,
                path,
                suggestion: 'Ensure scenario is loaded and included in bundle'
              });
            } else {
              // Check if scenario is public
              if (bundle.scenario.is_public === false) {
                issues.push({
                  rule: 'bundle_entry_validation',
                  severity: 'warning',
                  message: `Scenario '${scenarioRef}' is marked as private (is_public: false)`,
                  path,
                  suggestion: 'Consider making scenario public or use a different scenario'
                });
              }
            }
          }
        }

        return issues;
      }
    });
  }

  async lintFiles(paths: string[]): Promise<LintReport> {
    const results: LintResult[] = [];
    let totalErrors = 0;
    let totalWarnings = 0;

    for (const pattern of paths) {
      const files = await glob(pattern, { ignore: this.config.ignore });
      
      if (!Array.isArray(files)) {
        console.warn(`No files found for pattern: ${pattern}`);
        continue;
      }
      
      for (const file of files) {
        try {
          const content = readFileSync(file, 'utf-8');
          const doc = JSON.parse(content);
          
          const result = this.lintDocument(doc, file);
          results.push(result);
          
          totalErrors += result.errorCount;
          totalWarnings += result.warningCount;
        } catch (error) {
          results.push({
            path: file,
            issues: [{
              rule: 'parse_error',
              severity: 'error',
              message: `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
              path: file
            }],
            passed: false,
            errorCount: 1,
            warningCount: 0
          });
          totalErrors += 1;
        }
      }
    }

    const passedFiles = results.filter(r => r.passed).length;
    const failedFiles = results.length - passedFiles;

    return {
      timestamp: new Date().toISOString(),
      config: this.config,
      results,
      summary: {
        totalFiles: results.length,
        passedFiles,
        failedFiles,
        totalErrors,
        totalWarnings
      }
    };
  }

  public lintDocument(doc: any, path: string): LintResult {
    const issues: LintIssue[] = [];
    
    for (const rule of this.rules) {
      const ruleConfig = this.config.rules[rule.name];
      if (!ruleConfig?.enabled) continue;
      
      const ruleIssues = rule.check(doc, path);
      const filteredIssues = ruleIssues.map(issue => ({
        ...issue,
        severity: ruleConfig.severity || rule.severity
      }));
      
      issues.push(...filteredIssues);
    }

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const passed = errorCount === 0;

    return {
      path,
      issues,
      passed,
      errorCount,
      warningCount
    };
  }

  printReport(report: LintReport): void {
    console.log('\n🔍 AWF Lint Report');
    console.log('='.repeat(50));
    
    if (report.summary.totalErrors === 0 && report.summary.totalWarnings === 0) {
      console.log('✅ All files passed linting!');
      return;
    }

    console.log(`📊 Summary: ${report.summary.passedFiles}/${report.summary.totalFiles} files passed`);
    console.log(`❌ Errors: ${report.summary.totalErrors}`);
    console.log(`⚠️  Warnings: ${report.summary.totalWarnings}\n`);

    for (const result of report.results) {
      if (result.issues.length === 0) continue;

      console.log(`📄 ${result.path}`);
      console.log('-'.repeat(result.path.length));

      for (const issue of result.issues) {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        console.log(`${icon} [${issue.rule}] ${issue.message}`);
        if (issue.suggestion) {
          console.log(`   💡 ${issue.suggestion}`);
        }
      }
      console.log();
    }
  }

  saveReport(report: LintReport, outputPath: string): void {
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${outputPath}`);
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const pathsIndex = args.indexOf('--paths');
  const strictIndex = args.indexOf('--strict');
  const configIndex = args.indexOf('--config');
  const outputIndex = args.indexOf('--output');

  const paths = pathsIndex !== -1 && args[pathsIndex + 1] 
    ? args[pathsIndex + 1].split(',')
    : ['**/*.json'];
  
  const strict = strictIndex !== -1;
  const configPath = configIndex !== -1 ? args[configIndex + 1] : undefined;
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : undefined;

  const linter = new AwfLinter(configPath);
  
  linter.lintFiles(paths).then(report => {
    linter.printReport(report);
    
    if (outputPath) {
      linter.saveReport(report, outputPath);
    }

    // Exit codes: 0 (clean), 1 (errors), 2 (warnings-only when --strict off)
    if (report.summary.totalErrors > 0) {
      process.exit(1);
    } else if (strict && report.summary.totalWarnings > 0) {
      process.exit(2);
    } else {
      process.exit(0);
    }
  }).catch(error => {
    console.error('Linting failed:', error);
    process.exit(1);
  });
}
