-- Phase 24: Metrics Warehouse & Dashboards
-- Rollup tables and incremental jobs for analytics/experiments pipeline

-- Daily rollup table for comprehensive metrics aggregation
CREATE TABLE awf_rollup_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    world TEXT,
    adventure TEXT,
    locale TEXT,
    model TEXT,
    experiment TEXT,
    variation TEXT,
    content_version TEXT,
    
    -- Session metrics
    turns INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    
    -- Performance metrics
    p50_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    avg_in_tokens INTEGER,
    avg_out_tokens INTEGER,
    
    -- Quality metrics
    retry_rate DECIMAL(5,4),
    fallback_rate DECIMAL(5,4),
    validator_retry_rate DECIMAL(5,4),
    stuck_rate DECIMAL(5,4),
    
    -- Game metrics
    avg_ticks DECIMAL(10,2),
    tool_calls_per_turn DECIMAL(5,2),
    acts_per_turn DECIMAL(5,2),
    choices_per_turn DECIMAL(5,2),
    
    -- Narrative health
    softlock_hints_rate DECIMAL(5,4),
    econ_velocity DECIMAL(10,2),
    
    -- Economy metrics
    craft_success_rate DECIMAL(5,4),
    vendor_trade_rate DECIMAL(5,4),
    party_recruits_rate DECIMAL(5,4),
    
    -- Dialogue metrics
    dialogue_candidate_avg DECIMAL(5,2),
    romance_consent_rate DECIMAL(5,4),
    
    -- World simulation
    event_trigger_rate DECIMAL(5,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hourly rollup table for real-time monitoring
CREATE TABLE awf_rollup_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_hour TIMESTAMPTZ NOT NULL,
    world TEXT,
    adventure TEXT,
    locale TEXT,
    model TEXT,
    experiment TEXT,
    variation TEXT,
    
    -- Core metrics (subset of daily)
    turns INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    p95_latency_ms INTEGER,
    retry_rate DECIMAL(5,4),
    fallback_rate DECIMAL(5,4),
    stuck_rate DECIMAL(5,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Funnel analysis table
CREATE TABLE awf_funnels_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    adventure TEXT NOT NULL,
    world TEXT,
    experiment TEXT,
    variation TEXT,
    
    -- Funnel steps
    start_count INTEGER DEFAULT 0,
    first_choice_count INTEGER DEFAULT 0,
    first_npc_join_count INTEGER DEFAULT 0,
    first_craft_count INTEGER DEFAULT 0,
    first_vendor_count INTEGER DEFAULT 0,
    first_boss_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    
    -- Conversion rates
    start_to_choice_rate DECIMAL(5,4),
    choice_to_npc_rate DECIMAL(5,4),
    npc_to_craft_rate DECIMAL(5,4),
    craft_to_vendor_rate DECIMAL(5,4),
    vendor_to_boss_rate DECIMAL(5,4),
    boss_to_completion_rate DECIMAL(5,4),
    overall_completion_rate DECIMAL(5,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SLO thresholds and alerting configuration
CREATE TABLE awf_kpi_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope TEXT NOT NULL, -- 'global', 'world', 'adventure', 'variation'
    scope_ref TEXT, -- world_id, adventure_id, variation_id
    kpi_name TEXT NOT NULL,
    threshold_value DECIMAL(10,4) NOT NULL,
    threshold_operator TEXT NOT NULL CHECK (threshold_operator IN ('>', '<', '>=', '<=', '=', '!=')),
    severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
    enabled BOOLEAN DEFAULT true,
    suggested_actions JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard views and saved filters
CREATE TABLE awf_dashboard_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    dashboard_type TEXT NOT NULL, -- 'overview', 'narrative', 'economy', 'party', 'sim', 'experiments'
    filters JSONB NOT NULL DEFAULT '{}',
    layout JSONB NOT NULL DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incident tracking for SLO breaches
CREATE TABLE awf_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    threshold_id UUID REFERENCES awf_kpi_thresholds(id),
    severity TEXT NOT NULL,
    kpi_name TEXT NOT NULL,
    current_value DECIMAL(10,4) NOT NULL,
    threshold_value DECIMAL(10,4) NOT NULL,
    scope TEXT NOT NULL,
    scope_ref TEXT,
    suggested_actions JSONB,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'resolved')),
    acknowledged_by UUID REFERENCES auth.users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_awf_rollup_daily_date ON awf_rollup_daily(date);
CREATE INDEX idx_awf_rollup_daily_world ON awf_rollup_daily(world);
CREATE INDEX idx_awf_rollup_daily_adventure ON awf_rollup_daily(adventure);
CREATE INDEX idx_awf_rollup_daily_experiment ON awf_rollup_daily(experiment);
CREATE INDEX idx_awf_rollup_daily_variation ON awf_rollup_daily(variation);
CREATE INDEX idx_awf_rollup_daily_date_world ON awf_rollup_daily(date, world);
CREATE INDEX idx_awf_rollup_daily_date_adventure ON awf_rollup_daily(date, adventure);

CREATE INDEX idx_awf_rollup_hourly_date_hour ON awf_rollup_hourly(date_hour);
CREATE INDEX idx_awf_rollup_hourly_world ON awf_rollup_hourly(world);
CREATE INDEX idx_awf_rollup_hourly_adventure ON awf_rollup_hourly(adventure);
CREATE INDEX idx_awf_rollup_hourly_experiment ON awf_rollup_hourly(experiment);

CREATE INDEX idx_awf_funnels_daily_date ON awf_funnels_daily(date);
CREATE INDEX idx_awf_funnels_daily_adventure ON awf_funnels_daily(adventure);
CREATE INDEX idx_awf_funnels_daily_experiment ON awf_funnels_daily(experiment);

CREATE INDEX idx_awf_kpi_thresholds_scope ON awf_kpi_thresholds(scope, scope_ref);
CREATE INDEX idx_awf_kpi_thresholds_enabled ON awf_kpi_thresholds(enabled);

CREATE INDEX idx_awf_incidents_status ON awf_incidents(status);
CREATE INDEX idx_awf_incidents_created_at ON awf_incidents(created_at);
CREATE INDEX idx_awf_incidents_threshold_id ON awf_incidents(threshold_id);

-- RLS Policies
ALTER TABLE awf_rollup_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_rollup_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_funnels_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_kpi_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_dashboard_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_incidents ENABLE ROW LEVEL SECURITY;

-- Admin-only access to metrics data
CREATE POLICY "Admin only access to rollup data" ON awf_rollup_daily
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin only access to hourly rollup data" ON awf_rollup_hourly
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin only access to funnel data" ON awf_funnels_daily
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin only access to KPI thresholds" ON awf_kpi_thresholds
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin and editor access to dashboard views" ON awf_dashboard_views
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role IN ('admin', 'editor')
        )
    );

CREATE POLICY "Admin only access to incidents" ON awf_incidents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Functions for rollup calculations
CREATE OR REPLACE FUNCTION calculate_stuck_rate(
    total_sessions INTEGER,
    stuck_sessions INTEGER
) RETURNS DECIMAL(5,4) AS $$
BEGIN
    IF total_sessions = 0 THEN
        RETURN 0;
    END IF;
    RETURN ROUND(stuck_sessions::DECIMAL / total_sessions, 4);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_economy_velocity(
    gold_delta DECIMAL,
    turns_count INTEGER
) RETURNS DECIMAL(10,2) AS $$
BEGIN
    IF turns_count = 0 THEN
        RETURN 0;
    END IF;
    RETURN ROUND(gold_delta / (turns_count / 100.0), 2);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_conversion_rate(
    numerator INTEGER,
    denominator INTEGER
) RETURNS DECIMAL(5,4) AS $$
BEGIN
    IF denominator = 0 THEN
        RETURN 0;
    END IF;
    RETURN ROUND(numerator::DECIMAL / denominator, 4);
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_awf_rollup_daily_updated_at
    BEFORE UPDATE ON awf_rollup_daily
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_awf_kpi_thresholds_updated_at
    BEFORE UPDATE ON awf_kpi_thresholds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_awf_dashboard_views_updated_at
    BEFORE UPDATE ON awf_dashboard_views
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Down migration
-- DROP TABLE IF EXISTS awf_incidents CASCADE;
-- DROP TABLE IF EXISTS awf_dashboard_views CASCADE;
-- DROP TABLE IF EXISTS awf_kpi_thresholds CASCADE;
-- DROP TABLE IF EXISTS awf_funnels_daily CASCADE;
-- DROP TABLE IF EXISTS awf_rollup_hourly CASCADE;
-- DROP TABLE IF EXISTS awf_rollup_daily CASCADE;
-- DROP FUNCTION IF EXISTS calculate_stuck_rate(INTEGER, INTEGER);
-- DROP FUNCTION IF EXISTS calculate_economy_velocity(DECIMAL, INTEGER);
-- DROP FUNCTION IF EXISTS calculate_conversion_rate(INTEGER, INTEGER);
-- DROP FUNCTION IF EXISTS update_updated_at_column();
