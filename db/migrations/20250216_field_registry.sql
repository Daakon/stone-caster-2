-- Field Registry Migration
-- Allows dynamic field definitions for World/Ruleset/NPC/Scenario packs

-- Field definitions table
CREATE TABLE field_defs (
    id bigserial PRIMARY KEY,
    pack_type text NOT NULL CHECK (pack_type IN ('world', 'ruleset', 'npc', 'scenario')),
    key text NOT NULL,
    label text NOT NULL,
    group_label text NULL,
    schema_json jsonb NOT NULL,
    default_json jsonb NULL,
    help text NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(pack_type, key)
);

CREATE INDEX idx_field_defs_pack_type_status ON field_defs(pack_type, status);

-- Add extras columns to pack tables
ALTER TABLE worlds ADD COLUMN IF NOT EXISTS extras jsonb NULL;
ALTER TABLE rulesets ADD COLUMN IF NOT EXISTS extras jsonb NULL;
ALTER TABLE npcs ADD COLUMN IF NOT EXISTS extras jsonb NULL;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS extras jsonb NULL;

-- RLS policies (if needed)
-- Allow admins to read/write field_defs
-- Allow authenticated users to read active field_defs

COMMENT ON TABLE field_defs IS 'Dynamic field definitions for pack extras';
COMMENT ON COLUMN field_defs.schema_json IS 'JSON Schema 2020-12 for field validation';
COMMENT ON COLUMN field_defs.default_json IS 'Default value for the field';
COMMENT ON COLUMN worlds.extras IS 'Custom fields defined by field_defs';
COMMENT ON COLUMN rulesets.extras IS 'Custom fields defined by field_defs';
COMMENT ON COLUMN npcs.extras IS 'Custom fields defined by field_defs';
COMMENT ON COLUMN scenarios.extras IS 'Custom fields defined by field_defs';

