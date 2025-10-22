const fs = require('fs');
const path = require('path');

const MIGRATIONS = [
  '20250131_fix_worlds_uuid_safe.sql',
  '20250131_create_rulesets_table.sql', 
  '20250131_admin_associations_phase_b_safe.sql',
  '20250131_admin_publishing_phase_c.sql',
  '20250131_add_prompt_fields.sql',
  '20250204_segments_scope_cleanup.sql',
  '20250205_prompt_segments_ref_integrity.sql'
];

console.log('🔍 Validating Admin Migrations...\n');

let allValid = true;

MIGRATIONS.forEach((file, i) => {
  const filePath = path.join('supabase', 'migrations', file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  console.log(`📄 Migration ${i + 1}/${MIGRATIONS.length}: ${file}`);
  
  const issues = [];
  
  // Check for BEGIN/COMMIT balance
  const beginCount = (content.match(/BEGIN;/g) || []).length;
  const commitCount = (content.match(/COMMIT;/g) || []).length;
  
  if (beginCount !== commitCount) {
    issues.push(`BEGIN/COMMIT mismatch: ${beginCount} BEGIN, ${commitCount} COMMIT`);
  }
  
  // Check for unsafe operations
  if (content.includes('DROP TABLE') && !content.includes('IF EXISTS')) {
    issues.push('DROP TABLE without IF EXISTS');
  }
  
  if (content.includes('DROP COLUMN') && !content.includes('IF EXISTS')) {
    issues.push('DROP COLUMN without IF EXISTS');
  }
  
  if (content.includes('CREATE TABLE') && !content.includes('IF NOT EXISTS')) {
    issues.push('CREATE TABLE without IF NOT EXISTS');
  }
  
  if (content.includes('ALTER TABLE') && content.includes('ADD COLUMN') && !content.includes('IF NOT EXISTS')) {
    issues.push('ALTER TABLE ADD COLUMN without IF NOT EXISTS');
  }
  
  // Check for potential foreign key issues
  if (content.includes('REFERENCES public.worlds(id)') && !content.includes('world_text_id')) {
    issues.push('References worlds(id) - may need world_text_id for safe approach');
  }
  
  // Check for missing semicolons
  const lines = content.split('\n');
  let missingSemicolons = 0;
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed && 
        !trimmed.startsWith('--') && 
        !trimmed.startsWith('/*') && 
        !trimmed.endsWith(';') && 
        !trimmed.endsWith('{') && 
        !trimmed.endsWith('}') &&
        !trimmed.includes('BEGIN') &&
        !trimmed.includes('END') &&
        !trimmed.includes('COMMIT') &&
        !trimmed.includes('COMMENT') &&
        trimmed !== '') {
      missingSemicolons++;
    }
  });
  
  if (missingSemicolons > 0) {
    issues.push(`${missingSemicolons} lines may be missing semicolons`);
  }
  
  if (issues.length === 0) {
    console.log('✅ No issues found');
  } else {
    console.log('⚠️  Issues found:');
    issues.forEach(issue => console.log(`   - ${issue}`));
    allValid = false;
  }
  
  console.log('─'.repeat(60));
  console.log('');
});

if (allValid) {
  console.log('🎉 All migrations are valid and ready to run!');
  console.log('\n📋 Migration Order:');
  MIGRATIONS.forEach((file, i) => {
    console.log(`   ${i + 1}. ${file}`);
  });
  console.log('\n💡 To apply migrations:');
  console.log('   1. Use Supabase CLI: supabase db reset --force');
  console.log('   2. Or apply manually in Supabase dashboard SQL editor');
  console.log('   3. Or use the PowerShell script: .\\scripts\\run-admin-migrations.ps1');
} else {
  console.log('❌ Some migrations have issues that need to be fixed before running.');
}
