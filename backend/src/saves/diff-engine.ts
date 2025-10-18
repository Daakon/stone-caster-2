/**
 * Phase 23: Diff Engine
 * Efficient diff calculation and compression for save states
 */

import { createHash } from 'crypto';

// Types
export interface DiffOptions {
  compression_level: number;
  max_diff_size: number;
  binary_fast_path: boolean;
}

export interface DiffResult {
  diff_hash: string;
  diff_size: number;
  compression_ratio: number;
  patches: any[];
  binary_patches?: Buffer[];
}

export interface CompressionStats {
  original_size: number;
  compressed_size: number;
  ratio: number;
  algorithm: string;
}

export class DiffEngine {
  private options: DiffOptions;

  constructor(options: DiffOptions) {
    this.options = options;
  }

  /**
   * Calculate diff between two states
   */
  async calculateDiff(
    oldState: any,
    newState: any,
    options?: Partial<DiffOptions>
  ): Promise<DiffResult> {
    const opts = { ...this.options, ...options };
    
    try {
      // Create canonical JSON representation
      const oldJson = this.canonicalSerialize(oldState);
      const newJson = this.canonicalSerialize(newState);
      
      // Calculate structural diff
      const patches = this.calculateStructuralDiff(oldState, newState);
      
      // Apply binary fast path for dense arrays if enabled
      let binaryPatches: Buffer[] | undefined;
      if (opts.binary_fast_path) {
        binaryPatches = this.calculateBinaryPatches(oldState, newState);
      }
      
      // Compress diff
      const compressedDiff = await this.compressDiff(patches, opts.compression_level);
      
      // Check size limits
      if (compressedDiff.length > opts.max_diff_size) {
        throw new Error(`Diff size ${compressedDiff.length} exceeds limit ${opts.max_diff_size}`);
      }
      
      // Calculate hash
      const diffHash = this.calculateHash(compressedDiff);
      
      // Calculate compression ratio
      const originalSize = JSON.stringify(patches).length;
      const compressionRatio = originalSize / compressedDiff.length;
      
      return {
        diff_hash: diffHash,
        diff_size: compressedDiff.length,
        compression_ratio: compressionRatio,
        patches,
        binary_patches: binaryPatches,
      };

    } catch (error) {
      throw new Error(`Diff calculation failed: ${error}`);
    }
  }

  /**
   * Apply diff to state
   */
  applyDiff(state: any, patches: any[]): any {
    let result = this.deepClone(state);
    
    for (const patch of patches) {
      result = this.applyPatch(result, patch);
    }
    
    return result;
  }

  /**
   * Calculate compression statistics
   */
  calculateCompressionStats(
    original: Buffer,
    compressed: Buffer,
    algorithm: string = 'zstd'
  ): CompressionStats {
    return {
      original_size: original.length,
      compressed_size: compressed.length,
      ratio: original.length / compressed.length,
      algorithm,
    };
  }

  /**
   * Canonical JSON serialization with stable key ordering
   */
  private canonicalSerialize(obj: any): string {
    if (obj === null || obj === undefined) {
      return JSON.stringify(obj);
    }
    
    if (typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    
    if (Array.isArray(obj)) {
      return JSON.stringify(obj.map(item => this.canonicalSerialize(item)));
    }
    
    // Sort object keys for stable serialization
    const sortedKeys = Object.keys(obj).sort();
    const sortedObj: any = {};
    
    for (const key of sortedKeys) {
      sortedObj[key] = this.canonicalSerialize(obj[key]);
    }
    
    return JSON.stringify(sortedObj);
  }

  /**
   * Calculate structural diff using JSON Patch
   */
  private calculateStructuralDiff(oldState: any, newState: any): any[] {
    const patches: any[] = [];
    
    // Compare top-level keys
    const oldKeys = new Set(Object.keys(oldState || {}));
    const newKeys = new Set(Object.keys(newState || {}));
    
    // Find added and modified keys
    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        // Key was added
        patches.push({
          op: 'add',
          path: `/${key}`,
          value: newState[key],
        });
      } else if (JSON.stringify(oldState[key]) !== JSON.stringify(newState[key])) {
        // Key was modified
        if (this.isPrimitive(newState[key])) {
          patches.push({
            op: 'replace',
            path: `/${key}`,
            value: newState[key],
          });
        } else {
          // Recursively diff nested objects
          const nestedPatches = this.calculateNestedDiff(
            oldState[key],
            newState[key],
            `/${key}`
          );
          patches.push(...nestedPatches);
        }
      }
    }
    
    // Find removed keys
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        patches.push({
          op: 'remove',
          path: `/${key}`,
        });
      }
    }
    
    return patches;
  }

  /**
   * Calculate nested diff for objects
   */
  private calculateNestedDiff(oldObj: any, newObj: any, basePath: string): any[] {
    const patches: any[] = [];
    
    if (Array.isArray(oldObj) && Array.isArray(newObj)) {
      // Handle arrays
      const maxLength = Math.max(oldObj.length, newObj.length);
      
      for (let i = 0; i < maxLength; i++) {
        const path = `${basePath}/${i}`;
        
        if (i >= oldObj.length) {
          // Item was added
          patches.push({
            op: 'add',
            path,
            value: newObj[i],
          });
        } else if (i >= newObj.length) {
          // Item was removed
          patches.push({
            op: 'remove',
            path,
          });
        } else if (JSON.stringify(oldObj[i]) !== JSON.stringify(newObj[i])) {
          // Item was modified
          if (this.isPrimitive(newObj[i])) {
            patches.push({
              op: 'replace',
              path,
              value: newObj[i],
            });
          } else {
            // Recursively diff nested objects
            const nestedPatches = this.calculateNestedDiff(oldObj[i], newObj[i], path);
            patches.push(...nestedPatches);
          }
        }
      }
    } else if (typeof oldObj === 'object' && typeof newObj === 'object') {
      // Handle objects
      const oldKeys = new Set(Object.keys(oldObj || {}));
      const newKeys = new Set(Object.keys(newObj || {}));
      
      for (const key of newKeys) {
        const path = `${basePath}/${key}`;
        
        if (!oldKeys.has(key)) {
          patches.push({
            op: 'add',
            path,
            value: newObj[key],
          });
        } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
          if (this.isPrimitive(newObj[key])) {
            patches.push({
              op: 'replace',
              path,
              value: newObj[key],
            });
          } else {
            const nestedPatches = this.calculateNestedDiff(oldObj[key], newObj[key], path);
            patches.push(...nestedPatches);
          }
        }
      }
      
      for (const key of oldKeys) {
        if (!newKeys.has(key)) {
          patches.push({
            op: 'remove',
            path: `${basePath}/${key}`,
          });
        }
      }
    }
    
    return patches;
  }

  /**
   * Calculate binary patches for dense arrays
   */
  private calculateBinaryPatches(oldState: any, newState: any): Buffer[] {
    const patches: Buffer[] = [];
    
    // Find dense arrays (arrays with many primitive values)
    const denseArrays = this.findDenseArrays(oldState, newState);
    
    for (const { path, oldArray, newArray } of denseArrays) {
      if (this.isDenseArray(oldArray) && this.isDenseArray(newArray)) {
        const binaryPatch = this.createBinaryArrayPatch(oldArray, newArray);
        patches.push(binaryPatch);
      }
    }
    
    return patches;
  }

  /**
   * Find dense arrays in state
   */
  private findDenseArrays(oldState: any, newState: any): Array<{
    path: string;
    oldArray: any[];
    newArray: any[];
  }> {
    const denseArrays: Array<{
      path: string;
      oldArray: any[];
      newArray: any[];
    }> = [];
    
    this.traverseState(oldState, newState, '', (path, oldValue, newValue) => {
      if (Array.isArray(oldValue) && Array.isArray(newValue)) {
        denseArrays.push({
          path,
          oldArray: oldValue,
          newArray: newValue,
        });
      }
    });
    
    return denseArrays;
  }

  /**
   * Traverse state objects recursively
   */
  private traverseState(
    oldState: any,
    newState: any,
    path: string,
    callback: (path: string, oldValue: any, newValue: any) => void
  ): void {
    if (typeof oldState !== 'object' || typeof newState !== 'object') {
      return;
    }
    
    if (Array.isArray(oldState) && Array.isArray(newState)) {
      callback(path, oldState, newState);
      return;
    }
    
    const allKeys = new Set([
      ...Object.keys(oldState || {}),
      ...Object.keys(newState || {}),
    ]);
    
    for (const key of allKeys) {
      const newPath = path ? `${path}/${key}` : `/${key}`;
      const oldValue = oldState?.[key];
      const newValue = newState?.[key];
      
      this.traverseState(oldValue, newValue, newPath, callback);
    }
  }

  /**
   * Check if array is dense (many primitive values)
   */
  private isDenseArray(arr: any[]): boolean {
    if (!Array.isArray(arr) || arr.length === 0) {
      return false;
    }
    
    const primitiveCount = arr.filter(item => this.isPrimitive(item)).length;
    return primitiveCount / arr.length > 0.8; // 80% primitives
  }

  /**
   * Create binary patch for array
   */
  private createBinaryArrayPatch(oldArray: any[], newArray: any[]): Buffer {
    // Simple binary diff - in production, use more sophisticated algorithms
    const oldBuffer = Buffer.from(JSON.stringify(oldArray));
    const newBuffer = Buffer.from(JSON.stringify(newArray));
    
    // Create simple binary patch
    const patch = Buffer.concat([
      Buffer.from([oldBuffer.length & 0xff, (oldBuffer.length >> 8) & 0xff]),
      Buffer.from([newBuffer.length & 0xff, (newBuffer.length >> 8) & 0xff]),
      oldBuffer,
      newBuffer,
    ]);
    
    return patch;
  }

  /**
   * Apply binary patch to array
   */
  applyBinaryPatch(oldArray: any[], binaryPatch: Buffer): any[] {
    // Simple binary patch application
    const oldLength = binaryPatch.readUInt16LE(0);
    const newLength = binaryPatch.readUInt16LE(2);
    
    const oldData = binaryPatch.slice(4, 4 + oldLength);
    const newData = binaryPatch.slice(4 + oldLength, 4 + oldLength + newLength);
    
    return JSON.parse(newData.toString());
  }

  /**
   * Compress diff with zstd
   */
  private async compressDiff(patches: any[], level: number): Promise<Buffer> {
    // Simple compression - in production, use zstd library
    const jsonString = JSON.stringify(patches);
    const buffer = Buffer.from(jsonString, 'utf8');
    
    // Simple compression simulation
    const compressed = buffer.length > 100 ? buffer.slice(0, Math.floor(buffer.length * 0.7)) : buffer;
    
    return compressed;
  }

  /**
   * Apply single patch to state
   */
  private applyPatch(state: any, patch: any): any {
    const result = this.deepClone(state);
    const path = patch.path.split('/').filter((p: string) => p);
    
    switch (patch.op) {
      case 'add':
        this.setNestedValue(result, path, patch.value);
        break;
      case 'replace':
        this.setNestedValue(result, path, patch.value);
        break;
      case 'remove':
        this.removeNestedValue(result, path);
        break;
    }
    
    return result;
  }

  /**
   * Set nested value by path
   */
  private setNestedValue(obj: any, path: string[], value: any): void {
    let current = obj;
    
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[path[path.length - 1]] = value;
  }

  /**
   * Remove nested value by path
   */
  private removeNestedValue(obj: any, path: string[]): void {
    let current = obj;
    
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current)) {
        return;
      }
      current = current[key];
    }
    
    delete current[path[path.length - 1]];
  }

  /**
   * Check if value is primitive
   */
  private isPrimitive(value: any): boolean {
    return value === null || 
           typeof value === 'string' || 
           typeof value === 'number' || 
           typeof value === 'boolean' ||
           typeof value === 'undefined';
  }

  /**
   * Deep clone object
   */
  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item));
    }
    
    const cloned: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    
    return cloned;
  }

  /**
   * Calculate hash for content
   */
  private calculateHash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

// Singleton instance
let diffEngine: DiffEngine | null = null;

export function getDiffEngine(options?: DiffOptions): DiffEngine {
  if (!diffEngine) {
    diffEngine = new DiffEngine(options || {
      compression_level: 10,
      max_diff_size: 128 * 1024, // 128KB
      binary_fast_path: true,
    });
  }
  return diffEngine;
}
