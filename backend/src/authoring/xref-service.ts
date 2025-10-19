/**
 * Phase 20: Cross-Reference Service
 * Scans registries and returns cross-references for ID completion and dead-refs checks
 */

import { z } from 'zod';

// Types
export interface XRefResult {
  id: string;
  type: string;
  references: XRefReference[];
  deadRefs: string[];
  circularRefs: string[];
}

export interface XRefReference {
  id: string;
  type: string;
  location: string;
  json_pointer: string;
  context: string;
}

export interface XRefSearchOptions {
  includeTypes: string[];
  excludeTypes: string[];
  maxResults: number;
  fuzzy: boolean;
}

export interface XRefSearchResult {
  id: string;
  type: string;
  name: string;
  description?: string;
  relevance: number;
}

// Schemas
const XRefReferenceSchema = z.object({
  id: z.string(),
  type: z.string(),
  location: z.string(),
  json_pointer: z.string(),
  context: z.string(),
});

const XRefSearchOptionsSchema = z.object({
  includeTypes: z.array(z.string()).default([]),
  excludeTypes: z.array(z.string()).default([]),
  maxResults: z.number().int().min(1).max(100).default(20),
  fuzzy: z.boolean().default(false),
});

export class XRefService {
  private registries: Map<string, Map<string, any>> = new Map();
  private references: Map<string, XRefReference[]> = new Map();

  constructor() {
    this.initializeRegistries();
  }

  /**
   * Build cross-reference index for documents
   */
  async buildXRefIndex(documents: Record<string, any>): Promise<XRefResult[]> {
    const results: XRefResult[] = [];
    
    // Clear existing references
    this.references.clear();

    // Build references for each document
    for (const [docRef, doc] of Object.entries(documents)) {
      const xrefResult = await this.buildDocumentXRef(docRef, doc);
      if (xrefResult) {
        results.push(xrefResult);
      }
    }

    // Detect circular references
    this.detectCircularReferences(results);

    return results;
  }

  /**
   * Build cross-references for a single document
   */
  private async buildDocumentXRef(docRef: string, doc: { doc_type: string; payload: any }): Promise<XRefResult | null> {
    const references: XRefReference[] = [];
    const deadRefs: string[] = [];
    const circularRefs: string[] = [];

    // Extract references from document payload
    const docReferences = this.extractReferences(doc.payload, docRef);
    references.push(...docReferences);

    // Check for dead references
    for (const ref of docReferences) {
      if (!this.isReferenceValid(ref.id, ref.type)) {
        deadRefs.push(ref.id);
      }
    }

    // Store references for circular detection
    this.references.set(docRef, references);

    return {
      id: docRef,
      type: doc.doc_type,
      references,
      deadRefs,
      circularRefs,
    };
  }

  /**
   * Extract references from document payload
   */
  private extractReferences(payload: any, docRef: string, path: string = ''): XRefReference[] {
    const references: XRefReference[] = [];

    if (typeof payload === 'object' && payload !== null) {
      if (Array.isArray(payload)) {
        payload.forEach((item, index) => {
          const itemPath = `${path}[${index}]`;
          references.push(...this.extractReferences(item, docRef, itemPath));
        });
      } else {
        for (const [key, value] of Object.entries(payload)) {
          const keyPath = path ? `${path}.${key}` : key;
          
          // Check if this is a reference field
          if (this.isReferenceField(key, value)) {
            references.push({
              id: value,
              type: this.getReferenceType(key),
              location: docRef,
              json_pointer: `/${keyPath}`,
              context: this.getContext(payload, key),
            });
          } else {
            references.push(...this.extractReferences(value, docRef, keyPath));
          }
        }
      }
    }

    return references;
  }

  /**
   * Check if a field is a reference field
   */
  private isReferenceField(key: string, value: any): boolean {
    if (typeof value !== 'string') return false;

    const referenceFields = [
      'world_ref', 'adventure_ref', 'quest_ref', 'node_ref',
      'item_id', 'recipe_id', 'loot_id', 'vendor_id',
      'npc_id', 'character_id', 'region_id', 'event_id',
      'parent_id', 'target_id', 'source_id', 'destination_id',
    ];

    return referenceFields.includes(key) || key.endsWith('_ref') || key.endsWith('_id');
  }

  /**
   * Get reference type from field name
   */
  private getReferenceType(fieldName: string): string {
    const typeMap: Record<string, string> = {
      world_ref: 'world',
      adventure_ref: 'adventure',
      quest_ref: 'quest',
      node_ref: 'node',
      item_id: 'item',
      recipe_id: 'recipe',
      loot_id: 'loot',
      vendor_id: 'vendor',
      npc_id: 'npc',
      character_id: 'character',
      region_id: 'region',
      event_id: 'event',
    };

    return typeMap[fieldName] || 'unknown';
  }

  /**
   * Get context for reference
   */
  private getContext(payload: any, key: string): string {
    const context = payload[key];
    if (typeof context === 'string') {
      return context;
    }
    return JSON.stringify(context).substring(0, 50);
  }

  /**
   * Check if reference is valid
   */
  private isReferenceValid(id: string, type: string): boolean {
    const registry = this.registries.get(type);
    if (!registry) return false;
    
    return registry.has(id);
  }

  /**
   * Detect circular references
   */
  private detectCircularReferences(results: XRefResult[]): void {
    for (const result of results) {
      const visited = new Set<string>();
      const circularRefs = this.findCircularRefs(result.id, visited, []);
      result.circularRefs.push(...circularRefs);
    }
  }

  /**
   * Find circular references starting from a document
   */
  private findCircularRefs(
    docId: string,
    visited: Set<string>,
    path: string[]
  ): string[] {
    if (visited.has(docId)) {
      const cycleStart = path.indexOf(docId);
      if (cycleStart !== -1) {
        return path.slice(cycleStart);
      }
      return [];
    }

    visited.add(docId);
    path.push(docId);

    const references = this.references.get(docId) || [];
    for (const ref of references) {
      const circularRefs = this.findCircularRefs(ref.id, visited, [...path]);
      if (circularRefs.length > 0) {
        return circularRefs;
      }
    }

    visited.delete(docId);
    path.pop();
    return [];
  }

  /**
   * Search for references
   */
  async searchReferences(
    query: string,
    options: Partial<XRefSearchOptions> = {}
  ): Promise<XRefSearchResult[]> {
    const opts = XRefSearchOptionsSchema.parse(options);
    const results: XRefSearchResult[] = [];

    for (const [type, registry] of this.registries) {
      // Skip excluded types
      if (opts.excludeTypes.includes(type)) continue;
      
      // Skip if includeTypes specified and type not included
      if (opts.includeTypes.length > 0 && !opts.includeTypes.includes(type)) continue;

      for (const [id, doc] of registry) {
        const relevance = this.calculateRelevance(query, id, doc, opts.fuzzy);
        if (relevance > 0) {
          results.push({
            id,
            type,
            name: doc.name || id,
            description: doc.description,
            relevance,
          });
        }
      }
    }

    // Sort by relevance and limit results
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, opts.maxResults);
  }

  /**
   * Calculate relevance score for search
   */
  private calculateRelevance(
    query: string,
    id: string,
    doc: any,
    fuzzy: boolean
  ): number {
    const queryLower = query.toLowerCase();
    const idLower = id.toLowerCase();
    const nameLower = (doc.name || '').toLowerCase();
    const descriptionLower = (doc.description || '').toLowerCase();

    let score = 0;

    // Exact ID match
    if (idLower === queryLower) {
      score += 100;
    } else if (idLower.includes(queryLower)) {
      score += 50;
    }

    // Name match
    if (nameLower === queryLower) {
      score += 80;
    } else if (nameLower.includes(queryLower)) {
      score += 40;
    }

    // Description match
    if (descriptionLower.includes(queryLower)) {
      score += 20;
    }

    // Fuzzy matching
    if (fuzzy) {
      score += this.calculateFuzzyScore(queryLower, idLower);
      score += this.calculateFuzzyScore(queryLower, nameLower);
    }

    return Math.max(0, score);
  }

  /**
   * Calculate fuzzy score
   */
  private calculateFuzzyScore(query: string, target: string): number {
    // Simple Levenshtein distance-based scoring
    const distance = this.levenshteinDistance(query, target);
    const maxLength = Math.max(query.length, target.length);
    
    if (maxLength === 0) return 0;
    
    const similarity = 1 - (distance / maxLength);
    return Math.max(0, similarity * 10);
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get all references for a document
   */
  getReferences(docId: string): XRefReference[] {
    return this.references.get(docId) || [];
  }

  /**
   * Get all documents that reference a given ID
   */
  getReferencingDocuments(id: string): string[] {
    const referencing: string[] = [];
    
    for (const [docId, references] of this.references) {
      if (references.some(ref => ref.id === id)) {
        referencing.push(docId);
      }
    }
    
    return referencing;
  }

  /**
   * Initialize registries
   */
  private initializeRegistries(): void {
    // Initialize empty registries for each type
    const types = [
      'world', 'adventure', 'quest', 'node',
      'item', 'recipe', 'loot', 'vendor',
      'npc', 'character', 'region', 'event',
    ];

    for (const type of types) {
      this.registries.set(type, new Map());
    }
  }

  /**
   * Add document to registry
   */
  addToRegistry(type: string, id: string, doc: any): void {
    const registry = this.registries.get(type);
    if (registry) {
      registry.set(id, doc);
    }
  }

  /**
   * Remove document from registry
   */
  removeFromRegistry(type: string, id: string): void {
    const registry = this.registries.get(type);
    if (registry) {
      registry.delete(id);
    }
  }

  /**
   * Get registry for type
   */
  getRegistry(type: string): Map<string, any> | undefined {
    return this.registries.get(type);
  }

  /**
   * Get all registry types
   */
  getRegistryTypes(): string[] {
    return Array.from(this.registries.keys());
  }
}

// Singleton instance
export const xrefService = new XRefService();


