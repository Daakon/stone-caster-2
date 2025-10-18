# Phase 10 - Session Lifecycle Hardening

This document covers the implementation of Phase 10 of the AWF migration, which adds atomic save/resume snapshots, a Recap API, session export/import for support/debug, and crash recovery guarantees through a Write-Ahead Log (WAL) system.

## Overview

Phase 10 focuses on hardening the session lifecycle with:

- **Atomic Snapshots**: Create, restore, and list session state snapshots with content hash deduplication
- **Recap API**: Generate deterministic session recaps using warm memory and recent turns
- **Export/Import**: Support tools for session reproduction with data redaction
- **Write-Ahead Log**: Crash recovery and idempotent turn processing
- **Admin Endpoints**: RESTful API for all lifecycle operations
- **CLI Tools**: Command-line interfaces for administrative tasks

## Architecture

### Data Models

#### Snapshots Table
```sql
CREATE TABLE snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  label TEXT,
  content_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  UNIQUE (session_id, content_hash)
);
```

#### Turn WAL Table
```sql
CREATE TABLE turn_wal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  turn_id INTEGER NOT NULL,
  awf_raw JSONB NOT NULL,
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, turn_id)
);
```

### Service Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Snapshots     │    │     Recap       │    │  Export/Import  │
│   Service       │    │    Service      │    │    Service      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   WAL Service   │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Admin API     │
                    │   Endpoints     │
                    └─────────────────┘
```

## Features

### 1. Atomic Snapshots

#### Snapshot Creation
- Captures complete session runtime state
- Content hash deduplication prevents duplicate snapshots
- Atomic transaction ensures consistency

#### Snapshot Payload Structure
```typescript
interface SnapshotPayload {
  version: string;
  session: SessionData;
  game_state: GameState;
  npcs: NPCData[];
  player: PlayerData;
  rng: RNGState;
  contract_ref: string;
  world: WorldData;
  adventure: AdventureData;
}
```

#### API Endpoints
- `POST /api/admin/awf/sessions/:id/snapshots` - Create snapshot
- `GET /api/admin/awf/sessions/:id/snapshots` - List snapshots
- `POST /api/admin/awf/sessions/:id/restore/:snapshotId` - Restore snapshot

### 2. Recap API

#### Recap Generation Rules
1. **Warm Memory Priority**: Use `warm.pins` (newest first)
2. **Episodic Memory**: Top N by salience then recency
3. **Recent Turns**: Last K turn AWF.txt lines
4. **Composition**: 2-6 sentences, ≤24 words each
5. **Objectives**: From `hot.objectives` sorted by priority

#### API Endpoint
- `GET /api/admin/awf/sessions/:id/recap?lastTurns=K` - Generate recap

### 3. Session Export/Import

#### Export Process
1. **Data Collection**: Gather all session runtime data
2. **Redaction**: Remove sensitive information (API keys, IPs, emails, auth IDs)
3. **Serialization**: Create JSON bundle with metadata
4. **Validation**: Ensure data integrity

#### Import Process
1. **Validation**: Verify export data structure
2. **Sandbox Creation**: Create new session with preserved state
3. **Turn Preservation**: Optional `preserveTurnId` flag
4. **State Restoration**: Apply exported game state

#### API Endpoints
- `GET /api/admin/awf/sessions/:id/export` - Export session
- `POST /api/admin/awf/sessions/import` - Import session

### 4. Write-Ahead Log (WAL)

#### WAL Process
1. **Pre-Apply**: Write WAL entry before `applyActs`
2. **Transaction**: Apply acts in database transaction
3. **Post-Apply**: Mark WAL entry as applied
4. **Recovery**: Reconcile unapplied entries on startup

#### Crash Recovery
- **Startup Scan**: Check for unapplied WAL entries
- **State Verification**: Compare DB state with pre-apply snapshot
- **Reconciliation**: Re-apply acts or rollback as needed
- **Alerting**: Log critical issues for investigation

#### API Endpoints
- `GET /api/admin/awf/wal/repair` - Manual WAL reconciliation
- `GET /api/admin/awf/sessions/:id/wal` - List WAL entries

## CLI Tools

### Snapshot Management
```bash
# Create snapshot
npm run awf:snapshot:create -- --session session-123 --label "Checkpoint 1"

# List snapshots
npm run awf:snapshot:list -- --session session-123

# Restore snapshot
npm run awf:snapshot:restore -- --session session-123 --snapshot snapshot-456

# Delete snapshot
npm run awf:snapshot:delete -- --session session-123 --snapshot snapshot-456
```

### Recap Generation
```bash
# Generate recap
npm run awf:recap -- --session session-123 --lastTurns 3
```

### Export/Import
```bash
# Export session
npm run awf:export -- --session session-123 --output export.json

# Import session
npm run awf:import -- --file export.json --preserveTurnId
```

### WAL Operations
```bash
# Reconcile WAL
npm run awf:wal:reconcile -- --session session-123

# List WAL entries
npm run awf:wal:list -- --session session-123

# Cleanup old entries
npm run awf:wal:cleanup -- --days 30
```

## Configuration

### Environment Variables
```bash
# Snapshot Configuration
AWF_SNAPSHOT_MAX_AGE_DAYS=30
AWF_SNAPSHOT_MAX_COUNT=10

# Recap Configuration
AWF_RECAP_MAX_SENTENCES=6
AWF_RECAP_MAX_WORDS_PER_SENTENCE=24

# Export/Import Configuration
AWF_EXPORT_REDACT_SENSITIVE=true
AWF_EXPORT_MAX_SIZE_MB=50

# WAL Configuration
AWF_WAL_MAX_AGE_DAYS=7
AWF_WAL_CLEANUP_INTERVAL_HOURS=24
```

## Monitoring and Alerting

### Metrics
- `awf.snapshots.created` - Snapshots created
- `awf.snapshots.restored` - Snapshots restored
- `awf.recap.generated` - Recaps generated
- `awf.export.sessions` - Sessions exported
- `awf.import.sessions` - Sessions imported
- `awf.wal.entries` - WAL entries written
- `awf.wal.reconciled` - WAL entries reconciled

### Alerts
- **WAL Reconciliation Failures**: Critical alert for unapplied entries
- **Export Size Limits**: Warning for large exports
- **Snapshot Storage**: Monitor storage usage and cleanup
- **Recap Generation**: Track generation time and success rate

## Troubleshooting

### Common Issues

#### WAL Reconciliation Failures
- **Symptom**: Unapplied WAL entries after restart
- **Cause**: Database transaction failure during act application
- **Solution**: Run manual reconciliation and investigate root cause

#### Snapshot Storage Issues
- **Symptom**: Snapshots not being created or restored
- **Cause**: Database constraints or storage limits
- **Solution**: Check database logs and storage capacity

#### Export/Import Failures
- **Symptom**: Import fails with validation errors
- **Cause**: Corrupted export data or schema changes
- **Solution**: Validate export data and check schema compatibility

### Debugging Commands
```bash
# Check WAL status
npm run awf:wal:list -- --session session-123

# Verify snapshot integrity
npm run awf:snapshot:list -- --session session-123

# Test export/import cycle
npm run awf:export -- --session session-123 --output test.json
npm run awf:import -- --file test.json --preserveTurnId
```

## Security Considerations

### Data Redaction
- **API Keys**: Never exported in session data
- **IP Addresses**: Removed from export bundles
- **Email Addresses**: Redacted from user data
- **Auth IDs**: Stripped from session context

### Access Control
- **Admin Only**: All lifecycle endpoints require admin authentication
- **Session Isolation**: Users can only access their own sessions
- **Audit Logging**: All admin actions are logged

### Data Retention
- **Snapshot Cleanup**: Automatic cleanup of old snapshots
- **WAL Cleanup**: Regular cleanup of applied WAL entries
- **Export Cleanup**: Temporary export files are cleaned up

## Performance Considerations

### Snapshot Performance
- **Content Hashing**: Efficient deduplication using SHA-256
- **Payload Size**: Monitor snapshot payload sizes
- **Storage**: Consider compression for large snapshots

### WAL Performance
- **Batch Operations**: Process multiple WAL entries in batches
- **Indexing**: Proper indexing on session_id and turn_id
- **Cleanup**: Regular cleanup to prevent table bloat

### Export/Import Performance
- **Streaming**: Large exports use streaming to avoid memory issues
- **Validation**: Efficient validation of export data
- **Redaction**: Fast redaction using regex patterns

## Future Enhancements

### Planned Features
- **Snapshot Compression**: Compress large snapshots for storage efficiency
- **Incremental Snapshots**: Only store changes since last snapshot
- **Snapshot Scheduling**: Automatic snapshot creation at intervals
- **Recap Templates**: Customizable recap generation templates

### Integration Opportunities
- **Backup Systems**: Integration with backup and disaster recovery
- **Analytics**: Session analytics and reporting
- **Debugging**: Enhanced debugging tools for support teams
- **Testing**: Automated testing of session lifecycle operations

## Conclusion

Phase 10 provides comprehensive session lifecycle hardening with:

- **Atomic Snapshots**: Reliable state capture and restoration
- **Deterministic Recaps**: Consistent session summaries
- **Export/Import**: Support tools for debugging and reproduction
- **Crash Recovery**: WAL system for data integrity
- **Admin Tools**: Complete CLI and API interfaces
- **Monitoring**: Comprehensive metrics and alerting

The implementation ensures data integrity, provides debugging capabilities, and maintains high availability through proper error handling and recovery mechanisms.


