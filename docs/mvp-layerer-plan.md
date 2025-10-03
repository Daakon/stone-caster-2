# StoneCaster — Product-Manager Layered Plan (Tester-Ready MVP to RC)

**Purpose:** Deliver a fully testable product from MVP to Release Candidate using focused, hardened layers. Each layer contains **Objectives**, **Scope & Rules**, and **Acceptance Criteria**. No implementation details or static code—only requirements the team can build and QA against.

---

## Core Principles (apply to all layers)

* **Mobile-first UX** with React + Tailwind.
* **Server-only state**: prompt assembly and full game state never leave the server. Clients receive **UI DTO subsets** only.
* **Accurate Identity**: Authentication via Supabase JWT; no client-supplied IDs for ownership. Optional cookie identity for guests.
* **Config in One Place**: All numeric or toggle values come from a single runtime config source (env/DB). No hard-coded magic numbers.
* **Wrappers Only**: Third-party services (Auth, AI, Payments, Monitoring) are accessed via a single wrapper layer; swappable without refactor.
* **Stone Ledger**: Every change to stone balances (grant, spend, purchase, restore) writes an immutable ledger entry.
* **TDD-first**: Tests/specs are written before implementation. Each layer merges only when all acceptance criteria pass.
* **Security by Design**: DTO redaction, CSRF protection on profile updates, webhook verification, idempotency on spend/turns, minimal data exposure.

---

## Layer M0 — Baseline & Static Content Loader

**Objectives**

* App boots reliably. Testers can fetch the 7 worlds and their adventures/scenarios from **static JSON/TS** embedded in the repo.
* Basic authentication check surface.

**Scope & Rules**

* `/api/content/worlds` returns UI-safe DTOs derived from static content (no editor-only fields).
* `/api/me` reflects authentication state.
* Standard response envelope `{ ok, data?|error?, meta }` with trace identifier on all endpoints.

**Acceptance Criteria**

* Content endpoint returns only fields the UI uses; unknown fields are omitted.
* `/api/me` returns expected user/null structure.
* Envelope and traceId appear on all responses.

---

## Layer M1 — Characters & Wallet Foundations

**Objectives**

* Testers can create/manage **Characters** (guest or auth). Characters belong to a **World**.
* Display a simple **Casting Stones** balance for authenticated users.

**Scope & Rules**

* Characters require a valid `worldSlug` (must match static content).
* Casting Stones balance readable for authenticated users; no purchases or conversions yet.
* Ledger exists and will be used when stones change in later layers.

**Acceptance Criteria**

* Character CRUD works with correct ownership (guest/auth) and valid world membership.
* Invalid `worldSlug` is rejected.
* Wallet read returns a Casting Stones balance for authenticated users; guests may be out of scope here.

---

## Layer M2 — Game Spawn & Single-Active Constraint

**Objectives**

* Testers can **spawn** a game from an adventure and later **resume**.
* Enforce: one character can be **active on only one game** at a time.
* Establish the **guest-first** flow: browsing and first play do **not** require an account.

**Scope & Rules**

* `POST /api/games` with `{ adventureSlug, characterId? }` succeeds for **guest (cookie)** or **authenticated** owners.
* Adventure must belong to the character’s world; invalid slugs rejected.
* On first play (if configured), grant starter stones (config-driven) to enable initial turns.
* **Owner resolution is server-only**: JWT → user owner; else httpOnly cookie → guest owner; never accept IDs from client.
* Spawning as guest does **not** force account creation.
* A character may be **active on one game**; spawning another with same character returns conflict.

**Acceptance Criteria**

* Game spawns end-to-end for a guest (cookie) without creating an account; `GET /api/games/:id` returns DTO.
* Game spawns end-to-end for an authenticated user with identical behavior.
* Second spawn attempt with active character → conflict error.
* Starter stones grant (if enabled) appears for the correct owner; no leakage of internal state.
* No prompts to sign up during spawn; auth prompts appear only at gated actions (see M6/M7).

---

## Layer M3 — Turn Engine (Buffered AI, Spend, Idempotency)

**Objectives**

* Fully playable **turn loop** for both guest and authenticated owners.
* Ensure the route **never streams**; backend buffers AI JSON, applies state, then returns a single DTO.

**Scope & Rules**

* Turns consume **Casting Stones** at a config-defined cost for **both** guest and authenticated owners; all spends append ledger entries.
* Turn requests require an **Idempotency-Key** and are atomic.
* Prompt assembly is **server-only** (string templates for MVP) and version-checked.
* **No front-end streaming**: a single validated DTO is returned per turn with story blocks, next choices, display-safe relationship/faction changes, and updated stone balance.
* Guests can take turns while stones remain; **Save/Continue/Purchase/Profile** actions remain **gated** (see M6/M7/M8).

**Acceptance Criteria**

* Guest turn succeeds with correct stone spend and ledger write; authenticated turn behaves identically.
* Missing or duplicate idempotency key handled correctly (no double-spend; consistent response).
* Insufficient stones → clear error; no state advancement or ledger spend.
* Response is **one** complete DTO (no partials/streams) and never exposes internal state or prompt text.

---

## Layer M4 — Play UI (Mobile-First)

**Objectives**

* Deliver a **Unified Player** suitable for playtesting on mobile: story stream, choices with visible cost, stones badge, and adventure header.

**Scope & Rules**

* **No front-end streaming.** The backend receives a **full JSON turn result from AI**, applies server-side state changes (story text, relationship/faction deltas, any flags), and returns a **single DTO response** to the UI.
* UI renders only the DTO subset: story text blocks, choice list (ids/labels), surfaced relationship/faction changes (display-safe), current stone balance, and lightweight game metadata.
* UI never builds prompts or infers hidden state; no partial/incremental render per turn.
* Clear error and retry states for turn failures and network issues.

**Acceptance Criteria**

* On taking a turn, the UI shows a single update based on the **server-processed DTO** (no intermediate/streamed frames).
* DTO includes: new story blocks, available choices, and any **display-ready relationship/faction changes** (if present), along with updated stone count.
* No internal fields (full `state_snapshot`, prompt text, internal flags) are exposed to the client.
* Testers can sign in, select an adventure, spawn a game, and complete multiple turns with responsive feedback on mobile.

---

## Layer M5 — Hardening & QA Readiness

**Objectives**

* Improve reliability and diagnosability for playtests.

**Scope & Rules**

* Add structured logs with traceId for requests and errors.
* Optional telemetry endpoint (feature-flagged, sampled via config).
* Provide a simple tester runbook (how to sign in, start, take turns, report issues).

**Acceptance Criteria**

* Logs contain route, status, latency, and error code (if any).
* Telemetry (if enabled) records events without exposing sensitive data.
* Documentation is sufficient for testers to onboard themselves.

---

## Layer M6 — Profiles & Account Safety

**Objectives**

* Testers can view/update **Profile** data and manage sessions.
* Establish the **upgrade path**: convert an active **guest** session into an **authenticated** account **on-demand** (when the user invokes gated actions like Save/Continue/Purchase/Profile).

**Scope & Rules**

* All profile actions require authentication; unauthenticated requests are blocked.
* **Guest→Auth Linking** occurs immediately after successful sign-in:

  * Current device’s guest-owned games and stone balance are **linked/merged** into the authenticated account internally.
  * A ledger entry records the merge (e.g., `LINK_MERGE`).
  * Operation is **idempotent** and never exposes cookie/group IDs to clients.
* Profile updates are protected from CSRF/misuse via a clear, testable mechanism.
* DTO redaction applies: no provider IDs, tokens, or internal flags.
* Optional: ability to **revoke other sessions** for the account.

**Acceptance Criteria**

* From an active guest game, signing in returns the tester to the same game; ownership is now the authenticated user.
* Guest stones and games appear under the user after linking; ledger includes a single `LINK_MERGE` entry; repeating the link produces no duplicates.
* Profile read/update works with strict validation and CSRF protection; unauthenticated requests are blocked.
* Attempting a gated action while guest (e.g., list my games, save slot, purchase) returns a clear `REQUIRES_AUTH` error; after sign-in, the same action succeeds without data loss.

---

## Layer M7 — Save Games Management (Cloud Saves)

**Objectives**

* Reliable **save and resume** with automatic checkpoints and manual save slots.
* Reinforce the **auth gate**: Save/Continue requires authentication, but an **active guest** can upgrade mid-session without losing progress.

**Scope & Rules**

* Every successful turn writes an automatic checkpoint server-side (no client exposure of raw snapshots).
* **Manual save slots** can be created, listed, and restored **by authenticated owners only**.
* Guests attempting Save/Continue are prompted to authenticate; upon success, their **current guest game** is linked to the account and the save operation proceeds.
* Restores are auditable and append to the ledger (e.g., `RESTORE`) if stones/state implications apply; history is not erased.
* Client sees only slot metadata (labels/timestamps), never full snapshots.

**Acceptance Criteria**

* As guest: playing and then tapping **Save/Continue** yields `REQUIRES_AUTH`; after sign-in, the same action succeeds and the existing guest game is preserved under the user.
* Manual save slot creation, listing, and restore work for authenticated users only; unauthorized attempts are blocked.
* Restoring a slot deterministically returns the game to the saved state; subsequent turns continue from there.
* No internal snapshots or hidden state are exposed to clients at any point.

---

## Layer M8 — Payments & Stone Purchases (Test-Mode)

**Objectives**

* Allow testers to **purchase stones in test mode** to continue play without manual grants.

**Scope & Rules**

* List purchasable packs from config; create a checkout session through a **payments wrapper** (e.g., Stripe behind abstraction).
* Process webhooks securely (signature verification in wrapper) and credit stones accordingly.
* All mutations append ledger entries (e.g., `PURCHASE`).
* Client responses never expose provider-specific IDs or secrets.

**Acceptance Criteria**

* Testers can complete a test-mode purchase and see their stone balance increase.
* Invalid signatures are rejected; no credit applied.
* Ledger reflects accurate deltas and reasons.

---

## Layer M9 — Prompt System Hardening & Safety

**Objectives**

* Make prompt building robust, auditable, and safe for accounts and IP.

**Scope & Rules**

* **Allowlisted variables** only in templates (world/adventure/scenario metadata, server summary, character traits, last choice).
* Enforce **schema version** compatibility (template must match current app schema version).
* Maintain a **prompt audit log** (template id/version/hash used per turn) without storing raw prompt text in client-facing responses.
* Add a **PII guard** to remove profile identifiers (e.g., emails, usernames) from prompt context.
* Strengthen AI JSON validation with an optional repair/strict mode and failure metrics.

**Acceptance Criteria**

* Templates referencing out-of-scope variables are rejected before use.
* Mismatched schema versions are denied; matching versions proceed.
* Audit log entries exist for each turn, with verifiable template hashes.
* No personal identifiers appear in prompt context.

---

## Layer M10 — Release Candidate QA Suite

**Objectives**

* Validate the product for wider testing: performance, security, and reliability.

**Scope & Rules**

* Load tests for key flows: sign in → spawn → 3 turns → save.
* Security checks: authZ correctness, CSRF effectiveness for profile, webhook verification for payments.
* Regression suite for characters, games, turns, saves, purchases.
* Resilience tests: AI failure handling, DB restart behavior, idempotency under retries.

**Acceptance Criteria**

* Performance meets acceptable thresholds (document p95 latency targets).
* No data leakage across accounts; all ownership checks pass.
* End-to-end scenarios are green; recovery from transient failures is correct.

---

## Global Acceptance for Tester-Ready Release

* **End-to-end gameplay is reliable**: sign in → create character → spawn → take turns → save → resume → optional test purchase.
* **Account safety** and identity accuracy are ensured (no cross-account access, CSRF protections, revocable sessions).
* **Purchases** credit stones in test mode and are auditable via the ledger.
* **Prompts** are assembled server-side with strict validation and no leakage.
* **DTO redaction** is enforced on all endpoints.
* **Documentation** gives testers clear instructions to play and report issues.

> After RC, move static content to DB in phases, add feature-flag controls to enable richer worlds, and consider WebSockets for push updates once stability is proven.
