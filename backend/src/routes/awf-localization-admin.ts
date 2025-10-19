/**
 * AWF Localization Admin Routes
 * Phase 12: Multilingual Support - Admin endpoints for localization management
 */

import { Router } from 'express';
import { z } from 'zod';
import { localizationOverlayService } from '../services/localization-overlay.service.js';
import { TranslationCacheService } from '../services/translation-cache.service.js';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Validation schemas
const LocalizationPackSchema = z.object({
  doc_type: z.enum(['core', 'world', 'adventure', 'start']),
  doc_ref: z.string(),
  locale: z.string(),
  payload: z.record(z.unknown()),
});

const LocaleSchema = z.string().regex(/^[a-z]{2}-[A-Z]{2}$/);

/**
 * GET /api/admin/awf/localization/packs
 * List localization packs with optional filtering
 */
router.get('/packs', async (req, res) => {
  try {
    const { doc_type, doc_ref, locale } = req.query;
    
    let query = supabase.from('localization_packs').select('*');
    
    if (doc_type) {
      query = query.eq('doc_type', doc_type);
    }
    if (doc_ref) {
      query = query.eq('doc_ref', doc_ref);
    }
    if (locale) {
      query = query.eq('locale', locale);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    res.json({
      success: true,
      data: data || [],
      count: (data || []).length,
    });
  } catch (error) {
    console.error('[Localization Admin] Error listing packs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/awf/localization/packs
 * Create or update a localization pack
 */
router.post('/packs', async (req, res) => {
  try {
    const validation = LocalizationPackSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }
    
    const { doc_type, doc_ref, locale, payload } = validation.data;
    
    const pack = await localizationOverlayService.upsertLocalizationPack(
      doc_type,
      doc_ref,
      locale,
      payload
    );
    
    res.json({
      success: true,
      data: pack,
    });
  } catch (error) {
    console.error('[Localization Admin] Error creating pack:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/admin/awf/localization/packs/:doc_type/:doc_ref/:locale
 * Delete a localization pack
 */
router.delete('/packs/:doc_type/:doc_ref/:locale', async (req, res) => {
  try {
    const { doc_type, doc_ref, locale } = req.params;
    
    if (!['core', 'world', 'adventure', 'start'].includes(doc_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid doc_type',
      });
    }
    
    await localizationOverlayService.deleteLocalizationPack(
      doc_type as 'core' | 'world' | 'adventure' | 'start',
      doc_ref,
      locale
    );
    
    res.json({
      success: true,
      message: 'Localization pack deleted',
    });
  } catch (error) {
    console.error('[Localization Admin] Error deleting pack:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/awf/localization/packs/import
 * Import localization pack from JSON or XLIFF
 */
router.post('/packs/import', async (req, res) => {
  try {
    const { format, data } = req.body;
    
    if (!format || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing format or data',
      });
    }
    
    let packData;
    
    if (format === 'json') {
      packData = data;
    } else if (format === 'xliff') {
      // Basic XLIFF parsing (would need proper XLIFF library in production)
      packData = parseXLIFF(data);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported format. Use "json" or "xliff"',
      });
    }
    
    const validation = LocalizationPackSchema.safeParse(packData);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pack data',
        details: validation.error.errors,
      });
    }
    
    const { doc_type, doc_ref, locale, payload } = validation.data;
    
    const pack = await localizationOverlayService.upsertLocalizationPack(
      doc_type,
      doc_ref,
      locale,
      payload
    );
    
    res.json({
      success: true,
      data: pack,
    });
  } catch (error) {
    console.error('[Localization Admin] Error importing pack:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/awf/localization/packs/export
 * Export localization pack as JSON or XLIFF
 */
router.get('/packs/export', async (req, res) => {
  try {
    const { doc_type, doc_ref, locale, format = 'json' } = req.query;
    
    if (!doc_type || !doc_ref || !locale) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: doc_type, doc_ref, locale',
      });
    }
    
    const pack = await localizationOverlayService.getLocalizationPack(
      doc_type as 'core' | 'world' | 'adventure' | 'start',
      doc_ref as string,
      locale as string
    );
    
    if (!pack) {
      return res.status(404).json({
        success: false,
        error: 'Localization pack not found',
      });
    }
    
    if (format === 'json') {
      res.json({
        success: true,
        data: pack,
      });
    } else if (format === 'xliff') {
      const xliffData = generateXLIFF(pack);
      res.setHeader('Content-Type', 'application/xml');
      res.send(xliffData);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported format. Use "json" or "xliff"',
      });
    }
  } catch (error) {
    console.error('[Localization Admin] Error exporting pack:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/awf/localization/glossary
 * Get localization glossary for a locale
 */
router.get('/glossary', async (req, res) => {
  try {
    const { locale } = req.query;
    
    if (!locale) {
      return res.status(400).json({
        success: false,
        error: 'Missing locale parameter',
      });
    }
    
    const { data, error } = await supabase
      .from('localization_glossary')
      .select('*')
      .eq('locale', locale)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Glossary not found for locale',
        });
      }
      throw new Error(`Database error: ${error.message}`);
    }
    
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[Localization Admin] Error getting glossary:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/awf/localization/glossary
 * Update localization glossary for a locale
 */
router.post('/glossary', async (req, res) => {
  try {
    const { locale, entries } = req.body;
    
    if (!locale || !entries) {
      return res.status(400).json({
        success: false,
        error: 'Missing locale or entries',
      });
    }
    
    const hash = computeHash(entries);
    
    const { data, error } = await supabase
      .from('localization_glossary')
      .upsert({
        locale,
        entries,
        hash,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'locale' })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[Localization Admin] Error updating glossary:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/awf/localization/rules
 * Get localization rules for a locale
 */
router.get('/rules', async (req, res) => {
  try {
    const { locale } = req.query;
    
    if (!locale) {
      return res.status(400).json({
        success: false,
        error: 'Missing locale parameter',
      });
    }
    
    const { data, error } = await supabase
      .from('localization_rules')
      .select('*')
      .eq('locale', locale)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          error: 'Rules not found for locale',
        });
      }
      throw new Error(`Database error: ${error.message}`);
    }
    
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[Localization Admin] Error getting rules:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/admin/awf/localization/rules
 * Update localization rules for a locale
 */
router.post('/rules', async (req, res) => {
  try {
    const { locale, policy } = req.body;
    
    if (!locale || !policy) {
      return res.status(400).json({
        success: false,
        error: 'Missing locale or policy',
      });
    }
    
    const { data, error } = await supabase
      .from('localization_rules')
      .upsert({
        locale,
        policy,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'locale' })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[Localization Admin] Error updating rules:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/admin/awf/localization/translation-stats
 * Get translation cache statistics
 */
router.get('/translation-stats', async (req, res) => {
  try {
    const { src_lang, dst_lang } = req.query;
    
    if (!src_lang || !dst_lang) {
      return res.status(400).json({
        success: false,
        error: 'Missing src_lang or dst_lang parameters',
      });
    }
    
    // This would need the translation cache service to be properly initialized
    // For now, return mock data
    res.json({
      success: true,
      data: {
        src_lang,
        dst_lang,
        total_translations: 0,
        total_tokens: 0,
        avg_tokens_per_translation: 0,
      },
    });
  } catch (error) {
    console.error('[Localization Admin] Error getting translation stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Helper functions

function parseXLIFF(xliffData: string): any {
  // Basic XLIFF parsing - in production, use a proper XLIFF library
  // This is a simplified implementation
  try {
    // Extract basic structure from XLIFF
    const docRef = xliffData.match(/<file[^>]*original="([^"]*)"/)?.[1] || 'unknown';
    const locale = xliffData.match(/<file[^>]*target-language="([^"]*)"/)?.[1] || 'en-US';
    
    // This would need proper XLIFF parsing in production
    return {
      doc_type: 'world', // Would be determined from context
      doc_ref: docRef,
      locale,
      payload: {}, // Would be populated from XLIFF content
    };
  } catch (error) {
    throw new Error('Invalid XLIFF format');
  }
}

function generateXLIFF(pack: any): string {
  // Basic XLIFF generation - in production, use a proper XLIFF library
  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="${pack.doc_ref}" source-language="en-US" target-language="${pack.locale}">
    <body>
      <!-- XLIFF content would be generated here -->
    </body>
  </file>
</xliff>`;
}

function computeHash(data: any): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256')
    .update(JSON.stringify(data, Object.keys(data).sort()))
    .digest('hex')
    .substring(0, 16);
}

export default router;
