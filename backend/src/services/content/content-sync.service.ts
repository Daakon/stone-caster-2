import { randomUUID } from 'node:crypto';
import { ContentSourceService, type ValidatedContentBundle } from './content-source.service.js';
import { ContentSyncRepository, type ContentSyncReceipt } from '../../db/repos/content-sync.repo.js';

export class ContentSyncError extends Error {
  constructor(message: string, public readonly exitCode: number) {
    super(message);
    this.name = 'ContentSyncError';
  }
}

export class ContentSyncService {
  constructor(
    private readonly source = new ContentSourceService(),
    private readonly repository = new ContentSyncRepository(),
  ) {}

  validate(): ValidatedContentBundle {
    try {
      return this.source.loadAndValidate();
    } catch (error) {
      console.error(JSON.stringify({level:'error', event:'content_validate_failed', traceId:'content-sync-cli', message:error instanceof Error ? error.message : 'unknown validation error'}));
      throw new ContentSyncError(error instanceof Error ? error.message : 'First-party content validation failed', 2);
    }
  }

  async sync(connectionString: string): Promise<ContentSyncReceipt> {
    const {bundle} = this.validate();
    try {
      return await this.repository.apply(connectionString, randomUUID(), bundle);
    } catch (error) {
      console.error(JSON.stringify({level:'error', event:'content_sync_failed', traceId:'content-sync-cli', target:'local', message:error instanceof Error ? error.message : 'unknown database error'}));
      throw new ContentSyncError(error instanceof Error ? error.message : 'First-party content sync failed', 1);
    }
  }
}
