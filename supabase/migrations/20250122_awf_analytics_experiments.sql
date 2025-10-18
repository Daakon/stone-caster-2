-- Phase 13: AWF Analytics & Experiments Support
-- Migration: 20250122_awf_analytics_experiments.sql

-- Create analytics_events table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id TEXT NOT NULL,
    player_hash TEXT NOT NULL, -- Hashed player ID for privacy
    world_ref TEXT NOT NULL,
    adventure_ref TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'en-US',
    experiment_key TEXT NULL,
    variation_key TEXT NULL,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create experiments table
CREATE TABLE IF NOT EXISTS experiments (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'stopped')),
    start_at TIMESTAMPTZ NULL,
    stop_at TIMESTAMPTZ NULL,
    hash_basis TEXT NOT NULL DEFAULT 'session' CHECK (hash_basis IN ('session', 'player')),
    allocations JSONB NOT NULL DEFAULT '[]'::jsonb,
    guardrails JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create experiment_variations table
CREATE TABLE IF NOT EXISTS experiment_variations (
    experiment_key TEXT NOT NULL REFERENCES experiments(key) ON DELETE CASCADE,
    variation_key TEXT NOT NULL,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (experiment_key, variation_key)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_ts ON analytics_events(ts);
CREATE INDEX IF NOT EXISTS idx_analytics_events_experiment ON analytics_events(experiment_key, variation_key, ts);
CREATE INDEX IF NOT EXISTS idx_analytics_events_world ON analytics_events(world_ref, ts);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id, ts);

-- Add RLS policies
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_variations ENABLE ROW LEVEL SECURITY;

-- RLS policies for analytics_events (admin only)
DROP POLICY IF EXISTS "Admin can manage analytics events" ON analytics_events;
CREATE POLICY "Admin can manage analytics events" ON analytics_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- RLS policies for experiments (admin only)
DROP POLICY IF EXISTS "Admin can manage experiments" ON experiments;
CREATE POLICY "Admin can manage experiments" ON experiments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- RLS policies for experiment_variations (admin only)
DROP POLICY IF EXISTS "Admin can manage experiment variations" ON experiment_variations;
CREATE POLICY "Admin can manage experiment variations" ON experiment_variations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Add trigger to update updated_at timestamp for experiments
CREATE OR REPLACE FUNCTION update_experiments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_experiments_updated_at ON experiments;
CREATE TRIGGER trigger_update_experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_experiments_updated_at();

-- Add trigger to update updated_at timestamp for experiment_variations
CREATE OR REPLACE FUNCTION update_experiment_variations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_experiment_variations_updated_at ON experiment_variations;
CREATE TRIGGER trigger_update_experiment_variations_updated_at
  BEFORE UPDATE ON experiment_variations
  FOR EACH ROW
  EXECUTE FUNCTION update_experiment_variations_updated_at();

-- Add comments
COMMENT ON TABLE analytics_events IS 'Captures AWF turn metrics and content signals with PII-safe payloads';
COMMENT ON TABLE experiments IS 'Defines A/B tests with variations that tweak runtime knobs';
COMMENT ON TABLE experiment_variations IS 'Stores parameter variations for experiments';

-- Insert default experiment for testing
INSERT INTO experiments (key, name, status, hash_basis, allocations, guardrails) VALUES 
('default-test', 'Default Test Experiment', 'draft', 'session', 
 '[{"variation":"control","percent":50},{"variation":"treatment","percent":50}]'::jsonb,
 '{"maxActs":8,"maxChoices":5,"txtSentenceCap":4,"toolMaxCalls":10,"maxOutputTokens":2000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Insert default variations
INSERT INTO experiment_variations (experiment_key, variation_key, params) VALUES 
('default-test', 'control', '{"maxOutputTokens":1500,"maxActs":6,"toolMaxCalls":8,"timeAdvanceTicks":1}'::jsonb),
('default-test', 'treatment', '{"maxOutputTokens":2000,"maxActs":8,"toolMaxCalls":10,"timeAdvanceTicks":2}'::jsonb)
ON CONFLICT (experiment_key, variation_key) DO NOTHING;


