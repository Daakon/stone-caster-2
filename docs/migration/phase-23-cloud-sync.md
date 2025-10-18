# Phase 23: Cloud Save/Sync System

## Overview

Phase 23 implements a secure, deterministic cloud save/sync system that provides cross-device synchronization with snapshot/diff storage, conflict resolution, export/delete (privacy), quotas, and integrity guarantees. The system integrates with existing snapshots/WAL (Phase 10) and maintains all functionality behind admin/dev tooling without changing player-facing UI.

## Key Features

### Unified Save Model
- **Canonical Save**: `{ session_id, user_id_hash, version, turn_id, state_ptrs, integrity }`
- **Base Snapshots + Deltas**: Store base snapshots with incremental diffs for efficient storage
- **Deterministic Rebuild**: Base + ordered diffs → exact game_state bytes
- **Content Deduplication**: Blobs deduplicated by content hash for storage efficiency

### Cross-Device Sync
- **Device-Safe Sync Tokens**: Secure tokens for device identification and authentication
- **Pull → Merge → Rebuild → Verify Pipeline**: Robust sync process with integrity verification
- **Offline Queue Support**: Handle offline operations with automatic sync when online
- **Multi-Session Support**: Support multiple sessions per user with default resume selection

### Conflict Resolution
- **Three-Way Merge**: Resolve concurrent writes using turn lineage and WAL order
- **Priority System**: Most recent confirmed turn; longest valid chain; never "fork silently"
- **Conflict Reports**: Compact reports with both branches preserved
- **Archived Forks**: Losing branches archived for audit and potential recovery

### Privacy & Compliance
- **Export Endpoints**: Single archive (JSONL + checksums) of session history
- **Delete Endpoints**: Redact PII and purge blobs with tombstones & audit
- **Retention Policies**: Configurable retention and per-user quota enforcement
- **Audit Logging**: Complete audit trail for compliance and debugging

### Resilience & Integrity
- **End-to-End Integrity**: SHA-256 for blobs; rolling hash for chains
- **Background Verification**: Periodic rebuild verification with sampling
- **Encrypted Storage**: Server-side encryption + optional client-sealed saves (AES-GCM)
- **Backup & Rollback**: Daily backups with point-in-time restore capabilities

## Database Schema

### Main Tables

#### awf_saves
```sql
CREATE TABLE awf_saves (
  save_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id_hash TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  turn_id INTEGER NOT NULL DEFAULT 0,
  base_snapshot_hash TEXT,
  latest_chain_hash TEXT,
  integrity_ok BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id_hash)
);
```

#### awf_save_blobs
```sql
CREATE TABLE awf_save_blobs (
  blob_hash TEXT PRIMARY KEY,
  blob_type TEXT NOT NULL CHECK (blob_type IN ('snapshot', 'diff', 'meta')),
  bytes BYTEA NOT NULL,
  size INTEGER NOT NULL,
  enc TEXT NOT NULL DEFAULT 'none' CHECK (enc IN ('none', 'aesgcm')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### awf_save_diffs
```sql
CREATE TABLE awf_save_diffs (
  save_id UUID NOT NULL REFERENCES awf_saves(save_id) ON DELETE CASCADE,
  from_turn INTEGER NOT NULL,
  to_turn INTEGER NOT NULL,
  diff_hash TEXT NOT NULL,
  chain_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (save_id, to_turn)
);
```

#### awf_devices
```sql
CREATE TABLE awf_devices (
  device_id TEXT PRIMARY KEY,
  user_id_hash TEXT NOT NULL,
  session_id UUID,
  last_turn_seen INTEGER DEFAULT 0,
  sync_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### awf_save_archives
```sql
CREATE TABLE awf_save_archives (
  archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  save_id UUID NOT NULL REFERENCES awf_saves(save_id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('conflict', 'manual_restore')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### awf_sync_audit
```sql
CREATE TABLE awf_sync_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  save_id UUID REFERENCES awf_saves(save_id) ON DELETE CASCADE,
  device_id TEXT,
  operation TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## API Reference

### Save Service
```typescript
class SaveService {
  async createOrAttachSave(sessionId: string, userHash: string, version?: string): Promise<CreateResult>
  async persistTurn(saveId: string, turnId: number, state: any): Promise<PersistResult>
  async materialize(saveId: string, targetTurn?: number): Promise<MaterializeResult>
  async verify(saveId: string): Promise<VerifyResult>
}
```

### Sync Orchestrator
```typescript
class SyncOrchestrator {
  async syncUp(request: SyncUpRequest): Promise<SyncUpResponse>
  async syncDown(request: SyncDownRequest): Promise<SyncDownResponse>
  async getSyncStats(): Promise<SyncStats>
}
```

### Conflict Resolver
```typescript
class ConflictResolver {
  async resolveConflict(saveId: string, branches: ConflictBranch[], strategy: string): Promise<ConflictReport>
  async getConflictStats(): Promise<ConflictStats>
}
```

### Privacy Operations
```typescript
class PrivacyOps {
  async exportSave(request: ExportRequest): Promise<ExportResult>
  async deleteSave(request: DeleteRequest): Promise<DeleteResult>
  async getUserQuota(userIdHash: string): Promise<QuotaInfo>
  async enforceRetentionPolicy(): Promise<RetentionResult>
}
```

### Diff Engine
```typescript
class DiffEngine {
  async calculateDiff(oldState: any, newState: any, options?: DiffOptions): Promise<DiffResult>
  applyDiff(state: any, patches: any[]): any
  calculateCompressionStats(original: Buffer, compressed: Buffer, algorithm: string): CompressionStats
}
```

### Assembler Integration
```typescript
class AssemblerIntegration {
  async onTurnComplete(context: TurnContext): Promise<SyncIntegrationResult>
  async onWALCommit(context: TurnContext): Promise<SyncIntegrationResult>
  async onSnapshotCreate(context: TurnContext): Promise<SyncIntegrationResult>
  async getIntegrationStats(): Promise<IntegrationStats>
}
```

## API Endpoints

### Sync Operations
- `POST /api/awf-cloud-sync/sync/up` - Sync up (device → server)
- `GET /api/awf-cloud-sync/sync/down` - Sync down (server → device)

### Save Operations
- `POST /api/awf-cloud-sync/save/materialize` - Materialize save to specific turn
- `POST /api/awf-cloud-sync/save/verify` - Verify save integrity
- `POST /api/awf-cloud-sync/save/export` - Export save data
- `DELETE /api/awf-cloud-sync/save` - Delete save data
- `POST /api/awf-cloud-sync/save/restore` - Restore save to specific turn/snapshot

### Admin Operations
- `GET /api/awf-cloud-sync/save/conflicts` - Get conflicts (admin only)
- `GET /api/awf-cloud-sync/save/stats` - Get sync statistics (admin only)
- `GET /api/awf-cloud-sync/quota/:user_id_hash` - Get user quota
- `POST /api/awf-cloud-sync/admin/retention` - Enforce retention policy (admin only)
- `GET /api/awf-cloud-sync/admin/save/:save_id` - Get save details (admin only)
- `GET /api/awf-cloud-sync/admin/device/:device_id` - Get device info (admin only)
- `GET /api/awf-cloud-sync/admin/audit` - Get audit logs (admin only)

## Configuration

### Environment Variables
```bash
CLOUD_SYNC_ENABLED=true
CLOUD_SYNC_SNAPSHOT_EVERY=25
CLOUD_SYNC_MAX_SAVE_BYTES_MB=200
CLOUD_SYNC_MAX_DIFF_BYTES_KB=128
CLOUD_SYNC_ZSTD_LEVEL=10
CLOUD_SYNC_VERIFY_SAMPLE_PCT=1
CLOUD_SYNC_RETENTION_DAYS=365
CLOUD_SYNC_USER_QUOTA_MB=1024
CLOUD_SYNC_CLIENT_SEALED=false
CLOUD_SYNC_HMAC_SECRET=change-me
```

### Configuration Table
```sql
CREATE TABLE awf_cloud_sync_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  sync_enabled BOOLEAN DEFAULT true,
  snapshot_every INTEGER DEFAULT 25,
  max_save_bytes_mb INTEGER DEFAULT 200,
  max_diff_bytes_kb INTEGER DEFAULT 128,
  zstd_level INTEGER DEFAULT 10,
  verify_sample_pct INTEGER DEFAULT 1,
  retention_days INTEGER DEFAULT 365,
  user_quota_mb INTEGER DEFAULT 1024,
  client_sealed BOOLEAN DEFAULT false,
  hmac_secret TEXT NOT NULL DEFAULT 'change-me',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Security & Integrity

### Encryption
- **Server-Side Encryption**: All blobs encrypted at rest using AES-GCM
- **Client-Sealed Saves**: Optional client-side encryption when `CLIENT_SEAL_KEY` present
- **HMAC Authentication**: API payloads signed with per-session keys
- **Secure Tokens**: Device sync tokens with expiration and rotation

### Integrity Guarantees
- **SHA-256 Hashing**: All blobs hashed for integrity verification
- **Rolling Hash Chains**: Chain integrity maintained across turns
- **Background Verification**: Periodic integrity checks with sampling
- **Audit Logging**: Complete audit trail for all operations

### Access Control
- **Row-Level Security**: Users can only access their own saves
- **Admin Permissions**: Admin users have full access to all operations
- **Device Authentication**: Device tokens required for sync operations
- **Session Isolation**: Complete isolation between user sessions

## Performance Considerations

### Optimization Strategies
- **Snapshot Frequency**: Configurable snapshot creation (every N turns)
- **Diff Compression**: Zstd compression with configurable levels
- **Binary Fast Path**: Optimized handling for dense arrays
- **Content Deduplication**: Blob deduplication by content hash

### Performance Targets
- **Persist Turn**: p95 < 35ms for diff calculation and storage
- **Materialize**: p95 < 120ms for 500-turn chains with snapshots
- **Sync Operations**: < 100ms for typical sync up/down operations
- **Background Tasks**: < 1s for integrity verification sampling

### Monitoring
- **Metrics**: Turn persistence time, materialization time, sync latency
- **Alerts**: Integrity failures, quota violations, sync conflicts
- **Dashboards**: Real-time sync statistics and health monitoring

## Conflict Resolution

### Resolution Strategies
1. **Server Wins**: Always prefer server branch (default for admin operations)
2. **Client Wins**: Always prefer client branch (user preference)
3. **Longest Chain**: Prefer branch with most turns (default for user operations)
4. **Three-Way Merge**: Intelligent merge using common ancestor

### Conflict Detection
- **Concurrent Writes**: Detect when multiple devices modify same save
- **Turn Lineage**: Track turn progression to identify conflicts
- **WAL Order**: Use Write-Ahead Log order for conflict resolution
- **Integrity Scoring**: Score branches based on integrity and completeness

### Conflict Reports
```json
{
  "conflict_id": "conflict_123",
  "save_id": "save_456",
  "branches": [
    {
      "branch_id": "server",
      "turn_id": 10,
      "chain_hash": "chain_123",
      "device_id": "server",
      "integrity_score": 95
    },
    {
      "branch_id": "client",
      "turn_id": 8,
      "chain_hash": "chain_456",
      "device_id": "device_789",
      "integrity_score": 90
    }
  ],
  "resolution": {
    "chosen_branch": "server",
    "archived_branch": "client",
    "reason": "Server branch has more recent turns"
  }
}
```

## Privacy & Compliance

### Export Operations
- **Format Support**: JSONL, JSON, and ZIP formats
- **Data Inclusion**: Configurable metadata and audit log inclusion
- **Checksums**: SHA-256 checksums for integrity verification
- **Download URLs**: Secure, time-limited download links

### Delete Operations
- **PII Redaction**: Automatic redaction of personally identifiable information
- **Tombstone Creation**: Audit trail preservation with tombstones
- **Blob Purging**: Secure deletion of all associated blobs
- **Audit Logging**: Complete audit trail of deletion operations

### Retention Policies
- **Automatic Cleanup**: Configurable retention periods with automatic deletion
- **Quota Enforcement**: Per-user storage quotas with enforcement
- **Archive Before Delete**: Optional archiving before deletion
- **Notification**: Optional user notification before deletion

## Integration Points

### WAL Integration (Phase 10)
- **WAL Entries**: Process Write-Ahead Log entries for diff calculation
- **Turn Persistence**: Integrate with existing turn persistence system
- **Snapshot Reuse**: Reuse existing snapshot system for base snapshots
- **Audit Trail**: Maintain audit trail across all operations

### Assembler Integration
- **Turn Completion**: Hook into turn completion for automatic persistence
- **WAL Commit**: Process WAL commits for diff calculation
- **Snapshot Creation**: Integrate with snapshot creation system
- **State Management**: Maintain state consistency across all systems

### Frontend Integration
- **Device Helper**: Cloud sync client for frontend applications
- **Auto-Sync**: Automatic synchronization with configurable intervals
- **Offline Support**: Offline queue with automatic sync when online
- **Conflict Handling**: User-friendly conflict resolution interface

## Troubleshooting

### Common Issues

#### Sync Failures
- **Cause**: Network connectivity or authentication issues
- **Solution**: Check network connection and authentication tokens
- **Prevention**: Implement retry logic with exponential backoff

#### Conflict Resolution
- **Cause**: Concurrent writes from multiple devices
- **Solution**: Use appropriate resolution strategy for your use case
- **Prevention**: Implement optimistic locking and conflict detection

#### Integrity Failures
- **Cause**: Data corruption or tampering
- **Solution**: Rebuild from base snapshot and verify chain
- **Prevention**: Regular integrity checks and background verification

#### Quota Exceeded
- **Cause**: User storage quota exceeded
- **Solution**: Clean up old saves or increase quota
- **Prevention**: Implement quota monitoring and alerts

### Debug Commands
```bash
# Check sync status
yarn awf:sync:status

# Verify save integrity
yarn awf:sync:verify --save-id=save_123

# Export save data
yarn awf:sync:export --save-id=save_123 --format=jsonl

# Get sync statistics
yarn awf:sync:stats

# Check conflicts
yarn awf:sync:conflicts
```

### Log Analysis
- **Sync Operations**: Monitor sync up/down operations and failures
- **Conflict Resolution**: Track conflict detection and resolution
- **Integrity Verification**: Monitor integrity check results
- **Performance Metrics**: Track operation timing and resource usage

## Migration Guide

### From Phase 10 to Phase 23
1. **Database Migration**: Run cloud sync migration
2. **Configuration Update**: Update environment variables
3. **Service Integration**: Wire assembler integration
4. **Testing**: Run comprehensive tests to ensure compatibility

### Backward Compatibility
- **Existing Saves**: All existing saves continue to work
- **WAL Integration**: Seamless integration with existing WAL system
- **Snapshot System**: Reuse existing snapshot system
- **API Compatibility**: All existing APIs remain functional

### Rollback Plan
1. **Disable Cloud Sync**: Set `CLOUD_SYNC_ENABLED=false`
2. **Remove Sync Data**: Clean up cloud sync tables
3. **Database Rollback**: Run down migration if needed
4. **Configuration Reset**: Reset to pre-cloud-sync configuration

## Future Enhancements

### Planned Features
- **Real-Time Sync**: WebSocket-based real-time synchronization
- **Conflict Visualization**: Visual conflict resolution interface
- **Advanced Compression**: More sophisticated compression algorithms
- **Multi-Region Sync**: Cross-region synchronization support

### Performance Improvements
- **Parallel Processing**: Parallel diff calculation and compression
- **Caching**: Intelligent caching for frequently accessed saves
- **Optimization**: Advanced optimization for large state objects
- **Monitoring**: Enhanced monitoring and alerting capabilities

### Security Enhancements
- **Zero-Knowledge**: Client-side encryption with zero-knowledge architecture
- **Advanced Authentication**: Multi-factor authentication for sensitive operations
- **Audit Enhancement**: Enhanced audit logging and compliance reporting
- **Privacy Controls**: Granular privacy controls and data handling policies
