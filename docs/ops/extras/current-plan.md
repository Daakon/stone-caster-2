This is the **Definitive, High-Detail MVP & Fast Follow Plan**. This is our new ground truth, integrating the detailed product vision from `planning.md` and the robust technical architecture from `mvp-ruleset-design.md` onto our existing `chimera_technical_spec.md` foundation.

---

### 🗂️ The "Translation Layer" (Our Official Cross-Reference)

This remains our foundational guide for development.

| Technical Name (Code/DB) | User-Facing Name (UI) |
| :--- | :--- |
| `chimera_ruleset_templates` | `Systems` / `Forces` |
| `chimera_stories` | `Story Dimensions` |
| `chimera_story_links` | `Linked Systems` |
| `chimera_story_entity_links` | `Linked Elements` |
| Story Creation UI | `The Casting Circle` |
| `POST /:id/rebuild` (Compiler) | "Shape Story Dimension" (Button) |
| `chimera_game_states` | `Story Space` |
| Play Loop Endpoint | `Casting a Stone` |

---

## 🚀 Part A: The Playable MVP (Ground Truth Plan)

This is the full, detailed scope of work, in priority order.

### ▶️ Priority 1: The "Casting Circle" Creator UI (Frontend)

**Product Goal:** Our #1 priority. Create a "best-in-class" guided creation experience that is fast, intuitive, and prevents data loss. It must follow the "simple path first, customize on-demand" principle.

* **Epic 1.1: Implement the "Create-on-Start" Wizard Flow**
    * **Task 1.1.1 (Create-on-Start & State Persistence):**
        * **UX:** When a user clicks the "Create Story" button, they get *immediate* feedback (e.g., a full-screen loader).
        * **Functionality:** This button *immediately* calls `POST /api/v2/chimera/stories` with a placeholder `display_name` (e.g., "Untitled Story" + timestamp).
        * **Functionality:** On 201 Created response, the backend returns the new `story_id`. The frontend *immediately* redirects to a stateful URL: `/create/:story_id/step-1`.
        * **Product Requirement:** This is our **data-loss prevention**. The user can now refresh the page, close the tab, or walk away for a week. When they return to `/create/:story_id/...`, all their progress is intact because every action is an auto-save.
    * **Task 1.1.2 (Step 1: "Shaping `Forces`"):**
        * **UX/UI:** A beautiful, visual, horizontal-scrolling grid of "Story Template" cards (e.g., "Fantasy RPG," "Fantasy Romance," "Sci-Fi Horror").
        * **Product Principle:** "Guided `Shaping`". We are selling a *vibe* and a *starting point*, not a complex list of rules.
        * **Functionality (On-Click):** When a user clicks a template card:
            1.  The UI shows a "Selected" state.
            2.  In the background, the frontend makes *multiple* API calls to auto-link the template's bundle:
                * `POST /api/v2/chimera/stories/:id/links/rulesets` (to link the `MAIN_SYSTEM` ruleset).
                * `PUT /api/v2/chimera/stories/:id` (to set the default `world_id`).
                * `POST /api/v2/chimera/stories/:id/links/entities` (to link default `Elements` like a character sheet).
        * **UX/UI (Customize):** A *secondary* (e.g., outline-style) button labeled "Customize `Forces`". This opens a **modal** (never a new page) that allows the user to browse and select a *different* `MAIN_SYSTEM`.
    * **Task 1.1.3 (Step 2: "Shaping `Origin`"):**
        * **Product Principle:** "The Happy Path is Fast." This step should feel like a *confirmation*, not a *task*.
        * **UX/UI:** The UI shows the `World` that was auto-selected in Step 1 (e.g., "World: Aethelgard"). A large image and short description are shown. The "Next" button is prominent.
        * **UX/UI (Customize):** A secondary "Customize `Origin`" button. This opens a **modal** with two tabs: "Browse Worlds" and "Create New World." The "Create New" tab is a simple form (Name, Description) that creates the new world *without leaving the wizard flow*.
    * **Task 1.1.4 (Step 3: "Shaping `Elements`"):**
        * **UX/UI:** Similar to Step 2, this is a confirmation. "This template includes: [Icon] Core Character Sheet, [Icon] Basic Items, [Icon] Factions of Aethelgard."
        * **UX/UI (Customize):** A "Customize `Elements`" button. This opens the "Element Manager" **modal** (from Epic 1.2), allowing the user to browse, add, or create new `Elements`.
    * **Task 1.1.5 (Step 4: "Shaping `Narrative Flow`"):**
        * **Product Principle:** "Prevent Blank Page Syndrome".
        * **UX/UI:** A large, inviting textarea for the `Premise`.
        * **Functionality (Auto-save):** On text-entry (with a debounce) or on blur, the content is saved to the `chimera_stories.story_definition` JSONB field.
        * **UX/UI:** A prominent `[ ✨ Generate Premise Suggestions ]` button. On-click, it shows a loading state, calls a new AI endpoint (with `world_id` and `system_id` as context), and displays 3-5 premise "cards" that the user can click to auto-fill the textarea.
    * **Task 1.1.6 (Step 5: "Shaping `Intent`"):**
        * **UX/UI:** The "finish line." A clean form:
            * `Display Name` (pre-filled with "Untitled Story...").
            * `Cover Image` (an uploader component).
            * `Tags` (a tag-input, pre-filled with tags from the template).
            * `Author's Note / Style` (a textarea for AI style guidance).
        * **Functionality (Auto-save):** All fields auto-save to the `chimera_stories` record on change.
        * **UX/UI:** A large, satisfying "Finish" button that navigates the user to their story dashboard.

* **Epic 1.2: Build the `Element` & `World` Creation Modals**
    * **Product Goal:** This is our "RAG-First Design". The UI must *structurally* guide users to create RAG-friendly, atomic content without them knowing what "RAG" is.
    * **Task 1.2.1 (RAG-First UI):**
        * **UI:** The "New `Element`" modal must have:
            * `Type` (Dropdown: `Character`, `Item`, `Location`, `Lore (Fact)`, etc.).
            * `Name` (Text field).
            * `Entry` (Textarea): **UX Requirement:** A visible character limit (e.g., 1000) to *enforce atomicity*.
            * `Triggers` (Keyword Input): **UI Requirement:** This *must* be a "tag input" (like Stack Overflow tags) to make it clear these are discrete keywords.
    * **Task 1.2.2 (Drifter Tips):**
        * **UI:** The "Dimensional Drifter" icon (the 4-point star) will be placed next to the `Entry` and `Triggers` fields.
        * **UX:** On hover or click, a small, non-intrusive popover appears with the guidance text.
        * **Product Requirement (Entry Tip):** "This is the 'fact sheet' for your `Element`. Keep it clear, factual, and focused on one topic. This is *exactly* what the AI will read!".
        * **Product Requirement (Triggers Tip):** "This is the *most important* part! List all words or phrases that should 'pull' this entry. For 'Kiera the Knight,' add: `Kiera`, `Kiera the Knight`, `Knight of Larion`.".
    * **Task 1.2.3 (API):** Hook this up to a new `POST /api/v2/chimera/entities` endpoint.

* **Epic 1.3: Refactor the Advanced Editor ("Casting Circle")**
    * **Product Goal:** This is the "Master Shaper" mode. It's the destination for advanced users and for *refining* a story created by the wizard.
    * **Task 1.3.1 (Re-theme):** Refactor our *existing* 3-section editor to be the "advanced" landing page.
    * **Task 1.3.2 (Rename & Validate):**
        * **UI:** Rename headers to: 1. "`Origin` & `Intent`" 2. "`Forces` & `Narrative Flow`" 3. "`Elements`".
        * **UI Requirement:** Each header *must* have a `⚠️` / `✅` state icon.
        * **Functionality (Validation Logic):**
            * `Origin & Intent`: `✅` if `display_name` is not the placeholder and `world_id` is set.
            * `Forces & Narrative Flow`: `✅` if at least one `MAIN_SYSTEM` (ruleset) is linked.
            * `Elements`: `✅` (can be always `✅` for MVP).
    * **Task 1.3.3 (Functionality):** This UI will contain the full, detailed "manager" UIs for linking/unlinking `Systems`, `Content Packs`, and `Elements`.

* **Epic 1.4: Hook Up the "Shape Story Dimension" Button**
    * **UX/UI:** This is the primary call-to-action in the "Advanced Editor" (Epic 1.3).
    * **Functionality:** The button *must be disabled* if any section in Task 1.3.2 has a `⚠️`.
    * **UX (On-Click):**
        1.  Button enters a loading state (e.g., "Shaping...").
        2.  Call `POST /api/v2/chimera/stories/:id/rebuild`.
        3.  On Success (200 OK): Show a success toast ("Story Dimension Shaped Successfully!").
        4.  On Error (4xx/5xx): Show a detailed error toast.

---

### ▶️ Priority 2: The "Shaping" Compiler (Backend)

**Product Goal:** Make the "Shape" button *functional*. This is the "Smart Compiler" that transforms a creator's intent into a playable, optimized file.

* **Epic 2.1: Rebuild the `POST /:id/rebuild` Compiler Endpoint**
    * **Task 2.1.1 (Fetch & Sort):** Modify the existing endpoint. The new logic must fetch *all* linked assets (`ruleset_templates`, `entity_templates`, `pack_links`, `story_definition`).
    * **Task 2.1.2 (Merge `Systems`):** Implement the "last-in-wins" merge logic based on the *exact* load order: 1. Main System, 2. Subsystems, 3. World Modifiers, 4. Pack Modifiers, 5. Story Definition. This creates a `final_schema`.
    * **Task 2.1.3 (Compile `Elements` - "Smart Compiler"):**
        * **Product Requirement:** This is the "Smart Compiler" logic from `planning.md`.
        * **Functionality:** Iterate all linked `Elements`. For each one, compare its data keys against the `final_schema`. *Prune (discard)* any data keys from the `Element` that are not "claimed" by an active `System`.
        * **Example:** If the `final_schema` has `actor_stats: { health, mana }`, and an `Element` (NPC) has `data: { health: 100, mana: 50, rage: 25 }`, the compiler *discards* the `rage` key. This prevents data pollution and makes `Elements` modular.
    * **Task 2.1.4 (RAG Index):**
        * **Functionality:** Get all `Elements` of `Type: Lore`. Vectorize their `Entry` text (using Supabase pg_vector or similar) and store this in a new `rag_index` structure, indexed by their `Triggers`.
    * **Task 2.1.5 (Generate 4-Key JSON):**
        * **Architecture Requirement:** The endpoint *must* save the final `compiled_json` to `chimera_story_compiled_ruleset` in this exact 4-key structure:
            1.  `action_context_json`: (Pruned `Element` data + `action_prompt_rules` from `final_schema`).
            2.  `narrative_context_json`: (The `rag_index` + `narrative_prompt_rules` from `final_schema`).
            3.  `ui_schema_merged`: (The `ui_schema` from `final_schema`).
            4.  `version_manifest`: (A "receipt" of all source asset IDs/versions).

---

### ▶️ Priority 3: The "Play Engine" (Backend & Frontend)

**Product Goal:** A clean, secure, and responsive play loop that *programmatically separates* narrative (AI-driven) from mechanics (engine-driven).

* **Epic 3.1: Implement Core DB & Data Structures**
    * **Task 3.1.1 (DB Migration):** Create the `chimera_game_states` table in Supabase, using the exact schema from `chimera_technical_spec.md` (id, story_id, user_id, `current_game_state` jsonb, turn_count, status).
    * **Task 3.1.2 (Tiered Structure - The "Data Contract"):**
        * **Architecture Requirement:** This is the core of our game state integrity, based on `mvp-ruleset-design.md`. The `current_game_state` JSONB *will* be structured with these Tiers:
        ```json
        {
          "tier0_tracked_state": { 
            // AI READ/WRITE. Pure narrative data.
            "psyche": { "npc_1": { "mood": "angry" } },
            "relationships": { "npc_1": { "affinity": -10 } },
            "knowledge": ["knows_secret"],
            "events_memory": ["player_insulted_guard"]
          },
          "tier1_singular_state": { 
            // ENGINE READ/WRITE. Simple game mechanics.
            "actor_health": { "player": 100, "npc_1": 50 },
            "world_time": "2025-11-17T14:30:00Z"
          },
          "tier2_relational_state": { 
            // ENGINE READ/WRITE. Complex game mechanics.
            "player_skills": { "lockpicking": 25 },
            "player_status_effects": ["poisoned"]
          }
        }
        ```
        * **Product Benefit:** This structure *programmatically* enforces our core principle: "AI-Driven State" (Tier 0) vs. "Player-Driven Mechanics" (Tiers 1 & 2).

* **Epic 3.2: Build the `Casting` Endpoint & Orchestrator**
    * **Task 3.2.1 (Route):** Create the single endpoint: `POST /api/v2/play/:gameStateId/cast-stone`.
    * **Task 3.2.2 (Orchestrator):** This handler is the "main game loop." It will:
        1.  Load `game_state` and `compiled_ruleset`.
        2.  Call `ActionResolver` service (Epic 3.3).
        3.  Call `MasContextProvider` service (Epic 3.4).
        4.  Call `MutationValidator` service (Epic 3.5).
        5.  Save the new, mutated state.
        6.  Return the narrative response.

* **Epic 3.3: Build Internal Service: `ActionResolver` (The "Calculator")**
    * **Product Principle:** This is "The Calculator". It is a *non-AI*, deterministic, rules-based function.
    * **MVP Requirement:** The React client *must* send a structured JSON action (e.g., `{"action": "pick_lock", "target": "door_1"}`). Natural language input is a Fast Follow (Epic 4.1).
    * **Functionality (Workflow A):**
        1.  Input: `{"action": "pick_lock"}`.
        2.  Load `tier2_relational_state.player_skills.lockpicking` (e.g., 25).
        3.  Load rules from `action_context_json` (e.g., `difficulty: 50`).
        4.  Run D100 check: `d100(roll=40) + 25 = 65`. Success.
        5.  **Output:** Returns a factual `outcome: { success: true }` and an array of *engine-generated mutations*: `mutations: [{ op: "set", path: "/tier1.../door_1/is_locked", value: false }]`.

* **Epic 3.4: Build Internal Service: `MasContextProvider` (The "Storyteller")**
    * **Product Principle:** This is "The Storyteller". This is the *only* service in the loop that calls the creative AI (MAS).
    * **Functionality (Prompt Building):**
        1.  Input: The `outcome: { success: true }` from Epic 3.3.
        2.  Builds a rich prompt: "You are a master storyteller. A player's action was `pick_lock` and the result was `SUCCESS`. The current narrative state is [all `tier0_tracked_state` data]. Your style guide is [from `narrative_context_json`]. Generate the `ripple_narrative` and any `mutations` (for Tier 0 only)."
    * **Functionality (Output):** Must parse a JSON response from the AI:
        ```json
        {
          "ripple_narrative": "You skillfully work the tumblers, and the lock clicks open.",
          "mutations": [
            { "op": "set", "path": "/tier0_tracked_state/psyche/guard_1/mood", "value": "unaware" }
          ]
        }
        ```

* **Epic 3.5: Build Internal Service: `MutationValidator` (The "Security")**
    * **Product Principle:** This is our critical security and scope-control service. It prevents the AI from breaking the game.
    * **Functionality (Workflow B):**
        1.  Receives the `mutations` array from the AI in Epic 3.4.
        2.  Iterates every mutation:
        3.  `{ "op": "set", "path": "/tier0_tracked_state/psyche/..." }` -> **ALLOW**.
        4.  `{ "op": "set", "path": "/tier1_singular_state/actor_health/..." }` -> **REJECT**.
        5.  `{ "op": "set", "path": "/tier2_relational_state/player_skills/..." }` -> **REJECT**.
    * **Product Benefit:** The AI can *never* cheat. It cannot change player health, skills, or inventory. It can *only* change the narrative state it's supposed to control.

* **Epic 3.6: Finalize Orchestrator & Build Play UI**
    * **Functionality (Save):** The Orchestrator (Epic 3.2) takes the `mutations` from the `ActionResolver` (engine) and adds the *validated* `mutations` from the `MutationValidator` (AI). It applies this combined list to the `current_game_state` JSONB and saves the entire `chimera_game_states` record.
    * **Functionality (Respond):** Sends the `ripple_narrative` string back to the client.
    * **UX/UI (Play Client):**
        1.  A "chat" message log to render the `ripple_narrative`.
        2.  An input area.
        3.  **MVP Requirement:** The input area will be a set of context-aware buttons (e.g., [Look], [Use], [Talk]) that send the structured JSON required by Epic 3.3. Free-text entry is our first fast-follow.

---

## 🚀 Part B: The Fast Follows (v2.0) Plan

After the MVP is live, we will immediately begin work on these high-impact features.

* **Epic 4.1: Natural Language Action Parser**
    * **Goal:** Implement "MAS Step 1: Interpret `Stone` (The 'Parser')".
    * **Function:** Replaces the structured action buttons (Epic 3.6) with a free-text input. An AI "Parser" will translate "I try to pick the chest's lock" into the `{"action": "pick_lock", "target": "chest"}` JSON that our `ActionResolver` (Epic 3.3) already expects.

* **Epic 4.2: The `Shaping` Community Portal**
    * **Goal:** Implement "Phase 5" social and discovery features.
    * **Features:** A public, searchable "Story Library"; Publishing Workflows (approval queues); and public Creator (`Shaper`) Pages.

* **Epic 4.3: Full NPC-Driven Actions**
    * **Goal:** Remove the "Player-Only" constraint from the MVP.
    * **Function:** Implement a "dual-loop" where an NPC (driven by AI) can queue a processed (Tier 2) action (e.g., `guard.attack()`) and send it to the `ActionResolver` just like a player.

* **Epic 4.4: Complex Processed Systems (v2.0)**
    * **Goal:** Build out the full-featured `Systems` (rulesets) for major game mechanics.
    * **Features:** Full-blown Magic, Crafting, Tactical Combat (positioning, etc.), and "Processed" Equipment (equipping an item grants skills).