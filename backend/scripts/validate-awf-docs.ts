/**
 * Validation script for AWF (Adventure World Format) bundle documents
 * Phase 1: Data Model - Validate all documents in the database
 */

import { createClient } from '@supabase/supabase-js';
import { AWFRepositoryFactory } from '../src/repositories/awf-repository-factory.js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'service-local';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize repository factory
const repoFactory = new AWFRepositoryFactory({ supabase });

interface ValidationResult {
  table: string;
  total: number;
  valid: number;
  invalid: number;
  errors: string[];
}

async function validateAllDocuments(): Promise<void> {
  console.log('🔍 Starting AWF bundle document validation...');

  const results: ValidationResult[] = [];

  try {
    // Validate core contracts
    console.log('📄 Validating core contracts...');
    const coreContractsRepo = repoFactory.getCoreContractsRepository();
    const coreContracts = await supabase.from('core_contracts').select('*');
    
    if (coreContracts.error) {
      throw new Error(`Failed to fetch core contracts: ${coreContracts.error.message}`);
    }

    const coreContractsResult: ValidationResult = {
      table: 'core_contracts',
      total: coreContracts.data?.length || 0,
      valid: 0,
      invalid: 0,
      errors: [],
    };

    for (const record of coreContracts.data || []) {
      if (coreContractsRepo.validate(record.doc)) {
        coreContractsResult.valid++;
      } else {
        coreContractsResult.invalid++;
        coreContractsResult.errors.push(`Invalid core contract: ${record.id}@${record.version}`);
      }
    }

    results.push(coreContractsResult);

    // Validate worlds
    console.log('🌍 Validating worlds...');
    const worldsRepo = repoFactory.getWorldsRepository();
    const worlds = await supabase.from('worlds').select('*');
    
    if (worlds.error) {
      throw new Error(`Failed to fetch worlds: ${worlds.error.message}`);
    }

    const worldsResult: ValidationResult = {
      table: 'worlds',
      total: worlds.data?.length || 0,
      valid: 0,
      invalid: 0,
      errors: [],
    };

    for (const record of worlds.data || []) {
      if (worldsRepo.validate(record.doc)) {
        worldsResult.valid++;
      } else {
        worldsResult.invalid++;
        worldsResult.errors.push(`Invalid world: ${record.id}@${record.version}`);
      }
    }

    results.push(worldsResult);

    // Validate adventures
    console.log('🎯 Validating adventures...');
    const adventuresRepo = repoFactory.getAdventuresRepository();
    const adventures = await supabase.from('adventures').select('*');
    
    if (adventures.error) {
      throw new Error(`Failed to fetch adventures: ${adventures.error.message}`);
    }

    const adventuresResult: ValidationResult = {
      table: 'adventures',
      total: adventures.data?.length || 0,
      valid: 0,
      invalid: 0,
      errors: [],
    };

    for (const record of adventures.data || []) {
      if (adventuresRepo.validate(record.doc)) {
        adventuresResult.valid++;
      } else {
        adventuresResult.invalid++;
        adventuresResult.errors.push(`Invalid adventure: ${record.id}@${record.version}`);
      }
    }

    results.push(adventuresResult);

    // Validate adventure starts
    console.log('🚀 Validating adventure starts...');
    const adventureStartsRepo = repoFactory.getAdventureStartsRepository();
    const adventureStarts = await supabase.from('adventure_starts').select('*');
    
    if (adventureStarts.error) {
      throw new Error(`Failed to fetch adventure starts: ${adventureStarts.error.message}`);
    }

    const adventureStartsResult: ValidationResult = {
      table: 'adventure_starts',
      total: adventureStarts.data?.length || 0,
      valid: 0,
      invalid: 0,
      errors: [],
    };

    for (const record of adventureStarts.data || []) {
      if (adventureStartsRepo.validate(record.doc)) {
        adventureStartsResult.valid++;
      } else {
        adventureStartsResult.invalid++;
        adventureStartsResult.errors.push(`Invalid adventure start: ${record.adventure_ref}`);
      }
    }

    results.push(adventureStartsResult);

    // Validate injection maps
    console.log('🗺️ Validating injection maps...');
    const injectionMapRepo = repoFactory.getInjectionMapRepository();
    const injectionMaps = await supabase.from('injection_map').select('*');
    
    if (injectionMaps.error) {
      throw new Error(`Failed to fetch injection maps: ${injectionMaps.error.message}`);
    }

    const injectionMapsResult: ValidationResult = {
      table: 'injection_map',
      total: injectionMaps.data?.length || 0,
      valid: 0,
      invalid: 0,
      errors: [],
    };

    for (const record of injectionMaps.data || []) {
      if (injectionMapRepo.validate(record.doc)) {
        injectionMapsResult.valid++;
      } else {
        injectionMapsResult.invalid++;
        injectionMapsResult.errors.push(`Invalid injection map: ${record.id}`);
      }
    }

    results.push(injectionMapsResult);

    // Print summary
    console.log('\n📊 Validation Summary:');
    console.log('====================');
    
    let totalDocuments = 0;
    let totalValid = 0;
    let totalInvalid = 0;

    for (const result of results) {
      console.log(`\n${result.table}:`);
      console.log(`  Total: ${result.total}`);
      console.log(`  Valid: ${result.valid}`);
      console.log(`  Invalid: ${result.invalid}`);
      
      if (result.errors.length > 0) {
        console.log(`  Errors:`);
        for (const error of result.errors) {
          console.log(`    - ${error}`);
        }
      }

      totalDocuments += result.total;
      totalValid += result.valid;
      totalInvalid += result.invalid;
    }

    console.log('\n🎯 Overall Summary:');
    console.log(`  Total Documents: ${totalDocuments}`);
    console.log(`  Valid: ${totalValid}`);
    console.log(`  Invalid: ${totalInvalid}`);

    if (totalInvalid > 0) {
      console.log('\n❌ Validation failed - some documents are invalid');
      process.exit(1);
    } else {
      console.log('\n✅ All documents are valid');
    }

  } catch (error) {
    console.error('❌ Error validating AWF bundle documents:', error);
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateAllDocuments();
}

export { validateAllDocuments };


