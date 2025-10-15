# Enhanced Turn Recording Migration Plan

## Overview

This migration enhances the turn recording system to persist initialize narrative and every turn's data for offline play. It separates realtime client data from analytics-grade storage to optimize performance and enable offline narrative loading.

## Migration Details

### Schema Changes

#### New Columns in `turns` Table
- `user_prompt` (TEXT): User input text shown to AI for this turn
- `narrative_summary` (TEXT): Player-facing narrative snippet from AI response
- `is_initialization` (BOOLEAN): True if this is the initial narrative turn
- `session_id` (UUID): Reference to the game session (same as game_id for compatibility)
- `sequence` (INTEGER): Turn sequence number within the session

#### New `turn_analytics` Table
- `id` (UUID): Primary key
- `turn_id` (UUID): Reference to turns table
- `raw_ai_response` (JSONB): Complete raw AI response payload
- `raw_user_prompt` (TEXT): Complete user prompt sent to AI
- `raw_system_prompt` (TEXT): System prompt used for this turn
- `model_identifier` (VARCHAR): AI model used (e.g., gpt-4, claude-3)
- `token_count` (INTEGER): Token count for the request/response
- `processing_time_ms` (INTEGER): Total processing time in milliseconds
- `prompt_metadata` (JSONB): Metadata about prompt construction
- `response_metadata` (JSONB): Metadata about AI response processing
- `created_at` (TIMESTAMPTZ): Creation timestamp

#### Indexes Added
- `idx_turns_session_id`: Fast session lookups
- `idx_turns_sequence`: Turn ordering within sessions
- `idx_turns_is_initialization`: Initialize narrative queries
- `idx_turn_analytics_turn_id`: Analytics lookups
- `idx_turn_analytics_model`: Model-based analytics

### Data Migration

#### Existing Data Backfill
1. **Update existing turns** with new fields:
   - Set `session_id = game_id` for compatibility
   - Set `sequence = turn_number` for ordering
   - Extract `narrative_summary` from `ai_response.narrative` or `ai_response.txt`
   - Set `is_initialization = (turn_number = 1)`
   - Set `user_prompt` from existing `user_input` field

2. **Create analytics records** for existing turns:
   - Populate `turn_analytics` table with existing turn data
   - Use existing `ai_response`, `user_input`, and metadata fields
   - Handle missing data gracefully with NULL values

#### Trigger-Based Analytics Population
- **Automatic trigger** creates analytics records when new turns are inserted
- **Backward compatibility** maintained for existing turn creation flows
- **Error handling** for missing analytics data

### API Changes

#### New Endpoints
- `GET /api/games/:id/session-turns`: Fetch session turns with narrative data for offline play
- Returns `SessionTurnsResponse` with turns array and initialize_narrative

#### Enhanced Turn Recording
- **Realtime data**: User prompts, narrative summaries, initialization flags
- **Analytics data**: Raw AI responses, prompts, metadata, token counts
- **Offline support**: Initialize narrative cached for immediate loading

### Backend Service Updates

#### Games Service
- `getSessionTurns(gameId)`: Fetch turns with narrative data
- `getInitializeNarrative(gameId)`: Get cached initialize narrative
- Enhanced `applyTurn()` with new recording fields

#### Turns Service
- **Initialize narrative caching**: Check for existing narrative before AI generation
- **Offline loading**: Return cached data when available
- **Analytics population**: Automatic analytics record creation

### Frontend Integration

#### Offline Narrative Loading
- **Session turns API**: Fetch cached narrative data
- **No AI calls**: Use cached initialize narrative when available
- **Mobile-first**: Optimized for 375×812 viewport
- **Accessibility**: Screen reader support for narrative content

#### React Query Hooks
- **Session turns hook**: Fetch and cache session turn data
- **Initialize narrative hook**: Get cached initialize narrative
- **Optimistic updates**: Maintain UI responsiveness

## Rollback Plan

### Database Rollback
1. **Drop new columns** from `turns` table:
   ```sql
   ALTER TABLE turns DROP COLUMN IF EXISTS user_prompt;
   ALTER TABLE turns DROP COLUMN IF EXISTS narrative_summary;
   ALTER TABLE turns DROP COLUMN IF EXISTS is_initialization;
   ALTER TABLE turns DROP COLUMN IF EXISTS session_id;
   ALTER TABLE turns DROP COLUMN IF EXISTS sequence;
   ```

2. **Drop analytics table**:
   ```sql
   DROP TABLE IF EXISTS turn_analytics;
   ```

3. **Drop indexes**:
   ```sql
   DROP INDEX IF EXISTS idx_turns_session_id;
   DROP INDEX IF EXISTS idx_turns_sequence;
   DROP INDEX IF EXISTS idx_turns_is_initialization;
   DROP INDEX IF EXISTS idx_turn_analytics_turn_id;
   DROP INDEX IF EXISTS idx_turn_analytics_model;
   ```

4. **Drop trigger**:
   ```sql
   DROP TRIGGER IF EXISTS trigger_create_turn_analytics ON turns;
   DROP FUNCTION IF EXISTS create_turn_analytics();
   ```

### Code Rollback
1. **Remove new API endpoints** from games router
2. **Revert service methods** to previous implementations
3. **Remove frontend hooks** for session turns
4. **Restore original turn recording** logic

### Data Preservation
- **Existing turns preserved**: No data loss during rollback
- **Analytics data**: Can be safely dropped without affecting gameplay
- **Backward compatibility**: Original turn structure maintained

## Testing Strategy

### Migration Testing
1. **Schema validation**: Verify all new columns and tables created
2. **Data backfill**: Confirm existing data migrated correctly
3. **Trigger testing**: Verify analytics records created automatically
4. **API testing**: Test new session turns endpoint
5. **Frontend testing**: Verify offline narrative loading works

### Rollback Testing
1. **Rollback procedure**: Test complete rollback process
2. **Data integrity**: Verify no data loss during rollback
3. **Functionality**: Confirm original behavior restored
4. **Performance**: Ensure no performance degradation

### Performance Testing
1. **Query performance**: Test new indexes and queries
2. **Analytics storage**: Verify analytics table performance
3. **Frontend loading**: Test offline narrative loading speed
4. **Memory usage**: Monitor memory consumption

## Risk Assessment

### Low Risk
- **Schema changes**: Additive only, no breaking changes
- **Data migration**: Existing data preserved and enhanced
- **Backward compatibility**: Original functionality maintained

### Medium Risk
- **Analytics storage**: Large JSONB fields may impact performance
- **Trigger overhead**: Automatic analytics creation adds processing time
- **Frontend changes**: New offline loading logic needs testing

### Mitigation Strategies
- **Indexes**: Optimize query performance with proper indexing
- **Monitoring**: Track analytics table size and query performance
- **Fallback**: Graceful degradation when analytics data unavailable
- **Testing**: Comprehensive testing of offline loading scenarios

## Success Criteria

### Functional Requirements
- ✅ Initialize narrative persisted and retrievable
- ✅ Session turns API returns cached narrative data
- ✅ Offline play works without AI calls
- ✅ Analytics data captured for all turns
- ✅ Mobile-first design maintained
- ✅ Accessibility compliance preserved

### Performance Requirements
- ✅ Session turns query < 100ms
- ✅ Initialize narrative query < 50ms
- ✅ Analytics record creation < 200ms
- ✅ Frontend offline loading < 500ms
- ✅ No performance degradation for existing flows

### Quality Requirements
- ✅ Zero data loss during migration
- ✅ Backward compatibility maintained
- ✅ Rollback procedure tested and documented
- ✅ Comprehensive test coverage
- ✅ Documentation updated

## Timeline

### Phase 1: Schema Migration (Day 1)
- Deploy database migration
- Verify schema changes
- Test data backfill
- Validate indexes and triggers

### Phase 2: Backend Updates (Day 2)
- Deploy backend service changes
- Test new API endpoints
- Verify analytics population
- Test offline narrative loading

### Phase 3: Frontend Integration (Day 3)
- Deploy frontend changes
- Test offline narrative loading
- Verify mobile responsiveness
- Test accessibility compliance

### Phase 4: Monitoring & Optimization (Day 4-7)
- Monitor performance metrics
- Optimize queries if needed
- Gather user feedback
- Document lessons learned

## Monitoring

### Key Metrics
- **Session turns query time**: Target < 100ms
- **Initialize narrative query time**: Target < 50ms
- **Analytics table size**: Monitor growth rate
- **Offline loading success rate**: Target > 99%
- **Error rates**: Monitor for new error patterns

### Alerts
- **Query performance**: Alert if queries exceed targets
- **Analytics storage**: Alert if table size grows unexpectedly
- **Error rates**: Alert if error rates increase
- **Frontend loading**: Alert if offline loading fails

### Dashboards
- **Turn recording metrics**: Track recording success rates
- **Analytics data volume**: Monitor storage usage
- **Offline loading performance**: Track loading times
- **Error monitoring**: Track and categorize errors
