import { readFileSync } from 'fs';

export interface DiffChange {
  type: 'added' | 'removed' | 'modified';
  path: string;
  oldValue?: any;
  newValue?: any;
  description: string;
}

export interface SemanticDiff {
  changes: DiffChange[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    total: number;
  };
  breaking: boolean;
  description: string;
}

export class SemverDiff {
  /**
   * Generate a human-readable diff between two JSON documents
   */
  static diff(oldDoc: any, newDoc: any, path: string = ''): SemanticDiff {
    const changes: DiffChange[] = [];
    
    this.compareObjects(oldDoc, newDoc, path, changes);
    
    const added = changes.filter(c => c.type === 'added').length;
    const removed = changes.filter(c => c.type === 'removed').length;
    const modified = changes.filter(c => c.type === 'modified').length;
    
    // Determine if this is a breaking change
    const breaking = this.isBreakingChange(changes);
    
    return {
      changes,
      summary: {
        added,
        removed,
        modified,
        total: changes.length
      },
      breaking,
      description: this.generateDescription(changes, breaking)
    };
  }

  private static compareObjects(oldObj: any, newObj: any, path: string, changes: DiffChange[]): void {
    // Handle null/undefined cases
    if (oldObj === null && newObj === null) return;
    if (oldObj === undefined && newObj === undefined) return;
    
    if (oldObj === null || oldObj === undefined) {
      changes.push({
        type: 'added',
        path,
        newValue: newObj,
        description: `Added ${this.getTypeDescription(newObj)} at ${path || 'root'}`
      });
      return;
    }
    
    if (newObj === null || newObj === undefined) {
      changes.push({
        type: 'removed',
        path,
        oldValue: oldObj,
        description: `Removed ${this.getTypeDescription(oldObj)} at ${path || 'root'}`
      });
      return;
    }

    // Handle type changes
    if (typeof oldObj !== typeof newObj) {
      changes.push({
        type: 'modified',
        path,
        oldValue: oldObj,
        newValue: newObj,
        description: `Type changed from ${typeof oldObj} to ${typeof newObj} at ${path}`
      });
      return;
    }

    // Handle primitive values
    if (typeof oldObj !== 'object' || oldObj === null || newObj === null) {
      if (oldObj !== newObj) {
        changes.push({
          type: 'modified',
          path,
          oldValue: oldObj,
          newValue: newObj,
          description: `Value changed from ${JSON.stringify(oldObj)} to ${JSON.stringify(newObj)} at ${path}`
        });
      }
      return;
    }

    // Handle arrays
    if (Array.isArray(oldObj) && Array.isArray(newObj)) {
      this.compareArrays(oldObj, newObj, path, changes);
      return;
    }

    // Handle objects
    if (typeof oldObj === 'object' && typeof newObj === 'object') {
      this.compareObjectProperties(oldObj, newObj, path, changes);
      return;
    }
  }

  private static compareArrays(oldArr: any[], newArr: any[], path: string, changes: DiffChange[]): void {
    const maxLength = Math.max(oldArr.length, newArr.length);
    
    for (let i = 0; i < maxLength; i++) {
      const itemPath = `${path}[${i}]`;
      
      if (i >= oldArr.length) {
        changes.push({
          type: 'added',
          path: itemPath,
          newValue: newArr[i],
          description: `Added item at index ${i} in array ${path}`
        });
      } else if (i >= newArr.length) {
        changes.push({
          type: 'removed',
          path: itemPath,
          oldValue: oldArr[i],
          description: `Removed item at index ${i} in array ${path}`
        });
      } else {
        this.compareObjects(oldArr[i], newArr[i], itemPath, changes);
      }
    }
  }

  private static compareObjectProperties(oldObj: any, newObj: any, path: string, changes: DiffChange[]): void {
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    
    for (const key of allKeys) {
      const keyPath = path ? `${path}.${key}` : key;
      
      if (!(key in oldObj)) {
        changes.push({
          type: 'added',
          path: keyPath,
          newValue: newObj[key],
          description: `Added property '${key}'`
        });
      } else if (!(key in newObj)) {
        changes.push({
          type: 'removed',
          path: keyPath,
          oldValue: oldObj[key],
          description: `Removed property '${key}'`
        });
      } else {
        this.compareObjects(oldObj[key], newObj[key], keyPath, changes);
      }
    }
  }

  private static getTypeDescription(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return `array (${value.length} items)`;
    if (typeof value === 'object') return `object with ${Object.keys(value).length} properties`;
    return `${typeof value} (${JSON.stringify(value)})`;
  }

  private static isBreakingChange(changes: DiffChange[]): boolean {
    // Define breaking change patterns
    const breakingPatterns = [
      // Removing required fields
      (change: DiffChange) => change.type === 'removed' && this.isRequiredField(change.path),
      // Changing field types
      (change: DiffChange) => change.type === 'modified' && this.isTypeChange(change),
      // Removing enum values
      (change: DiffChange) => change.type === 'removed' && this.isEnumValue(change.path),
      // Changing array to non-array or vice versa
      (change: DiffChange) => change.type === 'modified' && this.isStructureChange(change)
    ];

    return changes.some(change => breakingPatterns.some(pattern => pattern(change)));
  }

  private static isRequiredField(path: string): boolean {
    const requiredFields = [
      'contract',
      'contract.acts',
      'world',
      'adventure',
      'adventure_start'
    ];
    return requiredFields.some(field => path.startsWith(field));
  }

  private static isTypeChange(change: DiffChange): boolean {
    if (!change.oldValue || !change.newValue) return false;
    return typeof change.oldValue !== typeof change.newValue;
  }

  private static isEnumValue(path: string): boolean {
    // Check if this looks like an enum value removal
    return path.includes('.type') || path.includes('.status') || path.includes('.mode');
  }

  private static isStructureChange(change: DiffChange): boolean {
    if (!change.oldValue || !change.newValue) return false;
    return Array.isArray(change.oldValue) !== Array.isArray(change.newValue);
  }

  private static generateDescription(changes: DiffChange[], breaking: boolean): string {
    const { added, removed, modified } = changes.reduce(
      (acc, change) => {
        acc[change.type]++;
        return acc;
      },
      { added: 0, removed: 0, modified: 0 }
    );

    const changeTypes = [];
    if (added > 0) changeTypes.push(`${added} added`);
    if (removed > 0) changeTypes.push(`${removed} removed`);
    if (modified > 0) changeTypes.push(`${modified} modified`);

    const changeDescription = changeTypes.join(', ');
    const breakingText = breaking ? ' (BREAKING CHANGE)' : '';

    return `${changeDescription}${breakingText}`;
  }

  /**
   * Generate a markdown-formatted diff report
   */
  static generateMarkdownReport(diff: SemanticDiff): string {
    let report = `# Schema Diff Report\n\n`;
    report += `**Summary:** ${diff.description}\n\n`;
    report += `- **Added:** ${diff.summary.added}\n`;
    report += `- **Removed:** ${diff.summary.removed}\n`;
    report += `- **Modified:** ${diff.summary.modified}\n`;
    report += `- **Total Changes:** ${diff.summary.total}\n`;
    report += `- **Breaking:** ${diff.breaking ? 'Yes' : 'No'}\n\n`;

    if (diff.changes.length === 0) {
      report += `✅ No changes detected.\n`;
      return report;
    }

    report += `## Changes\n\n`;

    const groupedChanges = this.groupChangesByType(diff.changes);
    
    for (const [type, changes] of Object.entries(groupedChanges)) {
      if (changes.length === 0) continue;
      
      const emoji = type === 'added' ? '➕' : type === 'removed' ? '➖' : '🔄';
      report += `### ${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)} (${changes.length})\n\n`;
      
      for (const change of changes) {
        report += `- **${change.path}**: ${change.description}\n`;
        if (change.oldValue !== undefined) {
          report += `  - Old: \`${JSON.stringify(change.oldValue)}\`\n`;
        }
        if (change.newValue !== undefined) {
          report += `  - New: \`${JSON.stringify(change.newValue)}\`\n`;
        }
        report += `\n`;
      }
    }

    return report;
  }

  private static groupChangesByType(changes: DiffChange[]): Record<string, DiffChange[]> {
    return changes.reduce((acc, change) => {
      if (!acc[change.type]) {
        acc[change.type] = [];
      }
      acc[change.type].push(change);
      return acc;
    }, {} as Record<string, DiffChange[]>);
  }

  /**
   * Load documents from files and generate diff
   */
  static diffFiles(oldPath: string, newPath: string): SemanticDiff {
    try {
      const oldDoc = JSON.parse(readFileSync(oldPath, 'utf-8'));
      const newDoc = JSON.parse(readFileSync(newPath, 'utf-8'));
      return this.diff(oldDoc, newDoc);
    } catch (error) {
      throw new Error(`Failed to load documents: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const oldIndex = args.indexOf('--old');
  const newIndex = args.indexOf('--new');
  const outputIndex = args.indexOf('--output');

  if (oldIndex === -1 || newIndex === -1) {
    console.error('Usage: yarn awf:diff --old <old-file> --new <new-file> [--output <output-file>]');
    process.exit(1);
  }

  const oldPath = args[oldIndex + 1];
  const newPath = args[newIndex + 1];
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : undefined;

  try {
    const diff = SemverDiff.diffFiles(oldPath, newPath);
    const report = SemverDiff.generateMarkdownReport(diff);
    
    console.log(report);
    
    if (outputPath) {
      require('fs').writeFileSync(outputPath, report);
      console.log(`\n📄 Report saved to: ${outputPath}`);
    }
  } catch (error) {
    console.error('❌ Diff failed:', error);
    process.exit(1);
  }
}


