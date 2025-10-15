-- Enhanced Turn Recording Schema
-- Separates realtime client data from analytics-grade storage
-- This migration enhances the existing turns table and adds analytics storage

-- First, let's add the missing columns to the existing turns table for realtime data
ALTER TABLE turns ADD COLUMN IF NOT EXISTS user_prompt TEXT;
ALTER TABLE turns ADD COLUMN IF NOT EXISTS narrative_summary TEXT;
ALTER TABLE turns ADD COLUMN IF NOT EXISTS is_initialization BOOLEAN DEFAULT FALSE;
ALTER TABLE turns ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES games(id) ON DELETE CASCADE;
ALTER TABLE turns ADD COLUMN IF NOT EXISTS sequence INTEGER;

-- Create analytics table for heavy data storage
CREATE TABLE IF NOT EXISTS turn_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turn_id UUID NOT NULL REFERENCES turns(id) ON DELETE CASCADE,
  raw_ai_response JSONB NOT NULL,
  raw_user_prompt TEXT,
  raw_system_prompt TEXT,
  model_identifier VARCHAR(100),
  token_count INTEGER,
  processing_time_ms INTEGER,
  prompt_metadata JSONB,
  response_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_turns_session_id ON turns(session_id);
CREATE INDEX IF NOT EXISTS idx_turns_sequence ON turns(session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_turns_is_initialization ON turns(is_initialization);
CREATE INDEX IF NOT EXISTS idx_turns_user_prompt ON turns(user_prompt);
CREATE INDEX IF NOT EXISTS idx_turns_narrative_summary ON turns(narrative_summary);

CREATE INDEX IF NOT EXISTS idx_turn_analytics_turn_id ON turn_analytics(turn_id);
CREATE INDEX IF NOT EXISTS idx_turn_analytics_model ON turn_analytics(model_identifier);
CREATE INDEX IF NOT EXISTS idx_turn_analytics_created_at ON turn_analytics(created_at);

-- Update existing turns to populate new fields
UPDATE turns 
SET 
  session_id = game_id,
  sequence = turn_number,
  user_prompt = COALESCE(user_input, ''),
  narrative_summary = COALESCE(
    (ai_response->>'narrative')::text,
    (ai_response->>'txt')::text,
    'Narrative not available'
  ),
  is_initialization = (turn_number = 1)
WHERE session_id IS NULL;

-- Add RLS policies for turn_analytics
ALTER TABLE turn_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access analytics for their own games
CREATE POLICY "Users can view analytics for own games" ON turn_analytics
  FOR SELECT USING (
    turn_id IN (
      SELECT t.id FROM turns t
      JOIN games g ON t.game_id = g.id
      WHERE g.user_id = auth.uid() OR g.cookie_group_id IN (
        SELECT id FROM cookie_groups WHERE user_id = auth.uid()
      )
    )
  );

-- Policy: Service role can manage all analytics
CREATE POLICY "Service role can manage all analytics" ON turn_analytics
  FOR ALL TO service_role USING (TRUE);

-- Add comments for documentation
COMMENT ON TABLE turns IS 'Realtime turn data for client display - stores user prompts, narrative summaries, and basic metadata';
COMMENT ON TABLE turn_analytics IS 'Analytics-grade storage for raw AI responses, prompts, and detailed metadata';

COMMENT ON COLUMN turns.user_prompt IS 'User input text shown to AI for this turn';
COMMENT ON COLUMN turns.narrative_summary IS 'Player-facing narrative snippet from AI response';
COMMENT ON COLUMN turns.is_initialization IS 'True if this is the initial narrative turn';
COMMENT ON COLUMN turns.session_id IS 'Reference to the game session (same as game_id for compatibility)';
COMMENT ON COLUMN turns.sequence IS 'Turn sequence number within the session';

COMMENT ON COLUMN turn_analytics.raw_ai_response IS 'Complete raw AI response payload';
COMMENT ON COLUMN turn_analytics.raw_user_prompt IS 'Complete user prompt sent to AI';
COMMENT ON COLUMN turn_analytics.raw_system_prompt IS 'System prompt used for this turn';
COMMENT ON COLUMN turn_analytics.model_identifier IS 'AI model used (e.g., gpt-4, claude-3)';
COMMENT ON COLUMN turn_analytics.token_count IS 'Token count for the request/response';
COMMENT ON COLUMN turn_analytics.processing_time_ms IS 'Total processing time in milliseconds';
COMMENT ON COLUMN turn_analytics.prompt_metadata IS 'Metadata about prompt construction';
COMMENT ON COLUMN turn_analytics.response_metadata IS 'Metadata about AI response processing';

-- Create function to automatically create analytics record when turn is created
CREATE OR REPLACE FUNCTION create_turn_analytics()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create analytics record if we have the required data
  IF NEW.ai_response IS NOT NULL THEN
    INSERT INTO turn_analytics (
      turn_id,
      raw_ai_response,
      raw_user_prompt,
      model_identifier,
      token_count,
      processing_time_ms,
      prompt_metadata,
      response_metadata
    ) VALUES (
      NEW.id,
      NEW.ai_response,
      NEW.user_input,
      NEW.model_used,
      NEW.token_count,
      NEW.processing_time_ms,
      NEW.prompt_metadata,
      NEW.ai_response_metadata
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically populate analytics
CREATE TRIGGER trigger_create_turn_analytics
  AFTER INSERT ON turns
  FOR EACH ROW
  EXECUTE FUNCTION create_turn_analytics();

-- Update existing turns to create analytics records
INSERT INTO turn_analytics (
  turn_id,
  raw_ai_response,
  raw_user_prompt,
  model_identifier,
  token_count,
  processing_time_ms,
  prompt_metadata,
  response_metadata
)
SELECT 
  t.id,
  t.ai_response,
  t.user_input,
  t.model_used,
  t.token_count,
  t.processing_time_ms,
  t.prompt_metadata,
  t.ai_response_metadata
FROM turns t
WHERE NOT EXISTS (
  SELECT 1 FROM turn_analytics ta WHERE ta.turn_id = t.id
)
AND t.ai_response IS NOT NULL;