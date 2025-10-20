-- Seed data for injection maps
-- Phase 5: Injection-Map Editor + Bundle Diff & Audit

-- Insert default injection map (current working map)
INSERT INTO public.injection_maps (id, version, label, doc, is_active, created_at, updated_at)
VALUES (
  'im.default',
  '1.0.0',
  'Default Injection Map',
  '{
    "rules": [
      {
        "from": "/world/name",
        "to": "/awf_bundle/world/name"
      },
      {
        "from": "/world/description", 
        "to": "/awf_bundle/world/description"
      },
      {
        "from": "/adventure/name",
        "to": "/awf_bundle/adventure/name"
      },
      {
        "from": "/adventure/synopsis",
        "to": "/awf_bundle/adventure/synopsis"
      },
      {
        "from": "/scenario/name",
        "to": "/awf_bundle/scenario/name"
      },
      {
        "from": "/scenario/start_scene",
        "to": "/awf_bundle/scenario/start_scene"
      },
      {
        "from": "/npcs",
        "to": "/awf_bundle/npcs",
        "limit": {
          "units": "count",
          "max": 10
        }
      },
      {
        "from": "/contract/id",
        "to": "/awf_bundle/contract/id"
      },
      {
        "from": "/contract/name",
        "to": "/awf_bundle/contract/name"
      },
      {
        "from": "/player/name",
        "to": "/awf_bundle/player/name"
      },
      {
        "from": "/game/turn_count",
        "to": "/awf_bundle/game/turn_count"
      }
    ],
    "notes": "Default injection map for standard bundle assembly. Maps core data from context to awf_bundle structure with basic limits."
  }'::jsonb,
  true,
  now(),
  now()
);

-- Insert experimental injection map (for testing diffs)
INSERT INTO public.injection_maps (id, version, label, doc, is_active, created_at, updated_at)
VALUES (
  'im.experimental',
  '1.0.0',
  'Experimental Injection Map',
  '{
    "rules": [
      {
        "from": "/world/name",
        "to": "/awf_bundle/world/name"
      },
      {
        "from": "/world/description",
        "to": "/awf_bundle/world/description",
        "limit": {
          "units": "tokens",
          "max": 50
        }
      },
      {
        "from": "/adventure/name",
        "to": "/awf_bundle/adventure/name"
      },
      {
        "from": "/adventure/synopsis",
        "to": "/awf_bundle/adventure/synopsis",
        "limit": {
          "units": "tokens", 
          "max": 100
        }
      },
      {
        "from": "/scenario/name",
        "to": "/awf_bundle/scenario/name"
      },
      {
        "from": "/scenario/start_scene",
        "to": "/awf_bundle/scenario/start_scene"
      },
      {
        "from": "/npcs",
        "to": "/awf_bundle/npcs",
        "limit": {
          "units": "count",
          "max": 5
        }
      },
      {
        "from": "/contract/id",
        "to": "/awf_bundle/contract/id"
      },
      {
        "from": "/contract/name",
        "to": "/awf_bundle/contract/name"
      },
      {
        "from": "/player/name",
        "to": "/awf_bundle/player/name"
      },
      {
        "from": "/game/turn_count",
        "to": "/awf_bundle/game/turn_count"
      },
      {
        "from": "/world/timeworld",
        "to": "/awf_bundle/world/timeworld",
        "skipIfEmpty": true
      },
      {
        "from": "/adventure/cast",
        "to": "/awf_bundle/adventure/cast",
        "limit": {
          "units": "count",
          "max": 3
        },
        "skipIfEmpty": true
      }
    ],
    "notes": "Experimental injection map with stricter token limits and additional optional fields. Used for testing bundle diff functionality."
  }'::jsonb,
  false,
  now(),
  now()
);

-- Insert a minimal injection map for testing
INSERT INTO public.injection_maps (id, version, label, doc, is_active, created_at, updated_at)
VALUES (
  'im.minimal',
  '1.0.0',
  'Minimal Injection Map',
  '{
    "rules": [
      {
        "from": "/world/name",
        "to": "/awf_bundle/world/name"
      },
      {
        "from": "/adventure/name", 
        "to": "/awf_bundle/adventure/name"
      }
    ],
    "notes": "Minimal injection map with only essential fields. Useful for testing basic functionality."
  }'::jsonb,
  false,
  now(),
  now()
);

-- Insert an injection map with fallback values for testing
INSERT INTO public.injection_maps (id, version, label, doc, is_active, created_at, updated_at)
VALUES (
  'im.fallback',
  '1.0.0',
  'Fallback Injection Map',
  '{
    "rules": [
      {
        "from": "/world/name",
        "to": "/awf_bundle/world/name",
        "fallback": {
          "ifMissing": "Unknown World"
        }
      },
      {
        "from": "/adventure/name",
        "to": "/awf_bundle/adventure/name", 
        "fallback": {
          "ifMissing": "Untitled Adventure"
        }
      },
      {
        "from": "/scenario/name",
        "to": "/awf_bundle/scenario/name",
        "fallback": {
          "ifMissing": "Default Start"
        }
      }
    ],
    "notes": "Injection map with fallback values for missing fields. Demonstrates fallback functionality."
  }'::jsonb,
  false,
  now(),
  now()
);
