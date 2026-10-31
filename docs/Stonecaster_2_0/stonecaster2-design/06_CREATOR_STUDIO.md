# 06 — Creator Studio and Guided Authoring

## Creator Studio outcome

Anyone with a good story idea can create a **playable**, coherent NPC, scenario or world without learning prompt engineering, authoring dozens of files, or configuring a complex mechanics engine. Expert creators can still edit deep knowledge and prompt rule packs.

## Four independent creation entry points

1. **World:** name, premise, tone, canon, setting boundaries, default rules and content permissions. Generate a minimal playable shell, not a sprawling mandatory encyclopedia.
2. **NPC:** select an existing world; name/role, personality, motives, fears, knowledge, goals, behavior constraints, availability, recruitability. Can publish alone.
3. **Scenario:** select world; premise, opening, participants/roles, stakes, hidden truths, threads, optional authored beats and rule packs. Can reuse existing world NPCs and locations.
4. **Rule Pack:** choose type and behavior goal; generate prompt instructions, sample adjudications, dependencies, test cases. Can share with compatible worlds or keep private.

Player personas/characters have a separate simple create/edit flow with native-world identity, personality and optional abilities.

## Three levels of authoring

- **Quick Create:** one description → AI-generated typed draft → inspect a readable summary → playtest. Minimal follow-up questions.
- **Guided:** AI asks a *small* number of impactful questions (e.g., how strictly abilities matter, whether NPC is recruitable, how replayable the mystery should be). Defaults are explicit and editable.
- **Advanced:** precise edit of behavior constraints, secret access, role bindings, source lore, rule instructions, prompt examples, output style, versions, publishing metadata. No requirement to use Advanced for quality results.

## Creator Assistant tools (server-authorized)

| Tool | Scope |
|---|---|
| `draft_world` | Generate minimal setting, canon and defaults |
| `draft_npc` | Create NPC definition tied to selected world |
| `draft_scenario` | Reuse world assets, scenario threads and roles |
| `draft_rule_pack` | Create prompt instructions + examples + tests |
| `search_world_content` | Retrieve only content the creator may access |
| `validate_draft` | Structural/schema, referential, permission, conflict, completeness checks |
| `preview_context` | Inspect the actual rule packs and knowledge available to a test scene |
| `run_playtest` | Isolated scratch timeline; no persistent live-player changes |
| `suggest_revision` | Convert natural-language critique into typed, reviewable patches |
| `publish_revision` | Explicit creator confirmation, validation and authorization required |

Do not let the assistant directly update published canon or other players' histories. Tool calls require ACL checks and separate draft/publish transactions; publishing is an explicit user action.

## Example creator journey

Creator: 'Make a political fantasy mystery about a vanished royal courier; let players enter with their own companions.'

Assistant:

1. Ask the world choice and one major tone/complexity question if not already known.
2. Retrieve permitted locations, factions, NPCs, world rules and canon via Context Intelligence.
3. Produce an editable scenario with opening event, active actors, goals, secrets, causal pressures, multiple plausible outcomes, role needs, and selected rule packs.
4. Identify conflicts: unavailable world NPC, contradiction to royal succession lore, scenario requiring an absent NPC, or secret-visibility problem.
5. Offer to use an existing NPC or create a new NPC definition as a separate artifact.
6. Run a playtest with supplied/temporary party. Show narrative quality plus objective checks: memory, agency, rule adherence, unauthorized information leaks.
7. Creator says 'the guard is too trusting' → assistant proposes adjustments to guard's behavior and agency instructions; creator reviews change and reruns test.
8. Publish approved revision as a scenario that other users of that world can enter.

## Content assembly without duplication

- Reuse world canon by references rather than copying entire lore into each NPC/scenario.
- A scenario's required roles may resolve to a fixed world NPC, a compatible party member, or an AI-generated ephemeral scene actor according to author constraints.
- Creators can provide exact NPC dialogue examples, but only as examples. They should not force players down a predetermined dialogue tree unless explicitly marked as a guided story experience.
- Publication validates missing references, contradictory facts, visibility scopes, rule-pack conflicts, content ownership and world-owner approval.
- Uploaded Markdown/TXT/PDF documents can seed drafts and knowledge indexing after author review. Preserve provenance, rights declaration and privacy; no uploaded text automatically becomes official canon.

## Publication and permissions

- `draft` → `in_review` (optional) → `published_revision` → `archived`.
- World owner chooses `owner-only`, `approval-required`, or `open-community`. Open community does not imply automatic promotion to official canon.
- Use immutable revisions for published entities; edits produce new revisions.
- A content library can show `official`, `community`, and `private` distinctions plus creator attribution, world compatibility, rule complexity and content notices.
- No marketplace payments/revenue sharing required for MVP.

## Creator UX surfaces

- **Home / My Creations:** continue draft, test, or update published content.
- **Creation Chat + Cards:** conversational suggestions on one side, generated structured cards on the other. Editable without code.
- **Connections:** embedded browser for existing world people/places/rules; clear provenance, avoid duplicate creations.
- **Playtest:** launch disposable timeline with visible `Reset`, inspect scene, rules/memories included, feedback, and 'Apply suggestion'.
- **Publish wizard:** permission, compatibility, validation warnings, preview, explicit publish.

Mobile-first 390px flow with single-column editor, compact preview, and obvious Save/Playtest/Publish controls. Desktop supports side-by-side chat and form. Never require creators to see or edit raw JSON.

## Creator quality rubric

Before publication, verify: character has actual motives/limits, clear speech/behavior examples, scenario has actionable tension and alternative routes, no contradictory canon, compatible role requirements, no accidental knowledge leaks, rule packs tested on at least one positive and negative example. Provide auto-generated explanations in plain language, not opaque completeness scores.
