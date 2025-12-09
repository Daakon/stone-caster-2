# StoneCaster API Endpoints by Domain

StoneCaster's Express server (see backend/src/index.ts) mounts every API router under /api plus a small set of root helper endpoints. Unless noted, handlers call sendSuccess/sendErrorWithStatus, so payloads follow the shared ApiSuccessResponse<T> / ApiErrorResponse envelope defined in @shared/types/api.ts (with meta.traceId). DTO definitions referenced below live in shared/src/types (dto.ts, catalog.ts, and the chimera-* modules).

## Envelope & Shared DTOs
- ApiSuccessResponse<T> wraps {ok:true, data:T, meta:{traceId,version?}}; ApiErrorResponse wraps {ok:false, error:{code:ApiErrorCode,message,details?}, meta:{traceId}}.
- Player-facing DTOs (profile, characters, games, turns, etc.) are in @shared/types/dto.
- Catalog DTOs (CatalogNpc, CatalogNpcDetail, CatalogWorldMini) live in @shared/types/catalog.
- Chimera authoring/runtime shapes (WorldDefinition, RulesetDefinition, EntityTemplate, LoreFragment, ChimeraAssetRef, compiled-story types, etc.) live in @shared/types/chimera-*.
- Debug-only endpoints called out below return raw JSON emitted directly from their services.

## Identity & Session (/api/me)
- GET /api/me - Optional Supabase session handled by optionalAuth. Returns either {kind:'guest', user:null, config:{enableChimeraUi}} or {kind:'user', user:{id,email?,role?,roleVersion}, config:{...}}. Authenticated responses set x-role/x-role-version headers for downstream caches.

## Authentication (/api/auth)
- POST /api/auth/magic/start - Body MagicLinkStartSchema {email}. Sends a Supabase magic-link and returns {message}.
- POST /api/auth/magic/verify - Body MagicLinkVerifySchema {email, token, guestCookieId}. Verifies the OTP, links the guest cookie via AuthCallbackService, and returns {user:{id,email,isGuest:false}, message}.
- GET /api/auth/oauth/:provider/start - Path provider - {'google','github','discord'}; query validated by OAuthStartSchema (guestCookieId?, destination ('web'|'api')). Returns {url, state} for the client to redirect to Supabase.
- GET /api/auth/oauth/:provider/callback - Query {code, state}. Exchanges the Supabase session, links the guest cookie embedded in state, then redirects to ${config.web.baseUrl}/auth/success (302). Failures redirect to /auth/error with a message.
- POST /api/auth/logout - Signs out the Supabase session and returns {message}.

## Profile & Guest Management (/api/profile)
Router-level 
equireAuth applies to all routes except /guest* and /link-guest.
- GET /api/profile/access - Returns {canAccess, isGuest, userId, requiresAuth} for feature-gating.
- GET /api/profile - Returns ProfileDTO via ProfileService.getProfile.
- PUT /api/profile - Body UpdateProfileRequestSchema (optional displayName, avatarUrl, preferences (showTips/theme/notifications), creatorSlug, publicBio, profileImageUrl, websiteUrl). Rate-limited (10/min) and optionally requires x-csrf-token. Returns the updated ProfileDTO.
- POST /api/profile/revoke-sessions - Body RevokeSessionsRequestSchema {csrfToken} plus optional X-Session-Id. Returns {revokedCount, currentSessionPreserved}.
- POST /api/profile/csrf-token - Returns {csrfToken} for subsequent CSRF-protected calls.
- GET /api/profile/guest/:cookieId - Returns {cookieId, groupId, deviceLabel?, lastSeen, createdAt} for a guest device.
- POST /api/profile/guest - Body {cookieId, deviceLabel?} creates a guest profile and returns the same DTO.
- GET /api/profile/guest-summary/:cookieGroupId - Returns {cookieGroupId, deviceLabel?, createdAt, lastSeen, characterCount, gameCount, stoneBalance, hasData} to preview data before linking.
- POST /api/profile/link-guest - Body {cookieGroupId} (rate-limited). Returns {success:true, alreadyLinked:boolean, message, migrationSummary:{charactersMigrated, gamesMigrated, stonesMigrated, ledgerEntriesCreated}}.

## Early Access Requests (/api/request-access, /api/admin/access-requests)
- POST /api/request-access - Body publicRequestSchema {email, note?, newsletter?, honeypot?}. Rate-limited per IP/email. Returns {id, status:'pending', message}.
- GET /api/request-access/status - Uses optionalAuth to look up the latest request by user_id or profile email. Returns {request: AccessRequest|null} (matches the OpenAPI schema).
- GET /api/admin/access-requests - Admin-only. Query adminListSchema (status?, q?, page, limit, orderBy, order). Returns {meta:{page, limit, total, hasMore, status?, q?}, data: AccessRequest[]}.
- POST /api/admin/access-requests/:id/approve - Optional body approveRequestSchema {note?}. Returns {requestId, userId?, roleUpdated:boolean, roleVersion?} (roles updated in profiles.role/role_version).
- POST /api/admin/access-requests/:id/deny - Body denyRequestSchema {reason}. Returns {requestId}.

## Catalog & Discovery (/api/catalog)
### Worlds & Stories
- GET /api/catalog/worlds - Optional search query. Returns world summaries {id, name, slug, tagline, short_desc, hero_quote, status:'active', cover_media?, created_at, updated_at} derived from chimera_worlds.definition.
- GET /api/catalog/worlds/:idOrSlug - UUID or slug lookup; returns the same DTO.
- GET /api/catalog/stories - Optional search. Returns {ok:true, data:[{id, slug, type:'story', title, description, synopsis?, tags, world_id?, world_name?, world_slug?, content_rating?, is_playable:boolean, has_prompt:boolean, cover_media?, created_at, updated_at}], meta:{total, limit, offset, filters, sort}} built from compiled_stories JSONB.
- GET /api/catalog/stories/:idOrSlug - Looks up by story id or story_key and returns {ok:true, data:{...story..., rulesets: meta.active_rulesets}}.

### Legacy NPC Catalog (Chimera entity snapshot)
- GET /api/catalog/npcs - Query NPCsQuerySchema (q/search, world UUID, activeOnly, limit - 100, offset). Returns ApiSuccessResponse with an array {id, name, slug, description, worldId, status, visibility, archetype, roleTags, portraitUrl, cover_media?, doc, createdAt, updatedAt} sourced from chimera_entities.
- GET /api/catalog/npcs/:id - Returns a single NPC DTO with the same shape.
- GET /api/catalog/rulesets - Placeholder returning [].
- GET /api/catalog/rulesets/:id - Placeholder NOT_FOUND response (legacy route).

### NPC Catalog (RLS-aware, cached)
Mounted via catalogNpcsRouter and documented in backend/src/openapi/paths.catalogNpcs.ts.
- GET /api/catalog/npcs - Query listParamsSchema (q, world slug/UUID, page, pageSize - 50, sort, order). Returns CatalogNpcListResponse (meta + array of CatalogNpc) along with strong ETag, Last-Modified, and Cache-Control headers. Authenticated requests alter the cache key.
- GET /api/catalog/npcs/:idOrSlug - UUID or slug lookup. Returns CatalogNpcDetailResponse (ok:true,data:CatalogNpcDetail or {ok:false,code:'NPC_NOT_FOUND'}) with the same conditional headers.

## System Monitoring & Admin Ops
### Budget (/api/system/budget)
- GET /api/system/budget - Restricted to admin/moderator/viewer. Returns {ok:true, data:{worlds, npcs, rulesets, stories, legacy:{worlds,npcs,rulesets,scenarios}}} summarizing key tables.
- POST /api/system/budget/prompt-budget-report - Body {worldId, rulesetId, scenarioId?, npcIds?, templatesVersion?, moduleParamsOverrides?, extrasOverrides?, maxTokens?}. Returns {ok:true, data:{tokens:{before,after}, trims:[...], warnings:[], sections:[{key, tokensBefore, tokensAfter, trimmed}]}} describing the simulated prompt budget.

### Telemetry (/api/system/telemetry)
- GET /api/system/telemetry/summary - Query from/	o (defaults last 7 days) and storyId?. Returns {ok:true, data: getTelemetrySummary(...)} (aggregated token/latency metrics per story).
- GET /api/system/telemetry/timeseries - Query metric - {'tokens_after','latency_ms'}, bucket - {'hour','day'}, optional from,	o,storyId. Returns {ok:true, data: getTelemetryTimeseries(...)}.

### Health & Template Quality (/api/system/health)
- GET /api/system/health - Verifies DB connectivity via chimera_worlds. Returns {ok:true, data:{connected:boolean, timestamp}} or 500 on failure.
- GET /api/system/templates/health - Optional fromDate,	oDate,worldId,
ulesetId,storyId. Returns {ok:true, data:{missingSlots, templateChurn, orphanedTemplates, highTrimStories, oversizedSections, timeRange}} for template QA.

### Role Management (/api/system/roles)
- GET /api/system/roles - Query ListRolesQuerySchema (
ole?, q?, limit?, cursor?, page?, search?). Returns RoleListResponse (data:UserRole[], hasMore, nextCursor?). UserRole contains {id, user_id, role, roles[], is_verified_creator?, email?, user_name?, last_sign_in?, created_at, updated_at}.
- GET /api/system/roles/stats - Returns RoleStats (	otalUsers, creators, moderators, admins).
- POST /api/system/roles/:id/assign - Body {role:'creator'|'moderator'|'admin'}. Returns the updated UserRole.
- POST /api/system/roles/:id/remove - Body {role:'creator'|'moderator'|'admin'}. Resets the role (protects removing your own admin). Returns the updated UserRole.
- POST /api/system/roles/:id/toggle-verified - Body {is_verified:boolean}. Returns the updated UserRole with the is_verified_creator flag.
- GET /api/system/roles/search - Query q (?2 chars). Returns {ok:true, data: Array<{id, email, name?}>}.

### Internal Flags (/api/internal/flags)
- GET /api/internal/flags - Admin-only. Returns {EARLY_ACCESS_MODE:'on'|'off'} from config/featureFlags.

## Public Health Endpoints
- GET /health - Root endpoint (outside /api). Returns {status:'ok', timestamp, testTxEnabled:boolean} for load balancers.
- GET /api/health/ready - Returns {ok:boolean, status:'ready'|'not_ready'|'error', checks:{db:boolean, v3Only:boolean, cacheWarm:boolean}, timestamp} with HTTP 503 when unhealthy.
- GET /api/health/live - Returns {ok:true, status:'alive', timestamp}.

## Debug & Preview Tooling (feature-flagged)
### Core Debug Bus (/api/debug)
- GET /api/debug/stats - {ok:true, data: debugService.getDebugStats()}.
- GET /api/debug/game/:gameId - {ok:true, data: debugService.getGameDebugData(gameId)}.
- GET /api/debug/game/:gameId/turn/:turnIndex - {ok:true, data: debugService.getTurnDebugData(...)}.
- GET /api/debug/prompts / /responses / /state-changes - Return the recorded arrays from debugService.getAllDebugData().
- DELETE /api/debug/clear - {ok:true, message:'Debug data cleared'}.
- GET /api/debug/game-state/:gameId - {ok:true, data: gameState} or {ok:false, error:'Game state not found'} from gameStateService.

### Admin Preview (/api/admin/preview)
Enabled when DEBUG_ROUTES_ENABLED=true and a valid X-Debug-Token + admin role is provided.
- GET /api/admin/preview/entry-point/:entryPointId - Query PreviewQuerySchema (
ulesetSlug?, budget?, warnPct?, 
pcLimit?, includeNpcs?, entryStartSlug?, qa?). Returns {ok:true, data:{prompt, pieces, meta:{source:'entry-point', version:'v3', ...}, diagnostics}} with optional QA output and Cache-Control: no-store.

### Developer Debug (/api/dev/debug)
Feature-flagged + X-Debug-Token (and extra admin check for traces).
- GET /api/dev/debug/prompt-assembly - Query PromptAssemblyQuerySchema (entry_point_id, entry_start_slug?, model?, budget?). Returns {promptPreview, promptLength, pieces, meta} from EntryPointAssemblerV3.
- GET /api/dev/debug/game/:gameId/turns - Returns {gameId, turns:[{turn_number, role, created_at, meta?}], count}.
- GET /api/dev/debug/traces/:gameId - Requires admin user ID; optional limit. Returns {gameId, traces, count} from prompt-trace.service.
- GET /api/dev/debug/preview-prompt/:gameId - Query optionId?, fullPrompt?. Returns {prompt, promptLength, pieces, meta, gameInfo, optionId} showing the next-turn prompt.
- GET /api/dev/debug/cache-stats - Returns {ruleset: rulesetCache.getStats(), npc: npcListCache.getStats()}.

### Developer Test Helpers (/api/dev/test)
- POST /api/dev/test/seed-turns - Body SeedTurnsSchema {gameId:uuid, count:1..1000} and requires X-Test-Rollback: 1. Uses the per-request test transaction to insert turns (rolled back) and returns {gameId, inserted, message}.

## Chimera V2 Engine (/api/v2/chimera)
- GET /api/v2/chimera/health - Returns {status:'ok'}.

### Worlds (/api/v2/chimera/worlds)
CreateWorldSchema includes display_name, optional description_short/long, character_schema_contributions, 
uleset_template_ids[], 	ag_names[]/tags[], and images[] (ChimeraAssetRef).
- POST /api/v2/chimera/worlds - Creates a private world (owner = requester, visibility defaults to 'private'). Returns the persisted world transformed by 	ransformWorldForResponse.
- GET /api/v2/chimera/worlds/selectable - Returns worlds where owner_user_id=userId or visibility='public' (optional 	ag filter).
- GET /api/v2/chimera/worlds/my-creations - Lists worlds owned by the caller.
- GET /api/v2/chimera/worlds/pending - Lists pending-approval worlds (visible to admins/moderators).
- GET /api/v2/chimera/worlds/:id/rulesets - Returns ruleset templates linked to the world after verifying access.
- GET /api/v2/chimera/worlds/:id - Fetches a world by ID/slug (owner-only unless approved/public).
- PUT /api/v2/chimera/worlds/:id - Body UpdateWorldSchema (partial). Updates metadata, tags, and ruleset links. Returns the updated world.
- DELETE /api/v2/chimera/worlds/:id - Deletes an owner-owned world.

### Entities (/api/v2/chimera/entities)
CreateEntitySchema defines display_name, optional descriptions, entity_type ('NPC'|'ITEM'|'FACTION'|'LOCATION'), base_state_json, 	ag_names[], and images[].
- GET /api/v2/chimera/entities/selectable - Returns user-owned plus public entities suitable for the Casting Circle.
- GET /api/v2/chimera/entities - Lists entities where owner_user_id=userId.
- GET /api/v2/chimera/entities/pending - Lists pending entities for review (admin view).
- GET /api/v2/chimera/entities/my-creations - Alias for the owner list.
- POST /api/v2/chimera/entities - Creates an entity (visibility 'private') and returns the new record.
- GET /api/v2/chimera/entities/:id - Returns an entity if the caller owns it or it is public.
- PUT /api/v2/chimera/entities/:id - Body UpdateEntitySchema (partial). Updates metadata, base state, tags, images, or visibility.
- DELETE /api/v2/chimera/entities/:id - Deletes an entity owned by the caller.

### Stories (/api/v2/chimera/stories)
CreateStorySchema includes display_name, optional description_short, content_rating ('safe'|'mature'|'explicit'), world_id?, 
uleset_template_ids[], pack_ids[], entity_ids[]. UpdateStorySchema adds optional visibility and story_definition.
- GET /api/v2/chimera/stories/my-creations - Lists owner stories with joined world metadata.
- POST /api/v2/chimera/stories - Creates a story (validates referenced worlds/rulesets/packs). Returns the inserted row.
- GET /api/v2/chimera/stories/:id - Returns a story and its world info (owner or public).
- PUT /api/v2/chimera/stories/:id - Body UpdateStorySchema; diffs linked rulesets/packs/entities and updates the story.
- PUT /api/v2/chimera/stories/:id/definition - Body UpdateStoryDefinitionSchema {story_definition} to update the JSON blob only.
- POST /api/v2/chimera/stories/:id/rebuild - Re-runs the compile step via 
ebuildStory and returns the result (compiled definition, warnings, etc.).
- DELETE /api/v2/chimera/stories/:id - Deletes an owner story.
- POST /api/v2/chimera/stories/:id/links/entities - Body {entity_template_id} attaches an entity to the story.
- DELETE /api/v2/chimera/stories/:id/links/entities/:entity_id - Removes the entity link.

### Content Packs (/api/v2/chimera/packs)
CreatePackSchema covers display_name, optional description_short, pack_type ('NPC'|'ITEM'|'LORE'|'MIXED'), entity_template_ids[], 
uleset_template_ids[], lore_template_ids[], depends_on_pack_ids[], and inter_entity_state?.
- GET /api/v2/chimera/packs/selectable - Lists packs that are public or owned by the caller (optional exclude query to avoid self-dependencies).
- GET /api/v2/chimera/packs/my-creations - Returns owner packs with linked entity/ruleset/lore/dependency IDs.
- POST /api/v2/chimera/packs - Creates a pack (visibility 'private') and returns {id}.
- GET /api/v2/chimera/packs/:id - Returns the pack, including entity/ruleset/lore/dependency arrays, if caller owns it or it is public.
- GET /api/v2/chimera/packs/:id/rulesets - Returns the ruleset templates linked to the pack after verifying access.
- PUT /api/v2/chimera/packs/:id - Body UpdatePackSchema; diffs linked content/dependencies and bumps the version.
- DELETE /api/v2/chimera/packs/:id - Deletes an owner pack.

### Lore (/api/v2/chimera/lore)
CreateLoreEntrySchema includes world_id, display_name, entry_text, 	ag_names[]. UpdateLoreEntrySchema lets you mutate those fields.
- POST /api/v2/chimera/lore - Validates world ownership and inserts a lore fragment (visibility 'private') plus tag links. Returns the inserted row (matches ChimeraLoreEntry).
- GET /api/v2/chimera/lore/my-creations - Returns lore fragments owned by the caller with minimal world info.
- GET /api/v2/chimera/lore/tags - Returns an alphabetized list of normalized tags.
- GET /api/v2/chimera/lore/world/:worldId - Returns fragments for a specific world (owner or public) using WorldIdQuerySchema.
- GET /api/v2/chimera/lore - Supports world_id or story_id query parameters to fetch lore scoped to a world/story.
- PUT /api/v2/chimera/lore/:id - Body UpdateLoreEntrySchema; updates the fragment and tag associations after ownership checks.
- DELETE /api/v2/chimera/lore/:id - Deletes a lore fragment and associated tag links.

### Chimera Profile (/api/v2/chimera/profile)
- PUT /api/v2/chimera/profile - Body UpdateCreatorProfileSchema (creator_slug? with slug regex, public_bio?, website_url?, 
ew_avatar_url?). Ensures slug uniqueness, updates creator profile fields, and returns {creator_slug, public_bio, website_url, approved_avatar_image_url, pending_avatar_image_url, avatar_image_status}.

### Admin Resources (/api/v2/chimera/admin/*)
- GET /api/v2/chimera/admin/rulesets - Lists all ruleset templates (transforms V3 definitions into V2-friendly DTOs).
- GET /api/v2/chimera/admin/rulesets/exclusion-groups - Stub that returns [] (exclusion groups moved to a TEXT column).
- GET /api/v2/chimera/admin/rulesets/:id - Accepts UUID or key; returns the template.
- POST /api/v2/chimera/admin/rulesets - Body CreateRulesetTemplateSchema (display_name, rule_type, exclusion group info, rule_category, definition JSON). Returns the inserted template.
- PUT /api/v2/chimera/admin/rulesets/:id - Body UpdateRulesetTemplateSchema. Updates a template by UUID or key.
- DELETE /api/v2/chimera/admin/rulesets/:id - Deletes the template.
- GET /api/v2/chimera/admin/tags - Lists all tags {id, tag_name, is_approved, created_at, updated_at}.
- POST /api/v2/chimera/admin/tags - Body CreateTagSchema {tag_name, is_approved?}. Returns the inserted tag.
- PUT /api/v2/chimera/admin/tags/:id - Body UpdateTagSchema (tag_name?, is_approved?). Returns the updated row.
- DELETE /api/v2/chimera/admin/tags/:id - Removes a tag.
- POST /api/v2/chimera/admin/entities - Body CreateSystemEntitySchema (display_name, description, entity_type, base_state_json, world_id?, is_quick_start_template?, tag_names[]). Creates a system asset (is_system_asset:true, visibility:'public') and returns the entity.
- PUT /api/v2/chimera/admin/entities/:id - Body UpdateSystemEntitySchema (partial). Updates a system asset's metadata, base state, visibility, and tags.
- DELETE /api/v2/chimera/admin/entities/:id - Deletes a system asset.
- GET /api/v2/chimera/admin/worlds - Lists official worlds (is_official:true).
- POST /api/v2/chimera/admin/worlds - Body similar to CreateWorldSchema but forces is_official:true and visibility:'public'. Returns the inserted world.
- PUT /api/v2/chimera/admin/worlds/:id - Updates an official world (partial schema).
- DELETE /api/v2/chimera/admin/worlds/:id - Deletes an official world and cleans up tags.
- GET /api/v2/chimera/admin/entities-official - Lists official system entities defined in admin/chimera-entities.admin.ts.
- GET /api/v2/chimera/admin/entities-official/:id - Returns a single official entity.
- POST /api/v2/chimera/admin/entities-official - Body similar to CreateSystemEntitySchema; inserts an official entity with is_system_asset:true.
- PUT /api/v2/chimera/admin/entities-official/:id - Updates official entity metadata.
- DELETE /api/v2/chimera/admin/entities-official/:id - Removes an official entity and its tag links.

## Chimera Repository APIs (/api/chimera/*)
These routes talk directly to repository classes (db/repos/*) and return pure JSON DTOs.

### Worlds (/api/chimera/worlds)
- POST /api/chimera/worlds - Body WorldDefinitionSchema; creates a world and returns {id} (HTTP 201).
- GET /api/chimera/worlds/:id - Returns a WorldDefinition document.
- PUT /api/chimera/worlds/:id - Body WorldDefinitionSchema; updates the world and returns {id, updated:true}.
- GET /api/chimera/worlds - Returns an array of all WorldDefinition records.

### Rulesets (/api/chimera/rulesets)
- POST /api/chimera/rulesets - Body RulesetDefinitionSchema; returns {id}.
- GET /api/chimera/rulesets/:id - Accepts UUID or key; returns the RulesetDefinition.
- PUT /api/chimera/rulesets/:id - Body RulesetDefinitionSchema; updates the template.
- GET /api/chimera/rulesets - Optional category query; returns the (filtered) list.

### Entities (/api/chimera/entities)
- POST /api/chimera/entities - Body EntityTemplateSchema; returns {id}.
- GET /api/chimera/entities/:id - Returns an EntityTemplate.
- PUT /api/chimera/entities/:id - Body EntityTemplateSchema; updates the entity and returns {id, updated:true}.
- DELETE /api/chimera/entities/:id - Deletes the entity.
- GET /api/chimera/entities - Returns all entity templates.

### Lore (/api/chimera/lore)
- POST /api/chimera/lore - Body LoreFragmentSchema; returns {id} for the new fragment.
- GET /api/chimera/lore/:id - Returns a LoreFragment.
- PUT /api/chimera/lore/:id - Body LoreFragmentSchema; updates the fragment.
- DELETE /api/chimera/lore/:id - Deletes the fragment.
- GET /api/chimera/lore - Returns all lore fragments.

### Assets (/api/chimera/assets)
- POST /api/chimera/assets/upload-url - Body {contentType:string, folder:string}. Returns {uploadUrl, publicUrl, path} signed via AssetService.
- POST /api/chimera/assets/sign-upload - Body may include {filename?, fileType?, contentType?, folder?}. Returns {uploadUrl, accessUrl, path} (alias of the previous endpoint with broader inputs).

### Compiler & Runtime (/api/chimera/compile, /api/chimera/play, /api/chimera/game)
- POST /api/chimera/compile - Body CompileSelectionSchema {worldId:uuid, rulesetIds:string[], entityIds?:uuid[]}. Invokes CompilerService and returns {id} for the compiled story. Errors map to ApiErrorCode (e.g., WORLD_NOT_FOUND, RULESET_NOT_FOUND).
- GET /api/chimera/play/:gameStateId - Authenticated. Returns the serialized game state from StoriesRepository.loadGameState (turn history, state snapshot, etc.).
- POST /api/chimera/play/:gameStateId/cast - Body CastStoneRequestSchema {userText}. Runs GameLoopService.castStone and returns the turn result (narrative, choices, AI metadata) or an error code.
- POST /api/chimera/play/start - Body StartSessionRequestSchema {compiledStoryId}. Initializes a new session and returns {gameStateId}.
- POST /api/chimera/game/init - Body InitializeGameRequestSchema {storyId, playerInput{identity{name,pronouns?,role?,age?}, appearance?, backstory?, personality_traits?, drive?, flaw?, ...}}. Initializes a game/character and returns {id: gameStateId}.
- GET /api/chimera/game/stories/:id - Returns the compiled story document (matches StoriesRepository.getCompiledStoryById / @shared/types/chimera-compiled).

## API Documentation Endpoints
- GET /api/openapi.json - Served by openapiRouter; currently merges the catalog NPC and access-request specs from backend/src/openapi.
- GET /api/docs - Swagger UI backed by /api/openapi.json.
- GET /swagger.json - Available in non-production (or when ENABLE_SWAGGER=true); returns the spec from config/swagger.js.
- GET /api-docs - Swagger UI (non-production) backed by /swagger.json.
