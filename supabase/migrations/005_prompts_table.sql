-- Prompts table for versioned prompt management
-- Each prompt has id, slug, scope (world/scenario/adventure/quest), version, hash, content, active

CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('world', 'scenario', 'adventure', 'quest')),
  version INTEGER NOT NULL DEFAULT 1,
  hash TEXT NOT NULL, -- SHA-256 hash of content for integrity
  content TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure only one active version per slug/scope combination
  UNIQUE (slug, scope, active) DEFERRABLE INITIALLY DEFERRED,
  -- Ensure unique version per slug/scope
  UNIQUE (slug, scope, version)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_prompts_slug_scope ON prompts(slug, scope);
CREATE INDEX IF NOT EXISTS idx_prompts_active ON prompts(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at);

-- Ensure updated_at trigger exists
DROP TRIGGER IF EXISTS update_prompts_updated_at ON prompts;
CREATE TRIGGER update_prompts_updated_at
  BEFORE UPDATE ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one active version per slug/scope
CREATE OR REPLACE FUNCTION ensure_single_active_prompt()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a prompt to active, deactivate all other versions of the same slug/scope
  IF NEW.active = TRUE THEN
    UPDATE prompts 
    SET active = FALSE 
    WHERE slug = NEW.slug 
      AND scope = NEW.scope 
      AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single active version
DROP TRIGGER IF EXISTS trigger_ensure_single_active_prompt ON prompts;
CREATE TRIGGER trigger_ensure_single_active_prompt
  BEFORE INSERT OR UPDATE ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_active_prompt();

-- Function to generate content hash
CREATE OR REPLACE FUNCTION generate_content_hash(content TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(content, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to auto-generate hash on insert/update
CREATE OR REPLACE FUNCTION auto_generate_prompt_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hash = generate_content_hash(NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate hash
DROP TRIGGER IF EXISTS trigger_auto_generate_prompt_hash ON prompts;
CREATE TRIGGER trigger_auto_generate_prompt_hash
  BEFORE INSERT OR UPDATE ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_prompt_hash();

-- Function to auto-increment version for new prompts
CREATE OR REPLACE FUNCTION auto_increment_prompt_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-increment on INSERT, not UPDATE
  IF TG_OP = 'INSERT' THEN
    -- Get the next version number for this slug/scope
    SELECT COALESCE(MAX(version), 0) + 1 
    INTO NEW.version
    FROM prompts 
    WHERE slug = NEW.slug AND scope = NEW.scope;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment version
DROP TRIGGER IF EXISTS trigger_auto_increment_prompt_version ON prompts;
CREATE TRIGGER trigger_auto_increment_prompt_version
  BEFORE INSERT ON prompts
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_prompt_version();

-- RLS policies for prompts table
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Admin users can do everything
CREATE POLICY "Admin users can manage prompts" ON prompts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Regular users can only read active prompts (for public consumption)
CREATE POLICY "Users can read active prompts" ON prompts
  FOR SELECT
  TO authenticated
  USING (active = TRUE);

-- Service role can do everything (for server-side operations)
CREATE POLICY "Service role can manage prompts" ON prompts
  FOR ALL
  TO service_role
  USING (TRUE);
