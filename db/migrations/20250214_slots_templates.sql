-- Slots and Templates Persistence Migration
-- Moves slot/template registries from in-memory to database

-- SLOTS TABLE
CREATE TABLE IF NOT EXISTS slots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL CHECK (type IN ('world', 'ruleset', 'npc', 'scenario', 'module', 'ux')),
    name text NOT NULL,
    description text NOT NULL,
    max_len integer,
    priority integer DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_slots_type_name UNIQUE (type, name)
);

-- TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL CHECK (type IN ('world', 'ruleset', 'npc', 'scenario', 'module', 'ux')),
    slot text NOT NULL,
    version integer NOT NULL DEFAULT 1,
    body text NOT NULL,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT uk_templates_type_slot_version UNIQUE (type, slot, version)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_slots_type ON slots(type);
CREATE INDEX IF NOT EXISTS idx_templates_type_slot ON templates(type, slot);
CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_type_slot_status ON templates(type, slot, status);

-- RLS policies
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Admin users can manage slots
CREATE POLICY "Admin can manage slots"
    ON slots
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Service role can manage slots
CREATE POLICY "Service role can manage slots"
    ON slots
    FOR ALL
    USING (auth.role() = 'service_role');

-- Admin users can manage templates
CREATE POLICY "Admin can manage templates"
    ON templates
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Service role can manage templates
CREATE POLICY "Service role can manage templates"
    ON templates
    FOR ALL
    USING (auth.role() = 'service_role');

-- Add parent_id to prompt_snapshots for override tracking
ALTER TABLE prompt_snapshots 
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES prompt_snapshots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prompt_snapshots_parent_id ON prompt_snapshots(parent_id);

