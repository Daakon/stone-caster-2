# 06 UX Feature Specifications
*(StoneCaster / Chimera Engine – MVP)*

This document defines the **User Experience**, **Navigation Structure**, and **Interface Requirements** for the MVP. It acts as the blueprint for frontend implementation.

> **Companion Visuals:** See `06_UX_Wireframe_Mockups.md` for lightweight layout diagrams that echo this spec.

---

# PART 1: GLOBAL NAVIGATION & ARCHITECTURE

## 1.1 Navigation Philosophy

The application is divided into two distinct modes:

1.  **Discovery & Play (Public/Player)**: Finding content and playing active sessions.

2.  **Creation (Author)**: Building worlds, entities, and compiling stories.

## 1.2 Global Navigation Bar

**Layout:**

* **Brand (Left):** StoneCaster Logo (Links to `/`)

* **Discovery Links (Center - Public):**

    * `Worlds` → `/worlds`

    * `NPCs` → `/npcs`

    * `Stories` → `/stories`

* **Personal Links (Right - User Context):**

    * `Play` (Active Games Hub) → `/play`

    * `Create` (Authoring Dashboard) → `/create`

    * `Profile` (Avatar/Settings)

### 1.3 Status & Notes (Global Navigation)

- **Status:** Spec-ready, requires responsive design + auth state logic wired to Supabase session.
- **Next UX tasks:** Define hover/focus treatment, mobile overflow pattern (hamburger vs. priority+), and contextual badges (e.g., pending approvals count beside `Create`).
- **Implementation blockers:** Need finalized route guards and feature flags to ensure Author-only links hide for non-creators.
- **Known gaps:** No documented mobile layout; also lacks guidance on how Profile menu surfaces sign-out/settings.
- **Suggested Improvement (Pending Approval):** Add a sticky sub-nav on `/play/:sessionId` offering `Story Log | State | Actions` shortcuts so players can jump without scrolling. (Not yet approved—documented for future review.)

### 1.4 Navigation Routes & Entry Points

- **StoneCaster Logo / Play:** Both route to `/play`, the default landing for authenticated players showing ongoing sessions they can resume.
- **Worlds / NPCs:** Link to their respective resource browsers. From these lists players can open the universal detail modal which then deep-links to related Worlds, Entities (NPCs, locations, etc.), and Stories without leaving context.
- **Create (Authoring Hub):** Opens `/create`, where authors branch into Stories, Worlds, or Entities tabs. Each tab offers quick actions for editing existing content or starting a new artifact.
- **Casting Circle Shortcut:** Within Create → Stories, the **Cast New Story** CTA goes directly to `/casting-circle`.
- **Editor Entry Points:** World and Entity editors can be launched from Dashboard tabs, from resource browser modals (if user is owner), or inline from Casting Circle (Select Elements step). Editors load as modal overlays so authors remain within their current flow when making adjustments.

---

# PART 2: PLAYER & PUBLIC HUBS

## 2.1 Public Discovery Browsers

All public views share a common **"Resource Browser"** layout.

**Common Components:**

* **Search Bar:** Full-text search (Title, Name, Summary).

* **Filter Sidebar:** Multi-select for Genre Tags, Safety Filters, Ruleset Compatibility.

* **Grid View:** Responsive card layout.

* **Visibility Rule:** Only items with `status: 'published'` or `visibility: 'public'` appear here.

These browsers leverage a shared **Detail Modal** component that can be invoked from any card within the app (discovery grids, dashboard cards, Casting Circle selectors, etc.). Cards should consistently trigger the same modal experience so players can inspect worlds/NPCs/stories regardless of where the card appears. Broader discovery re-designs are out of scope for now; we’ll iterate after the start→play flow stabilizes.

#### Interaction Details & Edge Cases

1. **Search UX:** Typeahead with debounce (300ms). Shows inline loading indicator in input; pressing `Enter` forces immediate fetch. Esc clears search.
2. **Filters:** Multi-select chips with AND logic inside groups, OR logic across groups. Include “Reset Filters” control pinned bottom-left of sidebar.
3. **Sorting:** Default “Most Recent”. Expose sort dropdown (Recent, Popularity, Alphabetical). Sorting spec missing previously—added for parity with grid expectations.
4. **Pagination / Infinite Scroll:** Use `react-query` infinite list; display skeleton cards during fetch.
5. **Empty States:** Provide per-resource copy plus CTA to authoring if user owns drafts. Public visitors receive “Nothing published yet” messaging.
6. **Error Handling:** Toast + inline retry button on grid.

#### Detail Modal (Shared Pattern)

* **Trigger:** Card click opens full-height modal drawer (desktop) or full-screen sheet (mobile/tablet). Deep linkable via `?modalType=item&id=...`.
* **Layout:** Left column hero art + metadata stack; right column tabbed content varying by resource.
* **Common Tabs:** `Overview`, `Lore`, `Relationships` (links), plus resource-specific tab described below.
* **Cross-Link Surface:** Inline chips for tags/worlds/entities; selecting chip filters main grid behind modal (ensures continuity).
* **Loading:** Skeleton placeholder before content fetched. Modal uses same API as detail page.
* **Actions:** Top-right primary action (e.g., Play, Follow, Add to Cast) + secondary (Share link).

#### Shared Component Status & Notes

- **Status:** Component architecture drafted; needs design token mapping + accessibility pass (focus order between search/sidebar/grid).
- **Integration Tasks:** Confirm API contracts for filters/sort, align with backend `?tag=` query syntax.
- **Known Issue:** No spec for bookmarking/favoriting despite probable demand—leaving out of MVP intentionally but callout for backlog.
- **Suggested Improvement (Pending Approval):** Add quick-view modal on hover/tap to surface summary without route change, reducing bounce while browsing.

### A. Worlds Browser (`/worlds`)

* **Card:** Title, Summary, Author, Biome Tag, Genre Tags.

* **Click Action:** Opens **World Detail View**.

* **Detail View:**

    * Full Description & Lore Snippet.

    * **"Playable Stories"**: List of Compiled Stories linked to this world.

* **"Inhabitants"**: List of Public Entities linked to this world.

**Modal Tabs (World)**

1. **Overview:** World description, biome, special rules summary, featured art.
2. **Stories:** Paginated list of compiled stories tied to world with Play CTA (searchable if list long).
3. **Entities:** Searchable table of NPCs/entities linked to world (filters by archetype, status).
4. **Lore:** Embedded lore entries scoped to world with collapsible snippets.
5. **Rulesets:** Shows mandatory + optional rulesets with tooltips describing effects.

#### Status & Notes — Worlds Browser

- **Status:** UX spec 80% complete; needs visual design for “Playable Stories” and “Inhabitants” subpanels.
- **Tasks:** Determine max cards per section, add “See all stories” link if list >4, confirm fallback art for worlds without cover.
- **Risk:** Deep-link from stories must gracefully handle unpublished worlds (should hide).
- **Suggested Improvement (Pending Approval):** Include “Follow World” action to notify players when new stories publish; requires notification system—flagged for backlog.

### B. NPCs (Entities) Browser (`/npcs`)

* **Card:** Name, Archetype (e.g., "Merchant"), Portrait Placeholder.

* **Click Action:** Opens **Entity Detail View**.

* **Detail View:**

    * Stats Summary (High-level only).

    * Personality & Role.

* **"Origin"**: Link to the World it belongs to.

**Modal Tabs (NPC)**

1. **Overview:** Identity, archetype, portrait, quick stats, current status.
2. **World:** Origin world summary with link-out button; includes breadcrumbs to other inhabitants.
3. **Stories:** List of stories this NPC participates in, showing role (ally/rival/etc.).
4. **Lore:** Pulls lore snippets referencing NPC, showing citation/backlinks.
5. **Relationships:** Displays linked entities or factions plus relationship tags/memory notes.

#### Status & Notes — NPCs Browser

- **Status:** Ready for high-fidelity mockups. Portrait placeholder style TBD (initials vs. generic silhouette).
- **Tasks:** Define stat summary fields (top 3 attributes?) and ensure Origin link respects visibility (hidden if origin world is private).
- **Issue Identified:** No filter for archetype tiers; add multi-select for Roles to avoid overwhelming grid.
- **Suggested Improvement (Pending Approval):** Provide “Compare” mode to view two NPC cards side-by-side for authors vetting casts.

### C. Stories Browser (`/stories`)

* **Card:** Story Title, "Based on [World]", Runtime Tag (e.g., "Short"), Author.

* **Primary Action:** **"Play Now"**

    * *Behavior:* Triggers `SessionService.createSession(storyId)` → Redirects to `/play/:sessionId`.

**Modal Tabs (Story)**

1. **Overview:** Synopsis, runtime tag, difficulty, author, cover.
2. **World & Rules:** Paired view outlining base world info + active ruleset stack.
3. **Cast:** List of entities included with roles, quick view linking to entity modal.
4. **Lore Hooks:** Lore entries highlighted within story context for flavor.
5. **Sessions:** For owners only—shows latest sessions/test runs linked to story (read-only).

#### Status & Notes — Stories Browser

- **Status:** Spec-complete for MVP; pending integration with Session Service.
- **Open Tasks:** Add confirmation modal if player already has max concurrent sessions, and design loading state while session ID is generated.
- **Known Gap:** No preview of estimated difficulty/runtime aside from “Short/Medium/Long” tag; consider tooltip with more detail.
- **Suggested Improvement (Pending Approval):** Add “Test Play” secondary action when viewing own published story to jump into sandbox environment.

## 2.2 Play Hub (Session List)

**Route:** `/play`

**Purpose:** Manage active save slots (sessions) and quickly jump back into a story.

**UI Layout:**

* **Header:** "Play"

* **Grid:** List of **Session Cards**.

* **Session Card Content:**

    * Story Title & Cover.

    * **"Last Played"**: Date/Time.

    * **Current State**: Location Name / Time Band (e.g., "Deep Night").

* **Actions:**

    * **Resume (Primary):** Redirects to `/play/:sessionId`.

    * **Abandon (Secondary):** Deletes the session.

* **Empty State:** "No active adventures. Visit the **Stories** tab to find a new journey."

#### Interaction Details

1. **Sorting:** Default by `lastPlayed DESC`. Allow manual sort (Alphabetical, World, Status).
2. **Resume CTA:** Primary button persists while API call in-flight; disable once clicked, show spinner, route when payload returns.
3. **Abandon Flow:** Secondary button opens confirmation modal with summary of irreversible deletion. Requires type-to-confirm for Published stories to avoid accidental wipes.
4. **Session Metadata:** Card chips show `Difficulty`, `World`, and `Session Age` (turn count). Tooltips explain states like “Deep Night”.
5. **Empty State CTA:** Provide direct link to `/stories` plus highlight featured story if available.

#### Status & Notes — Play Hub

- **Status:** UX spec in review; engineering waiting on session delete endpoint contract.
- **Next Tasks:** Define pagination vs. infinite scroll once we confirm expected session counts; finalize card aspect ratio for responsive view.
- **Known Issue:** No plan for archived/completed sessions; current design mixes active/finished. Need filter or tabbing.
- **Suggested Improvement (Pending Approval):** Introduce “Pin to Top” for favorite sessions—deferred unless players request.

## 2.3 Start Story & Character Selection

**Routes / Surfaces:** Accessible from `/play` via “Start New Story” CTA (opens start flow overlay). Flow includes: Story Summary → Character Library (`/play/start/:storyId`), Quick Start duplication, lightweight builder (`/character/new/:storyId`), advanced builder (`/character/create/:storyId`), then session initialization at `/play/:sessionId`.

**Purpose:** When a player launches a story, they can attach one-or-many characters to that world/session by selecting an existing avatar, choosing a quick-start prefab, or creating a brand-new character inline.

**Feature Set:**

1. **Story Summary Panel:** Display story/world metadata, difficulty, tags, and stone cost before committing. Accessible from any discovery card via shared modal “Play” CTA.
2. **Character Library:** Grid/list of player-owned characters scoped to the world/story; supports multi-select when stories allow party play later, but for MVP we attach one primary character while retaining the library for future expansion.
3. **Quick Start Characters:** Curated/pre-built characters authored for that world. Selecting one duplicates it into the player’s roster (belonging to the story’s world) and immediately attaches it to the session.
4. **Create New Character:** Launches lightweight `/create-character/:storyId` form (name, pronouns, archetype, backstory) and optionally an advanced builder (`/play/create/:storyId`) for detailed stats/bio. Newly created characters save to the player profile and appear in the library.
5. **Character Details Drawer:** Clicking any character opens a drawer modal showing stats, equipment placeholders, relationships, and last session used.
6. **Multiple Character Support:** Players can maintain multiple characters tied to the same world; when starting or resuming from `/play`, they select which one to use. Persist the mapping between character and session for continuity and display that pairing in the Play hub list.
7. **Validation & Limits:** Prevent duplicates with same name per world, enforce max characters (configurable), and warn if a character is mid-session elsewhere.

**Status & Notes — Character Selection**

- **Status:** Core flows exist in code (`StartStoryPage`, `PlayerGatewayPage`, `CharacterCreationPage`, `CharacterCreatorPage`) but UX needs updates to reflect the new catalog modals and multi-character management.
- **Tasks:** Align UI styling with Resource Browser patterns, add progress indicators across quick-start vs. custom creation, ensure quick-start duplication and new-character save logic surface success/failure states, and integrate stone cost/paywall messaging.
- **Known Gap:** No unified library view outside the start funnel—consider exposing `/profile` shortcut to manage characters.
- **Suggested Improvement (Pending Approval):** Allow tagging/favoriting characters and suggesting them when browsing stories set in their origin world.

---

# PART 3: CREATE (AUTHORING HUB)

**Route:** `/create`

**Purpose:** The central dashboard for creating content.

## 3.1 Dashboard Layout

* **Header:** "My Creations" (No global action buttons).

* **Tabs:**

    1.  **Stories** (Default)

    2.  **Worlds**

    3.  **Entities**

### 3.1.1 Dashboard Interactions & Status

- **Status:** Framework in wireframe stage. Needs tab persistence (URL query `?tab=`) and keyboard navigation spec.
- **Interactions:** Tabs load lazily with skeleton states. Persist column settings per tab via localStorage. Provide global alert banner slot for approval updates.
- **Accessibility:** Ensure tabs reachable via arrow keys; include ARIA `aria-controls`.
- **Suggested Improvement (Pending Approval):** Add quick-create split button in header to mirror most-used action without cluttering tabs.
## 3.2 Stories Tab (Compiled Artifacts)

The entry point for casting playable games.

* **Primary Action:** **"Cast New Story"** Button (Top Right).

    * *Behavior:* Redirects to `/casting-circle`.

* **List View:**

    * Table/Grid of `CompiledStory` artifacts.

    * Columns: Title, Source World, Version, **Status Badge** (`Draft` | `Pending` | `Published`).

    * Actions: **Play** (Test run), **Manage/Publish** (Open Detail), **Delete**.

#### Additional UX Details

1. **Column Customization:** Users can show/hide Version or Status columns; preference persists.
2. **Row States:** Draft rows show editable icon; Pending rows show lock icon with tooltip. Published rows disable inline delete (requires Manage modal).
3. **Bulk Actions:** MVP requires multi-select for bulk delete limited to Draft items.
4. **Filters:** Add quick filters for `status` and `world`.
5. **Pagination:** Server-side with 25 rows default; include page jump.

#### Status & Notes — Stories Tab

- **Status:** Spec mostly complete; dependencies on CompiledStory API sorting/pagination.
- **Tasks:** Need design for Play/Test run iconography and confirm Delete confirmation copy.
- **Known Issue:** No explicit “Duplicate story” flow though authors may expect it—rely on Casting Circle recompile for now.
- **Suggested Improvement (Pending Approval):** Provide inline “Publish” shortcut for Draft rows meeting validation to reduce modal hops.

## 3.3 Worlds Tab (World Management)

The container for settings, rules, and global lore.

* **Primary Action:** **"Create World"** Button.

* **List View:** Your draft and published worlds.

    * **Status Badge:** Visible on card (`Draft`, `Pending`, `Published`).

* **Editor View (World Editor):**

    * **Locked State:** If `status` is `pending` or `published`, all inputs are disabled. A banner appears: *"This world is [Status]. Create a new version to make edits."*

    * **Tab 1: Details:** Title, Slug, Summary, Privacy, Image.

    * **Tab 2: Configuration:** Select Rulesets (Foundation, Expansions).

    * **Tab 3: Lore (Integrated):** Manage `chimera_lore` items linked to this world.

#### Additional UX Details

1. **List Card Chips:** Display `Biome`, `Active Rulesets count`, `Last Edited`.
2. **Create World Flow:** Modal/wizard hybrid with autosave drafts.
3. **Locked State Banner:** Includes CTA “Create New Version” linking to duplication endpoint.
4. **Lore Tab:** Inline table with add/edit drawers; includes highlight of missing required lore counts (if any).
5. **Validation Messaging:** Right column callouts summarizing missing fields before publish.
6. **Entry Points:** Editor modal can be invoked from Dashboard, Casting Circle (Select World step), or any world detail modal when the viewer is the owner—ensuring consistent overlay experience.

#### Status & Notes — Worlds Tab

- **Status:** Requires design for Lore manager integration; other pieces spec-ready.
- **Tasks:** Define default cover art, confirm slug uniqueness validation messaging, add confirm dialog for status changes.
- **Known Gap:** No defined compare view between world versions (future need).
- **Suggested Improvement (Pending Approval):** Add “World Health” checklist summarizing required tasks (rulesets selected, lore count) to guide authors.

## 3.4 Entities Tab (Character Management)

The factory for NPCs and Player Templates.

* **Primary Action:** **"Create Entity"** Button.

* **List View:** Name, Role, Archetype, Status Badge.

* **Editor View (Entity Editor):**

    * **Locked State:** Same locking rules apply.

    * **Tab 1: Identity & Stats:** Name, Role, Attributes.

    * **Tab 2: Personality:** Values, Quirks, Tier 1 State.

    * **Tab 3: Background (Integrated):** Bio and Rumors (Saved to `entity_json`).

#### Additional UX Details

1. **List Columns:** Role, Archetype, Affinity tags, Last Updated.
2. **Create Entity CTA:** Opens drawer allowing quick attribute entry before full editor.
3. **Personality Tab:** Show progress meter for required values/quirks vs. recommended.
4. **Background Tab:** Supports markdown preview toggle.
5. **Locked States:** Provide “Clone to Draft” CTA when entity published.
6. **Entry Points:** Entity editor modal can launch from Dashboard, Casting Circle (Select Elements), or entity detail modals (owner view) so authors can edit without losing context.

#### Status & Notes — Entities Tab

- **Status:** UX ~70% done; stats layout pending.
- **Tasks:** Need default attribute dictionary, design for portrait upload, finalize JSON schema for Background tab fields.
- **Known Issue:** No spec for linking entity to multiple worlds—currently single origin; confirm requirement.
- **Suggested Improvement (Pending Approval):** Introduce “Persona templates” authors can apply for faster creation (future backlog).

---

# PART 4: CASTING CIRCLE (WIZARD)

**Route:** `/casting-circle`

**Purpose:** The compilation pipeline interface.

**Flow Steps:**

1.  **Select World:** Choose one of your Worlds (Tab 1).

2.  **Verify Forces (Ruleset Configuration)**
    * **Visual Hierarchy (Grouping & Nesting):**
        * **Foundations First:** Rulesets with `ui_category: 'foundation'` render as primary cards.
        * **Nested Expansions:** Rulesets with `ui_category: 'expansion'` that depend on a Foundation must render **visually nested** (indented or inside a sub-container) within that Foundation's card.
        * **Orphans:** Expansions without visible parents render in a separate "Global / Standalone" section.
    * **Constraint: World Inheritance Lock:**
        * Rulesets defined in the selected **World** are **Locked (Read-Only)** and strictly checked.
        * **Visual Indicator:** Inherited rulesets show a "World Base" badge and a disabled (checked) toggle.
        * **Logic:** The author can **add** new rulesets (e.g., a specific "Horror Expansion" for this specific story) but **cannot remove** the core physics/mechanics defined by the World creator.
    * **Auto-Selection Logic (Deterministic):**
        * **Selecting** a child expansion automatically selects its required Foundation dependency.
        * **Deselecting** a parent Foundation automatically deselects all nested child expansions (Cascade Deselect).
        * **Exclusion Groups:** Selecting a ruleset in an exclusion group (e.g., "Skill System") auto-deselects any other active member of that group.

3.  **Select Elements:** Choose which Entities to include (Tab 3).

4.  **Bind (Compile):**

    * Trigger `POST /chimera/compile`.

    * On Success: Output is a new `CompiledStory` with status `Draft`.

### Detailed UX Flow

1. **Entry Condition:** Wizard requires at least one published world; if none, show inline CTA linking to Worlds tab.
2. **Progress Indicator:** Top progress bar highlights active tab; disabled tabs show lock icon until prerequisites met.
3. **Validation Surface:** Each tab surfaces inline errors plus summary banner in Bind step.
4. **Autosave:** Selections autosave per step; warn on navigation away if compile not run.
5. **Compile Step:** Contains log output panel streaming compiler validations; on success shows CTA “View Story” linking to Stories tab detail.
6. **Failure Handling:** Show aggregated error list plus per-entity deep links to fix issues.

### Status & Notes — Casting Circle

- **Status:** UX spec ready; engineering blocked on final compile API payload structure.
- **Next Tasks:** Define skeleton loaders for each tab, finalize copy for validation banners, ensure compile button disabled if unchanged since last compile.
- **Known Gap:** No explicit “version comparison” view when re-binding; need spec to show diff vs. last compile.
- **Suggested Improvement (Pending Approval):** Provide optional AI assistant to propose missing elements or highlight underused rulesets (future enhancement).

### Casting Circle Feature Sets (Current → Target)

| Step | Current Implementation (`CreateStoryPage`) | Target Enhancements (This Spec) |
|------|-------------------------------------------|---------------------------------|
| **World Selection** | Step1_World lists owned worlds + inline CreateWorldModal (modal overlay). | Add searchable list with filters/tags, lock downstream tabs until a world is selected, display key stats (rulesets, status) and validation badges. |
| **Forces (Rulesets)** | Step2_Forces exposes checklist of ruleset templates + RulesetFilterBar. | Introduce dependency/exclusion warnings inline, recommended ruleset bundles, and summary chips that propagate to Bind tab. |
| **Elements (Entities/Packs)** | Step3_Elements integrates EntityBrowser, EntityCard, CreateEntityModal, EntityManagerModal. | Layer in quick filters (role, status), allow selecting packs + entities simultaneously, show slot counters and conflict alerts. |
| **Lore** | Step4_Lore uses LoreManagerModal/Entity selectors; optional. | Provide progress meter for required lore count, highlight missing context, support inline markdown preview, tie into new Lore Library view. |
| **Bind (Compile)** | Step5_Compile triggers compile + log; manual refresh for errors. | Add compile readiness checklist, diff view vs. last compile, streaming log with severity badges, success CTA to Stories tab, disable compile when unchanged. |
| **Support Modals** | CreateWorldModal, CreateEntityModal, CreateLoreModal reuse existing forms but open as blocking dialogs. | Ensure all support modals adhere to editor overlay spec (Part 3) with autosave, locking, and version info; allow launching them from detail modals and Casting Circle seamlessly. |

**Alignment Notes:**
- Preserve existing CreateStoryPage functionality while layering UI/validation improvements; never regress the ability to create worlds/entities/lore inline.
- Engineering should feature-flag new enhancements so authors can continue using the current flow during rollout.
- Shared components (TabBar, ValidationPanel, StatusBadges) from Part 7 should be adopted across each step to reduce duplication.

---

# PART 5: PUBLISHING & APPROVAL WORKFLOW

Each creation (World, Entity, Compiled Story) tracks a lifecycle status.

## 5.1 Status States

1.  **Draft (Default):** Private, fully editable. Visible only to author.

2.  **Pending:** Submitted for review. Read-only (Locked). Visible to author and admins.

3.  **Published:** Approved. Read-only (Locked). Publicly visible.

4.  **Rejected:** Returned to author. Editable. Contains "Rejection Reason".

## 5.2 The "Manage/Publish" Modal

Accessible from the Detail/Edit view of any item.

**State A: Item is Draft**

* **Action:** "Publish to Public"

* **Form:**

    * **Justification:** Text area (Required). *"Why is this ready for the public? What changed?"*

    * **Agreement:** Checkbox. *"I certify this follows content guidelines."*

* **Result:** Sets status to `Pending`. Locks item.

**State B: Item is Pending**

* **Banner:** "Waiting for Approval."

* **Action:** "Cancel Request"

* **Result:** Reverts status to `Draft`. Unlocks item.

**State C: Item is Published**

* **Banner:** "Live on StoneCaster."

* **Action 1:** "Unpublish" (Emergency).

    * *Result:* Reverts to `Draft`. Hides from public.

* **Action 2 (Primary):** **"Create New Version"**

    * *Result:*

        1.  Clones the current item to a new database row.

        2.  Appends `(v2)` or increments version number.

        3.  Sets new item status to `Draft`.

        4.  Redirects author to the new Draft.

        5.  *Note:* The old "Published" version remains live and untouched.

### Additional UX Details

1. **Modal Layout:** Left column summary (title, status, version, timestamps). Right column dynamic form fields.
2. **Audit Trail:** Display last status change + actor for transparency.
3. **Validation:** Require justification min character count (e.g., 120) before enabling Publish.
4. **Pending State:** Show timeline timeline? (maybe stepper) with expected review SLA.
5. **Rejected State:** Present rejection reason with CTA “Address Feedback” linking to editor anchor.

### Status & Notes — Publishing Workflow

- **Status:** UX spec 75%; needs hi-fi for banners/modals.
- **Tasks:** Determine toast vs. inline success messaging, connect to notification center (if exists), ensure versioning action clones linked lore/entities.
- **Known Issue:** No spec for admin review screen—only author view documented; create at least placeholder.
- **Suggested Improvement (Pending Approval):** Add lifecycle badge on cards that also show reviewer comments count, aiding quick triage.

---

# PART 6: ADDITIONAL SURFACES

## 6.1 Play Session Experience (`/play/:sessionId`)

**Layout:**

- **Game Log (Primary Column):** Stacked narration entries, player inputs, and system notices. Each turn groups `Player Input → MAS-1 summary → MAS-2 narration`.
- **State Sidebar (Secondary Column):** Displays Tier1 stats (stamina, hunger, emotional valence), time band, location, NPC spotlight, inventory-less resources (wealth tier), condition badges, and session metadata (turn count, last save).
- **Action Composer (Footer):** Multiline text box with suggestions panel, slash-command helper, MAS-1 parser preview, and Send CTA. Includes keyboard shortcuts and “Submit + Auto-Advance” toggle.
- **System Controls:** Buttons for Return to Play hub, Abandon Session, Download Transcript, Bug Report, Lore Peek (shows retrieved fragments), and Resolution Drawer toggle (exposes state_delta/roll breakdown).

**Status & Notes — Play Session**

- **Status:** Needs high-fidelity design; runtime JSON contract defined via API docs.
- **Tasks:** Define breakpoints for sidebar collapse, specify log pagination/infinite scroll behavior, add accessibility plan (screen reader reading order).
- **Known Gaps:** No help/tutorial overlay yet; no spec for multimedia (audio cues) which may be future enhancement.
- **Note:** Detailed visual/interaction polish is deferred until Casting Circle + compile workflows are finalized, so only high-level requirements are captured for now.
- **Suggested Improvement (Pending Approval):** Provide quick macro buttons (Rest, Observe, Inventory) derived from rulesets to assist players unfamiliar with open text.

---

## 6.2 Profile Hub (`/profile`)

**Purpose:** Centralize account controls, security, notifications, billing, and content shortcuts.

**Sections:**

1. **Overview:** Avatar, display name, handle, follower count, subscription tier, stone balance, quick buttons (Manage Billing, Change Password, Notification Prefs).
2. **Account Tab:** Personal info, linked auth providers, region, data export.
3. **Security Tab:** Password reset, MFA setup, session management.
4. **Notifications Tab:** Toggle email/push for approvals, compilation errors, store promos.
5. **Billing Tab:** Manage subscription, buy stones, see invoices, enter promo codes.
6. **Shortcuts:** Links to Play hub, Create hub, Conversion Store, Support.

**Status & Notes — Profile Hub**

- **Status:** New scope; needs UX exploration and backend endpoints for billing/subscription details.
- **Tasks:** Integrate with payment provider (Stripe) for portal deep link, define data model for notification preferences.
- **Known Gap:** No approach for GDPR/compliance requests (export/delete) yet.
- **Suggested Improvement (Pending Approval):** Add activity timeline summarizing recent creations, purchases, approvals.

---

## 6.3 Author Profile Pages (`/author/:id`)

**Purpose:** Public-facing landing for each author, accessible via any card/modal “by [Author]” link.

**Content:**

- Hero header with avatar, pen name, tagline, follow button, follower count.
- Stats row (Published Stories, Worlds, Entities, Ratings once available).
- Tabs:
    1. **Stories:** Grid filtered to author’s published stories with Play CTA.
    2. **Worlds:** Cards showing published worlds.
    3. **Entities:** Public entities/NPCs.
    4. **Activity:** Recent publishes or approvals (audit-safe).
- Social share buttons, report/flag option, contact guidelines.

**Status & Notes — Author Profiles**

- **Status:** Not yet designed; requires API support for fetching author catalog with pagination.
- **Tasks:** Determine visibility rules (draft vs. published), design follow/favorite interactions, integrate with notification system for updates.
- **Known Gap:** No follower/following backend present—needs new tables.
- **Suggested Improvement (Pending Approval):** Enable showcasing curated playlists/collections of stories per author.

---

## 6.4 Conversion & Store (`/store`, `/subscribe`)

**Purpose:** Handle virtual currency (“stones”) purchases, subscription upgrades, and billing history.

**Flow:**

1. **Entry Points:** Profile page, nav CTA, paywalls (e.g., limited sessions), marketing emails.
2. **Product Grid:** Stone bundles with price, bonus tag, discount badges. Subscription tier comparison chart (Free vs. Creator vs. Studio).
3. **Checkout Modal:** Payment method selection (saved cards, new card, promo code). Inline error handling, terms checkbox.
4. **Confirmation Screen:** Balance update, receipt download, shareable referral code.
5. **Billing History:** Table of transactions with status, invoice links, manage auto-renew toggle.

**Status & Notes — Conversion**

- **Status:** Concept stage; depends on payment integration (Stripe, Paddle, etc.).
- **Tasks:** Define entitlements unlocked per tier, handle tax info, add safeguards (purchase limits).
- **Known Gap:** No place yet for gifting stones or applying store credit.
- **Suggested Improvement (Pending Approval):** Offer “Trial compile” upsell when author hits compilation limits.

---

## 6.5 Additional Missing Surfaces / Future Needs

- **Notifications Center:** Persistent inbox/toast history surfacing approvals, errors, billing events.
- **Admin Review Console:** Required for moderators to approve Pending submissions (worlds/entities/stories).
- **Onboarding/Tutorial Flow:** Guided tour for first-time authors and players.
- **Lore Library Management View:** Dedicated screen for bulk editing and tagging lore outside world editor.
- **Support/Help Center:** Self-serve articles, contact form, status page links.
- **Accessibility Settings:** Text size, high-contrast theme, reduced animation toggles.
- **Analytics Dashboard (Author):** Basic insights on story plays, completion rates (post-MVP).

---

# PART 7: COMPONENT INVENTORY & SHARED UX SYSTEMS

## 7.1 Component Breakdown (What Lives Where)

| Component | Location / Routes | Required Elements |
|-----------|------------------|-------------------|
| **Global Navigation Bar** | Persistent shell (`/`, `/worlds`, `/npcs`, `/stories`, `/play`, `/create`, `/profile`) | Logo/Play link, Discovery links (Worlds/NPCs/Stories), Create CTA, Profile menu, auth-aware visibility, responsive collapse, notification/pending badges. |
| **Resource Browser Shell** | `/worlds`, `/npcs`, `/stories` | Search bar (debounced), filter sidebar with reset, sort dropdown, responsive card grid, infinite scroll/pagination, empty/error states, shared detail modal trigger. |
| **Worlds Detail Modal** | From world cards (public + author) | Tabs: Overview, Stories, Entities, Lore, Rulesets; follow/action CTA, inline chips that filter parent grid, owner-only edit link launching editor overlay. |
| **NPC Detail Modal** | From NPC cards, Casting Circle selections | Tabs: Overview, Origin World quick view, Stories, Lore, Relationships; portrait + stat summary, role badges, quick links to story/world modals, owner edit CTA. |
| **Stories Detail Modal** | From story cards, Create tab list, author profile | Tabs: Overview, World & Rules, Cast (links to NPC modals), Lore Hooks, Sessions (owners), Play/Test CTAs with loading state, warnings when session cap reached. |
| **Play Hub Cards** | `/play` | Card layout with cover, status chips (Difficulty, World, Session Age), Resume + Abandon buttons, empty state CTA, sort control, metadata tooltips, confirmation flow for deletion. |
| **Play Session Screen** | `/play/:sessionId` | Game log (player/system/narration grouping), action composer with MAS preview, state sidebar (Tier1 stats, time band, NPC spotlight, lore fragments), resolution drawer, lore peek, session controls (resume/abandon/transcript/help). |
| **Dashboard Tabs (Stories/Worlds/Entities)** | `/create` | Tab bar with persistence, tables/cards with status badges, bulk actions, filters, skeleton loaders, global alert slot, entry points to editors/Manage modal/Casting Circle. |
| **World Editor Modal** | Dashboard → Worlds, Casting Circle (Select World), world modal (owner) | Tabs: Details, Configuration, Lore; locked banner + Create New Version CTA; validation panel; autosave + versioning info. |
| **Entity Editor Modal** | Dashboard → Entities, Casting Circle (Select Elements), entity modal (owner) | Tabs: Identity & Stats, Personality (values/quirks progress meter), Background (markdown preview); locked state clone CTA; portrait upload; autosave. |
| **Casting Circle Wizard** | `/casting-circle` | Gated tabs (World, Forces, Elements, Bind), progress indicator, validation summaries per step, compile log console, autosave, compile CTA locked until clean, success redirect to Stories tab. |
| **Manage/Publish Modal** | From story/world/entity detail/editor | Layout: summary column, dynamic forms for Justification/Agreement, conditional actions (Publish, Cancel Request, Unpublish, Create New Version), rejection reason display, audit trail. |
| **Profile Hub** | `/profile` | Overview cards (avatar, tier, stones), tabs (Account, Security, Notifications, Billing, Shortcuts), billing portal link, purchase history, notification toggles, data export controls. |
| **Author Profile Pages** | `/author/:id` | Hero (bio, follow CTA, follower stats), tabs (Stories, Worlds, Entities, Activity), per-tab grid/list reuse, report/share controls. |
| **Conversion / Store Screens** | `/store`, `/subscribe`, billing modal | Stone bundle grid, subscription comparison, checkout modal (payment methods, promo codes), confirmation view, billing history with receipts, support link. |

## 7.2 Shared Systems & Duplicate Behaviors to Centralize

1. **Card Grid Template:** Worlds/NPCs/Stories/Author tabs all use filterable grids with status badges, chips, and CTA stacks. Create a single `ResourceGrid` component with slot-based card templates and shared empty/error states.
2. **Detail Modal Shell:** World/NPC/Story modals share hero, tabbed pane, action rail, and cross-link chips—standardize the container with props for tab config + CTA definitions.
3. **Status Badges & Locked Banners:** Sessions, stories, worlds, entities, and dashboards reuse `StatusBadge` (Draft/Pending/Published/Rejected) and `LockedBanner` patterns. Consolidate styles and copy strings in design tokens.
4. **Tab System:** Dashboard tabs, editor tabs, Casting Circle, profile tabs, and modal tabs should share an accessible tab component with keyboard navigation, lazy loading, and URL sync.
5. **Confirmation Modals:** Abandon session, delete story, publish, unpublish, stone purchases all need consistent confirmation dialogs with type-to-confirm options. Build a `ConfirmDialog` primitive.
6. **Compile/Validation Messaging:** Casting Circle, editors, and Manage modal all surface validation summaries. Reuse a `ValidationPanel` component handling severity icons, anchor links, and CTA disable logic.
7. **Notification/Toast System:** Publish submissions, approvals, billing changes, and runtime warnings feed a shared notification bus with deduping, persistence, and Profile hub linkage.
8. **Autosave Drawer:** World/Entity editors and Casting Circle rely on autosave indicators; share a status widget (e.g., “Saved 2s ago / Syncing...”) tied to the same hook.
9. **Chip-based Filters:** Filter sidebars, modal cross-link chips, author tabs use identical chip styling and logic. Centralize to avoid divergence in interactions (click toggles, keyboard focus).
10. **Action Composer Enhancements:** Future macros (Rest, Observe) and MAS preview can be reused in other text inputs (e.g., bug report, lore editor). Document shared helper functions.

**Next Steps:** 
- Inventory existing component library to see which of the above primitives already exist.
- Create tickets to formalize `ResourceGrid`, `DetailModal`, `StatusBadge`, `TabBar`, `ConfirmDialog`, `ValidationPanel`, and `NotificationCenter`.
- Ensure design tokens cover badges, chips, banners, and states so variants stay consistent across all surfaces.
