-- Minimal Demo Seed Data
-- Sample data for testing the core schema and UGC functionality

-- ============================================================================
-- SAMPLE WORLDS AND RULESETS
-- ============================================================================

-- Create a sample world
INSERT INTO worlds (id, version, status, doc) 
VALUES ('demo.mystika', '1.0.0', 'active', '{"name": "Mystika", "description": "A fantasy world of magic and mystery", "genre": "fantasy"}');

-- Create a sample ruleset
INSERT INTO rulesets (id, version, status, doc) 
VALUES ('demo.dnd5e', '1.0.0', 'active', '{"name": "D&D 5e", "description": "Dungeons & Dragons 5th Edition rules", "system": "dnd5e"}');

-- ============================================================================
-- SAMPLE ENTRY POINTS (System-owned and User-owned)
-- ============================================================================

-- System-owned entry point (active)
INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, synopsis, status, visibility, content_rating, tags, content, sort_weight, popularity_score) 
VALUES (
    'demo.system.adventure', 
    'the-lost-temple', 
    'adventure', 
    'demo.mystika', 
    'demo.dnd5e', 
    'The Lost Temple', 
    'A classic dungeon crawl through an ancient temple filled with traps and treasures.', 
    'Explore the mysterious temple and uncover its secrets.',
    'active', 
    'public', 
    'safe', 
    ARRAY['dungeon', 'treasure', 'classic'], 
    '{"difficulty": "medium", "duration": "2-4 hours", "level_range": "3-5"}',
    100,
    85
);

-- User-owned entry point (draft)
INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, synopsis, status, visibility, content_rating, tags, content, owner_user_id, lifecycle, sort_weight, popularity_score) 
VALUES (
    'demo.user.adventure', 
    'forest-encounter', 
    'adventure', 
    'demo.mystika', 
    'demo.dnd5e', 
    'Forest Encounter', 
    'A short adventure in the enchanted forest where players meet mysterious creatures.', 
    'A peaceful walk through the woods turns into an unexpected adventure.',
    'draft', 
    'public', 
    'safe', 
    ARRAY['forest', 'nature', 'creatures'], 
    '{"difficulty": "easy", "duration": "1-2 hours", "level_range": "1-3"}',
    gen_random_uuid(),
    'draft',
    50,
    0
);

-- User-owned entry point (pending review)
INSERT INTO entry_points (id, slug, type, world_id, ruleset_id, title, description, synopsis, status, visibility, content_rating, tags, content, owner_user_id, lifecycle, sort_weight, popularity_score) 
VALUES (
    'demo.user.scenario', 
    'tavern-brawl', 
    'scenario', 
    'demo.mystika', 
    'demo.dnd5e', 
    'Tavern Brawl', 
    'A social encounter that can turn into a brawl in the local tavern.', 
    'What starts as a friendly drink becomes a test of strength and wit.',
    'draft', 
    'public', 
    'safe', 
    ARRAY['social', 'combat', 'tavern'], 
    '{"difficulty": "easy", "duration": "30-60 minutes", "level_range": "1-5"}',
    gen_random_uuid(),
    'pending_review',
    25,
    0
);

-- ============================================================================
-- SAMPLE PROMPT SEGMENTS
-- ============================================================================

-- Core system prompt
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES ('core', NULL, 'You are a helpful AI game master for a fantasy role-playing game. You create immersive, engaging narratives and respond to player actions in character.', '{"type": "system", "priority": "high"}');

-- World-specific prompt
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES ('world', 'demo.mystika', 'The world of Mystika is a realm of ancient magic, where dragons once ruled and wizards still study the arcane arts. The land is filled with mysterious forests, towering mountains, and ancient ruins.', '{"type": "world_description", "mood": "mysterious"}');

-- Entry-specific prompt
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES ('entry', 'demo.system.adventure', 'This adventure takes place in the Lost Temple, an ancient structure filled with magical traps and valuable treasures. The temple has been sealed for centuries, and its secrets await discovery.', '{"type": "adventure_setup", "tone": "exploration"}');

-- Entry start segments (first turn only)
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES ('entry_start', 'demo.system.adventure', 'The ancient stone door stands before you, covered in glowing runes that pulse with an otherworldly light. The air is thick with the scent of old magic and forgotten secrets.', '{"type": "opening_scene", "mood": "mysterious"}');

INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES ('entry_start', 'demo.system.adventure', 'As you approach the door, you hear a faint whisper on the wind: "Only the worthy may enter, but beware the trials within." The runes begin to glow brighter in response to your presence.', '{"type": "atmosphere", "mood": "foreboding"}');

-- ============================================================================
-- SAMPLE CONTENT REVIEWS
-- ============================================================================

-- Review for the pending scenario
INSERT INTO content_reviews (target_type, target_id, submitted_by, state, notes) 
VALUES ('entry_point', 'demo.user.scenario', gen_random_uuid(), 'open', 'Please review this tavern brawl scenario for publication');

-- ============================================================================
-- SAMPLE GAMES AND TURNS
-- ============================================================================

-- Create a sample game
INSERT INTO games (entry_point_id, entry_point_type, world_id, ruleset_id, owner_user_id, state, turn_count, status) 
VALUES ('demo.system.adventure', 'adventure', 'demo.mystika', 'demo.dnd5e', gen_random_uuid(), '{"hot": {"player": "hero"}, "warm": {"location": "temple_entrance"}, "cold": {"world": "mystika"}}', 0, 'active');

-- Get the game ID for turns
DO $$
DECLARE
    game_uuid uuid;
BEGIN
    SELECT id INTO game_uuid FROM games WHERE entry_point_id = 'demo.system.adventure' LIMIT 1;
    
    -- Create sample turns
    INSERT INTO turns (game_id, idx, role, content, prompt_meta) 
    VALUES (game_uuid, 1, 'system', '{"message": "Welcome to the Lost Temple adventure! You stand before an ancient stone door covered in mysterious runes."}', '{"prompt_id": "demo.system.adventure", "layer": "entry_start"}');
    
    INSERT INTO turns (game_id, idx, role, content, prompt_meta) 
    VALUES (game_uuid, 2, 'player', '{"message": "I examine the runes carefully to see if I can understand them."}', '{"action": "examine", "target": "runes"}');
    
    INSERT INTO turns (game_id, idx, role, content, prompt_meta) 
    VALUES (game_uuid, 3, 'narrator', '{"message": "The runes glow faintly as you study them. They appear to be in an ancient language, but you can make out the words \'Only the worthy may enter.\'"}', '{"response_type": "narrative", "mood": "mysterious"}');
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show the seeded data
SELECT 'Sample data seeded successfully!' as status;

-- Count entries by type
SELECT 'Entry points by type:' as info;
SELECT type, COUNT(*) as count FROM entry_points GROUP BY type;

-- Count entries by lifecycle
SELECT 'Entry points by lifecycle:' as info;
SELECT lifecycle, COUNT(*) as count FROM entry_points GROUP BY lifecycle;

-- Count prompt segments by scope
SELECT 'Prompt segments by scope:' as info;
SELECT scope, COUNT(*) as count FROM prompt_segments GROUP BY scope;

-- Show active games
SELECT 'Active games:' as info;
SELECT COUNT(*) as count FROM games WHERE status = 'active';

-- Show open reviews
SELECT 'Open reviews:' as info;
SELECT COUNT(*) as count FROM content_reviews WHERE state = 'open';
