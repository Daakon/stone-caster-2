-- Phase 27: Autonomous Playtesting Bots and Fuzz Harness
-- Database schema for autoplay runs, artifacts, and baselines

-- Autoplay runs table
CREATE TABLE autoplay_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario JSONB NOT NULL, -- Contains world, adventure, locale, experiment, variation, module toggles
    seed TEXT NOT NULL, -- Deterministic seed for reproducibility
    mode TEXT NOT NULL CHECK (mode IN ('objective_seeker', 'explorer', 'economy_grinder', 'romance_tester', 'risk_taker', 'safety_max')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    metrics JSONB, -- Coverage metrics, oracle results, performance data
    pass BOOLEAN, -- Whether the run passed all oracles
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Autoplay artifacts table
CREATE TABLE autoplay_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES autoplay_runs(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('json', 'html', 'png', 'svg', 'zip')),
    path TEXT NOT NULL, -- File path or storage key
    bytes BIGINT, -- File size in bytes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Autoplay baselines table
CREATE TABLE autoplay_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE, -- Format: world/adventure/version/locale/variation
    metrics JSONB NOT NULL, -- Baseline metrics for comparison
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_autoplay_runs_status ON autoplay_runs(status);
CREATE INDEX idx_autoplay_runs_mode ON autoplay_runs(mode);
CREATE INDEX idx_autoplay_runs_started_at ON autoplay_runs(started_at);
CREATE INDEX idx_autoplay_runs_scenario ON autoplay_runs USING GIN(scenario);
CREATE INDEX idx_autoplay_runs_metrics ON autoplay_runs USING GIN(metrics);

CREATE INDEX idx_autoplay_artifacts_run_id ON autoplay_artifacts(run_id);
CREATE INDEX idx_autoplay_artifacts_kind ON autoplay_artifacts(kind);

CREATE INDEX idx_autoplay_baselines_key ON autoplay_baselines(key);

-- RLS Policies (admin-only access)
ALTER TABLE autoplay_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE autoplay_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE autoplay_baselines ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admin can manage autoplay_runs" ON autoplay_runs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin can manage autoplay_artifacts" ON autoplay_artifacts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin can manage autoplay_baselines" ON autoplay_baselines
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_autoplay_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_autoplay_baselines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER trigger_autoplay_runs_updated_at
    BEFORE UPDATE ON autoplay_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_autoplay_runs_updated_at();

CREATE TRIGGER trigger_autoplay_baselines_updated_at
    BEFORE UPDATE ON autoplay_baselines
    FOR EACH ROW
    EXECUTE FUNCTION update_autoplay_baselines_updated_at();

-- Sample data for testing
INSERT INTO autoplay_baselines (key, metrics) VALUES 
('world.forest_glade/adventure.tutorial/v1.0.0/en_US/control', '{
    "coverage": {
        "quest_graph": 0.85,
        "dialogue": 0.72,
        "mechanics": 0.68,
        "economy": 0.91,
        "world_sim": 0.76,
        "mods": 0.45
    },
    "performance": {
        "avg_turn_latency_ms": 1250,
        "p95_turn_latency_ms": 2100,
        "avg_tokens_per_turn": 450,
        "max_tokens_per_turn": 800
    },
    "oracles": {
        "soft_locks": 0,
        "budget_violations": 0,
        "validator_retries": 0.02,
        "fallback_engagements": 0.01,
        "safety_violations": 0,
        "performance_violations": 0
    }
}'),
('world.forest_glade/adventure.tutorial/v1.0.0/en_US/variation_a', '{
    "coverage": {
        "quest_graph": 0.82,
        "dialogue": 0.75,
        "mechanics": 0.71,
        "economy": 0.88,
        "world_sim": 0.73,
        "mods": 0.42
    },
    "performance": {
        "avg_turn_latency_ms": 1180,
        "p95_turn_latency_ms": 1950,
        "avg_tokens_per_turn": 420,
        "max_tokens_per_turn": 750
    },
    "oracles": {
        "soft_locks": 0,
        "budget_violations": 0,
        "validator_retries": 0.03,
        "fallback_engagements": 0.02,
        "safety_violations": 0,
        "performance_violations": 0
    }
}');

-- Down migration
-- DROP TABLE IF EXISTS autoplay_artifacts CASCADE;
-- DROP TABLE IF EXISTS autoplay_runs CASCADE;
-- DROP TABLE IF EXISTS autoplay_baselines CASCADE;
-- DROP FUNCTION IF EXISTS update_autoplay_runs_updated_at() CASCADE;
-- DROP FUNCTION IF EXISTS update_autoplay_baselines_updated_at() CASCADE;
