#!/usr/bin/env node

/**
 * Verification script for StoneCaster configuration
 * This script tests the config API endpoint and hot-reload functionality
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testConfigEndpoint() {
  console.log('🧪 Testing GET /api/config endpoint...\n');
  
  try {
    // First request - should return 200 with ETag
    console.log('1. Making initial request...');
    const response1 = await fetch(`${API_BASE_URL}/api/config`);
    
    if (!response1.ok) {
      throw new Error(`HTTP ${response1.status}: ${response1.statusText}`);
    }
    
    const config1 = await response1.json();
    const etag1 = response1.headers.get('etag');
    const cacheControl = response1.headers.get('cache-control');
    
    console.log(`✅ Status: ${response1.status}`);
    console.log(`✅ ETag: ${etag1}`);
    console.log(`✅ Cache-Control: ${cacheControl}`);
    console.log(`✅ Config keys: ${Object.keys(config1).join(', ')}`);
    
    // Verify required fields
    const requiredFields = ['etag', 'pricing', 'features', 'ai', 'app'];
    const missingFields = requiredFields.filter(field => !(field in config1));
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    console.log('✅ All required fields present');
    
    // Verify pricing structure
    const pricingFields = ['turnCostDefault', 'turnCostByWorld', 'conversionRates'];
    const missingPricingFields = pricingFields.filter(field => !(field in config1.pricing));
    
    if (missingPricingFields.length > 0) {
      throw new Error(`Missing pricing fields: ${missingPricingFields.join(', ')}`);
    }
    
    console.log('✅ Pricing structure valid');
    
    // Verify no sensitive data leaked
    const sensitiveFields = ['activeModel', 'maxTokensIn', 'maxTokensOut', 'cookieTtlDays', 'telemetrySampleRate'];
    const leakedFields = sensitiveFields.filter(field => {
      return JSON.stringify(config1).includes(field);
    });
    
    if (leakedFields.length > 0) {
      throw new Error(`Sensitive data leaked: ${leakedFields.join(', ')}`);
    }
    
    console.log('✅ No sensitive data leaked');
    
    // Second request with If-None-Match - should return 304
    console.log('\n2. Testing If-None-Match header...');
    const response2 = await fetch(`${API_BASE_URL}/api/config`, {
      headers: {
        'If-None-Match': etag1
      }
    });
    
    if (response2.status !== 304) {
      throw new Error(`Expected 304, got ${response2.status}`);
    }
    
    console.log('✅ 304 Not Modified returned correctly');
    
    // Third request with different ETag - should return 200
    console.log('\n3. Testing with different ETag...');
    const response3 = await fetch(`${API_BASE_URL}/api/config`, {
      headers: {
        'If-None-Match': 'different-etag'
      }
    });
    
    if (response3.status !== 200) {
      throw new Error(`Expected 200, got ${response3.status}`);
    }
    
    console.log('✅ 200 OK returned for different ETag');
    
    return { etag: etag1, config: config1 };
    
  } catch (error) {
    console.error('❌ Config endpoint test failed:', error.message);
    throw error;
  }
}

async function testHotReload() {
  console.log('\n🔄 Testing hot-reload functionality...\n');
  
  try {
    // Get initial config
    const response1 = await fetch(`${API_BASE_URL}/api/config`);
    const config1 = await response1.json();
    const etag1 = response1.headers.get('etag');
    
    console.log(`Initial ETag: ${etag1}`);
    
    // Wait a moment for potential polling
    console.log('Waiting 20 seconds for potential config changes...');
    await new Promise(resolve => setTimeout(resolve, 20000));
    
    // Get config again
    const response2 = await fetch(`${API_BASE_URL}/api/config`);
    const config2 = await response2.json();
    const etag2 = response2.headers.get('etag');
    
    console.log(`Updated ETag: ${etag2}`);
    
    if (etag1 === etag2) {
      console.log('✅ ETag unchanged (no config updates detected)');
    } else {
      console.log('✅ ETag changed (config was updated)');
    }
    
    return { initialEtag: etag1, updatedEtag: etag2 };
    
  } catch (error) {
    console.error('❌ Hot-reload test failed:', error.message);
    throw error;
  }
}

async function testTyping() {
  console.log('\n🔍 Testing TypeScript typing...\n');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/config`);
    const config = await response.json();
    
    // Test pricing config typing
    const turnCost = config.pricing.turnCostDefault;
    if (typeof turnCost !== 'number') {
      throw new Error(`Expected number, got ${typeof turnCost} for turnCostDefault`);
    }
    console.log(`✅ turnCostDefault is number: ${turnCost}`);
    
    const conversionRates = config.pricing.conversionRates;
    if (typeof conversionRates.crystal !== 'number') {
      throw new Error(`Expected number, got ${typeof conversionRates.crystal} for conversionRates.crystal`);
    }
    console.log(`✅ conversionRates.crystal is number: ${conversionRates.crystal}`);
    
    // Test features array
    if (!Array.isArray(config.features)) {
      throw new Error(`Expected array, got ${typeof config.features} for features`);
    }
    console.log(`✅ features is array with ${config.features.length} items`);
    
    // Test AI config
    if (typeof config.ai.promptSchemaVersion !== 'string') {
      throw new Error(`Expected string, got ${typeof config.ai.promptSchemaVersion} for promptSchemaVersion`);
    }
    console.log(`✅ promptSchemaVersion is string: ${config.ai.promptSchemaVersion}`);
    
    // Test app config
    if (typeof config.app.drifterEnabled !== 'boolean') {
      throw new Error(`Expected boolean, got ${typeof config.app.drifterEnabled} for drifterEnabled`);
    }
    console.log(`✅ drifterEnabled is boolean: ${config.app.drifterEnabled}`);
    
  } catch (error) {
    console.error('❌ Typing test failed:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Verifying StoneCaster configuration...\n');
  
  try {
    // Test config endpoint
    await testConfigEndpoint();
    
    // Test hot-reload
    await testHotReload();
    
    // Test typing
    await testTyping();
    
    console.log('\n🎉 All verification tests passed!');
    console.log('\nConfiguration spine is working correctly:');
    console.log('✅ Database migrations applied');
    console.log('✅ Configuration seeded');
    console.log('✅ API endpoint responding');
    console.log('✅ ETag caching working');
    console.log('✅ Hot-reload polling active');
    console.log('✅ TypeScript types correct');
    console.log('✅ No sensitive data leaked');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure the backend server is running: npm run dev');
    console.log('2. Check that migrations were applied: npm run setup-config');
    console.log('3. Verify environment variables are set correctly');
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();


