-- Phase 14: NPC Personality Evolution
-- Migration: 20250123_awf_npc_personalities.sql

-- Create npc_personalities table
CREATE TABLE IF NOT EXISTS npc_personalities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    npc_ref TEXT NOT NULL,
    world_ref TEXT NOT NULL,
    adventure_ref TEXT,
    traits JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    snapshot_version INTEGER DEFAULT 1,
    derived_from_session TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_npc_personalities_npc_world ON npc_personalities(npc_ref, world_ref);
CREATE INDEX IF NOT EXISTS idx_npc_personalities_npc_adventure ON npc_personalities(npc_ref, adventure_ref);
CREATE INDEX IF NOT EXISTS idx_npc_personalities_last_updated ON npc_personalities(last_updated);
CREATE INDEX IF NOT EXISTS idx_npc_personalities_snapshot_version ON npc_personalities(snapshot_version);

-- Add unique constraints for mergeable personalities
ALTER TABLE npc_personalities 
ADD CONSTRAINT npc_personalities_unique_adventure 
UNIQUE (npc_ref, world_ref, adventure_ref);

-- Note: We can't have a partial unique constraint with WHERE clause in ALTER TABLE
-- So we'll handle the world-level uniqueness in the application logic

-- Add RLS policies
ALTER TABLE npc_personalities ENABLE ROW LEVEL SECURITY;

-- RLS policies for npc_personalities (admin only)
DROP POLICY IF EXISTS "Admin can manage npc personalities" ON npc_personalities;
CREATE POLICY "Admin can manage npc personalities" ON npc_personalities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_npc_personalities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_npc_personalities_updated_at ON npc_personalities;
CREATE TRIGGER trigger_update_npc_personalities_updated_at
  BEFORE UPDATE ON npc_personalities
  FOR EACH ROW
  EXECUTE FUNCTION update_npc_personalities_updated_at();

-- Add comments
COMMENT ON TABLE npc_personalities IS 'Stores persistent NPC personality traits that evolve through interactions';
COMMENT ON COLUMN npc_personalities.npc_ref IS 'Reference to the NPC (e.g., "guard_001", "merchant_elena")';
COMMENT ON COLUMN npc_personalities.world_ref IS 'World context for personality (e.g., "mystika", "veyra")';
COMMENT ON COLUMN npc_personalities.adventure_ref IS 'Adventure context (null for world-level personalities)';
COMMENT ON COLUMN npc_personalities.traits IS 'JSONB object with trait scores (0-100) and metadata';
COMMENT ON COLUMN npc_personalities.summary IS 'Textual description of personality archetype';
COMMENT ON COLUMN npc_personalities.snapshot_version IS 'Version number for tracking personality evolution';
COMMENT ON COLUMN npc_personalities.derived_from_session IS 'Session ID that last updated this personality';

-- Insert default personality traits schema
INSERT INTO npc_personalities (npc_ref, world_ref, adventure_ref, traits, summary, snapshot_version) VALUES 
('default_archetype', 'system', 'system_default',
 '{
   "openness": 50,
   "loyalty": 50,
   "caution": 50,
   "empathy": 50,
   "patience": 50,
   "aggression": 50,
   "trust": 50,
   "curiosity": 50,
   "stubbornness": 50,
   "humor": 50
 }'::jsonb,
 'Balanced personality with neutral traits across all dimensions',
 1)
ON CONFLICT (npc_ref, world_ref, adventure_ref) DO NOTHING;

-- Create function to get NPC personality
CREATE OR REPLACE FUNCTION get_npc_personality(
    p_npc_ref TEXT,
    p_world_ref TEXT,
    p_adventure_ref TEXT DEFAULT NULL
)
RETURNS TABLE (
    traits JSONB,
    summary TEXT,
    last_updated TIMESTAMPTZ,
    snapshot_version INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        np.traits,
        np.summary,
        np.last_updated,
        np.snapshot_version
    FROM npc_personalities np
    WHERE np.npc_ref = p_npc_ref
    AND np.world_ref = p_world_ref
    AND (np.adventure_ref = p_adventure_ref OR (np.adventure_ref IS NULL AND p_adventure_ref IS NULL))
    ORDER BY np.last_updated DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create function to update NPC personality
CREATE OR REPLACE FUNCTION update_npc_personality(
    p_npc_ref TEXT,
    p_world_ref TEXT,
    p_adventure_ref TEXT DEFAULT NULL,
    p_traits JSONB DEFAULT NULL,
    p_summary TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_new_version INTEGER;
    v_existing_id UUID;
BEGIN
    -- Get current version
    SELECT COALESCE(MAX(snapshot_version), 0) + 1 INTO v_new_version
    FROM npc_personalities
    WHERE npc_ref = p_npc_ref AND world_ref = p_world_ref;
    
    -- Check if record exists
    SELECT id INTO v_existing_id
    FROM npc_personalities
    WHERE npc_ref = p_npc_ref 
    AND world_ref = p_world_ref 
    AND (adventure_ref = p_adventure_ref OR (adventure_ref IS NULL AND p_adventure_ref IS NULL));
    
    IF v_existing_id IS NOT NULL THEN
        -- Update existing record
        UPDATE npc_personalities SET
            traits = COALESCE(p_traits, traits),
            summary = COALESCE(p_summary, summary),
            snapshot_version = v_new_version,
            derived_from_session = p_session_id,
            last_updated = NOW()
        WHERE id = v_existing_id
        RETURNING id INTO v_id;
    ELSE
        -- Insert new record
        INSERT INTO npc_personalities (
            npc_ref, world_ref, adventure_ref, traits, summary, 
            snapshot_version, derived_from_session
        ) VALUES (
            p_npc_ref, p_world_ref, p_adventure_ref, 
            COALESCE(p_traits, '{}'::jsonb),
            p_summary,
            v_new_version,
            p_session_id
        )
        RETURNING id INTO v_id;
    END IF;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;
