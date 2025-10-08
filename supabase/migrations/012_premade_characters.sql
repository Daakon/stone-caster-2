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
('mystika', 'veil-touched-mage', 'Aria Crystalborn', 'A young Crystalborn who awakened during a devastating Veil-storm. Her crystalline powers allow her to see through the Veil and commune with otherworldly entities.', 'crystalborn-mage', '{"race": "Crystalborn", "class": "veil_touched_mage", "skills": {"magic": 65, "intelligence": 70, "charisma": 60, "strength": 45, "dexterity": 50, "constitution": 55, "wisdom": 60}, "personality_traits": ["mystical", "intuitive", "otherworldly"], "essence": ["Life", "Order"], "age": "Young Adult", "build": "Slender", "eyes": "Crystalline Blue", "traits": ["Mystical", "Intuitive", "Otherworldly", "Wise"], "backstory": "A young Crystalborn who awakened during a devastating Veil-storm. Her crystalline powers allow her to see through the Veil and commune with otherworldly entities.", "motivation": "To understand the true nature of the Veil and protect others from its dangers", "inventory": ["Crystal Focus", "Veil-sight Goggles", "Ancient Tome", "Healing Potion"], "goals": {"short_term": ["Master basic Veil-sight", "Find a mentor"], "long_term": ["Become a Veil Master", "Protect the realm from Veil-storms"]}}'::jsonb, true),

('mystika', 'elven-court-guardian', 'Thorne Shifter', 'A proud member of the Elven Courts who has sworn to protect the ancient traditions from the chaos of Veil-storms and Crystalborn influence.', 'elven-guardian', '{"race": "Elf", "class": "shifter_warden", "skills": {"magic": 60, "intelligence": 65, "charisma": 70, "strength": 70, "dexterity": 75, "constitution": 60, "wisdom": 55}, "personality_traits": ["noble", "protective", "traditional"], "essence": ["Order", "Life"], "age": "Adult", "build": "Athletic", "eyes": "Forest Green", "traits": ["Noble", "Protective", "Traditional", "Honorable"], "backstory": "A proud member of the Elven Courts who has sworn to protect the ancient traditions from the chaos of Veil-storms and Crystalborn influence.", "motivation": "To preserve the ancient ways and protect the realm from corruption", "inventory": ["Elven Longsword", "Court Armor", "Ancient Scroll", "Healing Herbs"], "goals": {"short_term": ["Master court protocols", "Strengthen elven magic"], "long_term": ["Become a Court Guardian", "Restore balance to the realm"]}}'::jsonb, true),

-- Aetherium premade characters
('aetherium', 'neural-hacker', 'Neo Vector', 'A legendary underground hacker who has mastered the art of neural manipulation. Known for their ability to navigate the Aetherium network like no other.', 'neural-hacker', '{"race": "Human", "class": "neural_hacker", "skills": {"intelligence": 80, "dexterity": 70, "charisma": 55, "strength": 40, "constitution": 50, "magic": 45, "wisdom": 60}, "personality_traits": ["analytical", "rebellious", "tech-savvy"], "essence": ["Data", "Network"], "age": "Young Adult", "build": "Lean", "eyes": "Cyber Blue", "traits": ["Analytical", "Rebellious", "Tech-Savvy", "Independent"], "backstory": "A legendary underground hacker who has mastered the art of neural manipulation. Known for their ability to navigate the Aetherium network like no other.", "motivation": "To expose corporate corruption and free the digital realm from corporate control", "inventory": ["Neural Interface", "Data Core", "Hacking Tools", "Energy Drink"], "goals": {"short_term": ["Hack corporate systems", "Build underground network"], "long_term": ["Overthrow corporate control", "Create free digital society"]}}'::jsonb, true),

-- Whispercross premade characters
('whispercross', 'nature-guardian', 'Willow Whisperwind', 'A gentle soul who has lived in Whispercross Glade for years, learning to listen to the ancient whispers of nature and protect the sacred groves.', 'nature-guardian', '{"race": "Human", "class": "nature_guardian", "skills": {"magic": 70, "charisma": 65, "intelligence": 60, "strength": 50, "dexterity": 55, "constitution": 60, "wisdom": 70}, "personality_traits": ["gentle", "wise", "nature-connected"], "essence": ["Nature", "Harmony"], "age": "Adult", "build": "Graceful", "eyes": "Forest Green", "traits": ["Gentle", "Wise", "Nature-Connected", "Peaceful"], "backstory": "A gentle soul who has lived in Whispercross Glade for years, learning to listen to the ancient whispers of nature and protect the sacred groves.", "motivation": "To protect the natural world and maintain the balance between civilization and nature", "inventory": ["Nature Staff", "Healing Herbs", "Ancient Seeds", "Whisper Stone"], "goals": {"short_term": ["Learn deeper nature magic", "Protect local groves"], "long_term": ["Become a Nature Guardian", "Restore balance to the world"]}}'::jsonb, true),

-- Paragon City premade characters
('paragon-city', 'superhero-origin', 'Alex Powers', 'A newly awakened superhuman discovering their incredible abilities in the bustling metropolis of Paragon City.', 'superhero-origin', '{"race": "Human", "class": "superhero_origin", "skills": {"strength": 60, "dexterity": 65, "constitution": 70, "intelligence": 55, "wisdom": 50, "charisma": 60, "magic": 0}, "personality_traits": ["heroic", "determined", "idealistic"], "essence": ["Justice", "Power"], "age": "Young Adult", "build": "Athletic", "eyes": "Determined Blue", "traits": ["Heroic", "Determined", "Idealistic", "Brave"], "backstory": "A newly awakened superhuman discovering their incredible abilities in the bustling metropolis of Paragon City.", "motivation": "To protect the innocent and fight for justice in the city", "inventory": ["Hero Costume", "Communication Device", "First Aid Kit", "City Map"], "goals": {"short_term": ["Master basic powers", "Find a mentor"], "long_term": ["Become a legendary hero", "Protect the city from evil"]}}'::jsonb, true),

-- Veloria premade characters
('veloria', 'court-noble', 'Lady Seraphina', 'A noble of the Velorian court, skilled in political intrigue and courtly manners.', 'court-noble', '{"race": "Human", "class": "court_noble", "skills": {"charisma": 80, "intelligence": 75, "wisdom": 70, "strength": 40, "dexterity": 45, "constitution": 50, "magic": 60}, "personality_traits": ["diplomatic", "elegant", "strategic"], "essence": ["Nobility", "Diplomacy"], "age": "Adult", "build": "Elegant", "eyes": "Royal Blue", "traits": ["Diplomatic", "Elegant", "Strategic", "Noble"], "backstory": "A noble of the Velorian court, skilled in political intrigue and courtly manners.", "motivation": "To maintain peace and prosperity in the realm through diplomacy", "inventory": ["Noble Gown", "Diplomatic Papers", "Royal Seal", "Court Jewelry"], "goals": {"short_term": ["Master court politics", "Build alliances"], "long_term": ["Become a court advisor", "Ensure realm stability"]}}'::jsonb, true),

-- Noctis Veil premade characters
('noctis-veil', 'shadow-hunter', 'Raven Darkbane', 'A skilled hunter who tracks dangerous creatures in the shadow realm of Noctis Veil.', 'shadow-hunter', '{"race": "Human", "class": "shadow_hunter", "skills": {"dexterity": 80, "strength": 70, "constitution": 75, "intelligence": 60, "wisdom": 65, "charisma": 50, "magic": 55}, "personality_traits": ["focused", "mysterious", "determined"], "essence": ["Shadow", "Hunting"], "age": "Adult", "build": "Agile", "eyes": "Shadow Gray", "traits": ["Focused", "Mysterious", "Determined", "Stealthy"], "backstory": "A skilled hunter who tracks dangerous creatures in the shadow realm of Noctis Veil.", "motivation": "To protect the realm from shadow creatures and maintain the balance", "inventory": ["Shadow Blade", "Hunting Gear", "Shadow Cloak", "Tracking Tools"], "goals": {"short_term": ["Master shadow hunting", "Track dangerous creatures"], "long_term": ["Become a master hunter", "Protect the realm from shadows"]}}'::jsonb, true)
ON CONFLICT (world_slug, archetype_key) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE premade_characters IS 'Static premade character templates available for each world';
COMMENT ON COLUMN premade_characters.world_slug IS 'World identifier (must match worlds from static content)';
COMMENT ON COLUMN premade_characters.archetype_key IS 'Unique archetype identifier within the world';
COMMENT ON COLUMN premade_characters.display_name IS 'Display name for the character';
COMMENT ON COLUMN premade_characters.summary IS 'Brief description/backstory of the character';
COMMENT ON COLUMN premade_characters.avatar_url IS 'Optional avatar image URL';
COMMENT ON COLUMN premade_characters.base_traits IS 'Base traits, skills, and world-specific data for the character';
