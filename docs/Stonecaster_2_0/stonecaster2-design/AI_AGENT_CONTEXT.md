# StoneCaster 2.0 — Short Context for Coding Agents

**Paste/reference this when starting work. Read the numbered design documents for the full spec.**

StoneCaster 2.0 is a simpler, extensible AI-storytelling platform, not a hardcoded RPG simulation engine. The product combines reusable **worlds, NPCs, scenarios, rule packs**, and an AI-guided creator with persistent player timelines, independent NPC behavior, portable companions, strong RAG, and dynamic prompts.

## Architecture that must remain true

- **World-bound identity:** player characters and published NPC definitions belong to one world. Each player timeline has its own NPC instances, relationships, memories, party members, events, and scenario history. Cross-world travel is deferred.
- **Scenarios are temporary:** player and NPC instances **do not belong to the scenario**. Enter A, recruit companions, leave/complete A, then enter B with those same instances and their history.
- **NPC agency:** characters may refuse, pursue independent goals, become unavailable, or leave. Player actions are attempts, not instructions that control other actors' feelings or choices.
- **Prompt-based rules:** combat, social checks, skills, abilities, survival and progression may have *deep, selectable, versioned rule packs*. Models adjudicate the fiction. Backend code validates identities, permissions, event schema, state version, and transactional storage—but does not implement a separate deterministic RPG mechanics engine.
- **Strong context engineering:** load required current state via exact SQL; use authorized hybrid RAG for lore, events and memories; select relevant rule packs; never assume vector retrieval is truth. Separate public facts, timeline facts, subjective NPC beliefs, private NPC knowledge and creator-only secrets.
- **Server-authoritative history:** AI proposes story and events; server validates and atomically commits them. Model failure never silently advances the story. Use idempotent per-turn APIs and immutable published content revisions.
- **Easy creation:** anyone can draft a single NPC, scenario, world or rule pack from a short description; existing world assets can be reused. Guided questions, validation, sandbox playtesting and explicit publication remove the requirement for prompt-engineering expertise.
- **Economical AI:** a capable scene model handles the present NPC cast in one call by default. Additional classification/repair calls only when evaluations justify them. Mainstream direct providers plus optional experimental model gateway; profile and pricing stay configurable.
- **Current stack:** React/Vite on Cloudflare; Node/Express/TypeScript on Fly.io; Supabase Auth/PostgreSQL/Drizzle/pgvector; optional AI SDK, Promptfoo and managed traces. No hosting migration or new microservice framework required.

## Start narrowly

Implement one test world with **two scenarios, a player and three NPCs**. Prove recruiting an NPC in Scenario A, carrying them into Scenario B, remembering a prior promise, and not leaking another character's private secret. Test a detailed optional rule pack and at least two compatible model profiles. Only then expand Creator Studio or the content catalog.

## What NOT to rebuild

Legacy fixed Mystika ZIP bundles, mandatory multi-agent turns, full deterministic combat/crafting/economy, scenario-owned player character saves, one model per NPC, continuous background simulation, public marketplaces, and cross-world party migration.

## Implementation guidance

Treat the numbered `00_START_HERE.md`–`09_AGENT_HANDOFF.md` as authoritative requirements. Legacy repository docs are reference material only when contradictory. Follow existing `AGENTS.md` quality/security/deploy rules when compatible. Build additively, preserve old saves, use feature flags, update migrations/tests, verify tracked `.env` exposure privately, and deliver each vertical slice before adding new infrastructure.
