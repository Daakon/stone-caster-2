-- Phase 1: Core vs Rulesets Framework Split - Games Fixtures
-- Migration: 20250129_awf_games_fixtures.sql
-- Add sample game fixtures with proper state_snapshot.meta (dev only)

-- Insert sample game fixtures with proper state_snapshot.meta
INSERT INTO games (id, user_id, cookie_group_id, world_slug, state_snapshot, turn_count, status, created_at, updated_at, last_played_at)
VALUES 
  (
    'game-mystika-tutorial-001',
    'user-123',
    NULL,
    'mystika',
    '{
      "meta": {
        "world_ref": "world.mystika@1.0.0",
        "adventure_ref": "adv.mystika-tutorial@1.0.0",
        "scenario_ref": "scenario.inn_last_ember@1.0.0",
        "ruleset_ref": "ruleset.core.default@1.0.0",
        "locale": "en-US"
      },
      "hot": {
        "scene": "inn_common_room",
        "time": { "ticks": 0, "band": "Dawn" },
        "objectives": [
          { "id": "learn_magic", "title": "Learn basic magic", "completed": false }
        ],
        "flags": { "tutorial_mode": true }
      },
      "warm": {
        "episodic": [
          { "key": "arrival", "note": "Arrived at the Last Ember Inn", "turn": 0 }
        ],
        "pins": [],
        "relationships": {},
        "tags": { "tutorial": true }
      },
      "cold": {
        "character_background": "Aspiring mage from the countryside",
        "world_knowledge": ["Mystika is a land of magic and mystery"]
      }
    }'::jsonb,
    0,
    'active',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    'game-whispercross-haunted-001',
    NULL,
    'cookie-group-456',
    'whispercross',
    '{
      "meta": {
        "world_ref": "world.whispercross@1.0.0",
        "adventure_ref": "adv.whispercross-haunted-town@1.0.0",
        "scenario_ref": "scenario.haunted_investigation@1.0.0",
        "ruleset_ref": "ruleset.core.default@1.0.0",
        "locale": "en-US"
      },
      "hot": {
        "scene": "town_square",
        "time": { "ticks": 15, "band": "Evening" },
        "objectives": [
          { "id": "investigate_haunting", "title": "Investigate the haunting", "completed": false },
          { "id": "find_evidence", "title": "Find evidence of supernatural activity", "completed": false }
        ],
        "flags": { "investigation_started": true, "locals_helpful": false }
      },
      "warm": {
        "episodic": [
          { "key": "arrival", "note": "Arrived in Whispercross", "turn": 0 },
          { "key": "first_sighting", "note": "Saw a ghostly figure in the town square", "turn": 5 }
        ],
        "pins": ["old_man_warning", "abandoned_house"],
        "relationships": {
          "npc.mayor": { "trust": 30, "fear": 20 },
          "npc.old_man": { "trust": 60, "fear": 10 }
        },
        "tags": { "supernatural": true, "investigation": true }
      },
      "cold": {
        "character_background": "Paranormal investigator",
        "world_knowledge": ["Whispercross is known for supernatural occurrences"]
      }
    }'::jsonb,
    3,
    'active',
    NOW(),
    NOW(),
    NOW()
  ),
  (
    'game-aetherium-space-001',
    'user-789',
    NULL,
    'aetherium',
    '{
      "meta": {
        "world_ref": "world.aetherium@1.0.0",
        "adventure_ref": "adv.aetherium-space-station@1.0.0",
        "scenario_ref": "scenario.station_alpha@1.0.0",
        "ruleset_ref": "ruleset.core.default@1.0.0",
        "locale": "en-US"
      },
      "hot": {
        "scene": "station_docking_bay",
        "time": { "ticks": 0, "band": "Dawn" },
        "objectives": [
          { "id": "explore_station", "title": "Explore the abandoned space station", "completed": false },
          { "id": "find_survivors", "title": "Look for any survivors", "completed": false }
        ],
        "flags": { "docking_complete": true, "life_support_active": true }
      },
      "warm": {
        "episodic": [
          { "key": "docking", "note": "Successfully docked at Station Alpha", "turn": 0 }
        ],
        "pins": ["engineering_section", "command_center"],
        "relationships": {},
        "tags": { "sci_fi": true, "exploration": true }
      },
      "cold": {
        "character_background": "Space explorer and engineer",
        "world_knowledge": ["Aetherium system is known for advanced technology"]
      }
    }'::jsonb,
    0,
    'active',
    NOW(),
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  state_snapshot = EXCLUDED.state_snapshot,
  updated_at = NOW();

-- Add comments
COMMENT ON COLUMN games.state_snapshot IS 'Complete game state including meta (world_ref, adventure_ref, ruleset_ref, locale) and hot/warm/cold state';







