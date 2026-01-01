import { supabaseAdmin } from '../supabase.js';

// DTO Interfaces
export interface CreateEntityDto {
    display_name: string;
    description_short?: string | null;
    description_long?: string | null;
    entity_type: 'NPC' | 'ITEM' | 'FACTION' | 'LOCATION' | 'PLAYER';
    archetype_handle?: string | null;
    base_state_json?: Record<string, unknown>;
    raw_data?: Record<string, unknown>;
    tags?: string[];
    world_id?: string;
    images?: any[];
    primary_image_url?: string;
    userId: string;
}

export interface UpdateEntityDto {
    display_name?: string;
    description_short?: string | null;
    description_long?: string | null;
    entity_type?: 'NPC' | 'ITEM' | 'FACTION' | 'LOCATION' | 'PLAYER';
    archetype_handle?: string | null;
    base_state_json?: Record<string, unknown>;
    raw_data?: Record<string, unknown>;
    tags?: string[];
    world_id?: string;
    visibility?: 'private' | 'pending_approval' | 'public';
    images?: any[];
    primary_image_url?: string;
    is_official?: boolean;
}

export interface CreatePlayerCharacterDto {
    userId: string;
    name: string;
    state_snapshot: Record<string, unknown>;
    world_id: string;
}

export class ChimeraEntitiesService {
    /**
     * Creates a new Player Character Template in the chimera_player_characters table.
     */
    static async createPlayerCharacter(dto: CreatePlayerCharacterDto) {
        const { userId, name, state_snapshot, world_id } = dto;

        const { data, error } = await supabaseAdmin
            .from('chimera_player_characters')
            .insert({
                user_id: userId,
                world_id,
                name,
                state_snapshot
            })
            .select()
            .single();

        if (error) throw error;
    }

    /**
     * Lists all Player Characters for a user.
     */
    static async listPlayerCharacters(userId: string) {
        const { data, error } = await supabaseAdmin
            .from('chimera_player_characters')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }



    /**
     * Helper to normalize tags
     */
    private static normalizeTagName(tagName: string): string {
        return tagName
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '_')
            .replace(/[^A-Z0-9_]/g, '');
    }

    /**
     * Resolve Primary Image URL
     * Priorities: 1. DTO top-level field 2. First image in array with role 'portrait' 3. First image in array
     */
    private static resolvePrimaryImage(dtoUrl?: string, images?: any[]): string | null {
        if (dtoUrl) return dtoUrl;

        if (images && images.length > 0) {
            const portrait = images.find((img: any) => img.role === 'portrait' || img.role === 'primary');
            if (portrait) return portrait.url;
            return images[0].url;
        }

        return null;
    }

    /**
     * Validate World Access
     * Allow if User Owns OR World is Official OR World is Public
     */
    private static async validateWorldAccess(worldId: string, userId: string): Promise<void> {
        const { data: world, error } = await supabaseAdmin
            .from('chimera_worlds')
            .select('id, owner_id, is_official, visibility')
            .eq('id', worldId)
            .single();

        if (error || !world) {
            throw new Error(`World not found: ${worldId}`);
        }

        const isOwner = world.owner_id === userId;
        const isOfficial = !!world.is_official;
        // Check if visibility property exists on the result
        const isPublic = (world as any).visibility === 'public';

        if (!isOwner && !isOfficial && !isPublic) {
            throw new Error(`Cannot link to World ${worldId}. You must own it, or it must be Official/Public.`);
        }
    }

    /**
     * Create a new entity with strict schema alignment
     */
    static async createEntity(dto: CreateEntityDto): Promise<any> {
        const {
            userId,
            tags,
            raw_data = {},
            world_id,
            display_name,
            entity_type,
            base_state_json,
            archetype_handle,
            images,
            primary_image_url
        } = dto;

        // 0. Resolve Image
        const finalPrimaryImage = this.resolvePrimaryImage(primary_image_url, images);

        // 0. Validate World (if provided)
        if (world_id) {
            await this.validateWorldAccess(world_id, userId);
        }

        // 1. Sanitize raw_data
        // Ensure narrative properties are the only things in raw_data (plus whatever else the user sent that ISN'T structural)
        const sanitizedRawData = { ...raw_data };

        // Explicitly pack archetype if provided separately
        if (archetype_handle) {
            sanitizedRawData.archetype_handle = archetype_handle;
        }

        // Remove structural fields from raw_data to prevent duplication/desync
        delete sanitizedRawData.tags;
        delete sanitizedRawData.world_id;
        delete sanitizedRawData.display_name;
        delete sanitizedRawData.entity_type;
        delete sanitizedRawData.id;
        delete sanitizedRawData.owner_user_id;

        // Validating base_state_json
        const safeBaseState = base_state_json || {};

        // 2. Prepare SQL Payload
        // Generate slug
        let baseSlug = display_name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        if (!baseSlug) baseSlug = 'entity';

        let slug = baseSlug;
        let attempt = 0;
        let createdEntity = null;

        // JSONB Payload (Strictly Narrative + needed context if any)
        const finalRawData = {
            ...safeBaseState,
            ...sanitizedRawData,
            base_state_json: safeBaseState
        };

        while (attempt < 5) {
            try {
                // Map Kind -> Entity Type (Cleanup)
                const entity_type_val = entity_type; // 'NPC', 'ITEM' etc as string

                const insertPayload: any = {
                    slug,
                    entity_type: entity_type_val,
                    owner_user_id: userId,
                    raw_data: finalRawData,
                    display_name, // Explicitly adding display_name as per alignment discussion
                    visibility: 'private',
                    primary_image_url: finalPrimaryImage
                };

                if (world_id) {
                    insertPayload.world_id = world_id;
                }

                // Ensures display_name and entity_type are never undefined in the payload
                if (!display_name) throw new Error("Display Name is required");
                if (!entity_type) throw new Error("Entity Type is required");

                const { data: entity, error } = await supabaseAdmin
                    .from('chimera_entities')
                    .insert(insertPayload)
                    .select('id, slug, entity_type, owner_user_id, raw_data, created_at, updated_at, world_id, display_name, primary_image_url')
                    .single();

                if (error) {
                    // Check for unique conflict on slug
                    if (error.code === '23505') {
                        attempt++;
                        const suffix = Math.random().toString(36).substring(2, 6);
                        slug = `${baseSlug}-${suffix}`;
                        continue;
                    }
                    throw error;
                }

                createdEntity = entity;
                break;
            } catch (err: any) {
                if (err.code !== '23505') throw err;
            }
        }

        if (!createdEntity) throw new Error("Failed to create entity after retries");

        // 3. Handle Tags
        if (tags && tags.length > 0) {
            await this.processTags(tags, createdEntity.id);
        }

        return createdEntity;
    }

    static async updateEntity(id: string, dto: UpdateEntityDto): Promise<void> {
        const { tags, raw_data, world_id, display_name, entity_type, visibility, images, primary_image_url } = dto as any;

        // 1. Sanitize Raw Data
        let updatedRawData: any = undefined;
        if (raw_data) {
            updatedRawData = { ...raw_data };
            delete updatedRawData.tags;
            delete updatedRawData.world_id;
            delete updatedRawData.display_name;
            delete updatedRawData.entity_type;
            delete updatedRawData.id;
        }

        // 2. Prepare SQL Update
        const updatePayload: any = {
            updated_at: new Date().toISOString()
        };

        if (display_name !== undefined) updatePayload.display_name = display_name;

        if (world_id !== undefined) {
            // For updates, checking world existence/type validity is good practice for 'public' linking.
            updatePayload.world_id = world_id;
        }

        if (entity_type !== undefined) updatePayload.entity_type = entity_type;
        if (visibility !== undefined) updatePayload.visibility = visibility;

        // Ensure world_id update is respected if passed (even if null to unlink, though normally we'd restrict that)
        if (world_id !== undefined) updatePayload.world_id = world_id;

        // Handle Image Update
        const finalPrimaryImage = this.resolvePrimaryImage(primary_image_url, images);
        if (finalPrimaryImage !== null) {
            updatePayload.primary_image_url = finalPrimaryImage;
        }

        // Handle merge of raw_data
        if (updatedRawData) {
            updatePayload.raw_data = updatedRawData;
        }

        const { error } = await supabaseAdmin
            .from('chimera_entities')
            .update(updatePayload)
            .eq('id', id);

        if (error) throw error;

        // 3. Handle Tags
        if (tags) {
            await supabaseAdmin.from('chimera_asset_tags').delete().eq('asset_id', id).eq('asset_type', 'entity_template');
            await this.processTags(tags, id);
        }
    }

    private static async processTags(tags: string[], entityId: string) {
        const tagIds: string[] = [];

        for (const tagName of tags) {
            const normalized = this.normalizeTagName(tagName);
            if (!normalized) continue;

            // Check if tag exists
            const { data: existingTag } = await supabaseAdmin
                .from('chimera_tags')
                .select('id')
                .eq('tag_name', normalized)
                .single();

            let tagId: string;

            if (existingTag) {
                tagId = existingTag.id;
            } else {
                // Create new tag (unapproved)
                const { data: newTag, error: tagError } = await supabaseAdmin
                    .from('chimera_tags')
                    .insert({
                        tag_name: normalized,
                        is_approved: false,
                    })
                    .select('id')
                    .single();

                if (tagError || !newTag) continue;
                tagId = newTag.id;
            }
            tagIds.push(tagId);
        }

        if (tagIds.length > 0) {
            const assetTagLinks = tagIds.map((tagId) => ({
                tag_id: tagId,
                asset_id: entityId,
                asset_type: 'entity_template',
            }));

            await supabaseAdmin
                .from('chimera_asset_tags')
                .insert(assetTagLinks);
        }
    }
}
