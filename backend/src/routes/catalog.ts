import { Router, type Request, type Response } from "express";
import { sendSuccess, sendErrorWithStatus } from "../utils/response.js";
import { ApiErrorCode } from "@shared";
import { ContentService } from "../services/content.service.js";
import { supabase, supabaseAdmin } from "../services/supabase.js";
import { z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";
import { config } from "../config/index.js";

import { WorldContentReadService } from "../services/content/world-content-read.service.js";
import {
  WorldReadQuerySchema,
  WorldReadIdSchema,
} from "../../../shared/src/types/chimera-world-read.js";
import { ServiceError } from "../utils/serviceError.js";
import { sendError, getTraceId } from "../utils/response.js";

import { StoryContentReadService } from "../services/content/story-content-read.service.js";
import {
  StoryReadQuerySchema,
  StoryReadIdSchema,
} from "../../../shared/src/types/chimera-story-read.js";

const router = Router();
async function publicStoryRead(
  req: Request,
  res: Response,
  action: (service: StoryContentReadService) => Promise<unknown>,
): Promise<void> {
  try {
    sendSuccess(
      res,
      await action(
        StoryContentReadService.forRequest(undefined, getTraceId(req)),
      ),
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
        "Invalid story read request",
        req,
        422,
      );
    console.error(
      JSON.stringify({
        level: "error",
        event: "story_read_route_failed",
        traceId: getTraceId(req),
      }),
    );
    sendError(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      "Story content is temporarily unavailable.",
      req,
      503,
    );
  }
}

async function publicWorldRead(
  req: Request,
  res: Response,
  action: (service: WorldContentReadService) => Promise<unknown>,
): Promise<void> {
  try {
    const service = WorldContentReadService.forRequest(
      undefined,
      getTraceId(req),
    );
    sendSuccess(res, await action(service), req);
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
        "Invalid world read request",
        req,
        422,
      );
    console.error(
      JSON.stringify({
        level: "error",
        event: "public_world_read_route_failed",
        traceId: getTraceId(req),
      }),
    );
    sendError(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      "World content is temporarily unavailable.",
      req,
      503,
    );
  }
}

/**
 * Check if Chimera V2 is enabled via feature flag
 * When enabled, legacy routes should return empty responses to force frontend migration
 */
function isChimeraV2Enabled(): boolean {
  return config.admin.enableChimeraUi === true;
}

type WorldVisibilityAwareResult<T> = {
  data: T | null;
  error: PostgrestError | null;
  count?: number | null;
};

type WorldVisibilityAwareExecutor<T> = (
  includeVisibilityColumn: boolean,
) => Promise<WorldVisibilityAwareResult<T>>;

const WORLD_VISIBILITY_ERROR_REGEX = /worlds(?:_\d+)?\.visibility/i;
let worldVisibilityColumnAvailable: boolean | null = null;
let worldVisibilityFallbackLogged = false;

const isWorldVisibilityColumnError = (error?: PostgrestError | null) => {
  if (!error) {
    return false;
  }

  if (error.code !== "42703") {
    return false;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return WORLD_VISIBILITY_ERROR_REGEX.test(message);
};

const logWorldVisibilityFallbackWarning = () => {
  if (worldVisibilityFallbackLogged) {
    return;
  }

  worldVisibilityFallbackLogged = true;
  console.warn(
    "[catalog] Missing worlds.visibility column; applying review_state-only fallback. Run Phase 0 publishing migration to restore full gating.",
  );
};

const executeWithWorldVisibilityFallback = async <T>(
  executor: WorldVisibilityAwareExecutor<T>,
): Promise<WorldVisibilityAwareResult<T>> => {
  const includeVisibilityColumn = worldVisibilityColumnAvailable !== false;
  let response = await executor(includeVisibilityColumn);

  if (
    response.error &&
    includeVisibilityColumn &&
    isWorldVisibilityColumnError(response.error)
  ) {
    worldVisibilityColumnAvailable = false;
    logWorldVisibilityFallbackWarning();
    response = await executor(false);
  } else if (
    !response.error &&
    worldVisibilityColumnAvailable === null &&
    includeVisibilityColumn
  ) {
    worldVisibilityColumnAvailable = true;
  }

  return response;
};

const buildWorldRelationshipSelect = (
  includeVisibilityColumn: boolean,
  extraFields: string[] = ["name"],
) => {
  const fields = new Set<string>([...extraFields, "review_state"]);
  if (includeVisibilityColumn) {
    fields.add("visibility");
  }
  return `worlds:world_id (${Array.from(fields).join(", ")})`;
};

const extractWorldRecord = (worldField: any) =>
  Array.isArray(worldField) ? worldField[0] : worldField;

const isWorldPublicAndApproved = (world: any) => {
  if (!world) {
    return false;
  }

  if (worldVisibilityColumnAvailable === false) {
    return world.review_state === "approved";
  }

  return world.visibility === "public" && world.review_state === "approved";
};

// Public catalog always uses the published audience, including requests bearing an admin token.
router.get("/worlds", (req: Request, res: Response) =>
  publicWorldRead(req, res, (service) =>
    service.catalogList(WorldReadQuerySchema.parse(req.query)),
  ),
);
router.get("/worlds/:idOrSlug", (req: Request, res: Response) =>
  publicWorldRead(req, res, (service) =>
    service.catalogFind(WorldReadIdSchema.parse(req.params.idOrSlug)),
  ),
);

// GET /api/catalog/stories (unified - mirrors entry-points)
// Phase 4.10: Standardized - search support via query parameter
router.get("/stories", (req: Request, res: Response) =>
  publicStoryRead(req, res, (service) =>
    service.catalogList(StoryReadQuerySchema.parse(req.query)),
  ),
);
router.get("/stories/:idOrSlug", (req: Request, res: Response) =>
  publicStoryRead(req, res, (service) =>
    service.catalogFind(StoryReadIdSchema.parse(req.params.idOrSlug)),
  ),
);

// Schema for NPCs query parameters
// Phase 4.10: Support both 'q' and 'search' for consistency
const NPCsQuerySchema = z.object({
  q: z.string().optional(),
  search: z.string().optional(), // Alias for 'q' for consistency
  world: z.string().uuid().optional(),
  activeOnly: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((val) => val === "1" || val === "true"),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0)),
});

// GET /api/catalog/npcs
router.get("/npcs", async (req: Request, res: Response) => {
  try {
    const queryValidation = NPCsQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.VALIDATION_FAILED,
        "Invalid query parameters",
        req,
        queryValidation.error.errors,
      );
    }

    const filters = queryValidation.data;

    const limit = Math.min(filters.limit || 20, 100);
    const offset = filters.offset || 0;

    // Phase 4.3: Use chimera_entities instead of deleted npcs table
    let query = supabaseAdmin
      .from("chimera_entities")
      .select(
        "id, slug, entity_type, owner_user_id, visibility, world_id, display_name, primary_image_url, raw_data, created_at, updated_at",
        { count: "exact" },
      )
      .eq("entity_type", "NPC") // Only NPCs
      .eq("visibility", "public"); // Only public entities

    // Filter by world_id if provided (world_id is in raw_data JSONB)
    if (filters.world) {
      // Note: JSONB filtering - world_id is stored in raw_data
      // We'll filter client-side for now, or use a more complex query
      // For now, fetch all and filter client-side
    }

    // Apply search query (will filter client-side from raw_data)
    // Note: For production, consider adding a GIN index on raw_data and using JSONB operators

    query = query.order("created_at", { ascending: false });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[catalog/npcs] Supabase query error:", error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        "Failed to fetch NPCs",
        req,
      );
    }

    // Phase 4.3: Extract data from raw_data JSONB and transform to catalog DTO
    let npcs = (data || []).map((entity: any) => {
      const rawData = entity.raw_data || {};
      const displayName =
        entity.display_name ||
        rawData.display_name ||
        rawData.name ||
        entity.slug;
      const description =
        rawData.description_short || rawData.description || "";
      const worldId = entity.world_id || rawData.world_id || null;

      // Extract images from raw_data if available
      const images = rawData.images || [];
      const coverImage = images.length > 0 ? images[0] : null;

      return {
        id: entity.id,
        name: displayName,
        slug: entity.slug,
        description: description,
        worldId: worldId,
        status: "active", // Chimera entities are always active
        visibility: entity.visibility,
        archetype: rawData.archetype || null,
        roleTags: rawData.role_tags || rawData.tags || [],
        portraitUrl: rawData.portrait_url || entity.primary_image_url || null,
        cover_media: coverImage
          ? {
              id: coverImage.id || null,
              provider_key: coverImage.url || coverImage.provider_key || null,
            }
          : null,
        doc: rawData || {},
        createdAt: entity.created_at,
        updatedAt: entity.updated_at,
      };
    });

    // Apply world filter if provided (client-side filter)
    if (filters.world) {
      npcs = npcs.filter((npc: any) => npc.worldId === filters.world);
    }

    // Phase 4.10: Apply search query if provided (client-side filter)
    // Support both 'q' and 'search' parameters
    const searchTerm = filters.q || filters.search;
    if (searchTerm) {
      const queryLower = searchTerm.toLowerCase();
      npcs = npcs.filter(
        (npc: any) =>
          npc.name.toLowerCase().includes(queryLower) ||
          npc.description.toLowerCase().includes(queryLower) ||
          (npc.roleTags || []).some((tag: string) =>
            tag.toLowerCase().includes(queryLower),
          ),
      );
    }

    sendSuccess(
      res,
      {
        items: npcs,
        total: count || 0,
        limit,
        offset,
      },
      req,
    );
  } catch (error) {
    console.error("[catalog/npcs] Error:", error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      "Failed to fetch NPCs",
      req,
    );
  }
});

// GET /api/catalog/npcs/:id
router.get("/npcs/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Phase 4.3: Use chimera_entities instead of deleted npcs table
    let entityQuery = supabaseAdmin
      .from("chimera_entities")
      .select(
        "id, slug, entity_type, owner_user_id, visibility, world_id, display_name, primary_image_url, raw_data, created_at, updated_at",
      )
      .eq("entity_type", "NPC")
      .eq("visibility", "public");

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    entityQuery = uuidPattern.test(id)
      ? entityQuery.eq("id", id)
      : entityQuery.eq("slug", id);

    const { data: entity, error } = await entityQuery.single();

    if (error) {
      if (error.code === "PGRST116") {
        return sendErrorWithStatus(
          res,
          ApiErrorCode.NOT_FOUND,
          "NPC not found",
          req,
        );
      }
      console.error("[catalog/npcs/:id] Supabase query error:", error);
      return sendErrorWithStatus(
        res,
        ApiErrorCode.INTERNAL_ERROR,
        "Failed to fetch NPC",
        req,
      );
    }

    if (!entity) {
      return sendErrorWithStatus(
        res,
        ApiErrorCode.NOT_FOUND,
        "NPC not found",
        req,
      );
    }

    // Phase 4.3: Extract data from raw_data JSONB
    const rawData = entity.raw_data || {};
    const displayName =
      entity.display_name ||
      rawData.display_name ||
      rawData.name ||
      entity.slug;
    const description = rawData.description_short || rawData.description || "";
    const worldId = entity.world_id || rawData.world_id || null;

    // Extract images from raw_data if available
    const images = rawData.images || [];
    const coverImage = images.length > 0 ? images[0] : null;

    const npcDto = {
      id: entity.id,
      name: displayName,
      slug: entity.slug,
      description: description,
      worldId: worldId,
      status: "active", // Chimera entities are always active
      visibility: entity.visibility,
      archetype: rawData.archetype || null,
      roleTags: rawData.role_tags || rawData.tags || [],
      portraitUrl: rawData.portrait_url || entity.primary_image_url || null,
      cover_media: coverImage
        ? {
            id: coverImage.id || null,
            provider_key: coverImage.url || coverImage.provider_key || null,
          }
        : null,
      doc: rawData || {},
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };

    sendSuccess(res, npcDto, req);
  } catch (error) {
    console.error("[catalog/npcs/:id] Error:", error);
    sendErrorWithStatus(
      res,
      ApiErrorCode.INTERNAL_ERROR,
      "Failed to fetch NPC",
      req,
    );
  }
});

// GET /api/catalog/rulesets — placeholder
router.get("/rulesets", async (req: Request, res: Response) => {
  sendSuccess(res, [], req);
});

// GET /api/catalog/rulesets/:id — placeholder
router.get("/rulesets/:id", async (req: Request, res: Response) => {
  return sendErrorWithStatus(
    res,
    ApiErrorCode.NOT_FOUND,
    "Ruleset not found",
    req,
  );
});

// ============================================================================
// UNIFIED CATALOG - ENTRY POINTS (New)
// ============================================================================

const ListQuerySchema = z.object({
  // Filters
  world: z.string().uuid().optional(),
  q: z.string().optional(),
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => (val ? (Array.isArray(val) ? val : [val]) : undefined)),
  rating: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => (val ? (Array.isArray(val) ? val : [val]) : undefined)),
  visibility: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => (val ? (Array.isArray(val) ? val : [val]) : undefined)),
  activeOnly: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((val) =>
      val === undefined ? true : val === "1" || val === "true",
    ),
  playableOnly: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((val) =>
      val === undefined ? true : val === "1" || val === "true",
    ),

  // Sorting
  sort: z
    .enum(["-updated", "-created", "-popularity", "alpha", "custom"])
    .optional()
    .default("-updated"),

  // Pagination
  limit: z
    .string()
    .optional()
    .transform((val) => {
      const num = val ? parseInt(val, 10) : 20;
      return Math.min(Math.max(num, 1), 100);
    }),
  offset: z
    .string()
    .optional()
    .transform((val) => {
      const num = val ? parseInt(val, 10) : 0;
      return Math.max(num, 0);
    }),
});

function computeIsPlayable(row: any): boolean {
  if (row.lifecycle !== "active") return false;
  if (row.visibility === "private") return false;
  if (
    !row.prompt ||
    (typeof row.prompt === "object" && Object.keys(row.prompt).length === 0)
  ) {
    return false;
  }
  // entry_id column was removed - entry_points.id is now the primary identifier
  if (!row.id) return false;
  return true;
}

function computeHasPrompt(row: any): boolean {
  return (
    row.prompt &&
    (typeof row.prompt !== "object" || Object.keys(row.prompt).length > 0)
  );
}

function transformToCatalogDTO(row: any, includeDetail = false): any {
  const dto: any = {
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.name,
    subtitle: null,
    description: row.description || row.synopsis || "No description available",
    synopsis: row.synopsis || null,
    tags: row.tags || [],
    world_id: row.world_id || null,
    world_name: row.world_name || null,
    world_slug: row.world_slug || null,
    content_rating: row.content_rating,
    is_playable: computeIsPlayable(row),
    has_prompt: computeHasPrompt(row),
    // Phase 4: Include cover media if available
    cover_media: row.cover_media || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  if (includeDetail) {
    dto.hero_quote = row.prompt?.hero_quote || null;
    dto.rulesets = row.rulesets || [];
  }

  return dto;
}

function buildSortClause(sort: string): { column: string; ascending: boolean } {
  switch (sort) {
    case "-created":
      return { column: "created_at", ascending: false };
    case "-popularity":
      // Note: popularity_score doesn't exist yet in schema
      return { column: "updated_at", ascending: false };
    case "alpha":
      return { column: "title", ascending: true };
    case "custom":
      // Note: sort_weight doesn't exist yet in schema
      return { column: "updated_at", ascending: false };
    case "-updated":
    default:
      return { column: "updated_at", ascending: false };
  }
}

// GET /api/catalog/entry-points
router.get("/entry-points", async (req: Request, res: Response) => {
  try {
    const queryValidation = ListQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({
        ok: false,
        error: "Invalid query parameters",
        details: queryValidation.error.errors,
      });
    }

    const filters = queryValidation.data;

    const sortConfig = buildSortClause(filters.sort);
    const from = filters.offset;
    const to = from + filters.limit - 1;

    const { data, error, count } = await executeWithWorldVisibilityFallback<
      any[]
    >((includeVisibility) => {
      const worldRelationship = buildWorldRelationshipSelect(includeVisibility);

      // Phase 4: Include cover_media_id (we'll fetch cover media separately to bypass RLS)
      let query = supabase.from("entry_points").select(
        `
        id,
        slug,
        type,
        name,
        description,
        synopsis,
        tags,
        world_id,
        ${worldRelationship},
        content_rating,
        lifecycle,
        visibility,
        publish_visibility,
        review_state,
        dependency_invalid,
        prompt,
        cover_media_id,
        created_at,
        updated_at
      `,
        { count: "exact" },
      );

      if (filters.activeOnly) {
        query = query.eq("lifecycle", "active");
      }

      if (filters.visibility) {
        query = query.in("visibility", filters.visibility);
      } else {
        query = query.eq("visibility", "public");
      }

      query = query.eq("review_state", "approved");
      query = query.eq("dependency_invalid", false);

      if (filters.world) {
        query = query.eq("world_id", filters.world);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.contains("tags", filters.tags);
      }

      if (filters.rating && filters.rating.length > 0) {
        query = query.in("content_rating", filters.rating);
      }

      if (filters.q) {
        query = query.or(
          `name.ilike.%${filters.q}%,description.ilike.%${filters.q}%,synopsis.ilike.%${filters.q}%`,
        );
      }

      query = query.order(sortConfig.column, {
        ascending: sortConfig.ascending,
      });
      query = query.range(from, to);

      return query;
    });

    if (error) {
      console.error("Supabase query error:", error);
      throw error;
    }

    // Fetch cover media separately for entry points that have cover_media_id
    // Use supabaseAdmin to bypass RLS for public media assets
    const coverMediaIds = (data || [])
      .filter((row: any) => row.cover_media_id)
      .map((row: any) => row.cover_media_id);

    let coverMediaMap: Record<string, any> = {};
    if (coverMediaIds.length > 0) {
      const { data: coverMediaData, error: coverError } = await supabaseAdmin
        .from("media_assets")
        .select("id, provider_key, status, image_review_status, visibility")
        .in("id", coverMediaIds);

      if (!coverError && coverMediaData) {
        coverMediaMap = coverMediaData.reduce(
          (acc: Record<string, any>, media: any) => {
            acc[media.id] = media;
            return acc;
          },
          {},
        );
      }
    }

    // Phase 2: Post-filter to ensure parent world is public+approved for story/npc
    let items = (data || [])
      .filter((row: any) => {
        const worldRecord = extractWorldRecord(row.worlds);
        if (row.world_id && worldRecord) {
          return isWorldPublicAndApproved(worldRecord);
        }
        return true;
      })
      .map((row: any) => {
        const { worlds, cover_media_id, ...restRow } = row;

        // Get cover media from the map we fetched separately
        const coverMedia = cover_media_id
          ? coverMediaMap[cover_media_id]
          : null;

        // For published entry points (visibility === 'public'), show cover if ready and approved
        const isPublishedEntryPoint = restRow.visibility === "public";
        const coverMediaData =
          coverMedia &&
          typeof coverMedia === "object" &&
          coverMedia.status === "ready" &&
          coverMedia.image_review_status === "approved" &&
          (isPublishedEntryPoint || coverMedia.visibility === "public")
            ? {
                id: coverMedia.id,
                provider_key: coverMedia.provider_key,
              }
            : null;

        const flatRow = {
          ...restRow,
          world_name: Array.isArray(worlds)
            ? worlds[0]?.name || null
            : worlds?.name || null,
          // Phase 4 refinement: UI only relies on cover_media, not cover_media_id
          cover_media: coverMediaData,
        };

        return transformToCatalogDTO(flatRow, false);
      });

    if (filters.playableOnly) {
      items = items.filter((item) => item.is_playable);
    }

    res.json({
      ok: true,
      data: items,
      meta: {
        total: count || 0,
        limit: filters.limit,
        offset: filters.offset,
        filters: {
          world: filters.world,
          q: filters.q,
          tags: filters.tags,
          rating: filters.rating,
          visibility: filters.visibility,
          activeOnly: filters.activeOnly,
          playableOnly: filters.playableOnly,
        },
        sort: filters.sort,
      },
    });
  } catch (error) {
    console.error("catalog.entry-points error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch entry points",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// GET /api/catalog/entry-points/:idOrSlug
router.get("/entry-points/:idOrSlug", async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;

    // Phase 4: Include cover_media_id (we'll fetch cover media separately to bypass RLS)
    const { data, error } = await supabase
      .from("entry_points")
      .select(
        `
        id,
        slug,
        type,
        name,
        description,
        synopsis,
        tags,
        world_id,
        worlds:world_id (name),
        content_rating,
        lifecycle,
        visibility,
        prompt,
        cover_media_id,
        created_at,
        updated_at
      `,
      )
      .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
      .limit(1)
      .single();

    if (error && error.code === "PGRST116") {
      return res.status(404).json({
        ok: false,
        error: "Entry point not found",
      });
    }

    if (error) {
      console.error("Supabase query error:", error);
      throw error;
    }

    const { data: rulesetsData, error: rulesetsError } = await supabase
      .from("entry_point_rulesets")
      .select(
        `
        rulesets:ruleset_id (id, name),
        sort_order
      `,
      )
      .eq("entry_point_id", data.id)
      .order("sort_order");

    if (rulesetsError) {
      console.error("Rulesets query error:", rulesetsError);
    }

    // Fetch cover media separately if it exists
    let coverMediaData = null;
    if (data.cover_media_id) {
      const { data: coverMedia, error: coverError } = await supabaseAdmin
        .from("media_assets")
        .select("id, provider_key, status, image_review_status, visibility")
        .eq("id", data.cover_media_id)
        .single();

      if (!coverError && coverMedia) {
        // For published entry points, show cover if ready and approved (even if cover visibility isn't public)
        const isPublishedEntryPoint = data.visibility === "public";
        if (
          coverMedia.status === "ready" &&
          coverMedia.image_review_status === "approved" &&
          (isPublishedEntryPoint || coverMedia.visibility === "public")
        ) {
          coverMediaData = {
            id: coverMedia.id,
            provider_key: coverMedia.provider_key,
          };
        }
      }
    }

    const { worlds, ...restData } = data;

    const flatRow = {
      ...restData,
      world_name: (worlds as any)?.[0]?.name || null,
      // Phase 4 refinement: UI only relies on cover_media, not cover_media_id
      cover_media: coverMediaData,
      rulesets: (rulesetsData || []).map((r: any) => ({
        id: r.rulesets?.id,
        name: r.rulesets?.name,
        sort_order: r.sort_order,
      })),
    };

    const dto = transformToCatalogDTO(flatRow, true);

    res.json({
      ok: true,
      data: dto,
    });
  } catch (error) {
    console.error("catalog.entry-point detail error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch entry point",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
