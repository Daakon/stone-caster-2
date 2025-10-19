-- Phase 17: AWF Economy Kernel
-- Migration: 20250127_awf_economy_kernel.sql

-- Create items_registry table
CREATE TABLE IF NOT EXISTS items_registry (
    id TEXT PRIMARY KEY,
    doc JSONB NOT NULL DEFAULT '{}'::jsonb,
    hash TEXT NOT NULL,
    rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legend')),
    tier INTEGER NOT NULL DEFAULT 1 CHECK (tier >= 1 AND tier <= 10),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(id, hash)
);

-- Create recipes_registry table
CREATE TABLE IF NOT EXISTS recipes_registry (
    id TEXT PRIMARY KEY,
    doc JSONB NOT NULL DEFAULT '{}'::jsonb,
    hash TEXT NOT NULL,
    skill TEXT,
    difficulty INTEGER DEFAULT 50 CHECK (difficulty >= 0 AND difficulty <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create loot_tables table
CREATE TABLE IF NOT EXISTS loot_tables (
    id TEXT PRIMARY KEY,
    doc JSONB NOT NULL DEFAULT '{}'::jsonb,
    hash TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'world', 'adventure', 'node', 'npc', 'encounter')),
    ref TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vendors_registry table
CREATE TABLE IF NOT EXISTS vendors_registry (
    id TEXT PRIMARY KEY,
    doc JSONB NOT NULL DEFAULT '{}'::jsonb,
    hash TEXT NOT NULL,
    world_ref TEXT NOT NULL,
    adventure_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_registry_rarity ON items_registry(rarity);
CREATE INDEX IF NOT EXISTS idx_items_registry_tier ON items_registry(tier);
CREATE INDEX IF NOT EXISTS idx_items_registry_tags ON items_registry USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_items_registry_hash ON items_registry(hash);

CREATE INDEX IF NOT EXISTS idx_recipes_registry_skill ON recipes_registry(skill);
CREATE INDEX IF NOT EXISTS idx_recipes_registry_difficulty ON recipes_registry(difficulty);
CREATE INDEX IF NOT EXISTS idx_recipes_registry_hash ON recipes_registry(hash);

CREATE INDEX IF NOT EXISTS idx_loot_tables_scope ON loot_tables(scope);
CREATE INDEX IF NOT EXISTS idx_loot_tables_ref ON loot_tables(ref);
CREATE INDEX IF NOT EXISTS idx_loot_tables_hash ON loot_tables(hash);

CREATE INDEX IF NOT EXISTS idx_vendors_registry_world ON vendors_registry(world_ref);
CREATE INDEX IF NOT EXISTS idx_vendors_registry_adventure ON vendors_registry(adventure_ref);
CREATE INDEX IF NOT EXISTS idx_vendors_registry_hash ON vendors_registry(hash);

-- Add RLS policies
ALTER TABLE items_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE loot_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors_registry ENABLE ROW LEVEL SECURITY;

-- RLS policies for economy tables (admin only)
DROP POLICY IF EXISTS "Admin can manage items registry" ON items_registry;
CREATE POLICY "Admin can manage items registry" ON items_registry
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admin can manage recipes registry" ON recipes_registry;
CREATE POLICY "Admin can manage recipes registry" ON recipes_registry
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admin can manage loot tables" ON loot_tables;
CREATE POLICY "Admin can manage loot tables" ON loot_tables
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admin can manage vendors registry" ON vendors_registry;
CREATE POLICY "Admin can manage vendors registry" ON vendors_registry
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.auth_user_id = auth.uid() 
            AND user_profiles.role = 'admin'
        )
    );

-- Add triggers to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_economy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_items_registry_updated_at ON items_registry;
CREATE TRIGGER trigger_update_items_registry_updated_at
  BEFORE UPDATE ON items_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_economy_updated_at();

DROP TRIGGER IF EXISTS trigger_update_recipes_registry_updated_at ON recipes_registry;
CREATE TRIGGER trigger_update_recipes_registry_updated_at
  BEFORE UPDATE ON recipes_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_economy_updated_at();

DROP TRIGGER IF EXISTS trigger_update_loot_tables_updated_at ON loot_tables;
CREATE TRIGGER trigger_update_loot_tables_updated_at
  BEFORE UPDATE ON loot_tables
  FOR EACH ROW
  EXECUTE FUNCTION update_economy_updated_at();

DROP TRIGGER IF EXISTS trigger_update_vendors_registry_updated_at ON vendors_registry;
CREATE TRIGGER trigger_update_vendors_registry_updated_at
  BEFORE UPDATE ON vendors_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_economy_updated_at();

-- Add comments
COMMENT ON TABLE items_registry IS 'Canonical registry for items with compact JSON shape and hashed content';
COMMENT ON TABLE recipes_registry IS 'Registry for crafting recipes with inputs, outputs, and requirements';
COMMENT ON TABLE loot_tables IS 'Weighted loot tables for drops and rewards';
COMMENT ON TABLE vendors_registry IS 'Registry for vendors with inventories and pricing rules';

COMMENT ON COLUMN items_registry.doc IS 'JSONB item definition with name, category, stack size, rules, etc.';
COMMENT ON COLUMN items_registry.hash IS 'Content hash for versioning and integrity';
COMMENT ON COLUMN items_registry.rarity IS 'Item rarity affecting pricing and drop rates';
COMMENT ON COLUMN items_registry.tier IS 'Level tier for item power and requirements';
COMMENT ON COLUMN items_registry.tags IS 'Tags for categorization and filtering';

COMMENT ON COLUMN recipes_registry.doc IS 'JSONB recipe definition with inputs, outputs, station requirements';
COMMENT ON COLUMN recipes_registry.skill IS 'Required skill for crafting (e.g., alchemy, smithing)';
COMMENT ON COLUMN recipes_registry.difficulty IS 'Crafting difficulty (0-100)';

COMMENT ON COLUMN loot_tables.doc IS 'JSONB loot table with weighted entries and roll counts';
COMMENT ON COLUMN loot_tables.scope IS 'Scope of loot table (global, world, adventure, node, npc)';
COMMENT ON COLUMN loot_tables.ref IS 'Reference to scope context (world_id, adventure_id, etc.)';

COMMENT ON COLUMN vendors_registry.doc IS 'JSONB vendor definition with stock, pricing, and refresh rules';
COMMENT ON COLUMN vendors_registry.world_ref IS 'World context for vendor';
COMMENT ON COLUMN vendors_registry.adventure_ref IS 'Adventure context for vendor (optional)';

-- Insert default items
INSERT INTO items_registry (id, doc, hash, rarity, tier, tags) VALUES 
('itm.healing_leaf', 
 '{"id":"itm.healing_leaf","name":"Healing Leaf","cat":"consumable","tier":1,"rarity":"common","stack":10,"tags":["herb","heal"],"rules":{"use":{"RESOURCE_DELTA":[{"key":"hp","delta":10}]}}}'::jsonb,
 'healing-leaf-v1',
 'common', 1, ARRAY['herb', 'heal', 'consumable']),

('itm.vial', 
 '{"id":"itm.vial","name":"Glass Vial","cat":"material","tier":1,"rarity":"common","stack":50,"tags":["container","glass"],"rules":{}}'::jsonb,
 'vial-v1',
 'common', 1, ARRAY['container', 'glass', 'material']),

('itm.mending_tonic', 
 '{"id":"itm.mending_tonic","name":"Mending Tonic","cat":"consumable","tier":2,"rarity":"uncommon","stack":5,"tags":["potion","heal"],"rules":{"use":{"RESOURCE_DELTA":[{"key":"hp","delta":25}]}}}'::jsonb,
 'mending-tonic-v1',
 'uncommon', 2, ARRAY['potion', 'heal', 'consumable']),

('itm.iron_sword', 
 '{"id":"itm.iron_sword","name":"Iron Sword","cat":"weapon","tier":2,"rarity":"common","stack":1,"tags":["weapon","melee","sword"],"rules":{"equip":{"slot":"main_hand","damage":8}}}'::jsonb,
 'iron-sword-v1',
 'common', 2, ARRAY['weapon', 'melee', 'sword']),

('itm.leather_armor', 
 '{"id":"itm.leather_armor","name":"Leather Armor","cat":"armor","tier":1,"rarity":"common","stack":1,"tags":["armor","light"],"rules":{"equip":{"slot":"body","defense":3}}}'::jsonb,
 'leather-armor-v1',
 'common', 1, ARRAY['armor', 'light'])
ON CONFLICT (id, hash) DO NOTHING;

-- Insert default recipes
INSERT INTO recipes_registry (id, doc, hash, skill, difficulty) VALUES 
('rcp.mending_tonic', 
 '{"id":"rcp.mending_tonic","inputs":[{"id":"itm.healing_leaf","qty":2},{"tag":"vial","qty":1}],"outputs":[{"id":"itm.mending_tonic","qty":1}],"skill":"alchemy","diff":45,"station":"alembic"}'::jsonb,
 'mending-tonic-recipe-v1',
 'alchemy', 45),

('rcp.basic_healing', 
 '{"id":"rcp.basic_healing","inputs":[{"id":"itm.healing_leaf","qty":1}],"outputs":[{"id":"itm.healing_leaf","qty":3}],"skill":"herbalism","diff":25,"station":"mortar"}'::jsonb,
 'basic-healing-recipe-v1',
 'herbalism', 25)
ON CONFLICT (id) DO NOTHING;

-- Insert default loot tables
INSERT INTO loot_tables (id, doc, hash, scope, ref) VALUES 
('loot.glade.basic', 
 '{"id":"loot.glade.basic","rolls":1,"entries":[{"id":"itm.healing_leaf","w":60,"qty":[1,2]},{"id":"itm.vial","w":25,"qty":[1,1]},{"id":"gold","w":15,"qty":[5,12]}]}'::jsonb,
 'glade-basic-loot-v1',
 'node', 'glade_clearing'),

('loot.encounter.wolves', 
 '{"id":"loot.encounter.wolves","rolls":2,"entries":[{"id":"itm.leather_armor","w":30,"qty":[1,1]},{"id":"gold","w":70,"qty":[8,15]}]}'::jsonb,
 'wolves-loot-v1',
 'encounter', 'wolf_pack')
ON CONFLICT (id) DO NOTHING;

-- Insert default vendors
INSERT INTO vendors_registry (id, doc, hash, world_ref, adventure_ref) VALUES 
('vnd.herbalist.kiera', 
 '{"id":"vnd.herbalist.kiera","currency":"gold","stock":[{"id":"itm.healing_leaf","qty":5,"price":12}],"buySpread":0.4,"sellSpread":1.0,"refresh":"daily"}'::jsonb,
 'kiera-herbalist-v1',
 'mystika', NULL),

('vnd.armorer.smith', 
 '{"id":"vnd.armorer.smith","currency":"gold","stock":[{"id":"itm.iron_sword","qty":2,"price":45},{"id":"itm.leather_armor","qty":3,"price":25}],"buySpread":0.3,"sellSpread":1.2,"refresh":"daily"}'::jsonb,
 'smith-armorer-v1',
 'mystika', NULL)
ON CONFLICT (id) DO NOTHING;

-- Add economy state to game_states if not present
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_states' AND column_name = 'inventory'
    ) THEN
        ALTER TABLE game_states ADD COLUMN inventory JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_states' AND column_name = 'equipment'
    ) THEN
        ALTER TABLE game_states ADD COLUMN equipment JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_states' AND column_name = 'currency'
    ) THEN
        ALTER TABLE game_states ADD COLUMN currency JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Create function to get item definition
CREATE OR REPLACE FUNCTION get_item_definition(p_item_id TEXT)
RETURNS TABLE (
    doc JSONB,
    rarity TEXT,
    tier INTEGER,
    tags TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ir.doc,
        ir.rarity,
        ir.tier,
        ir.tags
    FROM items_registry ir
    WHERE ir.id = p_item_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get recipe definition
CREATE OR REPLACE FUNCTION get_recipe_definition(p_recipe_id TEXT)
RETURNS TABLE (
    doc JSONB,
    skill TEXT,
    difficulty INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rr.doc,
        rr.skill,
        rr.difficulty
    FROM recipes_registry rr
    WHERE rr.id = p_recipe_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get loot table
CREATE OR REPLACE FUNCTION get_loot_table(p_table_id TEXT)
RETURNS TABLE (
    doc JSONB,
    scope TEXT,
    ref TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lt.doc,
        lt.scope,
        lt.ref
    FROM loot_tables lt
    WHERE lt.id = p_table_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get vendor definition
CREATE OR REPLACE FUNCTION get_vendor_definition(p_vendor_id TEXT)
RETURNS TABLE (
    doc JSONB,
    world_ref TEXT,
    adventure_ref TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vr.doc,
        vr.world_ref,
        vr.adventure_ref
    FROM vendors_registry vr
    WHERE vr.id = p_vendor_id;
END;
$$ LANGUAGE plpgsql;
