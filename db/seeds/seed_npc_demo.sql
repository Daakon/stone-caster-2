-- NPC Demo Seed Data
-- Sample NPCs and relationships for testing the NPC system

-- ============================================================================
-- SAMPLE NPCS
-- ============================================================================

-- Kiera - A warden/guide NPC
INSERT INTO npcs (id, world_id, name, archetype, role_tags, doc) 
VALUES (
    'npc.mystika.kiera',
    'demo.mystika',
    'Kiera',
    'Warden',
    ARRAY['companion', 'guide'],
    '{"quirks": ["speaks in clipped phrases"], "mannerisms": ["taps ring when thinking"], "background": "Former ranger turned warden"}'
) ON CONFLICT (id) DO NOTHING;

-- Thorne - A scholar NPC
INSERT INTO npcs (id, world_id, name, archetype, role_tags, doc) 
VALUES (
    'npc.mystika.thorne',
    'demo.mystika',
    'Thorne',
    'Scholar',
    ARRAY['merchant', 'lorekeeper'],
    '{"quirks": ["constantly adjusts spectacles"], "mannerisms": ["mumbles to himself"], "background": "Ancient knowledge keeper"}'
) ON CONFLICT (id) DO NOTHING;

-- Zara - A warrior NPC
INSERT INTO npcs (id, world_id, name, archetype, role_tags, doc) 
VALUES (
    'npc.mystika.zara',
    'demo.mystika',
    'Zara',
    'Warrior',
    ARRAY['guard', 'mentor'],
    '{"quirks": ["sharpens blade when nervous"], "mannerisms": ["stands with hand on sword"], "background": "Veteran of many battles"}'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ENTRY POINT BINDINGS
-- ============================================================================

-- Bind NPCs to the Lost Temple adventure
INSERT INTO entry_point_npcs (entry_point_id, npc_id, role_hint, weight) 
VALUES 
    ('demo.system.adventure', 'npc.mystika.kiera', 'guide', 3),
    ('demo.system.adventure', 'npc.mystika.thorne', 'lorekeeper', 2),
    ('demo.system.adventure', 'npc.mystika.zara', 'guard', 1)
ON CONFLICT (entry_point_id, npc_id) DO NOTHING;

-- ============================================================================
-- PROMPT SEGMENTS FOR NPCS
-- ============================================================================

-- Kiera - Tier 0 (baseline)
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.kiera', 
    'NPC: Kiera — calm, alert, protective. Prefers de-escalation. Speaks in clipped phrases and taps her ring when thinking.', 
    '{"tier": 0, "kind": "baseline"}'
) ON CONFLICT DO NOTHING;

INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.kiera', 
    'Behavior: watches for planar shimmer; warns before ambush. Always scans the horizon for threats.', 
    '{"tier": 0, "kind": "behavior"}'
) ON CONFLICT DO NOTHING;

-- Kiera - Tier 1 (trust ≥ 20)
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.kiera', 
    'Reveal: owes life-debt to a drygar (mentions at trust≥20). "I once owed my life to one of the forest guardians... they taught me to see what others miss."', 
    '{"tier": 1, "kind": "secret"}'
) ON CONFLICT DO NOTHING;

-- Kiera - Tier 2 (respect ≥ 25 & warmth ≥ 20)
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.kiera', 
    'Deep Reveal: carries cracked focus stone; shares at respect≥25 & warmth≥20. "This stone... it was my mentor\'s. It\'s cracked, but it still holds power."', 
    '{"tier": 2, "kind": "secret"}'
) ON CONFLICT DO NOTHING;

-- Kiera - Tier 3 (romance ≥ 30 & trust ≥ 30)
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.kiera', 
    'True name: Kierathen Vail (romance≥30 & trust≥30). "My true name is Kierathen Vail. Only those I trust completely know this."', 
    '{"tier": 3, "kind": "secret"}'
) ON CONFLICT DO NOTHING;

-- Thorne - Tier 0 (baseline)
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.thorne', 
    'NPC: Thorne — scholarly, absent-minded, knowledgeable. Constantly adjusts his spectacles and mumbles to himself.', 
    '{"tier": 0, "kind": "baseline"}'
) ON CONFLICT DO NOTHING;

INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.thorne', 
    'Behavior: examines everything with academic curiosity. "Fascinating... the runes on this door are from the Third Age..."', 
    '{"tier": 0, "kind": "behavior"}'
) ON CONFLICT DO NOTHING;

-- Thorne - Tier 1 (trust ≥ 20)
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.thorne', 
    'Reveal: has studied this temple before (trust≥20). "I\'ve read about this place in the ancient texts... the layout is exactly as described."', 
    '{"tier": 1, "kind": "secret"}'
) ON CONFLICT DO NOTHING;

-- Thorne - Tier 2 (respect ≥ 25 & warmth ≥ 20)
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.thorne', 
    'Deep Reveal: knows the temple\'s true purpose (respect≥25 & warmth≥20). "This wasn\'t just a temple... it was a testing ground for the worthy."', 
    '{"tier": 2, "kind": "secret"}'
) ON CONFLICT DO NOTHING;

-- Thorne - Tier 3 (romance ≥ 30 & trust ≥ 30)
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.thorne', 
    'True knowledge: the temple\'s final secret (romance≥30 & trust≥30). "The greatest treasure isn\'t gold... it\'s the knowledge of how to unlock one\'s true potential."', 
    '{"tier": 3, "kind": "secret"}'
) ON CONFLICT DO NOTHING;

-- Zara - Tier 0 (baseline)
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.zara', 
    'NPC: Zara — fierce, loyal, battle-scarred. Sharpens her blade when nervous and stands with hand on sword.', 
    '{"tier": 0, "kind": "baseline"}'
) ON CONFLICT DO NOTHING;

INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.zara', 
    'Behavior: assesses threats and protects the group. "Stay behind me. I\'ve seen what these ancient places can do to the unwary."', 
    '{"tier": 0, "kind": "behavior"}'
) ON CONFLICT DO NOTHING;

-- Zara - Tier 1 (trust ≥ 20)
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.zara', 
    'Reveal: has fought here before (trust≥20). "I\'ve been in places like this... the traps are predictable once you know what to look for."', 
    '{"tier": 1, "kind": "secret"}'
) ON CONFLICT DO NOTHING;

-- Zara - Tier 2 (respect ≥ 25 & warmth ≥ 20)
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.zara', 
    'Deep Reveal: lost someone here (respect≥25 & warmth≥20). "My sister... she didn\'t make it out of a place like this. I won\'t let that happen to you."', 
    '{"tier": 2, "kind": "secret"}'
) ON CONFLICT DO NOTHING;

-- Zara - Tier 3 (romance ≥ 30 & trust ≥ 30)
INSERT INTO prompt_segments (scope, ref_id, content, metadata) 
VALUES (
    'npc', 
    'npc.mystika.zara', 
    'True name: Zarathiel the Unbroken (romance≥30 & trust≥30). "My true name is Zarathiel the Unbroken. I earned that name in the fires of war."', 
    '{"tier": 3, "kind": "secret"}'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- SAMPLE RELATIONSHIPS (for testing)
-- ============================================================================

-- Get a sample game ID for relationship testing
DO $$
DECLARE
    game_uuid uuid;
BEGIN
    -- Get the first game ID
    SELECT id INTO game_uuid FROM games LIMIT 1;
    
    IF game_uuid IS NOT NULL THEN
        -- Create sample relationships
        INSERT INTO npc_relationships (game_id, npc_id, trust, warmth, respect, romance, awe, fear, desire, flags) 
        VALUES 
            (game_uuid, 'npc.mystika.kiera', 15, 10, 20, 0, 5, 0, 0, '{"met": true, "first_impression": "positive"}'),
            (game_uuid, 'npc.mystika.thorne', 5, 0, 15, 0, 0, 0, 0, '{"met": true, "first_impression": "neutral"}'),
            (game_uuid, 'npc.mystika.zara', 10, 5, 25, 0, 10, 0, 0, '{"met": true, "first_impression": "respectful"}')
        ON CONFLICT (game_id, npc_id) DO NOTHING;
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show seeded NPCs
SELECT 'NPCs seeded:' as info;
SELECT id, name, archetype, role_tags FROM npcs ORDER BY name;

-- Show entry point bindings
SELECT 'Entry point bindings:' as info;
SELECT epn.entry_point_id, n.name, epn.role_hint, epn.weight 
FROM entry_point_npcs epn 
JOIN npcs n ON epn.npc_id = n.id 
ORDER BY epn.entry_point_id, epn.weight DESC;

-- Show prompt segments by tier
SELECT 'NPC prompt segments by tier:' as info;
SELECT ps.ref_id, ps.metadata->>'tier' as tier, ps.metadata->>'kind' as kind, LEFT(ps.content, 50) || '...' as content_preview
FROM prompt_segments ps 
WHERE ps.scope = 'npc' 
ORDER BY ps.ref_id, (ps.metadata->>'tier')::int;

-- Show sample relationships
SELECT 'Sample relationships:' as info;
SELECT r.game_id, n.name, r.trust, r.warmth, r.respect, r.romance, r.awe, r.fear, r.desire
FROM npc_relationships r
JOIN npcs n ON r.npc_id = n.id
ORDER BY n.name;
