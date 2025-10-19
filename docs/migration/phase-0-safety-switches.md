# Phase 0: Safety & Switches - AWF Bundle Migration

This document describes the safety mechanisms and feature flags implemented in Phase 0 of the AWF bundle migration to prepare for the transition from markdown-based prompts to the new AWF bundle system.

## Overview

Phase 0 implements safety switches and feature flags that allow controlled testing of the new AWF bundle system while maintaining the existing markdown-based prompt system as the default. This ensures zero risk to production systems during the migration.

## Feature Flag: AWF_BUNDLE_ON

### Global Configuration

The primary feature flag is controlled by the `AWF_BUNDLE_ON` environment variable:

```bash
# Default: false (legacy markdown system)
AWF_BUNDLE_ON=false

# Enable: true (AWF bundle system)
AWF_BUNDLE_ON=true
```

### Environment Setup

1. **Development**: Add to your `.env` file:
   ```bash
   AWF_BUNDLE_ON=false
   ```

2. **Production**: Set in your deployment environment:
   ```bash
   AWF_BUNDLE_ON=false
   ```

3. **Testing**: Temporarily enable for testing:
   ```bash
   AWF_BUNDLE_ON=true
   ```

### Configuration Access

The flag is accessible through the config service:

```typescript
import { configService } from '../services/config.service.js';

// Check global flag
const isEnabled = configService.getAwfBundleEnabled();
```

## Session-Level Override

For individual session testing, you can override the global setting:

```typescript
import { 
  isAwfBundleEnabled, 
  setAwfBundleOverride, 
  clearAwfBundleOverride 
} from '../utils/feature-flags.js';

// Set override for a specific session
setAwfBundleOverride('session-123', true);

// Check if enabled (respects session override)
const enabled = isAwfBundleEnabled({ sessionId: 'session-123' });

// Clear override (falls back to global setting)
clearAwfBundleOverride('session-123');
```

### Admin/Tool Commands

For testing purposes, you can create admin endpoints or tools to manage session overrides:

```typescript
// Example admin endpoint
app.post('/admin/awf-override/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { enabled } = req.body;
  
  setAwfBundleOverride(sessionId, enabled);
  res.json({ success: true, sessionId, enabled });
});
```

## Turn Processing Behavior

The turn processing system now includes guarded branches that log which path would be used:

### Regular Turns

```typescript
// In turns.service.ts - runBufferedTurn method
const awfBundleEnabled = isAwfBundleEnabled({ sessionId: gameId });

if (awfBundleEnabled) {
  console.log(`[TURNS] AWF bundle path would be used for game ${gameId} (Phase 0 stub)`);
  // TODO Phase 3+: call assembleBundle()
  // For now, fall through to legacy path
} else {
  console.log(`[TURNS] Legacy markdown path in use for game ${gameId}`);
}
```

### Initial Prompts

```typescript
// In turns.service.ts - createInitialAIPrompt method
const awfBundleEnabled = isAwfBundleEnabled({ sessionId: game.id });

if (awfBundleEnabled) {
  console.log(`[TURNS] AWF bundle path would be used for initial prompt in game ${game.id} (Phase 0 stub)`);
  // TODO Phase 3+: call assembleBundle()
  // For now, fall through to legacy path
} else {
  console.log(`[TURNS] Legacy markdown path in use for initial prompt in game ${game.id}`);
}
```

## Snapshot Script

### Purpose

The snapshot script creates timestamped backups of all prompt and layer files before the AWF bundle migration. This ensures you can rollback if needed.

### Usage

```bash
# Run the snapshot script
npm run snapshot:prompts

# Or directly with tsx
tsx scripts/snapshot-prompts.ts
```

### Output

The script creates a timestamped directory under `backend/backups/pre-awf/`:

```
backend/backups/pre-awf/
└── 2024-01-15T10-30-45/
    ├── AI API Prompts/
    │   ├── agency.presence-and-guardrails.json
    │   ├── awf.scheme.json
    │   ├── baseline.md
    │   ├── core.prompt.json
    │   ├── core.rpg-storyteller.json
    │   ├── engine.system.json
    │   └── worlds/
    │       └── mystika/
    ├── src/prompts/
    │   ├── assembler.ts
    │   ├── db-assembler.ts
    │   └── ...
    └── snapshot-manifest.json
```

### Idempotent Operation

The script is safe to run multiple times:
- Each run creates a new timestamped directory
- No existing files are overwritten
- Previous snapshots are preserved

## Logging and Monitoring

### Log Messages

The system logs which path is being used for each turn:

```
[TURNS] AWF bundle path would be used for game abc-123 (Phase 0 stub)
[TURNS] Legacy markdown path in use for game def-456
```

### Verification

To verify the feature flag is working:

1. **Check logs**: Look for the log messages above
2. **Test session override**: Set a session override and verify it takes precedence
3. **Test global flag**: Change `AWF_BUNDLE_ON` and verify behavior changes

## Rollback Instructions

### Global Rollback

1. Set `AWF_BUNDLE_ON=false` in your environment
2. Restart the application
3. All sessions will use the legacy markdown path

### Session Override Rollback

1. Clear specific session overrides:
   ```typescript
   clearAwfBundleOverride('session-123');
   ```

2. Clear all session overrides:
   ```typescript
   clearAllSessionOverrides();
   ```

### File Rollback

If you need to restore prompt files from a snapshot:

1. Locate the snapshot directory: `backend/backups/pre-awf/YYYYMMDD-HHmmss/`
2. Copy files back to their original locations
3. Restart the application

## Testing Strategy

### Phase 0 Testing

1. **Default behavior**: Verify `AWF_BUNDLE_ON=false` uses legacy path
2. **Global enable**: Set `AWF_BUNDLE_ON=true` and verify logs show AWF path
3. **Session override**: Test session-level overrides work correctly
4. **Snapshot script**: Run snapshot script and verify files are backed up

### Log Verification

Check that logs show the correct path selection:

```bash
# Should show legacy path
grep "Legacy markdown path" logs/

# Should show AWF path when enabled
grep "AWF bundle path would be used" logs/
```

## Next Steps

After Phase 0 is complete and tested:

1. **Phase 1**: Implement basic AWF bundle assembly
2. **Phase 2**: Add AWF bundle validation and error handling
3. **Phase 3**: Complete AWF bundle integration with full feature parity
4. **Phase 4**: Remove legacy markdown system

## Troubleshooting

### Common Issues

1. **Flag not working**: Check environment variable is set correctly
2. **Session override not working**: Verify session ID is being passed correctly
3. **Snapshot script fails**: Check file permissions and disk space
4. **Logs not showing**: Verify logging level and console output

### Debug Commands

```typescript
// Check global flag
console.log('Global AWF flag:', configService.getAwfBundleEnabled());

// Check session overrides
console.log('Session overrides:', getSessionOverrides());

// Check specific session
console.log('Session enabled:', isAwfBundleEnabled({ sessionId: 'test-session' }));
```

## Security Considerations

- Session overrides are stored in memory and will be lost on restart
- In production, consider using Redis or database for persistent session overrides
- Admin endpoints for session overrides should be properly authenticated
- Feature flags should be audited and logged for compliance


