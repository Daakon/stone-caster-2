/**
 * AWF Economy Linter
 * Validates economy registries and checks for issues
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LintResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

interface LintOptions {
  checkItems: boolean;
  checkRecipes: boolean;
  checkLoot: boolean;
  checkVendors: boolean;
  checkReferences: boolean;
  checkWeights: boolean;
  checkPrices: boolean;
  verbose: boolean;
}

class EconomyLinter {
  private options: LintOptions;

  constructor(options: Partial<LintOptions> = {}) {
    this.options = {
      checkItems: true,
      checkRecipes: true,
      checkLoot: true,
      checkVendors: true,
      checkReferences: true,
      checkWeights: true,
      checkPrices: true,
      verbose: false,
      ...options,
    };
  }

  /**
   * Lint all economy registries
   */
  async lintAll(): Promise<LintResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Load registries
      const items = await this.loadItems();
      const recipes = await this.loadRecipes();
      const lootTables = await this.loadLootTables();
      const vendors = await this.loadVendors();

      // Check items
      if (this.options.checkItems) {
        const itemResults = this.lintItems(items);
        errors.push(...itemResults.errors);
        warnings.push(...itemResults.warnings);
        suggestions.push(...itemResults.suggestions);
      }

      // Check recipes
      if (this.options.checkRecipes) {
        const recipeResults = this.lintRecipes(recipes);
        errors.push(...recipeResults.errors);
        warnings.push(...recipeResults.warnings);
        suggestions.push(...recipeResults.suggestions);
      }

      // Check loot tables
      if (this.options.checkLoot) {
        const lootResults = this.lintLootTables(lootTables);
        errors.push(...lootResults.errors);
        warnings.push(...lootResults.warnings);
        suggestions.push(...lootResults.suggestions);
      }

      // Check vendors
      if (this.options.checkVendors) {
        const vendorResults = this.lintVendors(vendors);
        errors.push(...vendorResults.errors);
        warnings.push(...vendorResults.warnings);
        suggestions.push(...vendorResults.suggestions);
      }

      // Check references
      if (this.options.checkReferences) {
        const referenceResults = this.lintReferences(items, recipes, lootTables, vendors);
        errors.push(...referenceResults.errors);
        warnings.push(...referenceResults.warnings);
        suggestions.push(...referenceResults.suggestions);
      }

    } catch (error) {
      errors.push(`Failed to load economy registries: ${error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Load items from database
   */
  private async loadItems(): Promise<any[]> {
    const { data, error } = await supabase
      .from('items_registry')
      .select('*');

    if (error) {
      throw new Error(`Failed to load items: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Load recipes from database
   */
  private async loadRecipes(): Promise<any[]> {
    const { data, error } = await supabase
      .from('recipes_registry')
      .select('*');

    if (error) {
      throw new Error(`Failed to load recipes: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Load loot tables from database
   */
  private async loadLootTables(): Promise<any[]> {
    const { data, error } = await supabase
      .from('loot_tables')
      .select('*');

    if (error) {
      throw new Error(`Failed to load loot tables: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Load vendors from database
   */
  private async loadVendors(): Promise<any[]> {
    const { data, error } = await supabase
      .from('vendors_registry')
      .select('*');

    if (error) {
      throw new Error(`Failed to load vendors: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Lint items registry
   */
  private lintItems(items: any[]): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const item of items) {
      if (ids.has(item.id)) {
        errors.push(`Duplicate item ID: ${item.id}`);
      }
      ids.add(item.id);
    }

    // Check item definitions
    for (const item of items) {
      const doc = item.doc;
      if (!doc.name || doc.name.trim().length === 0) {
        errors.push(`Item ${item.id}: missing name`);
      }

      if (!doc.cat || !['weapon', 'armor', 'consumable', 'material', 'quest'].includes(doc.cat)) {
        errors.push(`Item ${item.id}: invalid category`);
      }

      if (doc.stack && (doc.stack < 1 || doc.stack > 999)) {
        warnings.push(`Item ${item.id}: stack size ${doc.stack} outside recommended range (1-999)`);
      }

      if (doc.tier && (doc.tier < 1 || doc.tier > 10)) {
        errors.push(`Item ${item.id}: tier ${doc.tier} outside valid range (1-10)`);
      }

      if (!doc.tags || doc.tags.length === 0) {
        suggestions.push(`Item ${item.id}: consider adding tags for categorization`);
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Lint recipes registry
   */
  private lintRecipes(recipes: any[]): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const recipe of recipes) {
      if (ids.has(recipe.id)) {
        errors.push(`Duplicate recipe ID: ${recipe.id}`);
      }
      ids.add(recipe.id);
    }

    // Check recipe definitions
    for (const recipe of recipes) {
      const doc = recipe.doc;
      
      if (!doc.inputs || doc.inputs.length === 0) {
        errors.push(`Recipe ${recipe.id}: missing inputs`);
      }

      if (!doc.outputs || doc.outputs.length === 0) {
        errors.push(`Recipe ${recipe.id}: missing outputs`);
      }

      if (!doc.skill || doc.skill.trim().length === 0) {
        errors.push(`Recipe ${recipe.id}: missing skill`);
      }

      if (doc.diff && (doc.diff < 0 || doc.diff > 100)) {
        errors.push(`Recipe ${recipe.id}: difficulty ${doc.diff} outside valid range (0-100)`);
      }

      // Check for circular recipes
      for (const output of doc.outputs || []) {
        if (doc.inputs?.some((input: any) => input.id === output.id)) {
          warnings.push(`Recipe ${recipe.id}: potential circular dependency (${output.id} in both inputs and outputs)`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Lint loot tables
   */
  private lintLootTables(lootTables: any[]): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const table of lootTables) {
      if (ids.has(table.id)) {
        errors.push(`Duplicate loot table ID: ${table.id}`);
      }
      ids.add(table.id);
    }

    // Check loot table definitions
    for (const table of lootTables) {
      const doc = table.doc;
      
      if (!doc.entries || doc.entries.length === 0) {
        errors.push(`Loot table ${table.id}: missing entries`);
      }

      if (doc.rolls && (doc.rolls < 1 || doc.rolls > 10)) {
        warnings.push(`Loot table ${table.id}: rolls ${doc.rolls} outside recommended range (1-10)`);
      }

      // Check weight distribution
      if (doc.entries && doc.entries.length > 0) {
        const totalWeight = doc.entries.reduce((sum: number, entry: any) => sum + (entry.w || 0), 0);
        if (totalWeight === 0) {
          errors.push(`Loot table ${table.id}: all entries have zero weight`);
        } else if (totalWeight < 10) {
          warnings.push(`Loot table ${table.id}: very low total weight (${totalWeight}) may cause issues`);
        }

        // Check for entries with zero weight
        for (const entry of doc.entries) {
          if (entry.w <= 0) {
            warnings.push(`Loot table ${table.id}: entry ${entry.id} has zero or negative weight`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Lint vendors
   */
  private lintVendors(vendors: any[]): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const vendor of vendors) {
      if (ids.has(vendor.id)) {
        errors.push(`Duplicate vendor ID: ${vendor.id}`);
      }
      ids.add(vendor.id);
    }

    // Check vendor definitions
    for (const vendor of vendors) {
      const doc = vendor.doc;
      
      if (!doc.currency || doc.currency.trim().length === 0) {
        errors.push(`Vendor ${vendor.id}: missing currency`);
      }

      if (!doc.stock || doc.stock.length === 0) {
        warnings.push(`Vendor ${vendor.id}: empty stock`);
      }

      if (doc.buySpread && (doc.buySpread < 0 || doc.buySpread > 2)) {
        warnings.push(`Vendor ${vendor.id}: buy spread ${doc.buySpread} outside recommended range (0-2)`);
      }

      if (doc.sellSpread && (doc.sellSpread < 0 || doc.sellSpread > 2)) {
        warnings.push(`Vendor ${vendor.id}: sell spread ${doc.sellSpread} outside recommended range (0-2)`);
      }

      // Check stock prices
      for (const stockItem of doc.stock || []) {
        if (stockItem.price < 0) {
          errors.push(`Vendor ${vendor.id}: negative price for ${stockItem.id}`);
        }
        if (stockItem.qty < 0) {
          errors.push(`Vendor ${vendor.id}: negative quantity for ${stockItem.id}`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Lint references between registries
   */
  private lintReferences(items: any[], recipes: any[], lootTables: any[], vendors: any[]): LintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const itemIds = new Set(items.map(item => item.id));

    // Check recipe references
    for (const recipe of recipes) {
      const doc = recipe.doc;
      
      // Check input references
      for (const input of doc.inputs || []) {
        if (input.id && !itemIds.has(input.id)) {
          errors.push(`Recipe ${recipe.id}: references unknown item ${input.id}`);
        }
      }

      // Check output references
      for (const output of doc.outputs || []) {
        if (!itemIds.has(output.id)) {
          errors.push(`Recipe ${recipe.id}: references unknown item ${output.id}`);
        }
      }
    }

    // Check loot table references
    for (const table of lootTables) {
      const doc = table.doc;
      
      for (const entry of doc.entries || []) {
        if (entry.id !== 'gold' && !itemIds.has(entry.id)) {
          errors.push(`Loot table ${table.id}: references unknown item ${entry.id}`);
        }
      }
    }

    // Check vendor references
    for (const vendor of vendors) {
      const doc = vendor.doc;
      
      for (const stockItem of doc.stock || []) {
        if (!itemIds.has(stockItem.id)) {
          errors.push(`Vendor ${vendor.id}: references unknown item ${stockItem.id}`);
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings, suggestions };
  }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'lint') {
    const linter = new EconomyLinter({ verbose: true });
    
    linter.lintAll().then(result => {
      console.log(`\nEconomy Lint Results:`);
      console.log(`Valid: ${result.valid ? '✅' : '❌'}`);
      
      if (result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(error => console.log(`  ❌ ${error}`));
      }
      
      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        result.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
      }
      
      if (result.suggestions.length > 0) {
        console.log('\nSuggestions:');
        result.suggestions.forEach(suggestion => console.log(`  💡 ${suggestion}`));
      }

      process.exit(result.valid ? 0 : 1);
    }).catch(error => {
      console.error('Lint error:', error);
      process.exit(1);
    });
  } else {
    console.log('Usage:');
    console.log('  npm run awf:lint:economy lint');
    process.exit(1);
  }
}


