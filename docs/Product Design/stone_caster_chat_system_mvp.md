# StoneCaster — Chat System & Character Integration (MVP + Fast-Follow Design)

> **Purpose:** Define the integration between the Chat System MVP and the new Character & Relationship System. MVP launches with **Transient Characters only** but includes design scaffolding for **Immersive (Chronicle) Mode** as a post-MVP fast follow.

---

## 1) Core Principles
- **Chat = Game**: All player interactions, narrative progress, and world state changes occur through the chat system.
- **Character-Centric Mode:** Persistence and play depth are tied to the **character**, not the session.
  - Every character is either **Transient (default)** or **Immersive (Chronicle)**.
- **MVP Goal:** Ship Transient-only characters with short-term memory, no persistent world state.
- **Fast-Follow Goal:** Enable Immersive Mode with minimal rework — persistent companions, relationships, and world continuity.

---

## 2) MVP vs. Post-MVP Comparison
| Layer | MVP (Transient Only) | Post-MVP (Immersive / Chronicle Mode) |
|-------|----------------------|--------------------------------------|
| Character System | All characters are transient. | Add persistent mode flag per character. |
| Save System | Autosave within session only. | Enable global autosave + canonical world memory. |
| NPC Memory | Temporary rapport and awareness. | Persistent relationships and reputation. |
| Companions | Temporary, reset on session end. | Permanent companions with loyalty arcs. |
| Adventure Lifecycle | Ends → sandbox → reset. | Ends → sandbox → persistent continuity. |
| UI / UX | No mode selector; clean closure. | Mode badge, continuity indicators. |
| Data Model | `character_id` + transient state only. | Add `is_immersive` flag and canonical save table. |
| AI Behavior | Transient context buffer only. | Canonical continuity and relationship deltas. |

---

## 3) MVP Implementation Scope
### 3.1 Character Creation & Mode Handling
- **All characters default to Transient Mode.**
- Mode fields (e.g., Immersive/Chronicle) exist in the schema but are inactive.
- Future toggle simply exposes Immersive option and persistent features.

**Acceptance Criteria:**
- New character creation results in transient character.
- Immersive-related UI/UX elements hidden or inactive.
- All gameplay uses short-term session memory only.

### 3.2 Session Initialization
- Player selects or creates a Transient character.
- Session inherits character’s transient behavior (no world continuity, temporary NPC states).
- System prepared to later check character mode on session start.

### 3.3 Save System
- **MVP:** Autosave occurs per-session only.
- **Fast-Follow Design:** Database keyed by `character_id` supports persistent saves.
- Save schema prepared for expansion: `character_id`, `session_id`, `world_state`, `npc_memory` (transient in MVP).

**Acceptance Criteria:**
- Autosave triggers at every AI turn.
- No save persists across new adventures.
- Schema validated for Immersive compatibility.

### 3.4 NPCs & Companions
- All companions and NPCs reset when session ends.
- **Energy and relationship systems** apply during session but do not persist.
- NPC and Companion models mirror future Immersive data structures.

**Acceptance Criteria:**
- Companions function for one adventure.
- Post-session reset verified.
- NPC state data stored in session context only.

### 3.5 Adventure Lifecycle
- Adventure ends with summary → sandbox epilogue → soft reset.
- Post-MVP: Sandbox transitions to persistent canon world.

**Acceptance Criteria:**
- Clear end summary appears on completion.
- Session closes cleanly with data wiped.
- Adventure progression stored only in session context.

### 3.6 UX & UI
- No visible mode selection in MVP.
- Hidden placeholders for future Immersive toggle and indicators.
- Future-ready UI structure:
  - Mode badge on character card (“IMMERSIVE” / “TRANSIENT”).
  - Tooltip for persistence difference.
  - Recap generator ready for canonical data pull.

**Acceptance Criteria:**
- No visible Immersive features in MVP.
- Mode-based UI tested via internal debug flag only.

### 3.7 AI Behavior
- AI uses transient session memory context.
- Memory buffer clears after session end.
- Architecture allows swapping to canonical context store post-MVP.

**Acceptance Criteria:**
- No references to prior sessions.
- Context memory refresh verified on new session.
- Future persistent hooks stubbed but inactive.

---

## 4) Fast-Follow (Immersive Mode) Enablement Plan
Once MVP stability confirmed:
1. **Enable Immersive Flag:** Activate `is_immersive` boolean and expose toggle in character creation.
2. **Unfreeze Companion Persistence:** Reuse existing structures, connect to persistent save layer.
3. **Activate Canon Save Layer:** Extend autosave logic to persist beyond session.
4. **Update Recap Generator:** Draw from canonical data.
5. **Expand AI Context Loader:** Load relationship and event memory from persistent store.

**Expected Workload:**
- Minimal refactor; primarily enabling pre-designed hooks.
- 2–4 week dev timeline depending on save model complexity.

---

## 5) Design Implications & Dependencies
- **Data Layer:** Must include `character_mode`, `character_id`, `world_id`, `npc_state`, and `energy` tables ready for persistence.
- **Backend:** Save/resume logic tied to `character_id`; easy toggle between transient and immersive state.
- **Frontend:** Mode selection UI prebuilt but hidden; auto-switch based on selected character.
- **AI Prompting:** Structured to accept contextual world and relationship data dynamically once Immersive mode is active.

---

## 6) QA Plan
**MVP Testing Focus:**
- Verify session resets fully between adventures.
- Validate all saves clear on exit.
- NPC and companion data ephemeral only.
- Adventure end summary consistent and complete.

**Fast-Follow Testing Focus:**
- Persistent save and resume accuracy across multiple adventures.
- NPC/companion memory continuity.
- Canonical recap references correct prior events.
- Performance stability with persistent context.

---

## 7) Summary
MVP delivers full-featured **Transient Play** with dynamic narrative, companions, and world reactivity — but no cross-adventure persistence.  
System architecture, UX scaffolding, and data design all anticipate **Immersive Mode** as a low-friction expansion.

Result: **Launch fast, expand fast** — rich storytelling now, persistent chronicles next.

