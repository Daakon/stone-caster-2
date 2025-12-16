import { supabaseAdmin } from '../supabase.js';
import { AssetService } from '../assets/asset.service.js';
import type { Request } from 'express';

export interface CreateAssetDto {
    url: string;
    owner_id?: string | null;
    type?: string;
    category?: string;
    meta?: Record<string, any>;
}

export class ChimeraAssetsService {
    private assetService: AssetService;

    constructor() {
        this.assetService = new AssetService();
    }

    /**
     * Generate a signed upload URL and immediately register the pending asset in the database.
     * This ensures we don't have orphaned assets if the client uploads but fails to tell us.
     */
    async generateAndRegisterUpload(
        contentType: string,
        folder: string,
        category: string = 'general',
        req?: Request
    ) {
        // 1. Generate the URL (External Service / Cloudflare)
        const uploadData = await this.assetService.generateUploadUrl(contentType, folder, req);

        // 2. Extract Metadata
        const meta = {
            contentType,
            folder,
            path: uploadData.path,
            originalName: req?.body?.filename || undefined, // If client sends it
            size: req?.body?.fileSize || undefined // If client sends it
        };

        // 3. Register in Database
        const userId = req?.ctx?.userId || null;

        const asset = await this.createAsset({
            url: uploadData.publicUrl,
            owner_id: userId,
            type: 'image', // Default, could assume based on contentType
            category,
            meta
        });

        // Return both the upload details AND the local DB ID so the client can update it later
        return {
            ...uploadData,
            id: asset.id
        };
    }

    /**
     * Persist asset record to DB
     */
    async createAsset(dto: CreateAssetDto) {
        const { url, owner_id, type = 'image', category, meta = {} } = dto;

        const { data, error } = await supabaseAdmin
            .from('chimera_assets')
            .insert({
                url,
                owner_id,
                type,
                category,
                meta
            })
            .select()
            .single();

        if (error) {
            console.error('[ChimeraAssets] Failed to register asset:', error);
            throw new Error(`Failed to register asset: ${error.message}`);
        }

        return data;
    }

    /**
     * Update asset record (e.g. after successful upload with final URL/ID)
     */
    async updateAsset(id: string, updates: Partial<CreateAssetDto>) {
        const payload: any = {};
        if (updates.url) payload.url = updates.url;
        if (updates.meta) payload.meta = updates.meta; // Merge? typically replace for simple JSONB helper

        const { data, error } = await supabaseAdmin
            .from('chimera_assets')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[ChimeraAssets] Failed to update asset:', error);
            throw new Error(`Failed to update asset: ${error.message}`);
        }

        return data;
    }

    /**
     * Get recent assets for a user (or system assets)
     */
    async getMyAssets(userId: string, limit: number = 100) {
        const { data, error } = await supabaseAdmin
            .from('chimera_assets')
            .select('*')
            .or(`owner_id.eq.${userId},owner_id.is.null`)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[ChimeraAssets] Failed to fetch assets:', error);
            throw new Error(`Failed to fetch assets: ${error.message}`);
        }

        return data || [];
    }
}
