// Phase 26: Creator Service
// Handles creator onboarding, namespace ownership, and profile management

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Validation schemas
const CreatorOnboardSchema = z.object({
  display_name: z.string().min(1).max(100),
  email: z.string().email(),
  terms_accepted: z.boolean().refine(val => val === true, {
    message: "Terms must be accepted"
  }),
  content_policy_accepted: z.boolean().refine(val => val === true, {
    message: "Content policy must be accepted"
  })
});

const NamespaceClaimSchema = z.object({
  namespace: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Namespace must contain only lowercase letters, numbers, and hyphens")
    .refine(val => !val.startsWith('-') && !val.endsWith('-'), {
      message: "Namespace cannot start or end with hyphen"
    }),
  description: z.string().min(10).max(500).optional()
});

const CreatorUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  notes: z.string().max(1000).optional()
});

export interface CreatorProfile {
  creator_id: string;
  display_name: string;
  email_hash: string;
  verified: boolean;
  terms_accepted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorNamespace {
  namespace: string;
  creator_id: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface NamespaceClaimResult {
  success: boolean;
  data?: {
    namespace: string;
    creator_id: string;
    verified: boolean;
  };
  error?: string;
}

export interface CreatorOnboardResult {
  success: boolean;
  data?: {
    creator_id: string;
    display_name: string;
    email_hash: string;
    verification_required: boolean;
  };
  error?: string;
}

export class CreatorService {
  private supabase: any;

  constructor() {
    this.supabase = supabase;
  }

  /**
   * Onboard a new creator
   */
  async onboardCreator(data: z.infer<typeof CreatorOnboardSchema>): Promise<CreatorOnboardResult> {
    try {
      const validated = CreatorOnboardSchema.parse(data);
      
      // Hash email for privacy
      const emailHash = crypto.createHash('sha256')
        .update(validated.email.toLowerCase())
        .digest('hex');

      // Check if creator already exists
      const { data: existingCreator, error: checkError } = await this.supabase
        .from('creators')
        .select('creator_id, verified')
        .eq('email_hash', emailHash)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(`Failed to check existing creator: ${checkError.message}`);
      }

      if (existingCreator) {
        return {
          success: true,
          data: {
            creator_id: existingCreator.creator_id,
            display_name: validated.display_name,
            email_hash: emailHash,
            verification_required: !existingCreator.verified
          }
        };
      }

      // Create new creator
      const { data: creator, error: createError } = await this.supabase
        .from('creators')
        .insert({
          display_name: validated.display_name,
          email_hash: emailHash,
          verified: false,
          terms_accepted_at: new Date().toISOString(),
          notes: `Terms accepted: ${new Date().toISOString()}\nContent policy accepted: ${new Date().toISOString()}`
        })
        .select('creator_id, display_name, email_hash, verified')
        .single();

      if (createError) {
        throw new Error(`Failed to create creator: ${createError.message}`);
      }

      // Log terms acceptance
      await this.logTermsAcceptance(creator.creator_id, {
        terms_accepted: validated.terms_accepted,
        content_policy_accepted: validated.content_policy_accepted,
        email: validated.email
      });

      return {
        success: true,
        data: {
          creator_id: creator.creator_id,
          display_name: creator.display_name,
          email_hash: creator.email_hash,
          verification_required: !creator.verified
        }
      };
    } catch (error) {
      console.error('Creator onboarding failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Claim a namespace
   */
  async claimNamespace(
    creatorId: string, 
    data: z.infer<typeof NamespaceClaimSchema>
  ): Promise<NamespaceClaimResult> {
    try {
      const validated = NamespaceClaimSchema.parse(data);
      
      // Check if namespace is already taken
      const { data: existingNamespace, error: checkError } = await this.supabase
        .from('creator_namespaces')
        .select('namespace, creator_id')
        .eq('namespace', validated.namespace)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(`Failed to check namespace availability: ${checkError.message}`);
      }

      if (existingNamespace) {
        return {
          success: false,
          error: 'Namespace is already taken'
        };
      }

      // Verify creator exists and is verified
      const { data: creator, error: creatorError } = await this.supabase
        .from('creators')
        .select('creator_id, verified')
        .eq('creator_id', creatorId)
        .single();

      if (creatorError) {
        throw new Error(`Creator not found: ${creatorError.message}`);
      }

      if (!creator.verified) {
        return {
          success: false,
          error: 'Creator must be verified before claiming namespaces'
        };
      }

      // Create namespace claim
      const { data: namespace, error: createError } = await this.supabase
        .from('creator_namespaces')
        .insert({
          namespace: validated.namespace,
          creator_id: creatorId,
          verified: false
        })
        .select('namespace, creator_id, verified')
        .single();

      if (createError) {
        throw new Error(`Failed to claim namespace: ${createError.message}`);
      }

      return {
        success: true,
        data: {
          namespace: namespace.namespace,
          creator_id: namespace.creator_id,
          verified: namespace.verified
        }
      };
    } catch (error) {
      console.error('Namespace claim failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get creator profile
   */
  async getCreatorProfile(creatorId: string): Promise<{
    success: boolean;
    data?: CreatorProfile;
    error?: string;
  }> {
    try {
      const { data: creator, error } = await this.supabase
        .from('creators')
        .select('*')
        .eq('creator_id', creatorId)
        .single();

      if (error) {
        throw new Error(`Failed to get creator profile: ${error.message}`);
      }

      return {
        success: true,
        data: creator
      };
    } catch (error) {
      console.error('Failed to get creator profile:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update creator profile
   */
  async updateCreatorProfile(
    creatorId: string, 
    data: z.infer<typeof CreatorUpdateSchema>
  ): Promise<{
    success: boolean;
    data?: CreatorProfile;
    error?: string;
  }> {
    try {
      const validated = CreatorUpdateSchema.parse(data);
      
      const { data: creator, error } = await this.supabase
        .from('creators')
        .update(validated)
        .eq('creator_id', creatorId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update creator profile: ${error.message}`);
      }

      return {
        success: true,
        data: creator
      };
    } catch (error) {
      console.error('Failed to update creator profile:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get creator namespaces
   */
  async getCreatorNamespaces(creatorId: string): Promise<{
    success: boolean;
    data?: CreatorNamespace[];
    error?: string;
  }> {
    try {
      const { data: namespaces, error } = await this.supabase
        .from('creator_namespaces')
        .select('*')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get creator namespaces: ${error.message}`);
      }

      return {
        success: true,
        data: namespaces || []
      };
    } catch (error) {
      console.error('Failed to get creator namespaces:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Verify creator (admin only)
   */
  async verifyCreator(creatorId: string, verified: boolean): Promise<{
    success: boolean;
    data?: CreatorProfile;
    error?: string;
  }> {
    try {
      const { data: creator, error } = await this.supabase
        .from('creators')
        .update({ verified })
        .eq('creator_id', creatorId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to verify creator: ${error.message}`);
      }

      // If verifying, also verify all their namespaces
      if (verified) {
        await this.supabase
          .from('creator_namespaces')
          .update({ verified: true })
          .eq('creator_id', creatorId);
      }

      return {
        success: true,
        data: creator
      };
    } catch (error) {
      console.error('Failed to verify creator:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all creators (admin only)
   */
  async getAllCreators(): Promise<{
    success: boolean;
    data?: CreatorProfile[];
    error?: string;
  }> {
    try {
      const { data: creators, error } = await this.supabase
        .from('creators')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get creators: ${error.message}`);
      }

      return {
        success: true,
        data: creators || []
      };
    } catch (error) {
      console.error('Failed to get creators:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Log terms acceptance for audit trail
   */
  private async logTermsAcceptance(
    creatorId: string, 
    terms: {
      terms_accepted: boolean;
      content_policy_accepted: boolean;
      email: string;
    }
  ): Promise<void> {
    try {
      const logEntry = {
        creator_id: creatorId,
        terms_accepted: terms.terms_accepted,
        content_policy_accepted: terms.content_policy_accepted,
        email_hash: crypto.createHash('sha256').update(terms.email.toLowerCase()).digest('hex'),
        timestamp: new Date().toISOString(),
        ip_address: 'unknown', // Would be passed from request context
        user_agent: 'unknown' // Would be passed from request context
      };

      // Store in audit log (would be a separate table in production)
      console.log('Terms acceptance logged:', logEntry);
    } catch (error) {
      console.error('Failed to log terms acceptance:', error);
    }
  }

  /**
   * Check if namespace is available
   */
  async isNamespaceAvailable(namespace: string): Promise<{
    success: boolean;
    data?: { available: boolean };
    error?: string;
  }> {
    try {
      const { data: existingNamespace, error } = await this.supabase
        .from('creator_namespaces')
        .select('namespace')
        .eq('namespace', namespace)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to check namespace availability: ${error.message}`);
      }

      return {
        success: true,
        data: { available: !existingNamespace }
      };
    } catch (error) {
      console.error('Failed to check namespace availability:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get namespace details
   */
  async getNamespaceDetails(namespace: string): Promise<{
    success: boolean;
    data?: {
      namespace: string;
      creator: CreatorProfile;
      verified: boolean;
      pack_count: number;
      latest_pack?: {
        version: string;
        status: string;
        created_at: string;
      };
    };
    error?: string;
  }> {
    try {
      const { data: namespaceData, error: namespaceError } = await this.supabase
        .from('creator_namespaces')
        .select(`
          namespace,
          creator_id,
          verified,
          created_at,
          creators!inner(*)
        `)
        .eq('namespace', namespace)
        .single();

      if (namespaceError) {
        throw new Error(`Failed to get namespace details: ${namespaceError.message}`);
      }

      // Get pack count and latest pack
      const { data: packs, error: packsError } = await this.supabase
        .from('mod_pack_registry')
        .select('version, status, created_at')
        .eq('namespace', namespace)
        .order('created_at', { ascending: false })
        .limit(1);

      if (packsError) {
        console.warn('Failed to get pack details:', packsError.message);
      }

      return {
        success: true,
        data: {
          namespace: namespaceData.namespace,
          creator: namespaceData.creators,
          verified: namespaceData.verified,
          pack_count: packs?.length || 0,
          latest_pack: packs?.[0] ? {
            version: packs[0].version,
            status: packs[0].status,
            created_at: packs[0].created_at
          } : undefined
        }
      };
    } catch (error) {
      console.error('Failed to get namespace details:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const creatorService = new CreatorService();
