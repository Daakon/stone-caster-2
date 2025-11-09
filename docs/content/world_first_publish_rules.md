# World-First Publishing and Privacy Rules

## 1. Publishing Policy
- **Owner request required:** Only the owner can request publication of a World, Story, or NPC. No automatic publishing.
- **Dependency gate:**
  - A Story or NPC cannot be published or requested for publish unless its World is already public.
  - If the World is private, pending, or rejected, the system blocks the request with an explanation.
- **Admin approval required:** All publish requests go to the Admin Review queue. Admins can approve, reject (with reason), or request changes.
- **Private items playable:** Owners can always play their own private Stories that use their private Worlds and NPCs.

## 2. Object States
Each object (World, Story, NPC) includes:
- `visibility`: `private | public`
- `review_state`: `draft | pending_review | approved | rejected`
- `owner_user_id`
- `version`, `parent_id` (for re-publishing)
- `review_reason`, `reviewed_by`, `reviewed_at`

### Transitions
- **Request publish (owner):** `draft → pending_review`
- **Approve (admin):** `pending_review → approved` and `visibility = public`
- **Reject (admin):** `pending_review → rejected` with reason, visibility stays private.
- **Unpublish (admin):** `public → private` with reason; review_state remains `approved`.

## 3. Dependency Rules
- **Story publishable?** Only if `world.visibility == public`.
- **NPC publishable?** Only if `world.visibility == public`.
- **On unpublish World:** dependent public Stories and NPCs marked `dependency_invalid = true`. They stay visible but not launchable until the World returns to public.

## 4. Player (Owner) Experience
### Wizard / Editor Review Step
- **World:** Buttons: `Save draft`, `Request publish`.
- **Story/NPC:**
  - If World is public: `Request publish` enabled.
  - If not: disabled with message *"Publishing requires world {{WorldName}} to be public."* and quick link to that World.

### Library & Quotas
- Default quotas: 1 World, 3 Stories, 6 NPCs (all private by default).

## 5. Admin Experience
### Submissions Queue
- Filters by type and dependency status.
- Shows dependency ribbon: *"World is pending"* or *"World is public"*.
- Approve/Reject/Request Changes buttons.
- Approval disabled if World not public.
- Linked navigation to referenced World submission.

## 6. API and Validation
- **Submit (owner):**
  - World: allowed if within quota.
  - Story/NPC: blocked if World not public (422 `WORLD_NOT_PUBLIC`).
- **Admin Review:**
  - Re-validate world visibility before approving.
- **Catalog:** only `visibility = public` and dependency-valid items appear.
- **Game Launch:** blocks public start of dependency-invalid content; private play allowed.

## 7. Data Model Additions
- `dependency_invalid` (bool) for Stories/NPCs, true if referenced public World becomes non-public.
- `blocked_reason` (string) optional.

## 8. Messaging
- On Story/NPC submit button (disabled): *"To publish {{Item}}, first publish its world {{WorldName}}."*
- On admin Story/NPC review: *"Approval blocked: World {{WorldName}} is not public."*
- On public launch attempt with invalid dependency: *"This story is unavailable because its world isn’t public."*

## 9. Telemetry
- `publish.requested` `{ type, id }`
- `publish.blocked` `{ type, id, reason: WORLD_NOT_PUBLIC }`
- `admin.review.{approved|rejected}` `{ type, id, decision_ms }`
- `dependency.invalid.{set|cleared}` `{ type, id, worldId }`

## 10. Edge Cases
- **World approved after Story/NPC blocked:** show toast *"World is now public—request publish."*
- **World unpublished after dependent item public:** mark dependent `dependency_invalid=true` until resolved.
- **Forks/clones:** re-evaluate dependencies on save.

## 11. Rollout Plan
1. Add validations and disabled UI for Story/NPC submit when World not public.
2. Add admin re-validation at approval time.
3. Add `dependency_invalid` marker and launch-time guard.
4. Update submission filters and ribbons.
5. Add notifications for decisions and dependency changes.

## 12. Outcomes
- **World-first publishing:** no Story or NPC can be public without a public World.
- **Private playability:** owners can play their private Worlds, Stories, and NPCs anytime.
- **Admin control:** centralized review queue for all publish requests.
- **Clear user feedback:** guided errors and quick links to required actions.

