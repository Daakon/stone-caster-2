-- Phase 28: LiveOps Remote Configuration System
-- Enables real-time tweaking of game balance, pacing, token budgets, and content parameters

-- Create enum types for config scopes and statuses
CREATE TYPE liveops_config_scope AS ENUM (
  'global',
  'world', 
  'adventure',
  'experiment',
  'session'
);

CREATE TYPE liveops_config_status AS ENUM (
  'draft',
  'scheduled', 
  'active',
  'archived'
);

CREATE TYPE liveops_audit_action AS ENUM (
  'create',
  'update',
  'activate',
  'archive',
  'rollback'
);

-- Main configs table
CREATE TABLE liveops_configs (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  scope liveops_config_scope NOT NULL,
  scope_ref TEXT NOT NULL, -- world_id, adventure_id, experiment_id, session_id
  status liveops_config_status NOT NULL DEFAULT 'draft',
  payload JSONB NOT NULL,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit trail for all config changes
CREATE TABLE liveops_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES liveops_configs(config_id) ON DELETE CASCADE,
  action liveops_audit_action NOT NULL,
  actor UUID NOT NULL REFERENCES auth.users(id),
  diff JSONB,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sampled resolved configs for troubleshooting
CREATE TABLE liveops_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  turn_id INTEGER NOT NULL,
  resolved JSONB NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_liveops_configs_status_valid_from ON liveops_configs(status, valid_from);
CREATE INDEX idx_liveops_configs_scope_ref ON liveops_configs(scope, scope_ref);
CREATE INDEX idx_liveops_audit_config_id ON liveops_audit(config_id);
CREATE INDEX idx_liveops_audit_ts ON liveops_audit(ts);
CREATE INDEX idx_liveops_snapshots_session_turn ON liveops_snapshots(session_id, turn_id);
CREATE INDEX idx_liveops_snapshots_ts ON liveops_snapshots(ts);

-- RLS policies - admin-only write, read allowed to admin and authoring IDE
CREATE POLICY "Admin only write access to liveops_configs" ON liveops_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin and authoring read access to liveops_configs" ON liveops_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'author')
    )
  );

CREATE POLICY "Admin only access to liveops_audit" ON liveops_audit
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin and authoring read access to liveops_snapshots" ON liveops_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('admin', 'author')
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_liveops_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_liveops_configs_updated_at
  BEFORE UPDATE ON liveops_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_liveops_configs_updated_at();

-- Function to create audit entries
CREATE OR REPLACE FUNCTION create_liveops_audit_entry()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO liveops_audit (config_id, action, actor, diff)
  VALUES (
    COALESCE(NEW.config_id, OLD.config_id),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'create'
      WHEN TG_OP = 'UPDATE' THEN 'update'
      WHEN TG_OP = 'DELETE' THEN 'archive'
    END,
    COALESCE(NEW.created_by, OLD.created_by),
    CASE 
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
        'old', to_jsonb(OLD),
        'new', to_jsonb(NEW)
      )
      ELSE NULL
    END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers for audit logging
CREATE TRIGGER trigger_liveops_configs_audit
  AFTER INSERT OR UPDATE OR DELETE ON liveops_configs
  FOR EACH ROW
  EXECUTE FUNCTION create_liveops_audit_entry();

-- Function to get effective config for a session
CREATE OR REPLACE FUNCTION get_effective_liveops_config(
  p_session_id TEXT,
  p_world_id TEXT DEFAULT NULL,
  p_adventure_id TEXT DEFAULT NULL,
  p_experiment_id TEXT DEFAULT NULL,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}';
  config_record RECORD;
BEGIN
  -- Get active configs in precedence order: global -> world -> adventure -> experiment -> session
  FOR config_record IN
    SELECT payload, scope, scope_ref
    FROM liveops_configs
    WHERE status = 'active'
      AND (valid_from IS NULL OR valid_from <= p_now)
      AND (valid_to IS NULL OR valid_to > p_now)
      AND (
        (scope = 'global') OR
        (scope = 'world' AND scope_ref = p_world_id) OR
        (scope = 'adventure' AND scope_ref = p_adventure_id) OR
        (scope = 'experiment' AND scope_ref = p_experiment_id) OR
        (scope = 'session' AND scope_ref = p_session_id)
      )
    ORDER BY 
      CASE scope
        WHEN 'global' THEN 1
        WHEN 'world' THEN 2
        WHEN 'adventure' THEN 3
        WHEN 'experiment' THEN 4
        WHEN 'session' THEN 5
      END
  LOOP
    -- Merge configs (last-writer-wins)
    result := result || config_record.payload;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sample resolved config for troubleshooting
CREATE OR REPLACE FUNCTION sample_liveops_config(
  p_session_id TEXT,
  p_turn_id INTEGER,
  p_world_id TEXT DEFAULT NULL,
  p_adventure_id TEXT DEFAULT NULL,
  p_experiment_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  resolved_config JSONB;
BEGIN
  -- Get effective config
  resolved_config := get_effective_liveops_config(
    p_session_id, 
    p_world_id, 
    p_adventure_id, 
    p_experiment_id
  );
  
  -- Sample it (only if not empty)
  IF resolved_config != '{}' THEN
    INSERT INTO liveops_snapshots (session_id, turn_id, resolved)
    VALUES (p_session_id, p_turn_id, resolved_config);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Down migration
CREATE OR REPLACE FUNCTION down_migration_20250128_awf_liveops_remote_config()
RETURNS VOID AS $$
BEGIN
  -- Drop triggers
  DROP TRIGGER IF EXISTS trigger_liveops_configs_audit ON liveops_configs;
  DROP TRIGGER IF EXISTS trigger_update_liveops_configs_updated_at ON liveops_configs;
  
  -- Drop functions
  DROP FUNCTION IF EXISTS create_liveops_audit_entry();
  DROP FUNCTION IF EXISTS update_liveops_configs_updated_at();
  DROP FUNCTION IF EXISTS get_effective_liveops_config(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
  DROP FUNCTION IF EXISTS sample_liveops_config(TEXT, INTEGER, TEXT, TEXT, TEXT);
  
  -- Drop tables
  DROP TABLE IF EXISTS liveops_snapshots;
  DROP TABLE IF EXISTS liveops_audit;
  DROP TABLE IF EXISTS liveops_configs;
  
  -- Drop types
  DROP TYPE IF EXISTS liveops_audit_action;
  DROP TYPE IF EXISTS liveops_config_status;
  DROP TYPE IF EXISTS liveops_config_scope;
END;
$$ LANGUAGE plpgsql;
