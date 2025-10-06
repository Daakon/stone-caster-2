import { createHash } from 'crypto';
import { supabaseAdmin } from './supabase.js';
import { ApiErrorCode } from '@shared';

export interface IdempotencyRecord {
  id: string;
  key: string;
  ownerId: string;
  gameId: string;
  operation: string;
  requestHash: string;
  responseData: any;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
}

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  existingRecord?: IdempotencyRecord;
  error?: ApiErrorCode;
  message?: string;
}

/**
 * Idempotency Service - manages idempotency keys for turn operations
 * Prevents duplicate turns and double-spending
 */
export class IdempotencyService {
  /**
   * Check if an idempotency key has been used for this operation
   * @param key - Idempotency key
   * @param ownerId - Owner ID (user ID or cookie group ID)
   * @param gameId - Game ID
   * @param operation - Operation type (e.g., 'turn')
   * @returns Check result with duplicate status
   */
  static async checkIdempotency(
    key: string,
    ownerId: string,
    gameId: string,
    operation: string = 'turn'
  ): Promise<IdempotencyCheckResult> {
    try {
      const { data: existingRecord, error } = await supabaseAdmin
        .from('idempotency_keys')
        .select('*')
        .eq('key', key)
        .eq('owner_id', ownerId)
        .eq('game_id', gameId)
        .eq('operation', operation)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking idempotency:', error);
        return {
          isDuplicate: false,
          error: ApiErrorCode.INTERNAL_ERROR,
          message: 'Failed to check idempotency',
        };
      }

      if (existingRecord) {
        return {
          isDuplicate: true,
          existingRecord: this.mapRecordFromDb(existingRecord),
        };
      }

      return {
        isDuplicate: false,
      };
    } catch (error) {
      console.error('Unexpected error in checkIdempotency:', error);
      return {
        isDuplicate: false,
        error: ApiErrorCode.INTERNAL_ERROR,
        message: 'Internal error checking idempotency',
      };
    }
  }

  /**
   * Store an idempotency record for a completed operation
   * @param key - Idempotency key
   * @param ownerId - Owner ID
   * @param gameId - Game ID
   * @param operation - Operation type
   * @param requestHash - Hash of the request data
   * @param responseData - Response data to cache
   * @param status - Operation status
   * @returns Created record
   */
  static async storeIdempotencyRecord(
    key: string,
    ownerId: string,
    gameId: string,
    operation: string,
    requestHash: string,
    responseData: any,
    status: 'completed' | 'failed' = 'completed'
  ): Promise<IdempotencyRecord> {
    try {
      const now = new Date().toISOString();
      const record = {
        key,
        owner_id: ownerId,
        game_id: gameId,
        operation,
        request_hash: requestHash,
        response_data: responseData,
        status,
        created_at: now,
        completed_at: status === 'completed' ? now : null,
      };

      const { data, error } = await supabaseAdmin
        .from('idempotency_keys')
        .insert(record)
        .select('*')
        .single();

      if (error) {
        console.error('Error storing idempotency record:', error);
        throw new Error(`Failed to store idempotency record: ${error.message}`);
      }

      return this.mapRecordFromDb(data);
    } catch (error) {
      console.error('Unexpected error in storeIdempotencyRecord:', error);
      throw error;
    }
  }

  /**
   * Create a hash of request data for idempotency checking
   * @param data - Request data to hash
   * @returns Hash string
   */
  static createRequestHash(data: any): string {
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Map database row to IdempotencyRecord type
   */
  private static mapRecordFromDb(dbRow: any): IdempotencyRecord {
    return {
      id: dbRow.id,
      key: dbRow.key,
      ownerId: dbRow.owner_id,
      gameId: dbRow.game_id,
      operation: dbRow.operation,
      requestHash: dbRow.request_hash,
      responseData: dbRow.response_data,
      status: dbRow.status,
      createdAt: dbRow.created_at,
      completedAt: dbRow.completed_at,
    };
  }
}
