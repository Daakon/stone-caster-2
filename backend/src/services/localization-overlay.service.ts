/**
 * Localization Overlay Service
 * Phase 12: Multilingual Support - Localized doc overlays
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface LocalizationPack {
  id: string;
  doc_type: 'core' | 'world' | 'adventure' | 'start';
  doc_ref: string;
  locale: string;
  payload: Record<string, unknown>;
  hash: string;
  created_at: string;
  updated_at: string;
}

export interface LocalizedOverlay {
  title?: string;
  short_desc?: string;
  npcs?: Record<string, {
    name?: string;
    description?: string;
    role?: string;
  }>;
  locations?: Record<string, {
    name?: string;
    description?: string;
  }>;
  objectives?: Record<string, {
    title?: string;
    description?: string;
  }>;
  slices?: Record<string, {
    name?: string;
    description?: string;
  }>;
}

export class LocalizationOverlayService {
  private supabase: any;

  constructor() {
    this.supabase = supabase;
  }

  /**
   * Get localization pack for a document and locale
   * @param docType - Document type
   * @param docRef - Document reference
   * @param locale - Target locale
   * @returns Localization pack or null
   */
  async getLocalizationPack(
    docType: 'core' | 'world' | 'adventure' | 'start',
    docRef: string,
    locale: string
  ): Promise<LocalizationPack | null> {
    const { data, error } = await this.supabase
      .from('localization_packs')
      .select('*')
      .eq('doc_type', docType)
      .eq('doc_ref', docRef)
      .eq('locale', locale)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return data as LocalizationPack;
  }

  /**
   * Apply localized overlays to a document
   * @param baseDoc - Base document
   * @param docType - Document type
   * @param docRef - Document reference
   * @param locale - Target locale
   * @param sliceNames - Optional slice names to limit overlay scope
   * @returns Document with localized overlays applied
   */
  async applyLocalizedOverlays(
    baseDoc: Record<string, unknown>,
    docType: 'core' | 'world' | 'adventure' | 'start',
    docRef: string,
    locale: string,
    sliceNames?: string[]
  ): Promise<Record<string, unknown>> {
    // If locale is en-US, return base document unchanged
    if (locale === 'en-US') {
      return baseDoc;
    }

    // Get localization pack
    const localizationPack = await this.getLocalizationPack(docType, docRef, locale);
    if (!localizationPack) {
      console.warn(`[Localization] No localization pack found for ${docType}/${docRef}/${locale}`);
      return baseDoc;
    }

    // Apply overlays
    const localizedDoc = { ...baseDoc };
    const overlays = localizationPack.payload as LocalizedOverlay;

    // Apply title overlay
    if (overlays.title) {
      localizedDoc.title = overlays.title;
    }

    // Apply short description overlay
    if (overlays.short_desc) {
      localizedDoc.short_desc = overlays.short_desc;
    }

    // Apply NPC overlays
    if (overlays.npcs && baseDoc.npcs && Array.isArray(baseDoc.npcs)) {
      const npcs = [...baseDoc.npcs] as Array<Record<string, unknown>>;
      for (const npc of npcs) {
        const npcId = npc.id as string;
        if (overlays.npcs[npcId]) {
          const npcOverlay = overlays.npcs[npcId];
          if (npcOverlay.name) npc.name = npcOverlay.name;
          if (npcOverlay.description) npc.description = npcOverlay.description;
          if (npcOverlay.role) npc.role = npcOverlay.role;
        }
      }
      localizedDoc.npcs = npcs;
    }

    // Apply location overlays
    if (overlays.locations && baseDoc.locations && Array.isArray(baseDoc.locations)) {
      const locations = [...baseDoc.locations] as Array<Record<string, unknown>>;
      for (const location of locations) {
        const locationId = location.id as string;
        if (overlays.locations[locationId]) {
          const locationOverlay = overlays.locations[locationId];
          if (locationOverlay.name) location.name = locationOverlay.name;
          if (locationOverlay.description) location.description = locationOverlay.description;
        }
      }
      localizedDoc.locations = locations;
    }

    // Apply objective overlays
    if (overlays.objectives && baseDoc.objectives && Array.isArray(baseDoc.objectives)) {
      const objectives = [...baseDoc.objectives] as Array<Record<string, unknown>>;
      for (const objective of objectives) {
        const objectiveId = objective.id as string;
        if (overlays.objectives[objectiveId]) {
          const objectiveOverlay = overlays.objectives[objectiveId];
          if (objectiveOverlay.title) objective.title = objectiveOverlay.title;
          if (objectiveOverlay.description) objective.description = objectiveOverlay.description;
        }
      }
      localizedDoc.objectives = objectives;
    }

    // Apply slice overlays (only for requested slices)
    if (overlays.slices && baseDoc.slices && Array.isArray(baseDoc.slices)) {
      const slices = [...baseDoc.slices] as Array<Record<string, unknown>>;
      for (const slice of slices) {
        const sliceId = slice.id as string;
        // Only apply overlay if slice is requested or no slice filter
        if (!sliceNames || sliceNames.includes(sliceId)) {
          if (overlays.slices[sliceId]) {
            const sliceOverlay = overlays.slices[sliceId];
            if (sliceOverlay.name) slice.name = sliceOverlay.name;
            if (sliceOverlay.description) slice.description = sliceOverlay.description;
          }
        }
      }
      localizedDoc.slices = slices;
    }

    // Add localized metadata
    localizedDoc._localized = {
      locale,
      doc_ref: docRef,
      applied_at: new Date().toISOString(),
    };

    return localizedDoc;
  }

  /**
   * Create or update a localization pack
   * @param docType - Document type
   * @param docRef - Document reference
   * @param locale - Target locale
   * @param payload - Localization payload
   * @returns Created or updated localization pack
   */
  async upsertLocalizationPack(
    docType: 'core' | 'world' | 'adventure' | 'start',
    docRef: string,
    locale: string,
    payload: Record<string, unknown>
  ): Promise<LocalizationPack> {
    const hash = this.computeHash(payload);
    
    const { data, error } = await this.supabase
      .from('localization_packs')
      .upsert({
        doc_type: docType,
        doc_ref: docRef,
        locale,
        payload,
        hash,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'doc_ref,locale' })
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data as LocalizationPack;
  }

  /**
   * Delete a localization pack
   * @param docType - Document type
   * @param docRef - Document reference
   * @param locale - Target locale
   */
  async deleteLocalizationPack(
    docType: 'core' | 'world' | 'adventure' | 'start',
    docRef: string,
    locale: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('localization_packs')
      .delete()
      .eq('doc_type', docType)
      .eq('doc_ref', docRef)
      .eq('locale', locale);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * List localization packs for a document
   * @param docType - Document type
   * @param docRef - Document reference
   * @returns Array of localization packs
   */
  async listLocalizationPacks(
    docType: 'core' | 'world' | 'adventure' | 'start',
    docRef: string
  ): Promise<LocalizationPack[]> {
    const { data, error } = await this.supabase
      .from('localization_packs')
      .select('*')
      .eq('doc_type', docType)
      .eq('doc_ref', docRef)
      .order('locale');

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return (data || []) as LocalizationPack[];
  }

  /**
   * Compute hash for localization payload
   * @param payload - Localization payload
   * @returns Hash string
   */
  private computeHash(payload: Record<string, unknown>): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256')
      .update(JSON.stringify(payload, Object.keys(payload).sort()))
      .digest('hex')
      .substring(0, 16);
  }
}

export const localizationOverlayService = new LocalizationOverlayService();


