# World-First Publishing Implementation Plan

The goal is to enforce that every publicly accessible Story or NPC references a public World while preserving private play, giving admins full control, and surfacing actionable messaging and telemetry. This plan translates the policy defined in `world_first_publish_rules.md` into phased delivery workstreams.

## Phase 0 – Discovery & Technical Alignment
**Objectives**
- Confirm scope, owners, rollout expectations, and cross-team dependencies.

**Workstreams**
- Product + Engineering review of `world_first_publish_rules.md` to agree on MVP vs improvements backlog.
- Architecture spike on data-model impact (new fields, migrations, versioning, parent-child relationships).
- Security/privacy review to ensure admin-only approval tooling matches compliance expectations.
- Define success metrics aligned with telemetry events (`publish.requested`, `publish.blocked`, etc.).
- Document backward-compatibility expectations for legacy content.

**Exit Criteria**
- Approved design brief, architecture notes, and resource allocation.
- Tickets created per workstream with estimates.

## Phase 1 – Data Model & Persistence
**Objectives**
- Introduce schema primitives required for gating logic and audit history.

**Workstreams**
- Database migrations:
  - Ensure `visibility`, `review_state`, `owner_user_id`, `version`, `parent_id`, `review_reason`, `reviewed_by`, `reviewed_at` exist for Worlds/Stories/NPCs (add missing columns + indexes).
  - Add `dependency_invalid` (bool, default false) and `blocked_reason` (nullable string) to Stories/NPCs.
- Update ORM/entities and serialization contracts to surface new fields.
- Seed default values for legacy rows (e.g., mark existing public items as `review_state = approved`).
- Add data access layer helpers for combined review + visibility state mutations (atomic transactions).

**Exit Criteria**
- Migrations applied in lower envs with rollback plans.
- Unit tests cover new persistence logic and defaulting behavior.

## Phase 2 – Owner-Facing Submission Flow
**Objectives**
- Ensure creators can save drafts and request publication while respecting dependency gates.

**Workstreams**
- API validation: Stories/NPCs check parent World visibility before accepting `request publish`; respond with 422 `WORLD_NOT_PUBLIC`.
- Quota enforcement for World/Story/NPC creation (1/3/6) with friendly error payloads.
- UI updates in builder/wizard:
  - Primary actions `Save draft`, `Request publish` for Worlds.
  - Conditional enablement for Story/NPC publish button; disabled state shows `"Publishing requires world {{WorldName}} to be public."` with deep link.
- Private play allowance: confirm session/game launch bypasses publish gate when `owner_user_id == current_user`.
- Add client + API integration tests for disabled state, error copy, and draft → pending transitions.

**Exit Criteria**
- Designers sign off on messaging and button states.
- Manual QA verifies private play unaffected and blocked submissions display correct guidance.

## Phase 3 – Admin Review Experience
**Objectives**
- Build review queue and moderation controls that enforce world-first approvals.

**Workstreams**
- Backend workflow:
  - Admin-only endpoints to approve/reject/request changes; revalidate that referenced World is `public` at decision time.
  - Record `review_reason`, `reviewed_by`, `reviewed_at` on every decision; send notifications to owners.
- Admin UI:
  - Submissions queue filters by type (`World`, `Story`, `NPC`) and dependency status.
  - Dependency ribbon (e.g., `"World is pending"` vs `"World is public"`).
  - Disable approval CTA if World is not public with copy `"Approval blocked: World {{WorldName}} is not public."`.
  - Provide navigation links to the World submission.
- Build regression tests covering approve/reject/unpublish flows.

**Exit Criteria**
- Admin reviewers complete scripted test passes with real data fixtures.
- Audit logs confirm state transitions and reasons are captured.

## Phase 4 – Dependency Monitoring & Launch Guards
**Objectives**
- Keep public content in sync with parent World status and prevent invalid launches.

**Workstreams**
- Background job or event listener for World visibility changes:
  - On World unpublish, flag dependent Stories/NPCs with `dependency_invalid = true`, set `blocked_reason`.
  - On World republish, clear flags and notify owners (`"World is now public—request publish."` toast/email).
- Catalog/API filters ensure only `visibility = public AND dependency_invalid = false` items surface.
- Game launch service enforces: public starts blocked when `dependency_invalid = true` with message `"This story is unavailable because its world isn't public."`; private launches bypass.
- Instrument telemetry events `dependency.invalid.set/cleared`.
- Unit/integration tests for dependency toggling and launch guard.

**Exit Criteria**
- Simulated world-unpublish cascade behaves as expected in staging.
- No catalog exposure of invalid content confirmed via automated tests.

## Phase 5 – Messaging, Notifications, and Telemetry
**Objectives**
- Provide consistent user feedback and observability throughout the workflow.

**Workstreams**
- Surface error strings defined in the rules document across API responses, UI toasts, and disabled states.
- Owner notification pipeline for admin decisions (email + in-app inbox).
- Emit telemetry events: `publish.requested`, `publish.blocked`, `admin.review.approved/rejected`, `dependency.invalid.set/cleared` with required payloads (`type`, `id`, `worldId`, `decision_ms`).
- Add dashboards or alerting for spikes in blocked submissions.
- Validate analytics schema updates with data engineering.

**Exit Criteria**
- QA verifies copy accuracy and localization hooks.
- Telemetry events visible in observability stack with sample records.

## Phase 6 – Rollout, QA, and Post-Launch
**Objectives**
- Safely deploy and monitor the feature with clear rollback strategy.

**Workstreams**
- Create feature flag(s) for:
  - Owner-side publish gate enforcement.
  - Admin queue dependency checks.
  - Dependency invalidation job + launch guards.
- Regression + smoke test plans covering drafts, approvals, unpublishes, private play scenarios.
- Staged rollout (internal → beta creators → GA) with feedback checkpoints.
- Post-launch monitoring of telemetry and support tickets; triage backlog for enhancements (e.g., forks/clones dependency re-evaluation).
- Documentation updates for creators/admins and internal runbooks.

**Exit Criteria**
- Feature fully enabled in production with KPIs meeting targets.
- Post-launch review logged with lessons learned and next-iteration backlog.
