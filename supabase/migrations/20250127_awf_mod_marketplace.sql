-- Phase 26: Mod Marketplace & Creator Portal
-- Database schema for creator accounts, pack registry, ratings, and moderation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Creators table
CREATE TABLE creators (
  creator_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  email_hash TEXT NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT FALSE,
  terms_accepted_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Creator namespaces table
CREATE TABLE creator_namespaces (
  namespace TEXT PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES creators(creator_id) ON DELETE CASCADE,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mod pack registry table
CREATE TABLE mod_pack_registry (
  namespace TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'reviewing', 'certified', 'listed', 'rejected', 'delisted', 'decertified')),
  manifest JSONB NOT NULL,
  sbom JSONB NOT NULL,
  hash TEXT NOT NULL,
  signature BYTEA,
  awf_core_range TEXT NOT NULL,
  deps JSONB DEFAULT '[]'::jsonb,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  certified_at TIMESTAMP WITH TIME ZONE,
  listed_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (namespace, version),
  FOREIGN KEY (namespace) REFERENCES creator_namespaces(namespace) ON DELETE CASCADE
);

-- Mod ratings table
CREATE TABLE mod_ratings (
  namespace TEXT NOT NULL,
  version TEXT NOT NULL,
  user_hash TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  tags TEXT[] DEFAULT '{}',
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (namespace, version, user_hash),
  FOREIGN KEY (namespace, version) REFERENCES mod_pack_registry(namespace, version) ON DELETE CASCADE
);

-- Mod reports table
CREATE TABLE mod_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace TEXT NOT NULL,
  version TEXT,
  reporter_hash TEXT NOT NULL,
  reason TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triage', 'resolved', 'rejected')),
  action TEXT DEFAULT 'none' CHECK (action IN ('none', 'warn', 'delist', 'decertify')),
  assigned_to UUID REFERENCES creators(creator_id),
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Mod download tokens table
CREATE TABLE mod_download_tokens (
  token TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  version TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  issued_to TEXT NOT NULL, -- creator_id or 'admin'
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (namespace, version) REFERENCES mod_pack_registry(namespace, version) ON DELETE CASCADE
);

-- Mod pack metrics table (aggregated from Phase 24)
CREATE TABLE mod_pack_metrics (
  namespace TEXT NOT NULL,
  version TEXT NOT NULL,
  metric_date DATE NOT NULL,
  adoption_count INTEGER DEFAULT 0,
  error_rate NUMERIC DEFAULT 0,
  violation_rate NUMERIC DEFAULT 0,
  avg_acts_per_turn NUMERIC DEFAULT 0,
  token_budget_usage NUMERIC DEFAULT 0,
  p95_latency_delta_ms NUMERIC DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (namespace, version, metric_date),
  FOREIGN KEY (namespace, version) REFERENCES mod_pack_registry(namespace, version) ON DELETE CASCADE
);

-- Mod pack dependencies table (for easier querying)
CREATE TABLE mod_pack_dependencies (
  namespace TEXT NOT NULL,
  version TEXT NOT NULL,
  dep_namespace TEXT NOT NULL,
  dep_version_range TEXT NOT NULL,
  dep_type TEXT NOT NULL DEFAULT 'required' CHECK (dep_type IN ('required', 'optional', 'conflicts')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (namespace, version, dep_namespace),
  FOREIGN KEY (namespace, version) REFERENCES mod_pack_registry(namespace, version) ON DELETE CASCADE
);

-- Mod pack capabilities table (declared hooks)
CREATE TABLE mod_pack_capabilities (
  namespace TEXT NOT NULL,
  version TEXT NOT NULL,
  hook_name TEXT NOT NULL,
  hook_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (namespace, version, hook_name),
  FOREIGN KEY (namespace, version) REFERENCES mod_pack_registry(namespace, version) ON DELETE CASCADE
);

-- Mod pack tags table (for categorization)
CREATE TABLE mod_pack_tags (
  namespace TEXT NOT NULL,
  version TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (namespace, version, tag),
  FOREIGN KEY (namespace, version) REFERENCES mod_pack_registry(namespace, version) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_creators_email_hash ON creators(email_hash);
CREATE INDEX idx_creators_verified ON creators(verified);
CREATE INDEX idx_creator_namespaces_creator_id ON creator_namespaces(creator_id);
CREATE INDEX idx_creator_namespaces_verified ON creator_namespaces(verified);

CREATE INDEX idx_mod_pack_registry_status ON mod_pack_registry(status);
CREATE INDEX idx_mod_pack_registry_awf_core_range ON mod_pack_registry(awf_core_range);
CREATE INDEX idx_mod_pack_registry_created_at ON mod_pack_registry(created_at);
CREATE INDEX idx_mod_pack_registry_certified_at ON mod_pack_registry(certified_at);
CREATE INDEX idx_mod_pack_registry_listed_at ON mod_pack_registry(listed_at);

CREATE INDEX idx_mod_ratings_namespace_version ON mod_ratings(namespace, version);
CREATE INDEX idx_mod_ratings_stars ON mod_ratings(stars);
CREATE INDEX idx_mod_ratings_created_at ON mod_ratings(created_at);

CREATE INDEX idx_mod_reports_status ON mod_reports(status);
CREATE INDEX idx_mod_reports_namespace ON mod_reports(namespace);
CREATE INDEX idx_mod_reports_created_at ON mod_reports(created_at);
CREATE INDEX idx_mod_reports_assigned_to ON mod_reports(assigned_to);

CREATE INDEX idx_mod_download_tokens_namespace_version ON mod_download_tokens(namespace, version);
CREATE INDEX idx_mod_download_tokens_expires_at ON mod_download_tokens(expires_at);
CREATE INDEX idx_mod_download_tokens_used ON mod_download_tokens(used);

CREATE INDEX idx_mod_pack_metrics_namespace_version ON mod_pack_metrics(namespace, version);
CREATE INDEX idx_mod_pack_metrics_metric_date ON mod_pack_metrics(metric_date);

CREATE INDEX idx_mod_pack_dependencies_namespace_version ON mod_pack_dependencies(namespace, version);
CREATE INDEX idx_mod_pack_dependencies_dep_namespace ON mod_pack_dependencies(dep_namespace);

CREATE INDEX idx_mod_pack_capabilities_namespace_version ON mod_pack_capabilities(namespace, version);
CREATE INDEX idx_mod_pack_capabilities_hook_name ON mod_pack_capabilities(hook_name);

CREATE INDEX idx_mod_pack_tags_namespace_version ON mod_pack_tags(namespace, version);
CREATE INDEX idx_mod_pack_tags_tag ON mod_pack_tags(tag);

-- Row Level Security (RLS) policies
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_namespaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE mod_pack_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE mod_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mod_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE mod_download_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE mod_pack_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE mod_pack_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE mod_pack_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE mod_pack_tags ENABLE ROW LEVEL SECURITY;

-- Creators can see their own data
CREATE POLICY "creators_own_data" ON creators
  FOR ALL USING (auth.uid()::text = creator_id::text);

-- Creator namespaces - creators can see their own, public can see verified
CREATE POLICY "creator_namespaces_own" ON creator_namespaces
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM creators 
      WHERE creators.creator_id::text = auth.uid()::text 
      AND creators.creator_id = creator_namespaces.creator_id
    )
  );

CREATE POLICY "creator_namespaces_public" ON creator_namespaces
  FOR SELECT USING (verified = true);

-- Mod pack registry - creators can see their own, public can see listed/certified
CREATE POLICY "mod_pack_registry_own" ON mod_pack_registry
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM creator_namespaces 
      WHERE creator_namespaces.namespace = mod_pack_registry.namespace
      AND EXISTS (
        SELECT 1 FROM creators 
        WHERE creators.creator_id::text = auth.uid()::text 
        AND creators.creator_id = creator_namespaces.creator_id
      )
    )
  );

CREATE POLICY "mod_pack_registry_public" ON mod_pack_registry
  FOR SELECT USING (status IN ('listed', 'certified'));

-- Mod ratings - users can see all, but only rate once per version
CREATE POLICY "mod_ratings_all" ON mod_ratings
  FOR SELECT USING (true);

CREATE POLICY "mod_ratings_insert" ON mod_ratings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "mod_ratings_update_own" ON mod_ratings
  FOR UPDATE USING (user_hash = auth.uid()::text);

-- Mod reports - users can create, admins can see all
CREATE POLICY "mod_reports_insert" ON mod_reports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "mod_reports_admin" ON mod_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM creators 
      WHERE creators.creator_id::text = auth.uid()::text 
      AND creators.verified = true
    )
  );

-- Mod download tokens - creators can see their own, admins can see all
CREATE POLICY "mod_download_tokens_own" ON mod_download_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM creator_namespaces 
      WHERE creator_namespaces.namespace = mod_download_tokens.namespace
      AND EXISTS (
        SELECT 1 FROM creators 
        WHERE creators.creator_id::text = auth.uid()::text 
        AND creators.creator_id = creator_namespaces.creator_id
      )
    )
  );

CREATE POLICY "mod_download_tokens_admin" ON mod_download_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM creators 
      WHERE creators.creator_id::text = auth.uid()::text 
      AND creators.verified = true
    )
  );

-- Mod pack metrics - public read access
CREATE POLICY "mod_pack_metrics_public" ON mod_pack_metrics
  FOR SELECT USING (true);

-- Mod pack dependencies - public read access
CREATE POLICY "mod_pack_dependencies_public" ON mod_pack_dependencies
  FOR SELECT USING (true);

-- Mod pack capabilities - public read access
CREATE POLICY "mod_pack_capabilities_public" ON mod_pack_capabilities
  FOR SELECT USING (true);

-- Mod pack tags - public read access
CREATE POLICY "mod_pack_tags_public" ON mod_pack_tags
  FOR SELECT USING (true);

-- Functions for common operations
CREATE OR REPLACE FUNCTION get_pack_dependencies(pack_namespace TEXT, pack_version TEXT)
RETURNS TABLE (
  dep_namespace TEXT,
  dep_version_range TEXT,
  dep_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.dep_namespace,
    d.dep_version_range,
    d.dep_type
  FROM mod_pack_dependencies d
  WHERE d.namespace = pack_namespace 
  AND d.version = pack_version
  ORDER BY d.dep_namespace;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_pack_capabilities(pack_namespace TEXT, pack_version TEXT)
RETURNS TABLE (
  hook_name TEXT,
  hook_type TEXT,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.hook_name,
    c.hook_type,
    c.description
  FROM mod_pack_capabilities c
  WHERE c.namespace = pack_namespace 
  AND c.version = pack_version
  ORDER BY c.hook_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_pack_metrics(pack_namespace TEXT, pack_version TEXT, days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  metric_date DATE,
  adoption_count INTEGER,
  error_rate NUMERIC,
  violation_rate NUMERIC,
  avg_acts_per_turn NUMERIC,
  token_budget_usage NUMERIC,
  p95_latency_delta_ms NUMERIC,
  download_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.metric_date,
    m.adoption_count,
    m.error_rate,
    m.violation_rate,
    m.avg_acts_per_turn,
    m.token_budget_usage,
    m.p95_latency_delta_ms,
    m.download_count
  FROM mod_pack_metrics m
  WHERE m.namespace = pack_namespace 
  AND m.version = pack_version
  AND m.metric_date >= CURRENT_DATE - INTERVAL '1 day' * days_back
  ORDER BY m.metric_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_pack_ratings(pack_namespace TEXT, pack_version TEXT)
RETURNS TABLE (
  stars INTEGER,
  tags TEXT[],
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.stars,
    r.tags,
    r.comment,
    r.created_at
  FROM mod_ratings r
  WHERE r.namespace = pack_namespace 
  AND r.version = pack_version
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_creators_updated_at
  BEFORE UPDATE ON creators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_creator_namespaces_updated_at
  BEFORE UPDATE ON creator_namespaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mod_pack_registry_updated_at
  BEFORE UPDATE ON mod_pack_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mod_ratings_updated_at
  BEFORE UPDATE ON mod_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mod_reports_updated_at
  BEFORE UPDATE ON mod_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mod_pack_metrics_updated_at
  BEFORE UPDATE ON mod_pack_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Down migration
-- DROP TRIGGER IF EXISTS update_mod_pack_metrics_updated_at ON mod_pack_metrics;
-- DROP TRIGGER IF EXISTS update_mod_reports_updated_at ON mod_reports;
-- DROP TRIGGER IF EXISTS update_mod_ratings_updated_at ON mod_ratings;
-- DROP TRIGGER IF EXISTS update_mod_pack_registry_updated_at ON mod_pack_registry;
-- DROP TRIGGER IF EXISTS update_creator_namespaces_updated_at ON creator_namespaces;
-- DROP TRIGGER IF EXISTS update_creators_updated_at ON creators;

-- DROP FUNCTION IF EXISTS get_pack_ratings(TEXT, TEXT);
-- DROP FUNCTION IF EXISTS get_pack_metrics(TEXT, TEXT, INTEGER);
-- DROP FUNCTION IF EXISTS get_pack_capabilities(TEXT, TEXT);
-- DROP FUNCTION IF EXISTS get_pack_dependencies(TEXT, TEXT);
-- DROP FUNCTION IF EXISTS update_updated_at_column();

-- DROP TABLE IF EXISTS mod_pack_tags;
-- DROP TABLE IF EXISTS mod_pack_capabilities;
-- DROP TABLE IF EXISTS mod_pack_dependencies;
-- DROP TABLE IF EXISTS mod_pack_metrics;
-- DROP TABLE IF EXISTS mod_download_tokens;
-- DROP TABLE IF EXISTS mod_reports;
-- DROP TABLE IF EXISTS mod_ratings;
-- DROP TABLE IF EXISTS mod_pack_registry;
-- DROP TABLE IF EXISTS creator_namespaces;
-- DROP TABLE IF EXISTS creators;
