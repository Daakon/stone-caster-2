/**
 * @swagger
 * tags:
 *   - name: Chimera V2 Lore
 *     description: User-facing CRUD endpoints for Chimera lore entries (Pure RAG system)
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.unified.js";
import { validateRequest } from "../middleware/validation.js";
import { sendSuccess, sendErrorWithStatus } from "../utils/response.js";
import { ApiErrorCode } from "@shared";
import { supabaseAdmin } from "../services/supabase.js";
import type { ChimeraLoreEntry } from "@shared/types/chimera-lore.js";
import { LoreRepository } from "../db/repos/lore.repo.js";

import { LoreContentReadService } from "../services/content/lore-content-read.service.js";
import {
  LoreReadQuerySchema,
  LoreContextQuerySchema,
} from "../../../shared/src/types/chimera-lore-read.js";
import { EntityReadIdSchema } from "../../../shared/src/types/chimera-entity-read.js";
import { ServiceError } from "../utils/serviceError.js";
import { sendError, getTraceId } from "../utils/response.js";

async function loreRead(
  req: Request,
  res: Response,
  action: (service: LoreContentReadService) => Promise<unknown>,
): Promise<void> {
  try {
    sendSuccess(
      res,
      await action(LoreContentReadService.forRequest(req, getTraceId(req))),
      req,
    );
  } catch (error) {
    if (error instanceof ServiceError)
      return sendError(
        res,
        error.error.code,
        error.error.message,
        req,
        error.statusCode,
      );
    if (error instanceof z.ZodError)
      return sendError(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        "Invalid lore read request",
        req,
        422,
      );
    console.error(
      JSON.stringify({
        level: "error",
        event: "lore_read_route_failed",
        traceId: getTraceId(req),
      }),
    );
    sendError(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      "Lore content is temporarily unavailable.",
      req,
      503,
    );
  }
}
const router = Router();

// All routes require authentication
router.use(requireAuth);

// Zod schemas for validation
const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const CreateLoreEntrySchema = z
  .object({
    world_id: z.string().uuid().optional(),
    display_name: z.string().min(1).max(200),
    entry_text: z.string().min(1),
    keywords: z.array(z.string()).default([]),
    type: z.string().optional(),
    entity_id: z.string().uuid().optional(),
    story_id: z.string().uuid().optional(),
    tag_names: z.array(z.string()).optional(), // Keep for backward compat, but keywords preferred
  })
  .refine((data) => data.world_id || data.entity_id || data.story_id, {
    message:
      "At least one of world_id, entity_id, or story_id must be provided",
  });

const UpdateLoreEntrySchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  entry_text: z.string().min(1).optional(),
  keywords: z.array(z.string()).optional(),
  type: z.string().optional(),
  tag_names: z.array(z.string()).optional(),
});

// Helper function to normalize tag names
function normalizeTagName(tagName: string): string {
  return tagName
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

/**
 * POST /api/v2/chimera/lore
 * Create a new lore entry (V2)
 */
router.post(
  "/",
  validateRequest(CreateLoreEntrySchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          "Authentication required",
          req,
        );
      }

      const {
        display_name,
        entry_text,
        keywords,
        type,
        tag_names,
        entity_id,
        story_id,
      } = req.body;
      let { world_id } = req.body;

      // RESOLVE CONTEXT AND WORLD ID
      // Priority: Entity > Story > World (Specific to General)

      if (entity_id) {
        // Case 1: Entity Context
        const { data: entity, error: entityError } = await supabaseAdmin
          .from("chimera_entities")
          .select("world_id, owner_user_id")
          .eq("id", entity_id)
          .single();

        if (entityError || !entity) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            "Entity not found",
            req,
          );
        }
        if (entity.owner_user_id !== userId) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.FORBIDDEN,
            "You do not have permission to add lore to this entity",
            req,
          );
        }

        // Infer world_id from entity
        world_id = entity.world_id;
      } else if (story_id) {
        // Case 2: Story Context
        const { data: story, error: storyError } = await supabaseAdmin
          .from("chimera_stories")
          .select("world_id, owner_user_id")
          .eq("id", story_id)
          .single();

        if (storyError || !story) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            "Story not found",
            req,
          );
        }
        if (story.owner_user_id !== userId) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.FORBIDDEN,
            "You do not have permission to add lore to this story",
            req,
          );
        }

        // Infer world_id from story
        world_id = story.world_id;
      } else if (world_id) {
        // Case 3: World Context (General Lore)
        const { data: world, error: worldError } = await supabaseAdmin
          .from("chimera_worlds")
          .select("owner_user_id")
          .eq("id", world_id)
          .single();

        if (worldError || !world) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.NOT_FOUND,
            "World not found",
            req,
          );
        }
        if (world.owner_user_id !== userId) {
          return sendErrorWithStatus(
            res,
            ApiErrorCode.FORBIDDEN,
            "You do not have permission to add lore to this world",
            req,
          );
        }
      } else {
        // Should be caught by Zod refine, but double check
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          "Validation Error: No context provided",
          req,
        );
      }

      // Create the lore entry using Repository
      const repo = new LoreRepository(supabaseAdmin);
      const loreEntry = await repo.createV2(
        world_id,
        { display_name, entry_text, keywords, type, entity_id, story_id },
        userId,
      );

      // Handle legacy tags if provided
      if (tag_names && tag_names.length > 0) {
        const tagIds: string[] = [];
        for (const tagName of tag_names) {
          const normalized = normalizeTagName(tagName);
          if (!normalized) continue;

          // Check/Create tag
          let { data: existingTag } = await supabaseAdmin
            .from("chimera_tags")
            .select("id")
            .eq("tag_name", normalized)
            .single();

          let tagId: string;
          if (existingTag) {
            tagId = existingTag.id;
          } else {
            const { data: newTag } = await supabaseAdmin
              .from("chimera_tags")
              .insert({ tag_name: normalized, is_approved: false })
              .select("id")
              .single();
            if (newTag) tagId = newTag.id;
            else continue;
          }
          tagIds.push(tagId);
        }

        if (tagIds.length > 0) {
          await supabaseAdmin.from("chimera_asset_tags").insert(
            tagIds.map((tagId) => ({
              tag_id: tagId,
              asset_id: loreEntry.id,
              asset_type: "lore_entry",
            })),
          );
        }
      }

      // Return consistent format
      const fragment = loreEntry.fragment || {};
      const response = {
        ...loreEntry,
        display_name: fragment.display_name,
        entry_text: fragment.entry_text,
        type: fragment.type,
      };

      return sendSuccess(res, response, req);
    } catch (error) {
      console.error("[Chimera Lore] Error creating lore entry:", error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        error instanceof Error ? error.message : "Failed to create lore entry",
        req,
      );
    }
  },
);

/**
 * GET /api/v2/chimera/lore/my-creations
 * Get all lore entries owned by the current user
 */
router.get("/my-creations", (req: Request, res: Response) =>
  loreRead(req, res, (service) =>
    service.list(LoreReadQuerySchema.parse(req.query)),
  ),
);

/**
 * GET /api/v2/chimera/lore/tags
 * Get all approved tags (for use in tag selectors)
 */
router.get("/tags", async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        "Authentication required",
        req,
      );
    }

    // Fetch all approved tags
    const { data: tags, error: tagsError } = await supabaseAdmin
      .from("chimera_tags")
      .select("id, tag_name, is_approved")
      .eq("is_approved", true)
      .order("tag_name", { ascending: true });

    if (tagsError) {
      console.error("[Chimera Lore] Error fetching tags:", tagsError);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        "Failed to fetch tags",
        req,
      );
    }

    return sendSuccess(res, tags || [], req);
  } catch (error) {
    console.error("[Chimera Lore] Unexpected error:", error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      "Internal server error",
      req,
    );
  }
});

router.get("/:id", (req: Request, res: Response) =>
  loreRead(req, res, (service) =>
    service.find(EntityReadIdSchema.parse(req.params.id)),
  ),
);
router.get("/", (req: Request, res: Response) =>
  loreRead(req, res, (service) =>
    service.listContext(LoreContextQuerySchema.parse(req.query)),
  ),
);

/**
 * PUT /api/v2/chimera/lore/:id
 * Update a lore entry
 */
router.put(
  "/:id",
  validateRequest(UpdateLoreEntrySchema),
  async (req: Request, res: Response) => {
    try {
      const userId = req.ctx?.userId;
      if (!userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.UNAUTHORIZED,
          "Authentication required",
          req,
        );
      }

      // Validate UUID param
      const paramResult = UuidParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.VALIDATION_FAILED,
          "Invalid lore entry ID",
          req,
        );
      }

      const { id } = paramResult.data;
      const updateData = req.body;
      const { tag_names, keywords, type, ...otherUpdateData } = updateData;

      // Fetch the lore entry to verify ownership
      const { data: loreEntry, error: fetchError } = await supabaseAdmin
        .from("chimera_lore")
        .select("world_id, fragment, owner_user_id")
        .eq("id", id)
        .single();

      if (fetchError || !loreEntry) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          "Lore entry not found",
          req,
        );
      }

      // Check world ownership and lifecycle state
      const { data: world, error: worldError } = await supabaseAdmin
        .from("chimera_worlds")
        .select("owner_user_id, visibility")
        .eq("id", loreEntry.world_id)
        .single();

      if (worldError || !world || world.owner_user_id !== userId) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          "You do not have permission to update this lore entry",
          req,
        );
      }

      // Lifecycle enforcement: Cannot edit lore for published worlds
      if (world.visibility === "public" && !updateData.visibility) {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.FORBIDDEN,
          "Cannot edit lore for published worlds. Please clone to create a new version.",
          req,
        );
      }

      // Update the lore entry
      const updatePayload: Partial<ChimeraLoreEntry> = {
        updated_at: new Date().toISOString(),
      };

      if (keywords !== undefined) {
        updatePayload.keywords = keywords;
      }

      // We need to merge fragment updates because it's JSONB
      // First fetch existing fragment
      const existingFragment = loreEntry.fragment || {};
      const newFragment = { ...existingFragment };
      let fragmentChanged = false;

      if (otherUpdateData.display_name !== undefined) {
        newFragment.display_name = otherUpdateData.display_name;
        fragmentChanged = true;
      }
      if (otherUpdateData.entry_text !== undefined) {
        newFragment.entry_text = otherUpdateData.entry_text;
        fragmentChanged = true;
      }
      if (type !== undefined) {
        newFragment.type = type;
        fragmentChanged = true;
      }

      if (fragmentChanged) {
        newFragment.updated_at = new Date().toISOString();
        updatePayload.fragment = newFragment;
      }

      const { data: updatedEntry, error: updateError } = await supabaseAdmin
        .from("chimera_lore")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        console.error("[Chimera Lore] Error updating lore entry:", updateError);
        return sendErrorWithStatus(
          res,
          ApiErrorCode.INTERNAL_ERROR,
          "Failed to update lore entry",
          req,
        );
      }

      // Handle tags if provided
      if (tag_names !== undefined) {
        // Delete existing tag links
        await supabaseAdmin
          .from("chimera_asset_tags")
          .delete()
          .eq("asset_id", id)
          .eq("asset_type", "lore_entry");

        // Create new tag links
        if (tag_names.length > 0) {
          const tagIds: string[] = [];

          for (const tagName of tag_names) {
            const normalized = normalizeTagName(tagName);
            if (!normalized) continue;

            // Check if tag exists
            const { data: existingTag, error: checkError } = await supabaseAdmin
              .from("chimera_tags")
              .select("id")
              .eq("tag_name", normalized)
              .single();

            let tagId: string;

            // PGRST116 is "not found" which is expected if tag doesn't exist
            if (checkError && checkError.code !== "PGRST116") {
              console.error(
                "[Chimera Lore] Error checking existing tag:",
                checkError,
              );
              continue;
            }

            if (existingTag) {
              tagId = existingTag.id;
            } else {
              // Create new tag (unapproved)
              const { data: newTag, error: tagError } = await supabaseAdmin
                .from("chimera_tags")
                .insert({
                  tag_name: normalized,
                  is_approved: false,
                })
                .select("id")
                .single();

              if (tagError) {
                console.error("[Chimera Lore] Error creating tag:", tagError);
                continue;
              }

              if (!newTag || !newTag.id) {
                console.error("[Chimera Lore] Tag created but no ID returned");
                continue;
              }

              tagId = newTag.id;
            }

            tagIds.push(tagId);
          }

          // Create asset tag links
          if (tagIds.length > 0) {
            const assetTagLinks = tagIds.map((tagId) => ({
              tag_id: tagId,
              asset_id: id,
              asset_type: "lore_entry",
            }));

            const { error: linksError } = await supabaseAdmin
              .from("chimera_asset_tags")
              .insert(assetTagLinks);

            if (linksError) {
              console.error(
                "[Chimera Lore] Error creating tag links:",
                linksError,
              );
              // Continue anyway - lore entry is updated, tags can be fixed later
            }
          }
        }
      }

      // Fetch tags for response
      const { data: assetTags } = await supabaseAdmin
        .from("chimera_asset_tags")
        .select(
          `
          tag:chimera_tags!tag_id(id, tag_name)
        `,
        )
        .eq("asset_id", id)
        .eq("asset_type", "lore_entry");

      if (assetTags && updatedEntry) {
        (updatedEntry as any).tags = assetTags
          .map((link: any) => link.tag)
          .filter((tag: any) => tag !== null);
      }

      return sendSuccess(res, updatedEntry as ChimeraLoreEntry, req);
    } catch (error) {
      console.error("[Chimera Lore] Unexpected error:", error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        "Internal server error",
        req,
      );
    }
  },
);

/**
 * DELETE /api/v2/chimera/lore/:id
 * Delete a lore entry
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.ctx?.userId;
    if (!userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.UNAUTHORIZED,
        "Authentication required",
        req,
      );
    }

    // Validate UUID param
    const paramResult = UuidParamSchema.safeParse(req.params);
    if (!paramResult.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        "Invalid lore entry ID",
        req,
      );
    }

    const { id } = paramResult.data;

    // Fetch the lore entry to verify ownership
    const { data: loreEntry, error: fetchError } = await supabaseAdmin
      .from("chimera_lore")
      .select("world_id")
      .eq("id", id)
      .single();

    if (fetchError || !loreEntry) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        "Lore entry not found",
        req,
      );
    }

    // Check world ownership
    const { data: world, error: worldError } = await supabaseAdmin
      .from("chimera_worlds")
      .select("owner_user_id")
      .eq("id", loreEntry.world_id)
      .single();

    if (worldError || !world || world.owner_user_id !== userId) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.FORBIDDEN,
        "You do not have permission to delete this lore entry",
        req,
      );
    }

    // Delete the lore entry
    const { error: deleteError } = await supabaseAdmin
      .from("chimera_lore")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("[Chimera Lore] Error deleting lore entry:", deleteError);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        "Failed to delete lore entry",
        req,
      );
    }

    return sendSuccess(res, { id, deleted: true }, req);
  } catch (error) {
    console.error("[Chimera Lore] Unexpected error:", error);
    return sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      "Internal server error",
      req,
    );
  }
});

export default router;
