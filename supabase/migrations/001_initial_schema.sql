-- Create characters table
CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  race VARCHAR(50) NOT NULL,
  class VARCHAR(50) NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 20),
  experience INTEGER NOT NULL DEFAULT 0 CHECK (experience >= 0),
  attributes JSONB NOT NULL,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_health INTEGER NOT NULL CHECK (current_health >= 0),
  max_health INTEGER NOT NULL CHECK (max_health >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create world_templates table
CREATE TABLE IF NOT EXISTS world_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  genre VARCHAR(50) NOT NULL,
  setting TEXT NOT NULL,
  themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  available_races JSONB NOT NULL DEFAULT '[]'::jsonb,
  available_classes JSONB NOT NULL DEFAULT '[]'::jsonb,
  starting_prompt TEXT NOT NULL,
  rules JSONB NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create game_saves table
CREATE TABLE IF NOT EXISTS game_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  world_template_id UUID NOT NULL REFERENCES world_templates(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  story_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_game_saves_user_id ON game_saves(user_id);
CREATE INDEX idx_game_saves_character_id ON game_saves(character_id);
CREATE INDEX idx_world_templates_public ON world_templates(is_public) WHERE is_public = true;
CREATE INDEX idx_game_saves_last_played ON game_saves(last_played_at DESC);

-- Enable Row Level Security
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for characters
CREATE POLICY "Users can view their own characters"
  ON characters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own characters"
  ON characters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own characters"
  ON characters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own characters"
  ON characters FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for game_saves
CREATE POLICY "Users can view their own game saves"
  ON game_saves FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own game saves"
  ON game_saves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own game saves"
  ON game_saves FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own game saves"
  ON game_saves FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for world_templates
CREATE POLICY "Anyone can view public world templates"
  ON world_templates FOR SELECT
  USING (is_public = true OR auth.uid() = created_by);

CREATE POLICY "Authenticated users can create world templates"
  ON world_templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own world templates"
  ON world_templates FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own world templates"
  ON world_templates FOR DELETE
  USING (auth.uid() = created_by);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_world_templates_updated_at
  BEFORE UPDATE ON world_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_saves_updated_at
  BEFORE UPDATE ON game_saves
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default world templates
INSERT INTO world_templates (name, description, genre, setting, themes, available_races, available_classes, starting_prompt, rules, is_public, created_by) VALUES
(
  'Classic Fantasy Adventure',
  'A traditional high-fantasy world filled with magic, dragons, and ancient mysteries.',
  'fantasy',
  'A vast medieval kingdom with enchanted forests, towering mountains, and ancient ruins.',
  '["heroism", "magic", "exploration", "good vs evil"]'::jsonb,
  '["Human", "Elf", "Dwarf", "Halfling", "Orc"]'::jsonb,
  '["Warrior", "Mage", "Rogue", "Cleric", "Ranger"]'::jsonb,
  'You find yourself in the bustling market square of the capital city. The air is filled with the sounds of merchants hawking their wares and the smell of fresh bread. A hooded figure approaches you with urgent news...',
  '{"allowMagic": true, "allowTechnology": false, "difficultyLevel": "medium", "combatSystem": "d20"}'::jsonb,
  true,
  NULL
),
(
  'Cyberpunk Noir',
  'A dystopian future where mega-corporations rule and technology blurs the line between human and machine.',
  'scifi',
  'Neo-Tokyo, 2077. Neon-lit streets, towering skyscrapers, and a society divided between the ultra-rich and the struggling masses.',
  '["technology", "corruption", "rebellion", "identity"]'::jsonb,
  '["Human", "Cyborg", "Android"]'::jsonb,
  '["Hacker", "Street Samurai", "Corporate Spy", "Tech Priest"]'::jsonb,
  'Rain pelts the grimy streets of the lower levels. Your neural interface flickers with an incoming encrypted message. Someone needs your unique skills for a job that could change everything...',
  '{"allowMagic": false, "allowTechnology": true, "difficultyLevel": "hard", "combatSystem": "custom"}'::jsonb,
  true,
  NULL
),
(
  'Cosmic Horror',
  'Uncover eldritch mysteries in a world where sanity is as valuable as life itself.',
  'horror',
  'A small New England town in the 1920s, where strange occurrences hint at cosmic terrors beyond human comprehension.',
  '["mystery", "madness", "ancient evil", "investigation"]'::jsonb,
  '["Human"]'::jsonb,
  '["Detective", "Scholar", "Doctor", "Journalist"]'::jsonb,
  'The telegram arrived three days ago, urgently requesting your presence at your late uncle''s estate. The locals refuse to speak of the place, their eyes betraying a fear they won''t name...',
  '{"allowMagic": true, "allowTechnology": false, "difficultyLevel": "deadly", "combatSystem": "narrative"}'::jsonb,
  true,
  NULL
);
