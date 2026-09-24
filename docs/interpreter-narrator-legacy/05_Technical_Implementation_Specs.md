# 05 Technical Implementation Specs
*(StoneCaster / Chimera Engine – MVP)*

This document defines the **Interfaces, Verification, and Safety** of the system. It combines the **API Contract**, **Test Plan**, **UX Flows**, and **Security Protocols**.

---

# PART 1: API CONTRACT

## 1. Conventions
* **Base URL**: `https://api.stonecaster.app/v1`
* **Auth**: Bearer JWT in `Authorization` header.
* **Response**: JSON. Errors use a uniform envelope: `{ "error": { "code": "...", "message": "..." } }`

## 2. Core DTO Summaries

**Compiled Story DTO**
    {
      "story_id": "uuid",
      "world_id": "uuid",
      "version": "1.0.0",
      "compiled_at": "timestamp",
      "compiled_json": { "schema": {}, "initial_state": {}, "instructions": {} }
    }

**Game State DTO**
    {
      "session_id": "uuid",
      "turn_index": 3,
      "updated_at": "timestamp",
      "state_json": { "tier0_world": {}, "tier1_entities": {}, "tier2_system": {} }
    }

## 3. Key Endpoints

### Authoring
* `POST /worlds`: Create a new world container.
* `POST /entities`: Create a Player or NPC template.
* `POST /lore`: Upload world context for RAG.
* `POST /chimera/compile`: Triggers the Compiler.
    * **Input**: `world_id`, `selected_ruleset_keys`.
    * **Output**: `CompiledStory` object (Deterministic artifact).
    * **Validation Rule (Inheritance Integrity):** The compiler must verify that `selected_ruleset_ids` contains **all** rulesets currently active on the `world_id`. If a World ruleset is missing, reject the request with `400 Bad Request`.

### Runtime (The Turn Loop)
* `POST /play/start`: Initialize a session from a Compiled Story.
* `POST /play/cast`: Execute a turn.
    * **Input**: `{ "session_id": "...", "text": "Pick the lock." }`
    * **Output**:
        {
          "messages": [{ "role": "assistant", "content": "The lock clicks..." }],
          "state_delta": { "tier2_system.current_stamina": -2 },
          "updated_state": { "..." }
        }

---

# PART 2: TEST PLAN

## 1. Testing Philosophy
StoneCaster demands **determinism** in non-LLM systems and **strict constraints** for LLM outputs.
1.  **Compiler Determinism**: Same input → identical compiled story.
2.  **Engine Determinism**: Same intent & state → identical resolution.
3.  **RLS Integrity**: Unauthorized access must be provably impossible.

## 2. Test Categories

**Unit Tests**
* **Compiler**: Validate dependency resolution, exclusion groups, and state merging.
* **Engine**: Validate D100 math, stamina drain, hunger decay, and time advancement.

**Integration Tests**
* **API**: Ensure `POST /chimera/compile` returns valid JSON schemas.
* **Database**: Verify JSONB writes and Foreign Key cascades.

**MAS Contract Tests (LLM Validation)**
* **MAS-1**: Output must be JSON. Must contain `intent` and `duration_tag`. Must NOT contain narration.
* **MAS-2**: Output must be JSON. Must contain `narration`. Must NOT reveal mechanics. Must NOT contradict state.

**Scenario Tests**
Multi-turn scripted flows to validate state persistence:
> Step 1: Input "Look around" → Expect Time Advance.
> Step 2: Input "Pick lock" → Expect Stamina Drain.

---

# PART 3: UX FLOWS AND WIREFRAMES

## 1. High-Level Flow
**Author**: [World Preset] → [Forces/Elements/Lore Tabs] → [Bind Tab: Compile] → **Story Ready**
**Player**: Start Session → View Opening → Enter Action → Receive MAS Output → **State Updates**

## 2. Play Session Screen (Story View)

**Layout Components (Desktop Split View):**
1.  **Game Log:** Turn-based stack showing `Player Input → MAS-1 summary → MAS-2 narration`, with infinite scroll, filters (Narration, System, Player), and timestamps.
2.  **Action Composer:** Multiline text box with suggestion chips, slash-command helper, MAS-1 preview tooltip, and Send CTA. Includes keyboard shortcuts (`Ctrl+Enter`) and "Auto-advance" toggle.
3.  **State Sidebar:** Tier1 stats (stamina, hunger, emotional valence), time band, location, NPC spotlight, condition badges, resources (wealth tier), turn count, and latest lore fragments.
4.  **Resolution Drawer:** Collapsible panel exposing `state_delta`, contest rolls, and triggered rulesets for authors/testers.
5.  **Lore Peek:** Button that reveals retrieved lore fragments and their scores for transparency.
6.  **Session Controls:** Return to Play hub, Abandon (with confirm), Download Transcript, Report Bug, and link back to `/stories`.

**Responsive Behavior:** On tablet/mobile, the sidebar collapses into accordions; resolution drawer becomes overlay.

## 3. Feedback & System States
* **MAS-1 Hard Gate:** Blocked actions surface diegetic warning plus inline tooltip explaining the gate (e.g., collapse prevents travel).
* **Compile/Runtime Errors:** Casting Circle errors stream into Bind log; runtime errors show modal with retry/back-to-dashboard options.
* **Status Banners:** Pending approvals, locked entities/worlds, or quota limits appear as sticky banners within dashboards and editors.
* **Notifications Hooks:** Toasts dispatch for publish submissions, approvals, billing events, and stone purchases (tying into the Profile hub).

## 4. Profile Hub (`/profile`)
* **Overview:** Avatar, display name, handle, follower count, subscription tier, stone balance, CTA buttons (Manage Billing, Notification Prefs, Security).
* **Tabs:** Account (personal info, linked auth), Security (password, MFA, sessions), Notifications (toggles for approvals/errors/marketing), Billing (subscriptions, stone purchases, invoices), Shortcuts (Play hub, Create hub, Store, Support).
* **Technical Notes:** Requires billing API integration (Stripe portal link), notification preference storage, and GDPR export/delete hooks.

## 5. Author Profile Pages (`/author/:id`)
* **Hero Block:** Author avatar, bio, follow button, follower count, share/report actions.
* **Tabs:** Stories, Worlds, Entities, Activity. Each tab paginates resource cards filtered by `author_id`.
* **Follow Flow:** Trigger notification subscription to author updates (future). Provide API contract for follow/unfollow once backend ready.

## 6. Conversion & Store (`/store`, `/subscribe`)
* **Entry Points:** Profile billing tab, navigation CTA, paywalls when limits hit.
* **Product Grid:** Stone bundles (Small/Medium/Large) displaying price, bonus, description. Subscription comparison (Free, Creator, Studio) with entitlements.
* **Checkout Modal:** Payment form (saved methods, new card, promo code, agreement checkbox). On success, show confirmation + new balance; on failure, show inline error + retry.
* **Billing History:** Table with date, product, status, amount, invoice link, refund/support action.

## 7. Additional Surfaces / Missing Pieces
* **Notifications Center:** Aggregated approvals, errors, billing events with read/unread state.
* **Admin Review Console:** Required for moderators to accept/reject Pending submissions.
* **Onboarding/Tutorial:** First-run wizard guiding the Play hub, Discovery, and Casting Circle usage.
* **Lore Library Manager:** Bulk table for authors to edit/tag lore entries outside the world editor.
* **Support/Help Center:** Knowledge base + contact form links accessible from Profile/footers.

---

# PART 4: SECURITY AND COMPLIANCE

## 1. Security Philosophy
1.  **Zero-Trust**: Application code must not trust LLM output.
2.  **RLS-First**: All data access is restricted by Row Level Security in PostgreSQL.
3.  **Immutable Artifacts**: Compiled stories cannot be modified after creation.

## 2. Authorization (RLS Policies)
* **Worlds/Entities**: Only `author_id` can read/write.
* **Compiled Stories**: Public read (for players), Server-only write.
* **Sessions**: Owner-only access.

## 3. LLM Safety & Validation
* **Input Sanitization**: Trim whitespace, enforce max length (800 chars).
* **Output Validation**:
    * **MAS-1**: Verify JSON structure and allowed `intent` keywords.
    * **MAS-2**: Verify JSON structure, no HTML, no mechanics leaks.
* **Content Filters**: Enforce PG/PG-13/R-lite constraints via system prompt instructions.

## 4. Data Protection
* **PII**: System stores no PII beyond Auth email.
* **Logging**: Do not log raw player narrative text (privacy). Log only metadata and mechanical outcomes.
