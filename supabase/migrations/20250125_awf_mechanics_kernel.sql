-- Phase 16: AWF Mechanics Kernel
-- Migration: 20250125_awf_mechanics_kernel.sql

-- Create mechanics_skills table
CREATE TABLE IF NOT EXISTS mechanics_skills (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    baseline INTEGER NOT NULL DEFAULT 10,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create mechanics_conditions table
CREATE TABLE IF NOT EXISTS mechanics_conditions (
    id TEXT PRIMARY KEY,
    stacking TEXT NOT NULL DEFAULT 'none' CHECK (stacking IN ('none', 'add', 'cap')),
    cap INTEGER,
    cleanse_keys TEXT[] DEFAULT '{}',
    tick_hooks JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create mechanics_resources table
CREATE TABLE IF NOT EXISTS mechanics_resources (
    id TEXT PRIMARY KEY,
    min_value INTEGER NOT NULL DEFAULT 0,
    max_value INTEGER NOT NULL DEFAULT 100,
    regen_per_tick DECIMAL(5,2) DEFAULT 0,
    decay_per_tick DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_mechanics_skills_tags ON mechanics_skills USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_mechanics_conditions_stacking ON mechanics_conditions(stacking);
CREATE INDEX IF NOT EXISTS idx_mechanics_resources_regen ON mechanics_resources(regen_per_tick);
CREATE INDEX IF NOT EXISTS idx_mechanics_resources_decay ON mechanics_resources(decay_per_tick);

-- Add RLS policies
ALTER TABLE mechanics_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanics_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanics_resources ENABLE ROW LEVEL SECURITY;

-- RLS policies for mechanics tables (admin only)
DROP POLICY IF EXISTS "Admin can manage mechanics skills" ON mechanics_skills;
CREATE POLICY "Admin can manage mechanics skills" ON mechanics_skills
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admin can manage mechanics conditions" ON mechanics_conditions;
CREATE POLICY "Admin can manage mechanics conditions" ON mechanics_conditions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admin can manage mechanics resources" ON mechanics_resources;
CREATE POLICY "Admin can manage mechanics resources" ON mechanics_resources
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Add triggers to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mechanics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_mechanics_skills_updated_at ON mechanics_skills;
CREATE TRIGGER trigger_update_mechanics_skills_updated_at
  BEFORE UPDATE ON mechanics_skills
  FOR EACH ROW
  EXECUTE FUNCTION update_mechanics_updated_at();

DROP TRIGGER IF EXISTS trigger_update_mechanics_conditions_updated_at ON mechanics_conditions;
CREATE TRIGGER trigger_update_mechanics_conditions_updated_at
  BEFORE UPDATE ON mechanics_conditions
  FOR EACH ROW
  EXECUTE FUNCTION update_mechanics_updated_at();

DROP TRIGGER IF EXISTS trigger_update_mechanics_resources_updated_at ON mechanics_resources;
CREATE TRIGGER trigger_update_mechanics_resources_updated_at
  BEFORE UPDATE ON mechanics_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_mechanics_updated_at();

-- Add comments
COMMENT ON TABLE mechanics_skills IS 'Registry of available skills for skill checks';
COMMENT ON TABLE mechanics_conditions IS 'Registry of status conditions and their stacking rules';
COMMENT ON TABLE mechanics_resources IS 'Registry of resources with regen/decay curves';
COMMENT ON COLUMN mechanics_skills.baseline IS 'Default baseline value for this skill';
COMMENT ON COLUMN mechanics_skills.tags IS 'Tags for categorizing skills (e.g., combat, social, magic)';
COMMENT ON COLUMN mechanics_conditions.stacking IS 'How multiple instances of this condition stack';
COMMENT ON COLUMN mechanics_conditions.cap IS 'Maximum stack count (for capped stacking)';
COMMENT ON COLUMN mechanics_conditions.cleanse_keys IS 'Other conditions that cleanse this one';
COMMENT ON COLUMN mechanics_conditions.tick_hooks IS 'JSONB hooks that fire each TIME_ADVANCE';
COMMENT ON COLUMN mechanics_resources.regen_per_tick IS 'Amount regenerated per TIME_ADVANCE';
COMMENT ON COLUMN mechanics_resources.decay_per_tick IS 'Amount decayed per TIME_ADVANCE';

-- Insert default skills
INSERT INTO mechanics_skills (id, description, baseline, tags) VALUES 
('strength', 'Physical power and muscle', 10, ARRAY['physical', 'combat']),
('dexterity', 'Agility and reflexes', 10, ARRAY['physical', 'combat']),
('constitution', 'Endurance and health', 10, ARRAY['physical', 'survival']),
('intelligence', 'Reasoning and memory', 10, ARRAY['mental', 'magic']),
('wisdom', 'Perception and insight', 10, ARRAY['mental', 'survival']),
('charisma', 'Force of personality', 10, ARRAY['social', 'magic']),
('athletics', 'Physical feats and climbing', 8, ARRAY['physical', 'combat']),
('acrobatics', 'Balance and agility', 8, ARRAY['physical', 'combat']),
('stealth', 'Hiding and sneaking', 8, ARRAY['physical', 'social']),
('perception', 'Noticing details', 8, ARRAY['mental', 'survival']),
('investigation', 'Searching and analyzing', 8, ARRAY['mental', 'social']),
('insight', 'Reading people and situations', 8, ARRAY['mental', 'social']),
('persuasion', 'Convincing others', 8, ARRAY['social', 'magic']),
('intimidation', 'Inspiring fear', 8, ARRAY['social', 'combat']),
('deception', 'Lying and misdirection', 8, ARRAY['social', 'magic'])
ON CONFLICT (id) DO NOTHING;

-- Insert default conditions
INSERT INTO mechanics_conditions (id, stacking, cap, cleanse_keys, tick_hooks) VALUES 
('poisoned', 'add', 5, ARRAY['antidote', 'cure_poison'], '{"resource_deltas": [{"key": "hp", "delta": -1}]}'),
('stunned', 'none', NULL, ARRAY['cure_stun'], '{}'),
('bleeding', 'add', 3, ARRAY['heal', 'bandage'], '{"resource_deltas": [{"key": "hp", "delta": -2}]}'),
('blessed', 'none', NULL, ARRAY['curse', 'dispel'], '{"resource_deltas": [{"key": "mana", "delta": 1}]}'),
('guarded', 'none', NULL, ARRAY['dispel', 'break_guard'], '{}'),
('exhausted', 'add', 3, ARRAY['rest', 'energy_boost'], '{"resource_deltas": [{"key": "energy", "delta": -1}]}'),
('inspired', 'none', NULL, ARRAY['fear', 'dispel'], '{"resource_deltas": [{"key": "mana", "delta": 2}]}'),
('frightened', 'none', NULL, ARRAY['courage', 'calm'], '{"resource_deltas": [{"key": "stress", "delta": 1}]}')
ON CONFLICT (id) DO NOTHING;

-- Insert default resources
INSERT INTO mechanics_resources (id, min_value, max_value, regen_per_tick, decay_per_tick) VALUES 
('hp', 0, 100, 0, 0),
('energy', 0, 100, 2, 0),
('mana', 0, 100, 1, 0),
('stress', 0, 100, 0, 1),
('favor', 0, 100, 0, 0),
('stamina', 0, 100, 1, 0)
ON CONFLICT (id) DO NOTHING;

-- Add status map to game_states if not present
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_states' AND column_name = 'status'
    ) THEN
        ALTER TABLE game_states ADD COLUMN status JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Create function to get skill baseline
CREATE OR REPLACE FUNCTION get_skill_baseline(p_skill_id TEXT)
RETURNS INTEGER AS $$
BEGIN
    SELECT baseline INTO STRICT p_skill_id FROM mechanics_skills WHERE id = p_skill_id;
    RETURN p_skill_id;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 10; -- Default baseline
END;
$$ LANGUAGE plpgsql;

-- Create function to get condition stacking rules
CREATE OR REPLACE FUNCTION get_condition_stacking(p_condition_id TEXT)
RETURNS TABLE (
    stacking TEXT,
    cap INTEGER,
    cleanse_keys TEXT[],
    tick_hooks JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mc.stacking,
        mc.cap,
        mc.cleanse_keys,
        mc.tick_hooks
    FROM mechanics_conditions mc
    WHERE mc.id = p_condition_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get resource curves
CREATE OR REPLACE FUNCTION get_resource_curves(p_resource_id TEXT)
RETURNS TABLE (
    min_value INTEGER,
    max_value INTEGER,
    regen_per_tick DECIMAL(5,2),
    decay_per_tick DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mr.min_value,
        mr.max_value,
        mr.regen_per_tick,
        mr.decay_per_tick
    FROM mechanics_resources mr
    WHERE mr.id = p_resource_id;
END;
$$ LANGUAGE plpgsql;


