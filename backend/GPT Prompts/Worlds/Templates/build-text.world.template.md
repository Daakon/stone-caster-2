# World Build Text — Template

**Purpose:** Lightweight, world-specific flavor/tone wrapper for the Custom GPT.  
**Use:** Load _after_ the base/core instructions and `engine.system.json`. Keep this file short and strictly **flavor-only**.

---

## World Header

- **World Name:** {{WORLD_NAME}}
- **Tagline:** {{SHORT_TAGLINE}} <!-- one line, e.g., "Amber-lit forests and sly courtly intrigues." -->

## Flavor Intro (≤ 120 words)

{{A tight, cinematic paragraph that sets tone and high-level themes. Avoid plot spoilers and mechanics.}}

## Tone & Diction Anchors (bulleted, 5–8 items max)

- {{e.g., "Cinematic but grounded"}}
- {{e.g., "Hints of folklore rather than encyclopedia dumps"}}
- {{e.g., "Subtext > exposition"}}
- {{e.g., "Nature imagery: moss, foxfire, reed-sway"}}
- {{e.g., "Magic feels costly"}}

## Style Notes (presentation cues only — not mechanics)

- Headers may show time/weather icons when available.
- Scene descriptions stay concise; avoid purple prose.
- Choice labels are short and actionable.
- Avoid meta commentary; the world feels self-consistent.

## Load Note

After loading **Core/Base instructions**, apply the following world assets for this session:

- `world-codex-<world>-logic.json` (rules/banlists/terms)
- `style.<world>.md` (voice templates, chips)

> Do **not** include mechanics policies or save/validation rules here. Those live in Core.
