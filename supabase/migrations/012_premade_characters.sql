-- Layer M1 - Premade Characters Migration
-- Creates table for premade characters and seeds initial data

-- Create premade_characters table
CREATE TABLE IF NOT EXISTS premade_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_slug VARCHAR(100) NOT NULL,
  archetype_key VARCHAR(100) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  summary TEXT NOT NULL,
  avatar_url VARCHAR(500),
  base_traits JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique archetype per world
  UNIQUE(world_slug, archetype_key)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_premade_characters_world_slug ON premade_characters(world_slug);
CREATE INDEX IF NOT EXISTS idx_premade_characters_archetype_key ON premade_characters(archetype_key);
CREATE INDEX IF NOT EXISTS idx_premade_characters_active ON premade_characters(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE premade_characters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for premade characters (public read access)
DROP POLICY IF EXISTS "Anyone can view active premade characters" ON premade_characters;
CREATE POLICY "Anyone can view active premade characters"
  ON premade_characters FOR SELECT
  USING (is_active = true);

-- Service role policies for server-side operations
DROP POLICY IF EXISTS "Service role can manage all premade characters" ON premade_characters;
CREATE POLICY "Service role can manage all premade characters"
  ON premade_characters FOR ALL
  TO service_role
  USING (TRUE);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_premade_characters_updated_at ON premade_characters;
CREATE TRIGGER update_premade_characters_updated_at
  BEFORE UPDATE ON premade_characters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert premade characters data (ignore duplicates)
INSERT INTO premade_characters (world_slug, archetype_key, display_name, summary, avatar_url, base_traits, is_active) VALUES
-- Mystika premade characters
('mystika', 'veil-touched-mage', 'Aria Crystalborn', 'A young Crystalborn who awakened during a devastating Veil-storm. Her crystalline powers allow her to see through the Veil and commune with otherworldly entities.', 'crystalborn-mage', '{"crystal_affinity": "veil-sight", "faction_alignment": "crystalborn_order", "veil_resonance": 75, "crystal_power": 65, "personality_traits": ["mystical", "intuitive", "otherworldly"], "skills": {"magic": 65, "intelligence": 70, "charisma": 60, "strength": 45, "dexterity": 50, "constitution": 55, "wisdom": 60}}'::jsonb, true),

('mystika', 'elven-court-guardian', 'Thorne Shifter', 'A proud member of the Elven Courts who has sworn to protect the ancient traditions from the chaos of Veil-storms and Crystalborn influence.', 'elven-guardian', '{"crystal_affinity": "elven_magic", "faction_alignment": "elven_courts", "veil_resonance": 40, "crystal_power": 55, "personality_traits": ["noble", "protective", "traditional"], "skills": {"magic": 60, "intelligence": 65, "charisma": 70, "strength": 70, "dexterity": 75, "constitution": 60, "wisdom": 55}}'::jsonb, true),

-- Aetherium premade characters
('aetherium', 'neural-hacker', 'Neo Vector', 'A legendary underground hacker who has mastered the art of neural manipulation. Known for their ability to navigate the Aetherium network like no other.', 'neural-hacker', '{"neural_implants": ["advanced_interface", "data_streaming", "consciousness_anchor"], "corporate_standing": "underground", "aetherium_connection": 85, "specialization": "neural_hacking", "skills": {"intelligence": 80, "dexterity": 70, "charisma": 55, "strength": 40, "constitution": 50, "magic": 45, "wisdom": 60}}'::jsonb, true),

-- Whispercross premade characters
('whispercross', 'nature-guardian', 'Willow Whisperwind', 'A gentle soul who has lived in Whispercross Glade for years, learning to listen to the ancient whispers of nature and protect the sacred groves.', 'nature-guardian', '{"nature_connection": "deep_bond", "whisper_affinity": "ancient_voices", "glade_harmony": 80, "specialization": "nature_magic", "skills": {"magic": 70, "charisma": 65, "intelligence": 60, "strength": 50, "dexterity": 55, "constitution": 60, "wisdom": 70}}'::jsonb, true),

-- Paragon City premade characters
('paragon-city', 'superhero-origin', 'Alex Powers', 'A newly awakened superhuman discovering their incredible abilities in the bustling metropolis of Paragon City.', 'superhero-origin', '{"power_type": "energy_manipulation", "hero_alignment": "chaotic_good", "city_standing": "unknown", "specialization": "energy_control", "skills": {"strength": 60, "dexterity": 65, "constitution": 70, "intelligence": 55, "wisdom": 50, "charisma": 60, "magic": 0}}'::jsonb, true),

-- Veloria premade characters
('veloria', 'court-noble', 'Lady Seraphina', 'A noble of the Velorian court, skilled in political intrigue and courtly manners.', 'court-noble', '{"court_standing": "high_noble", "political_influence": 80, "specialization": "diplomacy", "skills": {"charisma": 80, "intelligence": 75, "wisdom": 70, "strength": 40, "dexterity": 45, "constitution": 50, "magic": 60}}'::jsonb, true),

-- Noctis Veil premade characters
('noctis-veil', 'shadow-hunter', 'Raven Darkbane', 'A skilled hunter who tracks dangerous creatures in the shadow realm of Noctis Veil.', 'shadow-hunter', '{"shadow_affinity": "deep_bond", "hunting_specialization": "shadow_creatures", "veil_standing": "respected", "specialization": "shadow_hunting", "skills": {"dexterity": 80, "strength": 70, "constitution": 75, "intelligence": 60, "wisdom": 65, "charisma": 50, "magic": 55}}'::jsonb, true)
ON CONFLICT (world_slug, archetype_key) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE premade_characters IS 'Static premade character templates available for each world';
COMMENT ON COLUMN premade_characters.world_slug IS 'World identifier (must match worlds from static content)';
COMMENT ON COLUMN premade_characters.archetype_key IS 'Unique archetype identifier within the world';
COMMENT ON COLUMN premade_characters.display_name IS 'Display name for the character';
COMMENT ON COLUMN premade_characters.summary IS 'Brief description/backstory of the character';
COMMENT ON COLUMN premade_characters.avatar_url IS 'Optional avatar image URL';
COMMENT ON COLUMN premade_characters.base_traits IS 'Base traits, skills, and world-specific data for the character';
