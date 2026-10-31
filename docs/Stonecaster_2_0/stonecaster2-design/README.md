# StoneCaster 2.0 — Design Pack

Prepared 2026-10-30. This is a **new product/design direction**, not a code change.

## Best starting points

- `AI_AGENT_CONTEXT.md` — short context you can paste into an AI coding session.
- `00_START_HERE.md` — architectural design authority, scope and document precedence.
- `09_AGENT_HANDOFF.md` — kickoff prompt, first task, and two-agent work split.
- `08_MVP_EVALUATION.md` — acceptance tests and what must be proven first.

## Full design documents

1. `01_PRODUCT_EXPERIENCE.md` — player and creator experiences.
2. `02_DOMAIN_AND_CONTENT.md` — world/character/NPC/timeline/party/scenario identities.
3. `03_STORY_RUNTIME.md` — how turns, events and NPC agency work.
4. `04_CONTEXT_MEMORY_RAG.md` — scoped memories, retrieval and dynamic context.
5. `05_RULE_PACKS_AND_MODELS.md` — complex prompt-driven rules and provider-neutral model strategy.
6. `06_CREATOR_STUDIO.md` — guided content creation and playtesting.
7. `07_PLATFORM_MIGRATION.md` — existing repository, chosen infrastructure, migration stages.
8. `08_MVP_EVALUATION.md` — vertical slice and objective acceptance gates.
9. `09_AGENT_HANDOFF.md` — actionable implementation handoff.

`STONECASTER_2_MASTER_DESIGN.md` in the parent download folder is a generated **reading copy** of all numbered specifications. The individual numbered files are the canonical editable documents. Keep them synchronized by regenerating the master after edits.

## How to use with a coding agent

1. Add this folder under `docs/stonecaster-2/` in the repository (or supply it as context).
2. Start with the short agent context and `09_AGENT_HANDOFF.md`.
3. Ask for P0 audit and P1 contracts first. Do not ask for the full 2.0 rebuild as one task.
4. Keep legacy docs in place but mark contradictions as superseded by this pack; no destructive data changes without migration.
