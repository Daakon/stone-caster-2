import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';

export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
}

export interface MigrationStep {
  from: string;
  to: string;
  transform: (doc: any) => any;
  description: string;
}

export interface MigrationResult {
  success: boolean;
  originalDoc: any;
  migratedDoc: any;
  changelog: string;
  backupPath?: string;
  error?: string;
}

export interface VersionedDoc {
  id: string;
  type: 'core' | 'world' | 'adventure' | 'start';
  currentVersion: string;
  content: any;
  ready_for_publish: boolean;
  last_lint_report?: string;
  last_playtest_report?: string;
}

export class SchemaVersionManager {
  private migrations: Map<string, MigrationStep[]> = new Map();

  constructor() {
    this.registerMigrations();
  }

  private registerMigrations(): void {
    // Core contract migrations
    this.registerMigration('core.test-contract', '4.0.0', '5.0.0', {
      from: '4.0.0',
      to: '5.0.0',
      transform: (doc: any) => {
        const migrated = { ...doc };
        
        // Rename beats.policy → beats.rules
        if (migrated.contract?.beats?.policy) {
          migrated.contract.beats.rules = migrated.contract.beats.policy;
          delete migrated.contract.beats.policy;
        }
        
        // Add output.budget.max_acts default if missing
        if (!migrated.contract?.output?.budget?.max_acts) {
          migrated.contract = migrated.contract || {};
          migrated.contract.output = migrated.contract.output || {};
          migrated.contract.output.budget = migrated.contract.output.budget || {};
          migrated.contract.output.budget.max_acts = 8;
        }
        
        return migrated;
      },
      description: 'Rename beats.policy to beats.rules, add max_acts default'
    });

    // World migrations
    this.registerMigration('world.mystika', '1.0.0', '2.0.0', {
      from: '1.0.0',
      to: '2.0.0',
      transform: (doc: any) => {
        const migrated = { ...doc };
        
        // Update timeworld.bands[].id semantics if needed
        if (migrated.world?.timeworld?.bands) {
          migrated.world.timeworld.bands = migrated.world.timeworld.bands.map((band: any, index: number) => ({
            ...band,
            id: band.id || `band_${index + 1}`,
            // Ensure each band has required fields
            name: band.name || `Band ${index + 1}`,
            ticks: band.ticks || 1
          }));
        }
        
        return migrated;
      },
      description: 'Update timeworld band ID semantics and add defaults'
    });

    // Adventure migrations
    this.registerMigration('adventure.whispercross', '1.0.0', '1.1.0', {
      from: '1.0.0',
      to: '1.1.0',
      transform: (doc: any) => {
        const migrated = { ...doc };
        
        // Add slice definitions if missing
        if (!migrated.adventure?.slices) {
          migrated.adventure = migrated.adventure || {};
          migrated.adventure.slices = {
            'scenes.essential': {
              description: 'Essential scene information',
              fields: ['scenes.*.name', 'scenes.*.description']
            },
            'npcs.primary': {
              description: 'Primary NPCs only',
              fields: ['npcs.*.name', 'npcs.*.description']
            }
          };
        }
        
        return migrated;
      },
      description: 'Add default slice definitions for token optimization'
    });
  }

  private registerMigration(type: string, fromVersion: string, toVersion: string, step: MigrationStep): void {
    const key = `${type}:${fromVersion}→${toVersion}`;
    if (!this.migrations.has(key)) {
      this.migrations.set(key, []);
    }
    this.migrations.get(key)!.push(step);
  }

  getCurrentVersions(docs: VersionedDoc[]): Map<string, string> {
    const versions = new Map<string, string>();
    
    for (const doc of docs) {
      const key = `${doc.type}.${doc.id}`;
      versions.set(key, doc.currentVersion);
    }
    
    return versions;
  }

  async migrateDoc(
    doc: VersionedDoc,
    fromVersion: string,
    toVersion: string,
    options: { write?: boolean; backup?: boolean } = {}
  ): Promise<MigrationResult> {
    try {
      const migrationKey = `${doc.type}.${doc.id}:${fromVersion}→${toVersion}`;
      const steps = this.migrations.get(migrationKey);
      
      if (!steps || steps.length === 0) {
        return {
          success: false,
          originalDoc: doc.content,
          migratedDoc: doc.content,
          changelog: '',
          error: `No migration path found from ${fromVersion} to ${toVersion}`
        };
      }

      let migratedContent = { ...doc.content };
      const changelogEntries: string[] = [];

      // Apply each migration step
      for (const step of steps) {
        migratedContent = step.transform(migratedContent);
        changelogEntries.push(`- ${step.description}`);
      }

      // Create backup if requested
      let backupPath: string | undefined;
      if (options.backup) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = `./backups/${doc.type}_${doc.id}_${fromVersion}_${timestamp}.json`;
        
        const backupDir = dirname(backupPath);
        if (!existsSync(backupDir)) {
          mkdirSync(backupDir, { recursive: true });
        }
        
        writeFileSync(backupPath, JSON.stringify(doc.content, null, 2));
      }

      // Write migrated document if requested
      if (options.write) {
        const migratedDoc: VersionedDoc = {
          ...doc,
          content: migratedContent,
          currentVersion: toVersion,
          ready_for_publish: false // Reset publish flag after migration
        };
        
        const outputPath = `./migrated/${doc.type}_${doc.id}_${toVersion}.json`;
        const outputDir = dirname(outputPath);
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }
        
        writeFileSync(outputPath, JSON.stringify(migratedDoc, null, 2));
      }

      const changelog = `## Migration from ${fromVersion} to ${toVersion}\n\n${changelogEntries.join('\n')}`;

      return {
        success: true,
        originalDoc: doc.content,
        migratedDoc: migratedContent,
        changelog,
        backupPath
      };

    } catch (error) {
      return {
        success: false,
        originalDoc: doc.content,
        migratedDoc: doc.content,
        changelog: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  generateChangelog(migrationResults: MigrationResult[]): string {
    const timestamp = new Date().toISOString();
    let changelog = `# Schema Migration Changelog\n\nGenerated: ${timestamp}\n\n`;

    for (const result of migrationResults) {
      if (result.success) {
        changelog += result.changelog + '\n\n';
      } else {
        changelog += `## Migration Failed\n\nError: ${result.error}\n\n`;
      }
    }

    return changelog;
  }

  getAvailableMigrations(): Map<string, MigrationStep[]> {
    return new Map(this.migrations);
  }

  validateMigrationPath(fromVersion: string, toVersion: string): boolean {
    // Simple version comparison - in practice, you'd want more sophisticated logic
    const from = this.parseVersion(fromVersion);
    const to = this.parseVersion(toVersion);
    
    return to.major > from.major || 
           (to.major === from.major && to.minor > from.minor) ||
           (to.major === from.major && to.minor === from.minor && to.patch > from.patch);
  }

  private parseVersion(version: string): VersionInfo {
    const parts = version.split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const typeIndex = args.indexOf('--type');
  const idIndex = args.indexOf('--id');
  const fromIndex = args.indexOf('--from');
  const toIndex = args.indexOf('--to');
  const writeIndex = args.indexOf('--write');
  const backupIndex = args.indexOf('--backup');

  if (typeIndex === -1 || idIndex === -1 || fromIndex === -1 || toIndex === -1) {
    console.error('Usage: yarn awf:migrate --type <type> --id <id> --from <version> --to <version> [--write] [--backup]');
    process.exit(1);
  }

  const type = args[typeIndex + 1];
  const id = args[idIndex + 1];
  const fromVersion = args[fromIndex + 1];
  const toVersion = args[toIndex + 1];
  const write = writeIndex !== -1;
  const backup = backupIndex !== -1;

  const manager = new SchemaVersionManager();
  
  // Mock document for CLI usage
  const mockDoc: VersionedDoc = {
    id,
    type: type as any,
    currentVersion: fromVersion,
    content: {}, // Would be loaded from actual document
    ready_for_publish: false
  };

  manager.migrateDoc(mockDoc, fromVersion, toVersion, { write, backup })
    .then(result => {
      if (result.success) {
        console.log('✅ Migration completed successfully');
        console.log('📄 Changelog:');
        console.log(result.changelog);
        if (result.backupPath) {
          console.log(`💾 Backup saved: ${result.backupPath}`);
        }
      } else {
        console.error('❌ Migration failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Migration error:', error);
      process.exit(1);
    });
}
