import pg from 'pg';
import type { ContentSyncBundleV1 } from '@shared/types/chimera-content.js';

export interface ContentSyncReceipt {
  generation: number;
  manifest_hash: string;
  item_count: number;
}

export class ContentSyncRepository {
  async apply(connectionString: string, deployId: string, bundle: ContentSyncBundleV1): Promise<ContentSyncReceipt> {
    const client = new pg.Client({connectionString, application_name:'stonecaster-content-sync'});
    try {
      await client.connect();
      const {rows: generationRows} = await client.query<{catalog_generation: string}>(
        'select catalog_generation::text from content_deploy.validation_formats limit 1',
      );
      if (!generationRows.length) throw new Error('The content deploy role cannot read the validation format view');
      const expectedGeneration = Number(generationRows[0].catalog_generation);
      if (!Number.isSafeInteger(expectedGeneration)) throw new Error('The content catalog generation is invalid');
      const {rows} = await client.query<{content_sync_apply: ContentSyncReceipt}>(
        'select content_deploy.content_sync_apply($1::bigint, $2::uuid, $3::jsonb) as content_sync_apply',
        [expectedGeneration, deployId, JSON.stringify(bundle)],
      );
      return rows[0].content_sync_apply;
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}
