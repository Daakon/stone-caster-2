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
Authoring Flow:
  Create World → Add Entities → Add Lore → Choose Rulesets → Compile Story
      ↓                                                     ↓
   Preview Schema -------------------------------→ Story Ready

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

## 5.1 Create / Edit World

```md
+------------------------------------------------------+
|  Edit World                                          |
+------------------------------------------------------+
|  Title: [ Whispercross Alley        ]                |
|  Summary: [ A web of secrets...     ]                |
|  Genre Tags: [ fantasy noir ]                        |
|  Safety Filters: [ PG13 ▼ ]                           |
|                                                      |
|  Rulesets (select)                                   |
|  [x] d100-5-pillars                                  |
|  [x] vitality-stamina-system                         |
|  [ ] npc-quirks-habits                               |
|                                                      |
|  [ Save World ]   [ Delete ]                         |
+------------------------------------------------------+
```

### Rulesets Panel Behavior

* Standard Rulesets: Presented as a list of toggle/checkboxes.
* Exclusion Groups (Variants): Rulesets sharing an exclusion_group (e.g., Combat Core) are grouped together visually. Users select exactly one option via a radio-button style interface or a dropdown "Slot" selector.
* Dependencies: Selecting a ruleset automatically selects its required dependencies and notifies the user.

---

## 5.2 Entities Editor

```md
+------------------------------------------------------+
|  Entities in Whispercross Alley                      |
+------------------------------------------------------+
|  Kiera (player)   [edit]                             |
|  Arven (npc)      [edit]                             |
|                                                      |
|  [ Add Entity ]                                      |
+------------------------------------------------------+
```

### Entity Editing

```md
+------------------------------------------------------+
|  Edit Entity: Kiera                                  |
+------------------------------------------------------+
|  Name: [ Kiera                 ]                     |
|  Tags: [ player ]                                     |
|                                                      |
|  Personality:                                        |
|    Traits: [ Brave, Stoic ]                          |
|    Values: [ Honor ]                                 |
|    Quirks: [ Finger-Tapping ]                        |
|                                                      |
|  Defaults:                                           |
|    Stamina: 90                                       |
|    Satiety: 70                                       |
|                                                      |
|  [ Save Entity ]                                     |
+------------------------------------------------------+
```

Note: All entity fields map directly into the Domain Model.

---

## 5.3 Lore Editor

```md
+------------------------------------------------------+
|  Lore List                                           |
+------------------------------------------------------+
|  Guild Keys            public   [edit]               |
|  Whispered Alleyways   private  [edit]               |
|                                                      |
|  [ Add Lore Fragment ]                               |
+------------------------------------------------------+
```

### Edit Lore

```md
+------------------------------------------------------+
|  Edit Lore: Guild Keys                               |
+------------------------------------------------------+
|  Title: [ Guild Keys           ]                     |
|  Visibility: [ public ▼ ]                            |
|                                                      |
|  Body:                                               |
|  --------------------------------------------------  |
|  Ancient locksmiths forged keys that judge intent... |
|  --------------------------------------------------  |
|                                                      |
|  [ Save Lore ]                                       |
+------------------------------------------------------+
```

---

## 5.4 Compile Story

```md
+------------------------------------------------------+
|  Compile Story: Whispercross                         |
+------------------------------------------------------+
|  Selected Rulesets:                                  |
|    d100-5-pillars                                    |
|    vitality-stamina-system                           |
|    world-cycle-time-bands                            |
|                                                      |
|  Entities Included: 2                                |
|  Lore Included: 12                                   |
|                                                      |
|  [ Compile Story ]                                   |
+------------------------------------------------------+
```

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
