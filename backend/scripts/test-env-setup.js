#!/usr/bin/env node

/**
 * Test script to verify environment setup works without requiring actual env vars
 */

console.log('🧪 Testing environment setup...');

try {
  // Test 1: Import the config service (this should not throw)
  console.log('1. Testing config service import...');
  const { configService } = await import('../dist/services/config.service.js');
  console.log('   ✅ Config service imported successfully');

  // Test 2: Check if we can get environment config
  console.log('2. Testing environment config access...');
  const env = configService.getEnv();
  console.log('   ✅ Environment config accessed successfully');
  console.log(`   📋 Supabase URL: ${env.supabaseUrl}`);
  console.log(`   📋 Node Environment: ${env.nodeEnv}`);
  console.log(`   📋 Port: ${env.port}`);

  // Test 3: Check if config service is ready (this might fail if Supabase is not available, which is expected)
  console.log('3. Testing config service readiness...');
  try {
    await configService.whenReady();
    console.log('   ✅ Config service is ready');
  } catch (error) {
    console.log('   ⚠️  Config service not ready (expected if Supabase not available):', error.message);
  }

  console.log('\n🎉 Environment setup test completed successfully!');
  console.log('💡 The backend should now start without requiring environment variables in development mode.');
  
} catch (error) {
  console.error('❌ Environment setup test failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}




