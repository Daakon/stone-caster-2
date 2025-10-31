# Scenarios in StoneCaster

**Last Updated**: 2025-02-01

---

## Key Concept

**Scenarios are entry points with `type='scenario'`.**

They use the **same prompt scopes and assembly logic as adventures**. There is no separate "scenario scope" in the prompt system.

---

## What Makes Something a Scenario?

### Database Perspective

A scenario is an `entry_points` row with:
```sql
type = 'scenario'
```

That's it. Everything else (world, rulesets, NPCs, prompts) works identically to adventures.

### Player Experience Perspective

Scenarios may differ from adventures in:
- **Length**: Typically shorter (single session vs multi-session)
- **Focus**: Specific situation or challenge vs broader storyline
- **Goal**: Clear outcome or decision point vs open-ended exploration
- **Tone**: Often higher stakes or time-sensitive

But these are **content and design differences**, not technical ones.

---

## No Separate Scope

### ❌ There is NO `scenario` scope

The prompt system does not have a `scope='scenario'` in `prompt_segments`.

### ✅ Scenarios use `entry` and `entry_start` scopes

Just like adventures, sandbox, and quest entry points.

---

## Assembly Order

### First Turn
```
core → ruleset(s) → world → entry → entry_start → npc → [dynamic state]
```

### Ongoing Turns
```
core → ruleset(s) → world → entry → npc → [dynamic state]
```

**This is identical for all entry point types**, including scenarios.

---

## Authoring a Scenario

### Step 1: Create Entry Point

**UI**: Admin > Entry Points > Create New

**Fields**:
- **Type**: Select `scenario`
- **World**: Choose world (e.g., "Mystika")
- **Rulesets**: Select one or more rulesets
- **Title**: Scenario name (e.g., "Whispercross Encounter")
- **Description**: Brief summary for players
- **Visibility**: public / unlisted / private
- **Prompt/Content**: Initial prompt data (JSONB)

### Step 2: Add Prompt Segments

**Option A: Admin UI** (when available)
- Navigate to Prompts section
- Add segments for this entry point

**Option B: Direct SQL** (for now)
```sql
-- Main scenario context (used every turn)
INSERT INTO prompt_segments (scope, ref_id, content, active) VALUES
('entry', '[entry_point_id]',
 'Scenario: Negotiation at Whispercross. Tone: mysterious, tense. The NPC is withholding information.',
 true);

-- Opening narration (first turn only)
INSERT INTO prompt_segments (scope, ref_id, content, active) VALUES
('entry_start', '[entry_point_id]',
 'You arrive at the crossroads as dusk falls. A cloaked figure awaits, their face hidden in shadow.',
 true);
```

### Step 3: Link NPCs (if applicable)

```sql
INSERT INTO entry_point_npcs (entry_point_id, npc_id, tier)
VALUES ('[entry_point_id]', 'npc_mysterious_figure', 1);
```

### Step 4: Test

- Start scenario from player UI
- Verify opening narration appears (first turn)
- Verify scenario context persists (ongoing turns)
- Check token counts in assembly audit

---

## Example: "Whispercross Encounter" Scenario

### Content Design

**Scenario Goal**: Player must negotiate safe passage through the Whispering Woods.

**Key Elements**:
- **NPC**: Mysterious figure at the crossroads
- **Tone**: Mysterious, slightly ominous
- **Length**: 5-8 turns
- **Outcome**: Player gains passage or must find another way

### Database Setup

```sql
-- Entry point
INSERT INTO entry_points (
    id, slug, type, world_id, title, subtitle, description, tags, visibility, ...
) VALUES (
    'ep_whispercross_001',
    'whispercross-encounter',
    'scenario',
    'world_mystika',
    'Whispercross Encounter',
    'A mysterious meeting at the crossroads',
    'Negotiate safe passage through the Whispering Woods with a cryptic guardian.',
    ARRAY['mystery', 'negotiation', 'short'],
    'public',
    ...
);

-- Link ruleset
INSERT INTO entry_point_rulesets (entry_point_id, ruleset_id, sort_order)
VALUES ('ep_whispercross_001', 'ruleset_dnd5e', 1);

-- Link NPC
INSERT INTO entry_point_npcs (entry_point_id, npc_id, tier)
VALUES ('ep_whispercross_001', 'npc_mysterious_figure', 1);

-- Entry prompt (ongoing context)
INSERT INTO prompt_segments (scope, ref_id, content, active) VALUES
('entry', 'ep_whispercross_001',
 E'Scenario: Negotiation at Whispercross.\n\nTone: mysterious and tense. The figure speaks in riddles and seems to know more than they reveal.\n\nKey points:\n- The player must earn passage, not demand it\n- The figure tests the player\'s wisdom and intent\n- Resolution depends on player approach (diplomacy, insight, or creativity)',
 true);

-- Entry start (first-turn opening)
INSERT INTO prompt_segments (scope, ref_id, content, active) VALUES
('entry_start', 'ep_whispercross_001',
 E'Opening narration:\nYou arrive at the crossroads as dusk falls, casting long shadows across the forest path. A cloaked figure stands at the center, perfectly still, as if they\'ve been waiting for you. The air feels charged, expectant.',
 true);
```

### First Turn Assembly

```
=== CORE_BEGIN ===
You are a fantasy RPG narrator...
=== CORE_END ===

=== RULESET_BEGIN ===
D&D 5e rules. Use Wisdom (Insight) checks for reading NPCs...
=== RULESET_END ===

=== WORLD_BEGIN ===
Mystika is a realm of high magic and ancient mysteries. The Whispering Woods are known for strange encounters...
=== WORLD_END ===

=== ENTRY_BEGIN ===
Scenario: Negotiation at Whispercross.
Tone: mysterious and tense. The figure speaks in riddles...
=== ENTRY_END ===

=== ENTRY_START_BEGIN ===
Opening narration:
You arrive at the crossroads as dusk falls...
=== ENTRY_START_END ===

=== NPC_BEGIN ===
[Mysterious Figure]
Personality: Cryptic, patient, tests visitors
Speech: Speaks in riddles and metaphors
Knowledge: Knows the player's quest but won't reveal how
=== NPC_END ===

=== PLAYER_BEGIN ===
Character: Elara, Level 5 Wizard
Proficiencies: Arcana +7, Insight +3
Personality: Curious, sometimes too trusting
=== PLAYER_END ===
```

**AI Response**:
> "As you approach the crossroads, the cloaked figure turns toward you, their face still hidden in shadow. 'You seek passage,' they say, more statement than question. Their voice is like autumn leaves rustling. 'But the way is not free. Tell me, traveler—what do you offer in exchange for safe passage?'"

---

## Player Flow

### Starting a Scenario

**UI**: Player > Browse > Filter: Scenarios

Player sees:
- Scenario title: "Whispercross Encounter"
- Description: "Negotiate safe passage..."
- Tags: mystery, negotiation, short
- Estimated time: 30-60 minutes

Player clicks **Start** → game begins

### Gameplay

Exactly like any other entry point:
1. First turn shows opening narration (`entry_start`)
2. Player chooses actions
3. AI responds using scenario context (`entry`)
4. Scenario context persists until game ends

---

## Scenarios vs Adventures: When to Use Each

### Use Scenario When:

- **Single-session content** (30-90 minutes)
- **Focused challenge** or specific situation
- **Clear goal or decision point**
- **Testing a specific mechanic** or NPC interaction
- **Modular content** that can fit into any campaign

**Examples**:
- "The Haunted Tavern" - One-night ghost encounter
- "Trial by Combat" - Arena challenge
- "The Diplomat's Dilemma" - Tense negotiation
- "Riddle of the Sphinx" - Puzzle encounter

### Use Adventure When:

- **Multi-session campaign** (2+ hours)
- **Broad storyline** with multiple arcs
- **Character development** over time
- **World exploration** and discovery
- **Recurring NPCs** and ongoing plot threads

**Examples**:
- "Quest for the Crystal" - 5-session epic
- "Murder at the Manor" - Multi-day investigation
- "Rise of the Shadow King" - Campaign arc
- "Mysteries of the Ancient City" - Exploration campaign

### Both Can Have:

- Multiple NPCs
- Combat encounters
- Roleplay opportunities
- Branching choices
- Varied difficulty

The difference is **scope and pacing**, not technical implementation.

---

## Filtering Scenarios in Player UI

### Frontend Query

```typescript
// Fetch scenarios only
const scenarios = await api.get('/api/catalog/entry-points?type=scenario');

// Fetch adventures only
const adventures = await api.get('/api/catalog/entry-points?type=adventure');

// Fetch all
const all = await api.get('/api/catalog/entry-points');
```

### Database Query

```sql
-- Get public scenarios
SELECT id, slug, title, description, tags, world_id
FROM entry_points
WHERE type = 'scenario'
  AND visibility = 'public'
  AND status = 'active'
ORDER BY popularity_score DESC;
```

---

## Prompt Authoring Tips for Scenarios

### Keep It Focused

**Good**:
```
Scenario: Negotiation at Whispercross.
The player must earn the figure's trust in 5-8 turns.
```

**Too Broad**:
```
Scenario: Explore the entire Whispering Woods and uncover all its secrets over multiple sessions.
```

### Set Clear Tone

**Good**:
```
Tone: mysterious, tense, time-sensitive. The figure is impatient.
```

**Too Vague**:
```
Tone: fantasy stuff.
```

### Define Stakes

**Good**:
```
Stakes: If negotiation fails, the player must take a dangerous alternate route (2 day detour).
```

**Missing Stakes**:
```
[No mention of consequences]
```

### Provide Guardrails

**Good**:
```
The figure will not attack unless provoked. Resolution should come through dialogue or insight, not combat.
```

**No Guardrails**:
```
[AI might default to combat, derailing the scenario]
```

---

## Token Budgeting for Scenarios

Scenarios use the same token budget as adventures: **8000 tokens** by default.

### Typical Token Breakdown

**First Turn**:
- Core: ~200 tokens
- Ruleset: ~400 tokens
- World: ~600 tokens
- Entry (scenario): ~300 tokens
- Entry Start: ~200 tokens
- NPC: ~400 tokens
- Player: ~200 tokens
- **Total**: ~2300 tokens (well within budget)

**Ongoing Turn** (Turn 3):
- Core: ~200 tokens
- Ruleset: ~400 tokens
- World: ~600 tokens
- Entry (scenario): ~300 tokens
- NPC: ~400 tokens
- Game State: ~800 tokens (history summary)
- Player: ~200 tokens
- Input: ~150 tokens
- **Total**: ~3050 tokens (still comfortable)

### If Over Budget

The system will truncate in this order:
1. Trim player input
2. Compress game state history
3. Drop lower-tier NPCs
4. Drop entire NPC scope
5. **Last resort**: Drop scenario context (`entry` scope)

If scenario context is dropped, the AI loses the focused tone and guardrails, so keep segments concise.

---

## Testing Scenarios

### Unit Tests

Test that scenarios assemble identically to adventures:

```typescript
// Test: Scenario uses entry and entry_start scopes
it('assembles scenario with entry scopes', async () => {
  const result = await assemblePrompt({
    entryPointId: 'ep_whispercross_001', // type='scenario'
    worldId: 'world_mystika',
    isFirstTurn: true,
  }, dbAdapter);
  
  expect(result.meta.order).toContain('entry');
  expect(result.meta.order).toContain('entry_start');
  expect(result.meta.order).not.toContain('scenario'); // No separate scope
});
```

### Integration Tests

Test full game flow:

```typescript
// Test: Start scenario and play
it('starts and plays a scenario', async () => {
  // Start game
  const game = await api.post('/api/games/start', {
    entry_point_id: 'ep_whispercross_001'
  });
  
  // First turn includes entry_start
  expect(game.firstTurn.narrative).toContain('crossroads');
  
  // Submit action
  const turn2 = await api.post(`/api/games/${game.gameId}/turns`, {
    choice_id: '1',
    input_text: 'I offer to share my knowledge'
  });
  
  // Ongoing turn excludes entry_start
  expect(turn2.narrative).not.toContain('You arrive at');
});
```

### E2E Tests (Playwright)

Test player experience:

```typescript
// Test: Browse and start scenario
test('player can browse and start scenario', async ({ page }) => {
  await page.goto('/scenarios');
  await page.click('text=Whispercross Encounter');
  await page.click('button:has-text("Start")');
  
  // Verify opening narration
  await expect(page.locator('.narrative')).toContainText('crossroads');
  
  // Make choice
  await page.click('button:has-text("Ask about the price")');
  
  // Verify response
  await expect(page.locator('.narrative')).toContainText('passage');
});
```

---

## FAQ

### Q: Should I create a new scope for scenarios?

**No.** Scenarios use `entry` and `entry_start` scopes just like adventures.

### Q: How do I make a scenario feel different from an adventure?

Through **content and prompt design**, not technical architecture:
- Keep `entry` segment focused on a specific situation
- Use `entry_start` to set immediate context
- Design for 5-10 turns max
- Provide clear resolution points

### Q: Can a scenario have multiple NPCs?

Yes. Link NPCs via `entry_point_npcs` just like adventures.

### Q: Can a scenario span multiple sessions?

Technically yes, but it's against the design intent. For multi-session content, use `type='adventure'` instead.

### Q: What if I need scenario-specific truncation rules?

The truncation policy is the same for all entry point types. If you need special handling, that would require a code change and design discussion.

### Q: Can I convert an adventure to a scenario (or vice versa)?

Yes, just change the `type` field in `entry_points`. The prompt segments and assembly remain identical.

```sql
-- Convert to scenario
UPDATE entry_points SET type = 'scenario' WHERE id = '[entry_point_id]';

-- Convert to adventure
UPDATE entry_points SET type = 'adventure' WHERE id = '[entry_point_id]';
```

---

## See Also

- [ACTIVE_SYSTEM.md](./ACTIVE_SYSTEM.md) - Full system architecture
- [ENTRY_POINT_ASSEMBLY.md](./ENTRY_POINT_ASSEMBLY.md) - Detailed assembly flow
- [LEGACY_SYSTEMS.md](./LEGACY_SYSTEMS.md) - Deprecated systems
- `../assembly/audit_fields.md` - Assembly audit structure

