# 01 — Product and Experience Design

## Positioning

StoneCaster occupies the space between open-ended AI story generators and single-character AI roleplay apps: **modular, persistent, character-driven story worlds**. Players should feel that characters have real motivations and that their shared history survives a change of scenario. Creators should produce good initial results without knowing prompt engineering.

Distinctive promise: **Create a character. Find companions. Take them into new stories. Your history matters.**

## Player-facing concepts

- **World:** a coherent setting, its canon, narrative tone, available scenarios, and character catalog. World owner controls official canon and compatibility.
- **My Character:** one player's persona anchored to one world; descriptive abilities, traits, biography, and history. Progress persists across scenarios.
- **My Story / Timeline:** private, persistent continuity for that character in that world. Players may start independent timelines rather than having one global shared history.
- **Party:** a subset of timeline NPC instances accompanying the player. No automatic obedience; each can accept/decline participation.
- **Scenario:** a creator-built playable situation with an opening, tension, cast/role needs, rules, and possible developments. A scenario is reusable across different player histories.
- **Story Thread:** an open problem or desire with actors, known/hidden information, escalation conditions, and possible consequences, not necessarily a rigid quest graph.

## Player's minimal journey

1. Discover worlds/scenarios through readable, enticing cards (genre, tone, difficulty/complexity, content notices, model support).
2. Select a world, create a player character (quick generated or guided); choose a saved timeline or start a new one.
3. Review scenario compatibility and the party. The UI explains if the scenario calls for a role the party lacks, but allows reasonable alternatives.
4. Enter scenario, see an opening scene, act via typed text or optional suggested choices. Never force menu-only roleplay.
5. NPCs respond as independent actors using their private knowledge, motives, and relationships. Their behavior can surprise but should not contradict established facts.
6. Recruit an NPC through believable story interaction. Recruitment may fail or require time; no global 'add companion' toggle for other people's characters.
7. Complete or leave the scenario. Persistent consequences are stored. Choose another compatible scenario in the same world with the party intact.
8. Review relationships, events, active goals, and a concise timeline recap when returning.

## Scenario lifecycle UX

- **Enter:** preflight displays world compatibility, current party, unique NPC conflicts, safety/content settings, and any scenario-specific rule packs. Existing party members are not silently replaced.
- **Active:** scenario scene, cast list, text entry, 2–4 suggested choices (optional), in-world journal, compact status. No need to display raw state or prompt internals.
- **Complete:** completion status, key consequences, new companions/relationships, rewards/changes, follow-up threads.
- **Leave/Abandon:** explicitly warn that events already committed remain true. End the run without granting unearned resolution rewards. Story can account for withdrawal.
- **Pause:** retain current run; MVP supports resuming before entering another scenario. A player can complete/leave to switch freely. Multiple concurrent suspended runs are deferred due to timeline conflict complexity.

## Mobile-first screen map

Player: `Discover` → `World` → `Character/Timeline` → `Party & Scenario Entry` → `Story` → `Outcome/Journal`.

Creator: `My Content` → `Create (World / NPC / Scenario)` → `Guided Editor` → `Playtest` → `Publish`.

Global navigation: Discover, My Stories, My Characters, Create, Profile. No mandatory separate admin-only dashboard for core authoring. Player-first 390px UX; desktop adds right-side 'Cast/Journal' pane.

### Story UI requirements

- Distinguish narration, NPC speech, the player's speech/actions, internal thoughts where permitted, and system notifications with typography and spacing. Avoid presenting everything as one chatbot bubble.
- Visible character identity (portrait/name) for dialogue when useful. Keep longer narrative paragraphs readable.
- Free-text is primary. Suggestions guide new players but cannot constrain their agency.
- Companions and active threads accessible in one tap; relationship data is an in-world journal, not an artificial score meter by default.
- Pending turn progress, cancel/retry, partial generation failures, reconnection, and committed outcome must be unambiguous.
- Allow user preference for response length, pace, focus, and narrative voice without overriding character agency or world canon.

## Creator simplicity requirements

1. **Quick Create:** a short natural-language request yields a world, character, or scenario draft; no JSON or handcrafted prompt required.
2. **Guided Create:** ask only high-impact questions; infer reasonable defaults and make them visible.
3. **Advanced:** edit relationships, goals, secrets, story threads, rules, lore, and model instructions with versioning and warnings.
4. **Playtest:** run draft in a disposable sandbox with sample character/companions. See why the model behaved as it did (retrieved context/rules), without exposing protected data.
5. **Publish:** validate references, world permissions, content visibility, and rules compatibility. Official vs community labels must be clear.

A creator may submit a single NPC to a permitted world without making a scenario, or create a standalone scenario using existing world NPCs without rebuilding the world.

## Quality characteristics

- Character autonomy: meaningful refusal, initiative, personality consistency, no random over-agreeableness.
- Story flexibility: unrestricted input; not a fixed branching visual novel.
- Consequences: outcomes are remembered and affect later encounters/scenarios.
- Consistency: author canon, NPC beliefs, and player knowledge stay distinct.
- Accessibility: 390px baseline, keyboard/screen-reader-friendly, WCAG AA, no serious/critical axe violations in key routes.
- Convenience: autosave per completed turn, immediate resume, creator editing accessible without expertise.

## Differentiation not claims of exclusivity

Other platforms offer lore, memory, characters, and scenarios. StoneCaster's specific combination is **persistent player-specific world timelines + recruitable NPC instances + portable parties + reusable creator scenarios + prompt-driven rule depth + guided creation**. Judge quality by that combination, not by whether a feature name sounds unique.

## Business posture (not MVP payment specification)

- Offer low-friction entry with economical model and limited usage; premium/experimental model choices can carry usage budgets or credits.
- Avoid unlimited premium-model promises. Cost control per player and per turn must exist before subscription rollout.
- Community creator tools and discoverability are more important at launch than revenue sharing marketplaces.
