# 🚀 Project StoneCaster: The Comprehensive MVP Plan (v3.0)

**Status as of: 2025-11-16**
**Version: 3.0 (The "Forces & Systems" Brand Update)**

This document is the "ground truth" for building the Project StoneCaster Playable MVP. It integrates the official `StoneCaster Brand Vocabulary` and the latest `Core Changes` (e.g., "Forces" and "Systems") into all phases and technical components.

## 🎯 Guiding Principles (The "Why")

This plan is built on a "creator-first" model, defined by our brand:
* **Guided `Shaping`:** Make story creation (`Shaping`) intuitive with a guided wizard (`The Casting Circle`), while preserving the *power* of the advanced editor for "Master Shapers."
* **RAG-First `Element` Design:** Build the UI to *naturally* guide users into creating atomic, well-tagged `Elements` for RAG, without them needing to know how RAG works.
* **Shared `Elements` Ecosystem:** Treat all assets (`Elements`) as shareable, browseable content, enabling a community where creators (`Shapers`) can build on each other's work.

## 🎯 Current Status

* **Phase 0-2 (Foundation, Admin, UGC Tools):** Complete.
* **Phase 3 (Unified Studio):** In Progress.
    * **3.1: Admin `System` Refactor:** Complete. (Formerly `Ruleset` Refactor)
    * **3.2: Studio Shell (3-Section Accordion):** Complete (will be refactored by 3.4).
    * **3.3: "Mechanics & Plot" Dynamic UI:** Complete.

---

## 🚀 Phase 3 (Revised): The `Casting Circle` & `Story Dimension` Compiler

This phase is now responsible for the entire "inspiration-to-compilation" pipeline for `Shaping` a new `Story Dimension`.

### ▶️ Epic 3.4: Implement `The Casting Circle` (`Shaping` UI)

**Status:** **Not Started** (This replaces the old Epic 3.4 from the original plan)
**Task:** Implement the new "inspiration-first" user flow for story creation, from the wizard to the advanced editor, all unified under `The Casting Circle`.

---
#### 3.4.1: The "Dimensional Drifter" (Guided UI)

**Task:** Implement the persistent, contextual guide as the "Master Shaper."
* **Visual Identity:** Use the "faceless" robed figure images.
* **Icon:** Use the 4-point star from the Drifter's cloak as the "help" icon.
* **Interaction:** Clicking the icon opens a small callout with a portrait and a contextual tip, guiding the user through the `Shaping` process.

---
#### 3.4.2: "The First Cast" Wizard (The 5 Dimensions)

**Task:** Build the new "first-run" multi-step modal wizard. This is the new entry point for `Shaping`.

* **Step 1: Dimension 2 - `Forces` (Choose Template)**
    * **UI:** A visual grid of "Story Template" cards (e.g., "Fantasy RPG," "Fantasy Romance," "Sci-Fi Horror").
    * **Logic:** A "Story Template" is a data bundle that pre-selects default `Forces` (`Systems`) and `world_filter_tags`.

* **Step 2: Dimension 1 - `Origin` (Choose World)**
    * **UI:** A visual selector for `chimera_worlds`.
    * **Logic:** The list is pre-filtered using the `world_filter_tags` from the selected template. The user can clear the filter.

* **Step 3: Dimension 3 - `Elements` (Add Core Assets)**
    * **UI:** A step to add the core `Elements` of the story.
    * **`[ 🔍 Browse Elements ]`:** Opens a search modal to find and add existing public/private `Elements` (Characters, Items, Factions, etc.).
    * **`[ + Create New Element ]`:** Opens the "New `Element`" modal (see 3.4.3).

* **Step 4: Dimension 4 - `Narrative Flow` (Set Premise)**
    * **UI:** A textarea for the story's opening paragraph (`Premise`).
    * **`[ ✨ Generate Premise Suggestions ]`:** A button that uses AI to generate 2-3 starter premises based on the selected `Origin` and `Forces`, preventing "blank page" syndrome.

* **Step 5: Dimension 5 - `Intent` (Set Identity)**
    * **UI:** A form to establish the story's "feel."
    * **`Cover Image`:** An "Upload Image" component.
    * **`Display Name`:** Standard text input.
    * **`Tags`:** A tag input field, **auto-populated** with tags from the selected `Forces` and `Origin`.
    * **`Author's Note / Style`:** An optional textarea for AI style guidance (e.g., "Tone: dark, gritty prose," "Theme: light-hearted adventure").

---
#### 3.4.3: The `Element` Creation Modals (RAG-First Design)

**Task:** Build the creator modals for new `Elements`. These modals *structurally* and *explicitly* guide the user to create RAG-friendly content.

* **"New `Element`" Modal:**
    * **`Type`:** Dropdown (e.g., `Character`, `Item`, `Location`, `Faction`, `Creature`, `Lore (History)`, `Lore (Fact)`).
    * **`Name`:** Text input (e.g., "Kiera the Knight").
    * **`Entry`:** Textarea with a 1000-char limit (for RAG atomicity).
    * **`Triggers`:** Comma-separated keyword list.
    * **`Creator's Notes`:** A private text box, not shown to the AI.

* **Dimensional Drifter RAG Guidance:**
    * The Drifter's icon will be next to the `Entry` and `Triggers` fields.
    * **`Entry` Tip:** "This is the 'fact sheet' for your `Element`. This is exactly what the AI will read... Keep it clear, factual, and focused on one topic. Good entries are short and to the point!"
    * **`Triggers` Tip:** "This is the most important part! List all the words or phrases that should 'pull' this entry. For 'Kiera the Knight,' you should add: `Kiera`, `Kiera the Knight`, `Knight of Larion`. This is how the AI *finds* the information."

---
#### 3.4.4: The `Casting Circle` (Advanced Editor)

**Task:** Refactor the existing 3-section accordion to be the "advanced editor" that users land on *after* the wizard. The accordion headers will be re-themed to match the 5 Dimensions.

* **Section 1: `Origin` & `Intent`**
    * (Formerly "Core & World")
    * Contains selectors for `World` and inputs for `Display Name`, `Cover Image`, `Tags`, and `Style`.

* **Section 2: `Forces` & `Narrative Flow`**
    * (Formerly "Mechanics & Plot")
    * **`Forces` (`System` Category View):** The list of `Systems`, grouped by `system_category`.
    * **`Narrative Flow` (Dynamic UI):** The "Dynamic `System` Components" area, where `ui_schema` from a `System`'s `config` for `Premise`, `Quests`, etc., will render.

* **Section 3: `Elements`**
    * (Formerly "Assets & Lore")
    * Contains the selectors for `Content Packs` and individual `Elements` (Characters, Items, Lore, etc.).
    * **`Element` Inspector:** The rich detail modal that shows the full contents of a Pack or `Element`.
    * **De-duplication:** This logic is still required. `Elements` included in a selected `Content Pack` must be hidden from the individual "Browse `Elements`" selector.

* **State Icons & "Shape" Button:**
    * Each of the three sections must display a `⚠️` / `✅` icon to show completion.
    * The main "**Shape Story Dimension**" button (formerly "Rebuild Story") is enabled *only* if all three sections are `✅`.

---

### ⏸️ Epic 3.5: Implement The `Shaping` Compiler

**Status:** **Not Started**

**Task:** Implement the backend endpoint for the "**Shape Story Dimension**" button. This compiler uses the "last-in-wins" (Nexus Mod style) logic.

**Deliverables (4-Step Compilation Process):**

1.  **Fetch & Sort Assets:**
    * Fetch the `chimera_stories` record and all linked assets (`Systems`, `Elements`, `Packs`).
    * **Note:** This assumes the `chimera_ruleset_templates` table is now `chimera_system_templates`.
    * Sort all `Systems` into the definitive load order based on the spec:
        1.  Main System
        2.  Subsystems
        3.  World `Systems` (Modifiers)
        4.  Content Pack `Systems` (Modifiers)
        5.  Story Definition (from `chimera_stories.story_definition`)

2.  **Merge `Systems` (Last-In-Wins):**
    * Iterate the sorted list, performing a top-level merge of each `System`'s `config` (jsonb).
    * **Conflict Logic:** The last-loaded `System` "wins" and *completely replaces* any conflicting keys from earlier ones.
    * **Result:** A single `final_schema` object that is the "source of truth." (This object contains the merged `ui_schema`, `action_prompt_systems`, `narrative_prompt_systems`, etc., from all `config` blobs).

3.  **Compile & Prune `Elements` (The "Smart" Compiler):**
    * **`Elements`:** Iterate all selected `Elements`. For each, **prune (discard)** any data keys (e.g., `skills`) that are *not* "claimed" by a `System` in the final `final_schema`.
        * *Example:* This logic ensures an NPC's `skills` data is *ignored* if no Skill `System` is active in this story.
    * **Lore `Elements` (RAG):** Iterate all Lore-type `Elements`. Vectorize their `Entry` text and store them in a structure indexed by their `Triggers` list.

4.  **Generate `Story Dimension` (The `compiled_json`):**
    * Assemble the final 4-key `compiled_json` object, now rebranded:
        * **`forces_context`:** (Merged `action_prompt_systems` + pruned `Element` data)
        * **`narrative_context`:** (Merged `narrative_prompt_systems` + RAG-indexed Lore `Element` data)
        * **`shaping_ui_schema`:** (Merged `ui_schema` for the `Casting Circle` UI)
        * **`version_manifest`:** (A "receipt" of all source asset IDs/versions)
    * **Note:** This assumes `chimera_story_compiled_ruleset` table is now `chimera_story_compiled_systems`.
    * Save this object to the `chimera_story_compiled_systems` table.

---

## 🚀 Phase 4: The `Casting` Engine (Playable MVP)

**Status:** **Not Started**

**Task:** Implement the "Casting Loop" to make the compiled `Story Dimensions` playable, transforming `Stones` (player actions) into `Ripples` (narrative responses).

**Deliverables:**

1.  **Build `chimera_game_states` Table (The `Story Space`):**
    * Create the "save file" table.
    * **Schema:** `id`, `story_id`, `user_id`, `current_game_state` (jsonb) (this is the `Story Space` data), `turn_count`, `status`. (Based on original plan)

2.  **Build `Casting` Loop Orchestrator Endpoint:**
    * Create a single endpoint: `POST /api/v2/play/:gameStateId/cast-stone`.
    * This endpoint will load the `chimera_game_states` (the `Story Space`) and `chimera_story_compiled_systems` (the `Story Dimension`) and execute the full 3-step loop.

3.  **MAS Step 1: Interpret `Stone` (The "Parser")**
    * **Input:** `userInput` (the `Stone`), `forces_context`, current `game_state`.
    * **Prompt (Simplified):** "You are a Game Master's assistant. The user `Casts` a `Stone`: [User Input]. The current `Forces` (mechanics) are [Systems Context]. What structured actions are they trying to perform? Respond ONLY with JSON."
    * **Output:** A structured JSON `intent` (e.g., `[{"action": "PERCEPTION_CHECK", "target": "chest"}]`).

4.  **Game Engine Processor (The "Calculator") (Non-AI)**
    * **Input:** The `intent` JSON from Step 1.
    * **Logic:** A *non-AI* function that runs the game mechanics (`Systems`) based on the `intent` (e.g., skill checks).
    * **Output:** A factual JSON `outcome` (e.g., `[{"outcome": "SUCCESS", "roll": 18, "difficulty": 15}]`).

5.  **MAS Step 2: Generate `Ripples` & Deltas (The "Storyteller")**
    * **Input:** The `outcome` JSON from Step 2, `narrative_context` (for style/RAG).
    * **Prompt (Simplified):** "You are a master storyteller. A player's action was processed with this result: [Outcome JSON]. Your writing style is [Style Guide]. Generate the `Ripple` (narrative response). Also, generate any logical 'gameStateDeltas' as a JSON Patch array to apply *after* this response."
    * **Output:** The final JSON response with narrative (`Ripples`) and state changes:
        ```json
        {
          "ripple_narrative": "You spot a tiny, poisoned needle on the lock...",
          "gameStateDeltas": [
            { "op": "add", "path": "/player/stats/xp", "value": 10 }
          ]
        }
        ```

6.  **State Update:**
    * The orchestrator applies the `gameStateDeltas` to the `chimera_game_states` record, updating the `Story Space`.
    * The `ripple_narrative` text is sent back to the frontend.

---

## 🚀 Phase 5: The `Shaping` Community (Fast Follow)

**Status:** **Not Started** (This is the original Phase 5, rebranded)
* 5.1: Publishing Workflow (Approval Queue, Dependency Check)
* 5.2: "Official" Content System & Creator (`Shaper`) Pages
* 5.3: Moderation Queues
* 5.4: Social & Discovery (Story Library, Tags, Search)
* 5.5: Private Sharing & "Unapproved Content" Banner