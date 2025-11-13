/**
 * Publishing Wizard Service
 * Phase 7: Unified preflight checks and snapshot preview for publishing wizard
 */

import { supabaseAdmin } from './supabase.js';
import { checkMediaPreflight } from './mediaPreflight.js';
import { revalidateForApproval } from '../dal/publishing.js';
import { EntryPointAssemblerV3, CORE_PROMPT } from '../prompts/entry-point-assembler-v3.js';
import { checkDependencies, validateRequiredFields } from './publishingPreflightHelpers.js';
import type { PublishableType } from '@shared';
import type { PromptSnapshotData } from '@shared/types/publishing';

export interface PublishingWizardPreflightResult {
  ok: boolean;
  blockers: string[]; // Refinement: Human-readable messages
  blockerCodes: string[]; // Refinement: Canonical error codes for frontend mapping
  warnings: string[];
  warningCodes: string[]; // Refinement: Canonical warning codes
  media: {
    hasCover: boolean;
    coverApproved: boolean;
    galleryAllApproved: boolean;
    unapprovedGalleryCount: number;
  };
  dependencies: {
    missingRuleset: boolean;
    missingWorld: boolean;
    invalidRefs: string[];
  };
  validation: {
    fieldsMissing: string[];
    fieldsInvalid: string[];
  };
  snapshotPreview: {
    schemaVersion: number;
    prompts: {
      corePrompt: string;
      worldPrompt: string;
      rulesetPrompt: string;
      storyPrompt: string;
    };
    coverMediaId: string | null;
    galleryMediaIds: string[];
  };
}

/**
 * Run unified preflight checks for publishing wizard
 */
export async function runPublishingWizardPreflight(params: {
  entityType: PublishableType;
  entityId: string;
}): Promise<PublishingWizardPreflightResult> {
  const { entityType, entityId } = params;

  const blockers: string[] = [];
  const blockerCodes: string[] = []; // Refinement: Canonical error codes
  const warnings: string[] = [];
  const warningCodes: string[] = []; // Refinement: Canonical warning codes
  const invalidRefs: string[] = [];
  const fieldsMissing: string[] = [];
  const fieldsInvalid: string[] = [];

  // 1. Media checks (refinement: preserve error codes)
  const mediaPreflight = await checkMediaPreflight({ type: entityType, id: entityId });
  if (!mediaPreflight.ok && mediaPreflight.errors) {
    blockers.push(...mediaPreflight.errors.map(e => e.message));
    blockerCodes.push(...mediaPreflight.errors.map(e => e.code));
  }
  if (mediaPreflight.warnings) {
    warnings.push(...mediaPreflight.warnings.map(w => w.message));
    warningCodes.push(...mediaPreflight.warnings.map(w => w.code));
  }

  // Get media details for response
  const tableName = entityType === 'story' ? 'entry_points' : `${entityType}s`;
  const { data: entity } = await supabaseAdmin
    .from(tableName)
    .select('cover_media_id')
    .eq('id', entityId)
    .single();

  let hasCover = false;
  let coverApproved = false;
  let galleryAllApproved = true;
  let unapprovedGalleryCount = 0;

  if (entity?.cover_media_id) {
    hasCover = true;
    const { data: coverMedia } = await supabaseAdmin
      .from('media_assets')
      .select('status, image_review_status')
      .eq('id', entity.cover_media_id)
      .single();

    if (coverMedia) {
      coverApproved = coverMedia.status === 'ready' && coverMedia.image_review_status === 'approved';
    }
  }

  // Check gallery
  const targetColumn = entityType === 'world' ? 'world_id' : entityType === 'story' ? 'story_id' : 'npc_id';
  const { data: galleryLinks } = await supabaseAdmin
    .from('media_links')
    .select('media_id')
    .eq(targetColumn, entityId);

  if (galleryLinks && galleryLinks.length > 0) {
    const mediaIds = galleryLinks.map((link: any) => link.media_id);
    const { data: galleryMedia } = await supabaseAdmin
      .from('media_assets')
      .select('id, status, image_review_status')
      .in('id', mediaIds);

    if (galleryMedia) {
      const notApproved = galleryMedia.filter(
        (media: any) => media.status !== 'ready' || media.image_review_status !== 'approved'
      );
      unapprovedGalleryCount = notApproved.length;
      galleryAllApproved = notApproved.length === 0;
    }
  }

  // 2. Dependency checks (refinement: use shared helper)
  const validation = await revalidateForApproval({ type: entityType, id: entityId });
  if (!validation.ok) {
    // Map validation reasons to canonical codes
    validation.reasons.forEach(reason => {
      blockers.push(reason);
      // Map reason strings to canonical codes
      if (reason.includes('world_not_public') || reason.includes('parent_world_not_public')) {
        blockerCodes.push('DEPENDENCY_UNPUBLISHED_WORLD');
      } else if (reason.includes('world_not_found') || reason.includes('parent_world_not_found')) {
        blockerCodes.push('DEPENDENCY_MISSING_WORLD');
      } else if (reason.includes('dependency_invalid')) {
        blockerCodes.push('DEPENDENCY_INVALID');
      } else {
        blockerCodes.push('DEPENDENCY_ERROR');
      }
    });
  }

  // Use shared dependency check helper
  const dependencyCheck = await checkDependencies({ type: entityType, id: entityId });
  const missingRuleset = dependencyCheck.missingRuleset;
  const missingWorld = dependencyCheck.missingWorld;
  invalidRefs.push(...dependencyCheck.invalidRefs);

  // Add dependency blocker codes
  if (missingWorld) {
    blockerCodes.push('DEPENDENCY_MISSING_WORLD');
  }
  if (missingRuleset) {
    blockerCodes.push('DEPENDENCY_MISSING_RULESET');
  }
  if (dependencyCheck.invalidRefs.includes('world_not_published')) {
    blockerCodes.push('DEPENDENCY_UNPUBLISHED_WORLD');
  }

  // 3. Validation checks (required fields) - refinement: use shared helper
  const fieldValidation = await validateRequiredFields({ type: entityType, id: entityId });
  fieldsMissing.push(...fieldValidation.fieldsMissing);
  fieldsInvalid.push(...fieldValidation.fieldsInvalid);

  // Add validation blocker codes
  if (fieldValidation.fieldsMissing.length > 0) {
    blockerCodes.push('VALIDATION_MISSING_FIELDS');
    blockers.push(`Missing required fields: ${fieldValidation.fieldsMissing.join(', ')}`);
  }
  if (fieldValidation.fieldsInvalid.length > 0) {
    blockerCodes.push('VALIDATION_INVALID_FIELDS');
    blockers.push(`Invalid fields: ${fieldValidation.fieldsInvalid.join(', ')}`);
  }

  // 4. Snapshot preview (simulate without creating)
  let snapshotPreview: PublishingWizardPreflightResult['snapshotPreview'] = {
    schemaVersion: 1,
    prompts: {
      corePrompt: CORE_PROMPT,
      worldPrompt: '',
      rulesetPrompt: '',
      storyPrompt: '',
    },
    coverMediaId: entity?.cover_media_id || null,
    galleryMediaIds: [],
  };

  // Only generate preview for stories and worlds
  if (entityType === 'story' || entityType === 'world') {
    try {
      const assembler = new EntryPointAssemblerV3();
      
      if (entityType === 'story') {
        // Load entry point
        const { data: entryPoint } = await supabaseAdmin
          .from('entry_points')
          .select('id, slug, world_id, content, doc')
          .eq('id', entityId)
          .single();

        if (entryPoint) {
          // Load world
          const { data: world } = await supabaseAdmin
            .from('worlds')
            .select('id, doc')
            .eq('id', entryPoint.world_id)
            .single();

          if (world) {
            // Use assembler's private method via type casting
            snapshotPreview.prompts.worldPrompt = (assembler as any).extractWorldPrompt(world.doc || {});
          }

          // Load ruleset
          const { data: rulesetBinding } = await supabaseAdmin
            .from('entry_point_rulesets')
            .select('ruleset_id')
            .eq('entry_point_id', entityId)
            .order('sort_order', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (rulesetBinding) {
            const { data: ruleset } = await supabaseAdmin
              .from('rulesets')
              .select('doc')
              .eq('id', rulesetBinding.ruleset_id)
              .single();

            if (ruleset) {
              snapshotPreview.prompts.rulesetPrompt = (assembler as any).extractRulesetPrompt(ruleset.doc || {});
            }
          }

          // Extract story prompt
          const entryDoc = entryPoint.doc || entryPoint.content?.doc || {};
          snapshotPreview.prompts.storyPrompt = entryDoc.prompt?.text ||
            entryDoc.prompt ||
            entryPoint.content?.prompt?.text ||
            `# Entry: ${entryPoint.slug}\n\nBegin your adventure here.`;
        }
      } else if (entityType === 'world') {
        const { data: world } = await supabaseAdmin
          .from('worlds')
          .select('id, doc')
          .eq('id', entityId)
          .single();

        if (world) {
          snapshotPreview.prompts.worldPrompt = (assembler as any).extractWorldPrompt(world.doc || {});
        }
      }

      // Get gallery media IDs
      if (galleryLinks) {
        const mediaIds = galleryLinks.map((link: any) => link.media_id);
        const { data: galleryMedia } = await supabaseAdmin
          .from('media_assets')
          .select('id, status, image_review_status')
          .in('id', mediaIds);

        if (galleryMedia) {
          snapshotPreview.galleryMediaIds = galleryMedia
            .filter((media: any) => media.status === 'ready' && media.image_review_status === 'approved')
            .map((media: any) => media.id);
        }
      }
    } catch (error) {
      console.error('[publishing-wizard] Error generating snapshot preview:', error);
      warnings.push('Failed to generate snapshot preview');
    }
  }

  return {
    ok: blockers.length === 0,
    blockers,
    blockerCodes, // Refinement: Canonical error codes for frontend mapping
    warnings,
    warningCodes, // Refinement: Canonical warning codes
    media: {
      hasCover,
      coverApproved,
      galleryAllApproved,
      unapprovedGalleryCount,
    },
    dependencies: {
      missingRuleset,
      missingWorld,
      invalidRefs,
    },
    validation: {
      fieldsMissing,
      fieldsInvalid,
    },
    snapshotPreview,
  };
}

