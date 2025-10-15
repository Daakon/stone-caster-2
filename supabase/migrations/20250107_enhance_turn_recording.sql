-- Enhanced Turn Recording Schema
-- Adds comprehensive turn data recording including user input, prompt data, and AI response metadata

-- Add new columns to turns table for comprehensive turn recording
ALTER TABLE turns ADD COLUMN IF NOT EXISTS turn_number INTEGER;
ALTER TABLE turns ADD COLUMN IF NOT EXISTS user_input TEXT;
ALTER TABLE turns ADD COLUMN IF NOT EXISTS user_input_type VARCHAR(50) DEFAULT 'choice'; -- 'choice', 'text', 'action'
ALTER TABLE turns ADD COLUMN IF NOT EXISTS prompt_data JSONB;
ALTER TABLE turns ADD COLUMN IF NOT EXISTS prompt_metadata JSONB;
ALTER TABLE turns ADD COLUMN IF NOT EXISTS ai_response_metadata JSONB;
ALTER TABLE turns ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE turns ADD COLUMN IF NOT EXISTS token_count INTEGER;
ALTER TABLE turns ADD COLUMN IF NOT EXISTS model_used VARCHAR(100);
ALTER TABLE turns ADD COLUMN IF NOT EXISTS prompt_id VARCHAR(255);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_turns_turn_number ON turns(game_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_turns_user_input_type ON turns(user_input_type);
CREATE INDEX IF NOT EXISTS idx_turns_processing_time ON turns(processing_time_ms);
CREATE INDEX IF NOT EXISTS idx_turns_model_used ON turns(model_used);
CREATE INDEX IF NOT EXISTS idx_turns_prompt_id ON turns(prompt_id);

-- Add comments for documentation
COMMENT ON COLUMN turns.turn_number IS 'Sequential turn number within the game';
COMMENT ON COLUMN turns.user_input IS 'Raw user input text or action taken';
COMMENT ON COLUMN turns.user_input_type IS 'Type of user input: choice, text, action';
COMMENT ON COLUMN turns.prompt_data IS 'Complete prompt data sent to AI including context and sections';
COMMENT ON COLUMN turns.prompt_metadata IS 'Metadata about prompt creation (sections, token count, etc.)';
COMMENT ON COLUMN turns.ai_response_metadata IS 'Metadata about AI response (model, timing, validation, etc.)';
COMMENT ON COLUMN turns.processing_time_ms IS 'Total processing time for the turn in milliseconds';
COMMENT ON COLUMN turns.token_count IS 'Token count for the prompt sent to AI';
COMMENT ON COLUMN turns.model_used IS 'AI model used for generating the response';
COMMENT ON COLUMN turns.prompt_id IS 'Unique identifier for the prompt sent to AI';

-- Update existing turns to have turn_number (backfill)
UPDATE turns 
SET turn_number = subquery.row_number
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY created_at) as row_number
  FROM turns
) subquery
WHERE turns.id = subquery.id AND turns.turn_number IS NULL;
