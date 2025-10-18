/**
 * Translation Cache Service
 * Phase 12: Multilingual Support - Deterministic translation caching
 */

import { createClient } from '@supabase/supabase-js';
import { AwfModelProvider } from '../model/awf-model-provider.js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface TranslationCacheEntry {
  id: string;
  src_lang: string;
  dst_lang: string;
  src_hash: string;
  contract_ver: string;
  text_out: string;
  tokens_est: number;
  created_at: string;
}

export interface TranslationResult {
  out: string;
  fromCache: boolean;
  tokensEst: number;
}

export interface TranslationPolicy {
  sentence_caps: number;
  choice_label_max: number;
  forbidden_phrases: string[];
  formal_you: boolean;
}

export class TranslationCacheService {
  private supabase: any;
  private modelProvider: AwfModelProvider;
  private useModelTranslator: boolean;
  private maxTokens: number;

  constructor(modelProvider: AwfModelProvider) {
    this.supabase = supabase;
    this.modelProvider = modelProvider;
    this.useModelTranslator = process.env.USE_MODEL_TRANSLATOR === 'true';
    this.maxTokens = parseInt(process.env.AWF_TRANSLATION_MAX_TOKENS || '800', 10);
  }

  /**
   * Translate text with caching
   * @param text - Source text
   * @param srcLang - Source language
   * @param dstLang - Destination language
   * @param policy - Translation policy
   * @returns Translation result
   */
  async translateText(
    text: string,
    srcLang: string,
    dstLang: string,
    policy: TranslationPolicy
  ): Promise<TranslationResult> {
    // If source and destination languages are the same, return original
    if (srcLang === dstLang) {
      return {
        out: text,
        fromCache: true,
        tokensEst: this.estimateTokens(text),
      };
    }

    // Compute source hash
    const srcHash = this.computeHash(text);
    const contractVer = '1.0.0'; // Use current contract version

    // Check cache first
    const cached = await this.getCachedTranslation(srcHash, srcLang, dstLang, contractVer);
    if (cached) {
      console.log(`[Translation] Cache hit for ${srcLang}->${dstLang} (${srcHash.substring(0, 8)})`);
      return {
        out: cached.text_out,
        fromCache: true,
        tokensEst: cached.tokens_est,
      };
    }

    // Cache miss - translate if model translator is enabled
    if (!this.useModelTranslator) {
      console.warn(`[Translation] Model translator disabled, returning original text`);
      return {
        out: text,
        fromCache: false,
        tokensEst: this.estimateTokens(text),
      };
    }

    console.log(`[Translation] Cache miss for ${srcLang}->${dstLang} (${srcHash.substring(0, 8)}), translating...`);
    
    // Translate using model
    const translated = await this.translateWithModel(text, srcLang, dstLang, policy);
    
    // Cache the result
    await this.cacheTranslation(srcHash, srcLang, dstLang, contractVer, translated, this.estimateTokens(translated));
    
    return {
      out: translated,
      fromCache: false,
      tokensEst: this.estimateTokens(translated),
    };
  }

  /**
   * Get cached translation
   * @param srcHash - Source hash
   * @param srcLang - Source language
   * @param dstLang - Destination language
   * @param contractVer - Contract version
   * @returns Cached translation or null
   */
  private async getCachedTranslation(
    srcHash: string,
    srcLang: string,
    dstLang: string,
    contractVer: string
  ): Promise<TranslationCacheEntry | null> {
    const { data, error } = await this.supabase
      .from('translation_cache')
      .select('*')
      .eq('src_hash', srcHash)
      .eq('src_lang', srcLang)
      .eq('dst_lang', dstLang)
      .eq('contract_ver', contractVer)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return data as TranslationCacheEntry;
  }

  /**
   * Cache translation result
   * @param srcHash - Source hash
   * @param srcLang - Source language
   * @param dstLang - Destination language
   * @param contractVer - Contract version
   * @param textOut - Translated text
   * @param tokensEst - Estimated tokens
   */
  private async cacheTranslation(
    srcHash: string,
    srcLang: string,
    dstLang: string,
    contractVer: string,
    textOut: string,
    tokensEst: number
  ): Promise<void> {
    const { error } = await this.supabase
      .from('translation_cache')
      .upsert({
        src_hash: srcHash,
        src_lang: srcLang,
        dst_lang: dstLang,
        contract_ver: contractVer,
        text_out: textOut,
        tokens_est: tokensEst,
      }, { onConflict: 'src_hash,src_lang,dst_lang,contract_ver' });

    if (error) {
      console.error(`[Translation] Failed to cache translation: ${error.message}`);
      // Don't throw - caching failure shouldn't break translation
    }
  }

  /**
   * Translate text using model
   * @param text - Source text
   * @param srcLang - Source language
   * @param dstLang - Destination language
   * @param policy - Translation policy
   * @returns Translated text
   */
  private async translateWithModel(
    text: string,
    srcLang: string,
    dstLang: string,
    policy: TranslationPolicy
  ): Promise<string> {
    const systemPrompt = this.createTranslationSystemPrompt(dstLang, policy);
    
    try {
      const result = await this.modelProvider.infer({
        system: systemPrompt,
        awf_bundle: {
          text_to_translate: text,
          source_language: srcLang,
          target_language: dstLang,
        },
      });

      // Extract translated text from model response
      const translated = this.extractTranslatedText(result.raw);
      
      // Validate and truncate if necessary
      return this.validateAndTruncate(translated, policy);
    } catch (error) {
      console.error(`[Translation] Model translation failed: ${error}`);
      // Return original text as fallback
      return text;
    }
  }

  /**
   * Create translation system prompt
   * @param dstLang - Destination language
   * @param policy - Translation policy
   * @returns System prompt for translation
   */
  private createTranslationSystemPrompt(dstLang: string, policy: TranslationPolicy): string {
    const constraints = [];
    
    if (policy.sentence_caps > 0) {
      constraints.push(`Keep sentences under ${policy.sentence_caps} characters.`);
    }
    
    if (policy.choice_label_max > 0) {
      constraints.push(`Keep choice labels under ${policy.choice_label_max} characters.`);
    }
    
    if (policy.forbidden_phrases.length > 0) {
      constraints.push(`Avoid these phrases: ${policy.forbidden_phrases.join(', ')}.`);
    }
    
    if (policy.formal_you) {
      constraints.push(`Use formal "you" (vous/usted) instead of informal.`);
    }

    return `You are a professional translator. Translate the provided text from the source language to ${dstLang}.

Requirements:
- Maintain the original meaning and tone
- Use natural, fluent language
- Preserve any placeholders like {npc}, {location}, {objective}
- ${constraints.join(' ')}

Return only the translated text, no explanations or additional text.`;
  }

  /**
   * Extract translated text from model response
   * @param rawResponse - Raw model response
   * @returns Extracted translated text
   */
  private extractTranslatedText(rawResponse: string): string {
    // Remove any markdown formatting
    let text = rawResponse.replace(/```[\s\S]*?```/g, '').trim();
    
    // Remove any JSON wrapper if present
    if (text.startsWith('{') && text.includes('"translation"')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.translation) {
          text = parsed.translation;
        }
      } catch {
        // Not JSON, use as-is
      }
    }
    
    return text.trim();
  }

  /**
   * Validate and truncate translated text
   * @param text - Translated text
   * @param policy - Translation policy
   * @returns Validated and truncated text
   */
  private validateAndTruncate(text: string, policy: TranslationPolicy): string {
    // Check sentence length
    if (policy.sentence_caps > 0) {
      const sentences = text.split(/[.!?]+/);
      const truncatedSentences = sentences.map(sentence => {
        if (sentence.length > policy.sentence_caps) {
          return sentence.substring(0, policy.sentence_caps - 3) + '...';
        }
        return sentence;
      });
      text = truncatedSentences.join('.');
    }
    
    // Check choice label length
    if (policy.choice_label_max > 0) {
      const lines = text.split('\n');
      const truncatedLines = lines.map(line => {
        if (line.length > policy.choice_label_max) {
          return line.substring(0, policy.choice_label_max - 3) + '...';
        }
        return line;
      });
      text = truncatedLines.join('\n');
    }
    
    // Check forbidden phrases
    if (policy.forbidden_phrases.length > 0) {
      for (const phrase of policy.forbidden_phrases) {
        if (text.toLowerCase().includes(phrase.toLowerCase())) {
          console.warn(`[Translation] Forbidden phrase detected: ${phrase}`);
        }
      }
    }
    
    return text;
  }

  /**
   * Compute hash for text
   * @param text - Input text
   * @returns Hash string
   */
  private computeHash(text: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256')
      .update(text)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Estimate token count for text
   * @param text - Input text
   * @returns Estimated token count
   */
  private estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get translation statistics
   * @param srcLang - Source language
   * @param dstLang - Destination language
   * @returns Translation statistics
   */
  async getTranslationStats(srcLang: string, dstLang: string): Promise<{
    totalTranslations: number;
    totalTokens: number;
    avgTokensPerTranslation: number;
  }> {
    const { data, error } = await this.supabase
      .from('translation_cache')
      .select('tokens_est')
      .eq('src_lang', srcLang)
      .eq('dst_lang', dstLang);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const translations = data || [];
    const totalTokens = translations.reduce((sum: number, t: any) => sum + t.tokens_est, 0);
    
    return {
      totalTranslations: translations.length,
      totalTokens,
      avgTokensPerTranslation: translations.length > 0 ? totalTokens / translations.length : 0,
    };
  }

  /**
   * Clear translation cache
   * @param srcLang - Optional source language filter
   * @param dstLang - Optional destination language filter
   */
  async clearCache(srcLang?: string, dstLang?: string): Promise<void> {
    let query = this.supabase.from('translation_cache').delete();
    
    if (srcLang) {
      query = query.eq('src_lang', srcLang);
    }
    
    if (dstLang) {
      query = query.eq('dst_lang', dstLang);
    }
    
    const { error } = await query;
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
  }
}
