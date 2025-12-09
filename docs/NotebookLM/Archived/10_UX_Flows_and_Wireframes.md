# 10 UX Flows and Wireframes

*(StoneCaster / Chimera Engine – MVP)*

This document captures the **end-to-end user experience**, including **primary flows**, **interaction states**, **screen-purpose definitions**, and **wireframe descriptions** for the MVP.
It is intentionally **low-fidelity** and **architecture-driven**, matching the product constraints.

Because Canvas cannot embed graphical wireframes, this document uses **structural ASCII wireframe layouts**, each designed so NotebookLM can interpret them clearly.

---

# 1. UX Philosophy

StoneCaster’s UX must reflect the following principles:

1. **Simple authoring → deep output**
   Users provide minimal structured inputs; the system compiles everything else.

2. **State-first storytelling**
   Players always see the current state, context, and NPC emotional cues.

3. **Deterministic UX for deterministic engine**
   The interface reinforces that outcomes follow rules, not randomness.

4. **Minimalist AI exposure**
   MAS models operate behind-the-scenes; users see only narrative.

---

# 2. Primary UX Personas

### 2.1 Author

Goals:

* Create worlds, entities, lore, and ruleset configurations
* Compile stories
* Validate schema

### 2.2 Player

Goals:

* Enter the story
* Enter text actions
* Receive narrative outcome
* Track ongoing state

### 2.3 Admin (internal)

Goals:

* Manage ruleset templates
* Validate correctness & dependencies

---

# 3. High-Level UX Flow Map

```md
Authoring Flow (Non-Linear):
  [World] -> [Forces] -> [Elements] -> [Lore] -> [Bind]
     |          |           |            |
     +----------+-----------+------------+--> (Free Navigation after World Selection)
                    |
              (Draft Auto-Saved)

Player Flow:
  Choose Story → Start Session → View Opening → Enter Action → Receive MAS Output
      ↑                                                               ↓
      └────────────────────────── State Updates ◄─────────────────────┘
```

---

# 4. Screen Definitions

## 4.1 Dashboard

Purpose: Entry point for Authors & Players.

Key Components:

* World List
* Story List (compiled worlds)
* Start Session / Resume Session

```md
+------------------------------------------------------+
|  StoneCaster Dashboard                               |
+------------------------------------------------------+
|  Worlds                                              |
|  - Whispercross Alley (edit / compile)               |
|  - Verdant Earth (edit)                              |
|                                                      |
|  Stories                                             |
|  - Whispercross v1.0 (play)                          |
|                                                      |
|  [ Create World ]                                    |
+------------------------------------------------------+
```

---

# 5. Authoring Flow

## 5.1 Step 1: World (Tab 1)

**Goal**: Select a starting point (Vibe/Genre). Triggers "World Preset".

```md
+------------------------------------------------------+
|  Casting Circle: [World] Forces  Elements  Lore  Bind|
+------------------------------------------------------+
|  Select a World Preset:                              |
|                                                      |
|  [ High Fantasy ]    [ Cyber Sprawl ]   [ Noir ]     |
|   - Magic: High       - Tech: High       - Gritty    |
|   - Tech: Low         - Magic: Low       - Mystery   |
|   [ (i) Info ]        [ (i) Info ]       [ (i) Info ]|
|                                                      |
|  Selection: Cyber Sprawl                             |
|  > Applied Rules: Gravity, Digital Economy           |
|  > Applied Safety: PG-13 (Default)                   |
|                                                      |
|  [ Next: Forces > ]                                  |
+------------------------------------------------------+
```

### Interaction Notes
*   **Cards**: Visual representation of genres.
*   **Info Button (i)**: Opens modal with full ruleset/safety description.
*   **Gating**: Tabs 2-5 are disabled until a selection is made here.
*   **Reset Warning**: Changing preset later warns about resetting incompatible Forces/Elements.

---

## 5.2 Step 2: Forces (Tab 2)

**Goal**: Tweak the physics/rulesets.

```md
+------------------------------------------------------+
|  Casting Circle:  World [Forces] Elements  Lore  Bind|
+------------------------------------------------------+
|  Filters: [All] [Narrative] [Crunchy] [Combat]       |
|                                                      |
|  v Foundation: Action Resolution                     |
|    (o) d100 Outcomes (Selected)                      |
|    ( ) PbtA Moves                                    |
|      > [ Drawer: Advanced Criticals (Checkout) ]     |
|                                                      |
|  > Foundation: Time System                           |
|    (o) Cinematic Time                                |
|    ( ) Tick-Based                                    |
|                                                      |
|  [ Next: Elements > ]                                |
+------------------------------------------------------+
```

### Forces UI
*   **Visual Grouping**: Rulesets grouped by Exclusion Group (e.g., "Action Resolution").
*   **Nested Drawers**: Child rulesets (expansions) live inside their parent card.
*   **Tags**: Filter by "Narrative" vs "Crunchy" styles.

---

## 5.3 Step 3: Elements (Tab 3)

**Goal**: Add Characters, Items, Locations.

```md
+------------------------------------------------------+
|  Casting Circle:  World  Forces [Elements] Lore  Bind|
+------------------------------------------------------+
|  Active Elements (3/20)                              |
|  - Kiera (Player) [Edit]                             |
|  - Rusty Key (Item) [Edit]                           |
|                                                      |
|  [ + Add Element ] -> Opens Library/Forge Modal      |
+------------------------------------------------------+
```

### Add Element Modal (Library vs. Forge)
*   **Library Tab**: "Pick from existing" (Clones asset into draft).
*   **Forge Tab**: Create new asset from scratch (Name, Tags, Stats).

---

## 5.4 Step 4: Lore (Tab 4)

**Goal**: Add narrative context (formerly "Whispers").

```md
+------------------------------------------------------+
|  Casting Circle:  World  Forces  Elements [Lore] Bind|
+------------------------------------------------------+
|  Context / Memory                                    |
|  - "The Guild War" (Global)                          |
|  - "Kiera's Secret" (Attached to Kiera)              |
|                                                      |
|  [ + Add Context ] -> Opens Library/Forge Modal      |
+------------------------------------------------------+
```

---

## 5.5 Step 5: Bind (Tab 5)

**Goal**: Compile the story.

```md
+------------------------------------------------------+
|  Casting Circle:  World  Forces  Elements  Lore [Bind|
+------------------------------------------------------+
|  Ready to Bind Story?                                |
|  - World: Cyber Sprawl                               |
|  - Forces: 4 Active                                  |
|  - Elements: 12                                      |
|                                                      |
|  [ BIND STORY (COMPILE) ]                            |
+------------------------------------------------------+
```

### Draft Persistence
*   **Auto-Save**: Changes saved to `localStorage` immediately.
*   **Sync**: Periodic sync to backend.
*   **Resume**: Available from Dashboard "My Creations".

### After Compilation

```md
+------------------------------------------------------+
|  Story Ready                                          |
+------------------------------------------------------+
|  Story ID: UUID                                       |
|  Version: 1.0.0                                       |
|  [ Play Story ]                                       |
+------------------------------------------------------+
```

---

# 6. Player Flow

## 6.1 Start Session

```md
+------------------------------------------------------+
|  Start Session: Whispercross                          |
+------------------------------------------------------+
|  Player Character: [ Kiera ▼ ]                        |
|                                                      |
|  [ Start Session ]                                    |
+------------------------------------------------------+
```

---

## 6.2 Story View (Core Player Screen)

This is the **heart of StoneCaster’s UX**.

```md
+--------------------------------------------------------------+
| Narration Window                                             |
| ------------------------------------------------------------ |
|  "The alley’s lantern sputters in the deep night..."         |
|                                                              |
+--------------------------------------------------------------+
| Action Input                                                 |
| ------------------------------------------------------------ |
|  > "Pick the rusty lock quietly."                           |
|                                                              |
|  [ Send ]                                                    |
+--------------------------------------------------------------+
| State Panel (Right Sidebar)                                  |
| ------------------------------------------------------------ |
|  Time Band: Deep Night                                       |
|  Stamina: 88 (Winded)                                        |
|  Hunger: Hungry                                              |
|                                                              |
|  NPC: Arven                                                  |
|    Mood: Cautious                                            |
|    Memory: Old Debt                                          |
|    Quirk: Finger-Tapping (active)                            |
+--------------------------------------------------------------+
```

---

## 6.3 Turn Resolution UX

After each action:

1. MAS-1 interprets → no UI impact.
2. Engine updates state → sidebar updates.
3. MAS-2 narrates → narration window scrolls.

### Inline Turn Card (optional)

```md
+------------------------------------------------------+
| Turn 4                                                |
| ------------------------------------------------------|
|  Narration: "The lock gives a reluctant click..."     |
|  State: stamina -2, time +1                           |
+------------------------------------------------------+
```

---

# 7. Error & Feedback UX

### MAS-1 Hard Gate Example

```md
[ You are too exhausted to move. Try resting first. ]
```

### API Errors

```md
[ Unable to reach server. Please try again. ]
```

### Compiler Errors

```md
[ Ruleset conflict: Only one skill system may be selected. ]
```

---

# 8. UX States & Edge Cases

### Session Lost / Expired

* Auto-restore last state from `chimera_game_states`.

### Network Drop During MAS-2

* UI shows loader + retry option.

### Player Sends Non-Action

* MAS-1 returns guidance ("Try phrasing your intent as an action.").

---

# 9. Mobile Layout Considerations

* Sidebar collapses into a swipe-up drawer.
* Action box floats above keyboard.
* Narration scrolls full-screen.

---

# 10. Accessibility Requirements

* High-contrast theme
* Keyboard-only navigation
* Screen-reader labeling for all UI buttons
* Adjustable text scaling

---

# 11. Summary

This UX specification covers:

* Authoring workflow
* Player story interaction
* Turn-based narrative display
* Structural wireframes to guide implementation

Next step: convert these ASCII layouts into Figma-ready wireframes or React component blueprints.

This file serves as the **canonical UX guide** for the MVP.
