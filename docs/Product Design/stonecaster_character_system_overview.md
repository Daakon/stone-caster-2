# 🧭 StoneCaster Character & Relationship System

## 1. Core Modes
### Transient Mode (default)
- Frictionless, AI-chat-style play; instant entry.
- No world or timeline enforcement; NPCs can appear anywhere.
- Ideal for quick stories, experiments, or sandbox exploration.
- Relationships exist only within the current session unless a companion slot is active.

### Immersive Mode (opt-in)
- Adds persistence and continuity to character play.
- Relationships, inventory, and world state persist across sessions.
- Broad NPC re-use allowed; continuity handled narratively, not by restriction.
- Player gains limited **companion slots** that retain state across adventures and scenarios.

---

## 2. NPC & Location Access
### World Roster
- Each **world** (e.g., Mystika, Verdant Earth, Aetherium) maintains its own roster of available NPCs.
- Roster includes all characters discoverable through adventures, scenarios, or free chat.
- NPC roster can be filtered or searched by:
  - Name / role / faction
  - Relationship level
  - Availability (open, away, companion)
  - Context (scenario, adventure, general world)

### Location System
- Each world includes a defined set of **locations** (regions, cities, hubs, wilderness zones).
- Scenarios and adventures are tied to one or more locations.
- Player access to NPCs depends on location rules and mode:
  - **Transient:** free to jump to any world or location.
  - **Immersive:** limited to the PC’s current or unlocked regions.
- Players use the **World Directory** or **Map View** to browse available NPCs and scenes.
- Locations filter the roster dynamically — e.g., “Who can I meet in Whispercross?”

---

## 3. Scenario & Location Routes
### Location Route
- Player selects a **location** first (e.g., Whispercross Tavern, market square, forest path).
- Each location lists:
  - NPCs currently present (based on world and character state).
  - Option to **visit only when X character is there** or to **visit freely** for randomized NPC encounters.
- Visiting freely produces dynamic or ambient scenes with available NPCs and possible introductions.
- Visiting for a specific character triggers contextual dialogue, influenced by relationship and world events.

### Character Route
- Player selects an **NPC** first, then chooses from a list of **available meeting places** based on that NPC’s world context.
- Example: Meeting Kiera could occur at:
  - Whispercross Tavern (detailed background)
  - Roadside encounter (lightweight narrative)
  - Training field (unique to her role)
- Context determines depth and tone of scene — generic encounters are brief, while detailed ones provide full backdrops and extended dialogue.

### Narrative Rule
- Encounters from either route are always **below adventure depth** — lighter, character-driven, social or slice-of-life scenes, never full story arcs.

---

## 4. Entering Scenarios & Adventures
- Players start from a **World Hub** view listing:
  - Available NPCs (filtered by world and location)
  - Available Scenarios
  - Available Adventures
- Selecting an NPC opens a **Meet / Talk / Join Adventure** menu, depending on availability.
- Scenario and Adventure lists already respect trust gates, unlocks, and mode rules.

---

## 5. Companions as Continuity Anchors
- Any NPC can be recruited and occupy one of the player's limited companion slots.
- Only companions maintain long-term state: trust, affection, synergy, personal quests.
- Companions bridge adventures and scenarios, providing emotional continuity.
- Non-companions reset or soft-remember depending on play mode.

---

## 6. Relationship & Memory Logic
- Every NPC tracks rapport (trust, affection, etc.) during session.
- **Companions:** persist across all play; their relationship data stored in canon.
- **Immersive PCs:** maintain world state and persistent companion data.
- **Transient PCs:** temporary data; relationships end unless companioned.

---

## 7. Continuity & World State
- World coherence is soft; continuity emerges through adaptive dialogue, not hard rules.
- Immersive mode tracks location and quest flags but does not limit NPC access beyond geography.
- Transient play remains fully freeform and unrestricted.

---

## 8. Player Experience
| Action | Transient | Immersive |
|---------|------------|-----------|
| Talk to NPC | Always allowed; resets later | Builds toward recruitment |
| Recruit NPC | Temporary | Persistent companion |
| Start Adventure | Immediate | Trust-gated |
| Scenario Follow-up | Possible anytime | Reflects adventure outcomes |
| End Session | Soft reset | Canon update |

---

## 9. System Principles
1. **Unified NPC roster** per world.
2. **Locations act as filters and context generators.**
3. **Continuity via relationships**, not hard exclusions.
4. **Companions = persistence container.**
5. **Player choice of depth:** casual vs. immersive.
6. **Writers define both deep and generic encounter contexts.**

---

## 10. UX & Terminology
- Default mode: Standard Play (unlabeled).
- Opt-in upgrade: **Immersive RPG Mode** or **Chronicle Mode**.
- Companions appear as **Bound Allies** or **Persistent Bonds**.
- Tooltip example:
  > "Make this ally a Companion. They’ll remember your actions across journeys."

---

## 11. Benefits
- Unified NPC + location system for all play types.
- Two interaction paths (by location or by character) for flexible storytelling.
- Random and directed encounters coexist seamlessly.
- Meaningful persistence through limited companion slots.
- Casual entry preserved while supporting deep RPG immersion.

---

## 12. Summary Snapshot
| Concept | Rule |
|----------|------|
| Default | Transient free-play (existing system). |
| Immersive | Optional persistent world + relationship tracking. |
| NPC Access | Universal (roster-based). |
| Locations | Filter NPCs and content by world context. |
| Encounter Routes | Location-first or Character-first, each with adaptive context. |
| Continuity | Handled via relationships and context, not restrictions. |
| Recruitment | Any NPC can become a companion. |
| Persistence | Companions + immersive PCs retain memory. |
| Result | Seamless mix of sandbox freedom and RPG progression.