/**
 * Phase 20: Preview Assembler
 * Assembles AWF bundle for draft validation without mutating database
 */

import { z } from 'zod';

// Types
export interface PreviewSession {
  sessionId: string;
  turnId: number;
  nodeId: string;
  worldRef: string;
  adventureRef: string;
  playerProfile: {
    name: string;
    level: number;
    skills: Record<string, number>;
    resources: Record<string, number>;
  };
  gameState: {
    hot: any;
    cold: any;
  };
}

export interface PreviewOptions {
  includeWorld: boolean;
  includeAdventure: boolean;
  includeGraph: boolean;
  includeSim: boolean;
  includeParty: boolean;
  includeEconomy: boolean;
  includeLocalization: boolean;
  tokenCap: number;
  toolQuota: number;
}

export interface PreviewResult {
  success: boolean;
  bundle: any;
  tokenEstimate: number;
  tokenBreakdown: Record<string, number>;
  slices: {
    world: boolean;
    adventure: boolean;
    graph: boolean;
    sim: boolean;
    party: boolean;
    economy: boolean;
    localization: boolean;
  };
  warnings: string[];
  errors: string[];
}

export interface DocumentBundle {
  [docRef: string]: {
    doc_type: string;
    payload: any;
    format: 'json' | 'yaml';
  };
}

// Schemas
const PreviewSessionSchema = z.object({
  sessionId: z.string(),
  turnId: z.number().int().min(0),
  nodeId: z.string(),
  worldRef: z.string(),
  adventureRef: z.string(),
  playerProfile: z.object({
    name: z.string(),
    level: z.number().int().min(1),
    skills: z.record(z.string(), z.number()),
    resources: z.record(z.string(), z.number()),
  }),
  gameState: z.object({
    hot: z.any(),
    cold: z.any(),
  }),
});

const PreviewOptionsSchema = z.object({
  includeWorld: z.boolean().default(true),
  includeAdventure: z.boolean().default(true),
  includeGraph: z.boolean().default(true),
  includeSim: z.boolean().default(true),
  includeParty: z.boolean().default(true),
  includeEconomy: z.boolean().default(true),
  includeLocalization: z.boolean().default(true),
  tokenCap: z.number().int().min(1000).max(50000).default(8000),
  toolQuota: z.number().int().min(1).max(100).default(10),
});

export class PreviewAssembler {
  private documents: DocumentBundle = {};
  private session: PreviewSession | null = null;
  private options: PreviewOptions = {
    includeWorld: true,
    includeAdventure: true,
    includeGraph: true,
    includeSim: true,
    includeParty: true,
    includeEconomy: true,
    includeLocalization: true,
    tokenCap: 8000,
    toolQuota: 10,
  };

  constructor() {
    // Initialize with default options
  }

  /**
   * Assemble preview bundle from documents
   */
  async assemblePreview(
    documents: DocumentBundle,
    session: PreviewSession,
    options: Partial<PreviewOptions> = {}
  ): Promise<PreviewResult> {
    try {
      // Set documents and session
      this.documents = documents;
      this.session = session;
      this.options = { ...this.options, ...options };

      // Validate inputs
      const sessionValidation = PreviewSessionSchema.safeParse(session);
      if (!sessionValidation.success) {
        return {
          success: false,
          bundle: null,
          tokenEstimate: 0,
          tokenBreakdown: {},
          slices: {
            world: false,
            adventure: false,
            graph: false,
            sim: false,
            party: false,
            economy: false,
            localization: false,
          },
          warnings: [],
          errors: ['Invalid session data'],
        };
      }

      // Assemble bundle components
      const bundle: any = {
        version: '1.0.0',
        session: {
          id: session.sessionId,
          turn: session.turnId,
          node: session.nodeId,
        },
        player: session.playerProfile,
        world: null,
        adventure: null,
        graph: null,
        sim: null,
        party: null,
        economy: null,
        localization: null,
      };

      const warnings: string[] = [];
      const errors: string[] = [];
      const tokenBreakdown: Record<string, number> = {};

      // Assemble world slice
      if (this.options.includeWorld) {
        const worldResult = await this.assembleWorldSlice();
        if (worldResult.success) {
          bundle.world = worldResult.data;
          tokenBreakdown.world = worldResult.tokens;
        } else {
          errors.push(`World assembly failed: ${worldResult.error}`);
        }
      }

      // Assemble adventure slice
      if (this.options.includeAdventure) {
        const adventureResult = await this.assembleAdventureSlice();
        if (adventureResult.success) {
          bundle.adventure = adventureResult.data;
          tokenBreakdown.adventure = adventureResult.tokens;
        } else {
          errors.push(`Adventure assembly failed: ${adventureResult.error}`);
        }
      }

      // Assemble graph slice
      if (this.options.includeGraph) {
        const graphResult = await this.assembleGraphSlice();
        if (graphResult.success) {
          bundle.graph = graphResult.data;
          tokenBreakdown.graph = graphResult.tokens;
        } else {
          warnings.push(`Graph assembly failed: ${graphResult.error}`);
        }
      }

      // Assemble sim slice
      if (this.options.includeSim) {
        const simResult = await this.assembleSimSlice();
        if (simResult.success) {
          bundle.sim = simResult.data;
          tokenBreakdown.sim = simResult.tokens;
        } else {
          warnings.push(`Sim assembly failed: ${simResult.error}`);
        }
      }

      // Assemble party slice
      if (this.options.includeParty) {
        const partyResult = await this.assemblePartySlice();
        if (partyResult.success) {
          bundle.party = partyResult.data;
          tokenBreakdown.party = partyResult.tokens;
        } else {
          warnings.push(`Party assembly failed: ${partyResult.error}`);
        }
      }

      // Assemble economy slice
      if (this.options.includeEconomy) {
        const economyResult = await this.assembleEconomySlice();
        if (economyResult.success) {
          bundle.economy = economyResult.data;
          tokenBreakdown.economy = economyResult.tokens;
        } else {
          warnings.push(`Economy assembly failed: ${economyResult.error}`);
        }
      }

      // Assemble localization slice
      if (this.options.includeLocalization) {
        const localizationResult = await this.assembleLocalizationSlice();
        if (localizationResult.success) {
          bundle.localization = localizationResult.data;
          tokenBreakdown.localization = localizationResult.tokens;
        } else {
          warnings.push(`Localization assembly failed: ${localizationResult.error}`);
        }
      }

      // Calculate total token estimate
      const totalTokens = Object.values(tokenBreakdown).reduce((sum, tokens) => sum + tokens, 0);

      // Check token cap
      if (totalTokens > this.options.tokenCap) {
        warnings.push(`Token estimate (${totalTokens}) exceeds cap (${this.options.tokenCap})`);
      }

      // Check for errors
      const hasErrors = errors.length > 0;

      return {
        success: !hasErrors,
        bundle: hasErrors ? null : bundle,
        tokenEstimate: totalTokens,
        tokenBreakdown,
        slices: {
          world: bundle.world !== null,
          adventure: bundle.adventure !== null,
          graph: bundle.graph !== null,
          sim: bundle.sim !== null,
          party: bundle.party !== null,
          economy: bundle.economy !== null,
          localization: bundle.localization !== null,
        },
        warnings,
        errors,
      };

    } catch (error) {
      return {
        success: false,
        bundle: null,
        tokenEstimate: 0,
        tokenBreakdown: {},
        slices: {
          world: false,
          adventure: false,
          graph: false,
          sim: false,
          party: false,
          economy: false,
          localization: false,
        },
        warnings: [],
        errors: [`Preview assembly failed: ${error}`],
      };
    }
  }

  /**
   * Assemble world slice
   */
  private async assembleWorldSlice(): Promise<{ success: boolean; data: any; tokens: number; error?: string }> {
    try {
      const worldDoc = this.findDocumentByType('world');
      if (!worldDoc) {
        return { success: false, data: null, tokens: 0, error: 'No world document found' };
      }

      const worldData = {
        id: worldDoc.payload.id,
        name: worldDoc.payload.name,
        description: worldDoc.payload.description,
        settings: worldDoc.payload.settings,
      };

      const tokens = this.estimateTokens(worldData);
      return { success: true, data: worldData, tokens };
    } catch (error) {
      return { success: false, data: null, tokens: 0, error: String(error) };
    }
  }

  /**
   * Assemble adventure slice
   */
  private async assembleAdventureSlice(): Promise<{ success: boolean; data: any; tokens: number; error?: string }> {
    try {
      const adventureDoc = this.findDocumentByType('adventure');
      if (!adventureDoc) {
        return { success: false, data: null, tokens: 0, error: 'No adventure document found' };
      }

      const adventureData = {
        id: adventureDoc.payload.id,
        name: adventureDoc.payload.name,
        description: adventureDoc.payload.description,
        world_ref: adventureDoc.payload.world_ref,
        difficulty: adventureDoc.payload.difficulty,
      };

      const tokens = this.estimateTokens(adventureData);
      return { success: true, data: adventureData, tokens };
    } catch (error) {
      return { success: false, data: null, tokens: 0, error: String(error) };
    }
  }

  /**
   * Assemble graph slice
   */
  private async assembleGraphSlice(): Promise<{ success: boolean; data: any; tokens: number; error?: string }> {
    try {
      const graphDoc = this.findDocumentByType('quest_graph');
      if (!graphDoc) {
        return { success: false, data: null, tokens: 0, error: 'No quest graph document found' };
      }

      const graphData = {
        id: graphDoc.payload.id,
        adventure_ref: graphDoc.payload.adventure_ref,
        nodes: graphDoc.payload.nodes,
        edges: graphDoc.payload.edges,
      };

      const tokens = this.estimateTokens(graphData);
      return { success: true, data: graphData, tokens };
    } catch (error) {
      return { success: false, data: null, tokens: 0, error: String(error) };
    }
  }

  /**
   * Assemble sim slice
   */
  private async assembleSimSlice(): Promise<{ success: boolean; data: any; tokens: number; error?: string }> {
    try {
      // This would integrate with Phase 19 sim assembler
      const simData = {
        time: { band: 'Dawn', day_index: 0 },
        weather: { current: 'clear', forecast: 'clear skies' },
        regions: [],
        npcs: [],
      };

      const tokens = this.estimateTokens(simData);
      return { success: true, data: simData, tokens };
    } catch (error) {
      return { success: false, data: null, tokens: 0, error: String(error) };
    }
  }

  /**
   * Assemble party slice
   */
  private async assemblePartySlice(): Promise<{ success: boolean; data: any; tokens: number; error?: string }> {
    try {
      // This would integrate with Phase 18 party assembler
      const partyData = {
        members: [],
        intents: {},
        caps: { maxParty: 4, maxReserve: 6 },
      };

      const tokens = this.estimateTokens(partyData);
      return { success: true, data: partyData, tokens };
    } catch (error) {
      return { success: false, data: null, tokens: 0, error: String(error) };
    }
  }

  /**
   * Assemble economy slice
   */
  private async assembleEconomySlice(): Promise<{ success: boolean; data: any; tokens: number; error?: string }> {
    try {
      // This would integrate with Phase 17 economy assembler
      const economyData = {
        currency: {},
        inventory: {},
        equipment: {},
      };

      const tokens = this.estimateTokens(economyData);
      return { success: true, data: economyData, tokens };
    } catch (error) {
      return { success: false, data: null, tokens: 0, error: String(error) };
    }
  }

  /**
   * Assemble localization slice
   */
  private async assembleLocalizationSlice(): Promise<{ success: boolean; data: any; tokens: number; error?: string }> {
    try {
      const localizationDoc = this.findDocumentByType('localization');
      if (!localizationDoc) {
        return { success: false, data: null, tokens: 0, error: 'No localization document found' };
      }

      const localizationData = {
        locale: localizationDoc.payload.locale,
        translations: localizationDoc.payload.translations,
      };

      const tokens = this.estimateTokens(localizationData);
      return { success: true, data: localizationData, tokens };
    } catch (error) {
      return { success: false, data: null, tokens: 0, error: String(error) };
    }
  }

  /**
   * Find document by type
   */
  private findDocumentByType(docType: string): { doc_type: string; payload: any; format: string } | null {
    for (const doc of Object.values(this.documents)) {
      if (doc.doc_type === docType) {
        return doc;
      }
    }
    return null;
  }

  /**
   * Estimate token count for data
   */
  private estimateTokens(data: any): number {
    try {
      const jsonString = JSON.stringify(data);
      // Rough estimate: 4 characters per token
      return Math.ceil(jsonString.length / 4);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Set options
   */
  setOptions(options: Partial<PreviewOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current options
   */
  getOptions(): PreviewOptions {
    return { ...this.options };
  }
}

// Singleton instance
export const previewAssembler = new PreviewAssembler();


