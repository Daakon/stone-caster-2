-- Phase 23: Cloud Save/Sync System
-- Database schema for secure, deterministic cloud save/sync across devices

-- Main saves table
CREATE TABLE IF NOT EXISTS awf_saves (
  save_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id_hash TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  turn_id INTEGER NOT NULL DEFAULT 0,
  base_snapshot_hash TEXT,
  latest_chain_hash TEXT,
  integrity_ok BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, user_id_hash)
);

-- Save blobs table for snapshots, diffs, and metadata
CREATE TABLE IF NOT EXISTS awf_save_blobs (
  blob_hash TEXT PRIMARY KEY,
  blob_type TEXT NOT NULL CHECK (blob_type IN ('snapshot', 'diff', 'meta')),
  bytes BYTEA NOT NULL,
  size INTEGER NOT NULL,
  enc TEXT NOT NULL DEFAULT 'none' CHECK (enc IN ('none', 'aesgcm')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Save diffs table for incremental changes
CREATE TABLE IF NOT EXISTS awf_save_diffs (
  save_id UUID NOT NULL REFERENCES awf_saves(save_id) ON DELETE CASCADE,
  from_turn INTEGER NOT NULL,
  to_turn INTEGER NOT NULL,
  diff_hash TEXT NOT NULL,
  chain_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (save_id, to_turn)
);

-- Devices table for multi-device sync
CREATE TABLE IF NOT EXISTS awf_devices (
  device_id TEXT PRIMARY KEY,
  user_id_hash TEXT NOT NULL,
  session_id UUID,
  last_turn_seen INTEGER DEFAULT 0,
  sync_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Save archives table for conflict forks and manual restores
CREATE TABLE IF NOT EXISTS awf_save_archives (
  archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  save_id UUID NOT NULL REFERENCES awf_saves(save_id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('conflict', 'manual_restore')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync audit log for tracking operations
CREATE TABLE IF NOT EXISTS awf_sync_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  save_id UUID REFERENCES awf_saves(save_id) ON DELETE CASCADE,
  device_id TEXT,
  operation TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_awf_saves_user_id_hash ON awf_saves(user_id_hash);
CREATE INDEX IF NOT EXISTS idx_awf_saves_session_id ON awf_saves(session_id);
CREATE INDEX IF NOT EXISTS idx_awf_saves_updated_at ON awf_saves(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_awf_saves_integrity ON awf_saves(integrity_ok);

CREATE INDEX IF NOT EXISTS idx_awf_save_blobs_type ON awf_save_blobs(blob_type);
CREATE INDEX IF NOT EXISTS idx_awf_save_blobs_created_at ON awf_save_blobs(created_at);
CREATE INDEX IF NOT EXISTS idx_awf_save_blobs_enc ON awf_save_blobs(enc);

CREATE INDEX IF NOT EXISTS idx_awf_save_diffs_save_id ON awf_save_diffs(save_id);
CREATE INDEX IF NOT EXISTS idx_awf_save_diffs_turn_range ON awf_save_diffs(from_turn, to_turn);
CREATE INDEX IF NOT EXISTS idx_awf_save_diffs_chain_hash ON awf_save_diffs(chain_hash);

CREATE INDEX IF NOT EXISTS idx_awf_devices_user_id_hash ON awf_devices(user_id_hash);
CREATE INDEX IF NOT EXISTS idx_awf_devices_session_id ON awf_devices(session_id);
CREATE INDEX IF NOT EXISTS idx_awf_devices_updated_at ON awf_devices(updated_at);

CREATE INDEX IF NOT EXISTS idx_awf_save_archives_save_id ON awf_save_archives(save_id);
CREATE INDEX IF NOT EXISTS idx_awf_save_archives_reason ON awf_save_archives(reason);
CREATE INDEX IF NOT EXISTS idx_awf_save_archives_created_at ON awf_save_archives(created_at);

CREATE INDEX IF NOT EXISTS idx_awf_sync_audit_save_id ON awf_sync_audit(save_id);
CREATE INDEX IF NOT EXISTS idx_awf_sync_audit_device_id ON awf_sync_audit(device_id);
CREATE INDEX IF NOT EXISTS idx_awf_sync_audit_operation ON awf_sync_audit(operation);
CREATE INDEX IF NOT EXISTS idx_awf_sync_audit_created_at ON awf_sync_audit(created_at);

-- Add RLS policies
ALTER TABLE awf_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_save_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_save_diffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_save_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE awf_sync_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read/write their own saves
CREATE POLICY "Users can manage own saves" ON awf_saves
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.user_id_hash = awf_saves.user_id_hash
    )
  );

-- Policy: Users can read blobs for their saves
CREATE POLICY "Users can read own save blobs" ON awf_save_blobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM awf_saves 
      JOIN user_profiles ON user_profiles.user_id_hash = awf_saves.user_id_hash
      WHERE user_profiles.auth_user_id = auth.uid()
      AND (awf_saves.base_snapshot_hash = awf_save_blobs.blob_hash 
           OR EXISTS (
             SELECT 1 FROM awf_save_diffs 
             WHERE awf_save_diffs.save_id = awf_saves.save_id 
             AND awf_save_diffs.diff_hash = awf_save_blobs.blob_hash
           ))
    )
  );

-- Policy: Users can read diffs for their saves
CREATE POLICY "Users can read own save diffs" ON awf_save_diffs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM awf_saves 
      JOIN user_profiles ON user_profiles.user_id_hash = awf_saves.user_id_hash
      WHERE user_profiles.auth_user_id = auth.uid()
      AND awf_saves.save_id = awf_save_diffs.save_id
    )
  );

-- Policy: Users can manage their own devices
CREATE POLICY "Users can manage own devices" ON awf_devices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.user_id_hash = awf_devices.user_id_hash
    )
  );

-- Policy: Users can read their own save archives
CREATE POLICY "Users can read own save archives" ON awf_save_archives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM awf_saves 
      JOIN user_profiles ON user_profiles.user_id_hash = awf_saves.user_id_hash
      WHERE user_profiles.auth_user_id = auth.uid()
      AND awf_saves.save_id = awf_save_archives.save_id
    )
  );

-- Policy: Users can read their own sync audit
CREATE POLICY "Users can read own sync audit" ON awf_sync_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM awf_saves 
      JOIN user_profiles ON user_profiles.user_id_hash = awf_saves.user_id_hash
      WHERE user_profiles.auth_user_id = auth.uid()
      AND awf_saves.save_id = awf_sync_audit.save_id
    )
  );

-- Policy: Admin users can manage all saves
CREATE POLICY "Admin users can manage all saves" ON awf_saves
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can manage all save blobs" ON awf_save_blobs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can manage all save diffs" ON awf_save_diffs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can manage all devices" ON awf_devices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can manage all save archives" ON awf_save_archives
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can manage all sync audit" ON awf_sync_audit
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_cloud_sync_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_awf_saves_updated_at 
  BEFORE UPDATE ON awf_saves 
  FOR EACH ROW EXECUTE FUNCTION update_cloud_sync_updated_at();

CREATE TRIGGER update_awf_devices_updated_at 
  BEFORE UPDATE ON awf_devices 
  FOR EACH ROW EXECUTE FUNCTION update_cloud_sync_updated_at();

-- Add configuration table for cloud sync
CREATE TABLE IF NOT EXISTS awf_cloud_sync_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  sync_enabled BOOLEAN DEFAULT true,
  snapshot_every INTEGER DEFAULT 25,
  max_save_bytes_mb INTEGER DEFAULT 200,
  max_diff_bytes_kb INTEGER DEFAULT 128,
  zstd_level INTEGER DEFAULT 10,
  verify_sample_pct INTEGER DEFAULT 1,
  retention_days INTEGER DEFAULT 365,
  user_quota_mb INTEGER DEFAULT 1024,
  client_sealed BOOLEAN DEFAULT false,
  hmac_secret TEXT NOT NULL DEFAULT 'change-me',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO awf_cloud_sync_config (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Add RLS policy for config
ALTER TABLE awf_cloud_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read cloud sync config" ON awf_cloud_sync_config
  FOR SELECT USING (true);

CREATE POLICY "Admin users can manage cloud sync config" ON awf_cloud_sync_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.auth_user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Add trigger for config updated_at
CREATE TRIGGER update_awf_cloud_sync_config_updated_at 
  BEFORE UPDATE ON awf_cloud_sync_config 
  FOR EACH ROW EXECUTE FUNCTION update_cloud_sync_updated_at();

-- Add sample data for testing
INSERT INTO awf_saves (session_id, user_id_hash, version, turn_id, base_snapshot_hash, latest_chain_hash) VALUES
(
  gen_random_uuid(),
  'user_hash_123',
  '1.0.0',
  10,
  'snapshot_hash_001',
  'chain_hash_001'
),
(
  gen_random_uuid(),
  'user_hash_456',
  '1.0.0',
  25,
  'snapshot_hash_002',
  'chain_hash_002'
);

-- Add comments
COMMENT ON TABLE awf_saves IS 'Main saves table with canonical save model';
COMMENT ON TABLE awf_save_blobs IS 'Encrypted blobs for snapshots, diffs, and metadata';
COMMENT ON TABLE awf_save_diffs IS 'Incremental diffs between turns with chain hashes';
COMMENT ON TABLE awf_devices IS 'Multi-device sync tracking with tokens';
COMMENT ON TABLE awf_save_archives IS 'Archived saves from conflicts or manual restores';
COMMENT ON TABLE awf_sync_audit IS 'Audit log for sync operations and privacy compliance';
COMMENT ON TABLE awf_cloud_sync_config IS 'Configuration for cloud sync system';

-- Add down migration
CREATE OR REPLACE FUNCTION down_migration_phase23()
RETURNS void AS $$
BEGIN
  -- Drop cloud sync tables
  DROP TABLE IF EXISTS awf_sync_audit CASCADE;
  DROP TABLE IF EXISTS awf_save_archives CASCADE;
  DROP TABLE IF EXISTS awf_devices CASCADE;
  DROP TABLE IF EXISTS awf_save_diffs CASCADE;
  DROP TABLE IF EXISTS awf_save_blobs CASCADE;
  DROP TABLE IF EXISTS awf_saves CASCADE;
  DROP TABLE IF EXISTS awf_cloud_sync_config CASCADE;
  
  -- Drop indexes
  DROP INDEX IF EXISTS idx_awf_saves_user_id_hash;
  DROP INDEX IF EXISTS idx_awf_saves_session_id;
  DROP INDEX IF EXISTS idx_awf_saves_updated_at;
  DROP INDEX IF EXISTS idx_awf_saves_integrity;
  DROP INDEX IF EXISTS idx_awf_save_blobs_type;
  DROP INDEX IF EXISTS idx_awf_save_blobs_created_at;
  DROP INDEX IF EXISTS idx_awf_save_blobs_enc;
  DROP INDEX IF EXISTS idx_awf_save_diffs_save_id;
  DROP INDEX IF EXISTS idx_awf_save_diffs_turn_range;
  DROP INDEX IF EXISTS idx_awf_save_diffs_chain_hash;
  DROP INDEX IF EXISTS idx_awf_devices_user_id_hash;
  DROP INDEX IF EXISTS idx_awf_devices_session_id;
  DROP INDEX IF EXISTS idx_awf_devices_updated_at;
  DROP INDEX IF EXISTS idx_awf_save_archives_save_id;
  DROP INDEX IF EXISTS idx_awf_save_archives_reason;
  DROP INDEX IF EXISTS idx_awf_save_archives_created_at;
  DROP INDEX IF EXISTS idx_awf_sync_audit_save_id;
  DROP INDEX IF EXISTS idx_awf_sync_audit_device_id;
  DROP INDEX IF EXISTS idx_awf_sync_audit_operation;
  DROP INDEX IF EXISTS idx_awf_sync_audit_created_at;
END;
$$ LANGUAGE plpgsql;
