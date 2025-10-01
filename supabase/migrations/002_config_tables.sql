-- Configuration tables for StoneCaster configuration spine

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('string', 'number', 'boolean', 'json')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config_meta (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure updated_at triggers exist exactly once
DROP TRIGGER IF EXISTS update_app_config_updated_at ON app_config;
DROP TRIGGER IF EXISTS update_pricing_config_updated_at ON pricing_config;
DROP TRIGGER IF EXISTS update_ai_config_updated_at ON ai_config;
DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON feature_flags;
DROP TRIGGER IF EXISTS update_config_meta_updated_at ON config_meta;

CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_config_updated_at
  BEFORE UPDATE ON pricing_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_config_updated_at
  BEFORE UPDATE ON ai_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_config_meta_updated_at
  BEFORE UPDATE ON config_meta
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO config_meta (id, version, updated_at)
VALUES (TRUE, 1, NOW())
ON CONFLICT (id) DO NOTHING;

