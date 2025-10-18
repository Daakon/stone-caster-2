-- Phase 25: Operations Hardening
-- Rate limits, quotas, backpressure, circuit breakers, and incident tracking

-- Rate limits configuration and tracking
CREATE TABLE awf_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope TEXT NOT NULL, -- 'user', 'session', 'device', 'ip', 'global'
    key TEXT NOT NULL, -- user_id, session_id, device_id, ip_address, 'global'
    window_seconds INTEGER NOT NULL, -- time window in seconds
    max_requests INTEGER NOT NULL, -- max requests per window
    burst_limit INTEGER DEFAULT 0, -- burst allowance
    current_count INTEGER DEFAULT 0,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(scope, key, window_seconds)
);

-- Quota buckets for different features
CREATE TABLE awf_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_hash TEXT,
    session_id TEXT,
    daily_turn_cap INTEGER DEFAULT 1000,
    tool_cap INTEGER DEFAULT 100,
    bytes_cap BIGINT DEFAULT 10485760, -- 10MB
    current_turns INTEGER DEFAULT 0,
    current_tools INTEGER DEFAULT 0,
    current_bytes BIGINT DEFAULT 0,
    resets_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CHECK (user_hash IS NOT NULL OR session_id IS NOT NULL)
);

-- Incident tracking for operational issues
CREATE TABLE awf_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    scope TEXT NOT NULL, -- 'rate_limit', 'quota', 'backpressure', 'circuit_breaker', 'budget'
    metric TEXT NOT NULL, -- specific metric that triggered
    observed_value DECIMAL(10,4) NOT NULL,
    threshold_value DECIMAL(10,4) NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'closed')),
    suggested_actions JSONB,
    resolution_notes TEXT,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Circuit breaker state tracking
CREATE TABLE awf_circuit_breakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL UNIQUE, -- 'model_provider', 'redis', 'database'
    state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
    failure_count INTEGER DEFAULT 0,
    failure_threshold INTEGER DEFAULT 5,
    success_count INTEGER DEFAULT 0,
    last_failure TIMESTAMPTZ,
    last_success TIMESTAMPTZ,
    next_attempt TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backpressure state tracking
CREATE TABLE awf_backpressure_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL UNIQUE, -- 'latency_p95', 'queue_depth', 'token_queue'
    current_value DECIMAL(10,4) NOT NULL,
    threshold_value DECIMAL(10,4) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    actions_taken JSONB, -- array of actions taken
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget tracking and cost controls
CREATE TABLE awf_budget_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_year TEXT NOT NULL, -- '2024-01'
    budget_usd DECIMAL(10,2) NOT NULL,
    spent_usd DECIMAL(10,2) DEFAULT 0,
    projected_spend DECIMAL(10,2) DEFAULT 0,
    alert_threshold_80 BOOLEAN DEFAULT false,
    alert_threshold_95 BOOLEAN DEFAULT false,
    hard_stop_triggered BOOLEAN DEFAULT false,
    model_downgrade_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(month_year)
);

-- Feature toggles for operational control
CREATE TABLE awf_feature_toggles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    conditions JSONB, -- conditions for enabling the feature
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Secrets rotation tracking
CREATE TABLE awf_secrets_rotation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secret_name TEXT NOT NULL,
    current_version TEXT NOT NULL,
    previous_version TEXT,
    rotated_at TIMESTAMPTZ DEFAULT NOW(),
    rotated_by UUID REFERENCES auth.users(id),
    next_rotation TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health check results
CREATE TABLE awf_health_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    check_type TEXT NOT NULL, -- 'liveness', 'readiness', 'startup'
    status TEXT NOT NULL CHECK (status IN ('healthy', 'unhealthy', 'degraded')),
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_awf_rate_limits_scope_key ON awf_rate_limits(scope, key);
CREATE INDEX idx_awf_rate_limits_window_start ON awf_rate_limits(window_start);

CREATE INDEX idx_awf_quotas_user_hash ON awf_quotas(user_hash);
CREATE INDEX idx_awf_quotas_session_id ON awf_quotas(session_id);
CREATE INDEX idx_awf_quotas_resets_at ON awf_quotas(resets_at);

CREATE INDEX idx_awf_incidents_severity ON awf_incidents(severity);
CREATE INDEX idx_awf_incidents_scope ON awf_incidents(scope);
CREATE INDEX idx_awf_incidents_status ON awf_incidents(status);
CREATE INDEX idx_awf_incidents_timestamp ON awf_incidents(timestamp);

CREATE INDEX idx_awf_circuit_breakers_service ON awf_circuit_breakers(service_name);
CREATE INDEX idx_awf_circuit_breakers_state ON awf_circuit_breakers(state);

CREATE INDEX idx_awf_backpressure_metric ON awf_backpressure_state(metric_name);
CREATE INDEX idx_awf_backpressure_active ON awf_backpressure_state(is_active);

CREATE INDEX idx_awf_budget_month_year ON awf_budget_tracking(month_year);
CREATE INDEX idx_awf_budget_hard_stop ON awf_budget_tracking(hard_stop_triggered);

CREATE INDEX idx_awf_feature_toggles_name ON awf_feature_toggles(feature_name);
CREATE INDEX idx_awf_feature_toggles_enabled ON awf_feature_toggles(enabled);

CREATE INDEX idx_awf_secrets_rotation_name ON awf_secrets_rotation(secret_name);
CREATE INDEX idx_awf_secrets_rotation_status ON awf_secrets_rotation(status);

CREATE INDEX idx_awf_health_checks_service ON awf_health_checks(service_name);
CREATE INDEX idx_awf_health_checks_type ON awf_health_checks(check_type);
CREATE INDEX idx_awf_health_checks_checked_at ON awf_health_checks(checked_at);

-- RLS Policies
ALTER TABLE awf_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_circuit_breakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_backpressure_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_budget_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_feature_toggles ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_secrets_rotation ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_health_checks ENABLE ROW LEVEL SECURITY;

-- Admin-only access to operations data
CREATE POLICY "Admin only access to rate limits" ON awf_rate_limits
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin only access to quotas" ON awf_quotas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
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

CREATE POLICY "Admin only access to circuit breakers" ON awf_circuit_breakers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin only access to backpressure state" ON awf_backpressure_state
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin only access to budget tracking" ON awf_budget_tracking
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin only access to feature toggles" ON awf_feature_toggles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin only access to secrets rotation" ON awf_secrets_rotation
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin only access to health checks" ON awf_health_checks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Functions for operations
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_scope TEXT,
    p_key TEXT,
    p_window_seconds INTEGER,
    p_max_requests INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    window_start TIMESTAMPTZ;
BEGIN
    -- Get or create rate limit record
    INSERT INTO awf_rate_limits (scope, key, window_seconds, max_requests, current_count, window_start)
    VALUES (p_scope, p_key, p_window_seconds, p_max_requests, 0, NOW())
    ON CONFLICT (scope, key, window_seconds) DO NOTHING;
    
    -- Get current state
    SELECT current_count, window_start 
    INTO current_count, window_start
    FROM awf_rate_limits 
    WHERE scope = p_scope AND key = p_key AND window_seconds = p_window_seconds;
    
    -- Reset window if expired
    IF window_start < NOW() - INTERVAL '1 second' * p_window_seconds THEN
        UPDATE awf_rate_limits 
        SET current_count = 0, window_start = NOW()
        WHERE scope = p_scope AND key = p_key AND window_seconds = p_window_seconds;
        current_count := 0;
    END IF;
    
    -- Check if limit exceeded
    IF current_count >= p_max_requests THEN
        RETURN FALSE;
    END IF;
    
    -- Increment counter
    UPDATE awf_rate_limits 
    SET current_count = current_count + 1, updated_at = NOW()
    WHERE scope = p_scope AND key = p_key AND window_seconds = p_window_seconds;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_quota(
    p_user_hash TEXT,
    p_session_id TEXT,
    p_quota_type TEXT,
    p_amount INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    quota_record RECORD;
    current_value INTEGER;
    max_value INTEGER;
BEGIN
    -- Get quota record
    SELECT * INTO quota_record
    FROM awf_quotas 
    WHERE (user_hash = p_user_hash OR session_id = p_session_id)
    LIMIT 1;
    
    IF NOT FOUND THEN
        -- Create default quota
        INSERT INTO awf_quotas (user_hash, session_id)
        VALUES (p_user_hash, p_session_id);
        
        SELECT * INTO quota_record
        FROM awf_quotas 
        WHERE (user_hash = p_user_hash OR session_id = p_session_id)
        LIMIT 1;
    END IF;
    
    -- Reset quotas if expired
    IF quota_record.resets_at < NOW() THEN
        UPDATE awf_quotas 
        SET current_turns = 0, current_tools = 0, current_bytes = 0, resets_at = NOW() + INTERVAL '1 day'
        WHERE id = quota_record.id;
        
        quota_record.current_turns := 0;
        quota_record.current_tools := 0;
        quota_record.current_bytes := 0;
    END IF;
    
    -- Check specific quota type
    CASE p_quota_type
        WHEN 'turns' THEN
            current_value := quota_record.current_turns;
            max_value := quota_record.daily_turn_cap;
        WHEN 'tools' THEN
            current_value := quota_record.current_tools;
            max_value := quota_record.tool_cap;
        WHEN 'bytes' THEN
            current_value := quota_record.current_bytes;
            max_value := quota_record.bytes_cap;
        ELSE
            RETURN FALSE;
    END CASE;
    
    -- Check if quota exceeded
    IF current_value + p_amount > max_value THEN
        RETURN FALSE;
    END IF;
    
    -- Update quota
    CASE p_quota_type
        WHEN 'turns' THEN
            UPDATE awf_quotas SET current_turns = current_turns + p_amount, updated_at = NOW() WHERE id = quota_record.id;
        WHEN 'tools' THEN
            UPDATE awf_quotas SET current_tools = current_tools + p_amount, updated_at = NOW() WHERE id = quota_record.id;
        WHEN 'bytes' THEN
            UPDATE awf_quotas SET current_bytes = current_bytes + p_amount, updated_at = NOW() WHERE id = quota_record.id;
    END CASE;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_awf_rate_limits_updated_at
    BEFORE UPDATE ON awf_rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_awf_quotas_updated_at
    BEFORE UPDATE ON awf_quotas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_awf_circuit_breakers_updated_at
    BEFORE UPDATE ON awf_circuit_breakers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_awf_backpressure_state_updated_at
    BEFORE UPDATE ON awf_backpressure_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_awf_budget_tracking_updated_at
    BEFORE UPDATE ON awf_budget_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_awf_feature_toggles_updated_at
    BEFORE UPDATE ON awf_feature_toggles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Down migration
-- DROP TABLE IF EXISTS awf_health_checks CASCADE;
-- DROP TABLE IF EXISTS awf_secrets_rotation CASCADE;
-- DROP TABLE IF EXISTS awf_feature_toggles CASCADE;
-- DROP TABLE IF EXISTS awf_budget_tracking CASCADE;
-- DROP TABLE IF EXISTS awf_backpressure_state CASCADE;
-- DROP TABLE IF EXISTS awf_circuit_breakers CASCADE;
-- DROP TABLE IF EXISTS awf_incidents CASCADE;
-- DROP TABLE IF EXISTS awf_quotas CASCADE;
-- DROP TABLE IF EXISTS awf_rate_limits CASCADE;
-- DROP FUNCTION IF EXISTS check_rate_limit(TEXT, TEXT, INTEGER, INTEGER);
-- DROP FUNCTION IF EXISTS check_quota(TEXT, TEXT, TEXT, INTEGER);
-- DROP FUNCTION IF EXISTS update_updated_at_column();
