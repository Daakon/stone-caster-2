# 07 API Contract

*(StoneCaster / Chimera Engine – MVP)*

This document defines the **public API contract** for the StoneCaster backend: Authoring APIs, Compiler API, Runtime APIs, Embedding APIs, pagination, and the error model.
All JSON examples use **quadruple backticks (````)** to preserve formatting for NotebookLM and editors.

The API emphasizes:

* **Determinism** — strict DTOs and stable shapes
* **Safety** — RLS-enforced access, payload validation
* **Consistency** — DTOs align with Domain & Data Models
* **Predictability** — no ad-hoc model instructions; prompts are compiler-derived

---

# 1. Conventions

* **Base URL**: `https://api.stonecaster.app/v1`
* **Auth**: Bearer JWT in `Authorization` header
* **Content-Type**: `application/json`
* **IDs**: UUID v4
* **Pagination**: Cursor-based (`?limit=&cursor=`). Default `limit=20`, max `100`.
* **Timestamps**: ISO 8601 UTC
* **Errors**: Uniform error envelope (section 11)

---

# 2. Authentication

Authentication is handled by the identity provider (e.g., Supabase Auth). All protected routes require:

```md
Authorization: Bearer <token>
```

**Roles**

* **author** — owns worlds, entities, lore
* **player** — can start and play sessions created from compiled stories
* **admin** — ruleset template management

RLS is enforced at the database layer. Application code must not circumvent RLS.

---

# 3. Resource Model Overview

API resources map to the Data Model:

* **Worlds** — authoring containers
* **Entities** — player or NPC seeds
* **Lore** — RAG-ready fragments
* **Rulesets** — read-only catalog
* **Compiled Stories** — compiler artifacts
* **Sessions** — active play instances
* **Game States** — per-turn snapshots
* **Embeddings** — async jobs and vectors

---

# 4. DTO Summaries (Canonical Shapes)

## 4.1 World DTO

```json
{
  "id": "uuid",
  "author_id": "uuid",
  "title": "Whispercross Alley",
  "summary": "A low-magic alley of intrigue.",
  "genre_tags": ["fantasy", "noir"],
  "ruleset_keys": ["d100-5-pillars", "world-cycle-time-bands"],
  "safety_filters": ["pg13"],
  "created_at": "2025-12-06T00:00:00Z",
  "world_json": {"...": "..."}
}
```

## 4.2 Entity DTO

```json
{
  "id": "uuid",
  "world_id": "uuid",
  "name": "Kiera",
  "tags": ["player"],
  "is_player": true,
  "entity_json": {"stats": {"root_finesse": 60}}
}
```

## 4.3 Lore DTO

```json
{
  "id": "uuid",
  "world_id": "uuid",
  "title": "Guild Keys",
  "visibility": "public",
  "lore_json": {"body": "Ancient keys forged..."}
}
```

## 4.4 Ruleset DTO (read-only)

```json
{
  "id": "uuid",
  "key": "d100-5-pillars",
  "ui_category": "foundation",
  "exclusion_group": "skill_system_root",
  "version": "1.0.0",
  "ruleset_json": {"...": "..."}
}
```

## 4.5 Compiled Story DTO

```json
{
  "story_id": "uuid",
  "world_id": "uuid",
  "version": "1.0.0",
  "compiled_at": "2025-12-06T00:00:00Z",
  "compiled_json": {
    "schema": {"tier0_world": {}, "tier1_entity": {}, "tier2_system": {}},
    "initial_state": {"...": "..."},
    "instructions": {"mas1": {"...": "..."}, "mas2": {"...": "..."}},
    "lore_index": {"retrieval": {"k": 3, "min_score": 0.65}}
  }
}
```

## 4.6 Game State DTO

```json
{
  "session_id": "uuid",
  "story_id": "uuid",
  "turn_index": 3,
  "updated_at": "2025-12-06T00:05:00Z",
  "state_json": {"tier0_world": {"current_time_band": "Deep Night"}}
}
```

---

# 5. Authoring APIs

## 5.1 Create World

`POST /worlds`

```json
{
  "title": "Whispercross Alley",
  "summary": "A city of whispered debts.",
  "genre_tags": ["fantasy", "noir"],
  "ruleset_keys": ["d100-5-pillars", "world-cycle-time-bands"],
  "safety_filters": ["pg13"],
  "world_json": {"world_metadata": {"starting_time_band": "Dusk"}}
}
```

**201 →** World DTO

## 5.2 Get World

`GET /worlds/{world_id}` → World DTO

## 5.3 List Worlds

`GET /worlds?limit=20&cursor=...`

```json
{
  "items": [
    {"id": "uuid", "title": "Whispercross Alley", "created_at": "2025-12-06T00:00:00Z"}
  ],
  "next_cursor": null
}
```

## 5.4 Update World

`PATCH /worlds/{world_id}`

```json
{ "summary": "Updated summary." }
```

**200 →** World DTO

## 5.5 Delete World

`DELETE /worlds/{world_id}` → **204 No Content**

---

## 5.6 Entity APIs

### Create Entity

`POST /entities`

```json
{
  "world_id": "uuid",
  "name": "Kiera",
  "tags": ["player"],
  "is_player": true,
  /* OPTIONAL: Hints to the backend to validate specific schema fields immediately */
  "applied_ruleset_keys": ["vitality-stamina-system"],
  "entity_json": {"stats": {"root_finesse": 60}, "emotional": {"mood": "focused"}}
}
```

**201 →** Entity DTO

### List Entities

`GET /entities?world_id=uuid&limit=20&cursor=...`

### Get Entity

`GET /entities/{entity_id}` → Entity DTO

### Update Entity

`PATCH /entities/{entity_id}`

```json
{ "entity_json": {"defaults": {"current_stamina": 90}} }
```

### Delete Entity

`DELETE /entities/{entity_id}` → **204**

---

## 5.7 Lore APIs

### Create Lore

`POST /lore`

```json
{
  "world_id": "uuid",
  "title": "Guild Keys",
  "visibility": "public",
  "lore_json": {"body": "Ancient locksmiths forged keys that judge intent."}
}
```

**201 →** Lore DTO

### List Lore

`GET /lore?world_id=uuid&limit=20&cursor=...`

### Get Lore

`GET /lore/{lore_id}` → Lore DTO

### Update Lore

`PATCH /lore/{lore_id}`

```json
{ "lore_json": {"body": "Revised body..."} }
```

### Delete Lore

`DELETE /lore/{lore_id}` → **204**

---

# 6. Ruleset Catalog (Read-Only)

### List Rulesets

`GET /rulesets?limit=50&cursor=...`

```json
{
  "items": [
    {"id": "uuid", "key": "d100-5-pillars", "ui_category": "foundation", "exclusion_group": "skill_system_root", "version": "1.0.0"}
  ],
  "next_cursor": null
}
```

### Get Ruleset

`GET /rulesets/{id}` → Ruleset DTO

---

# 7. Compiler API

## 7.1 Compile Story

`POST /chimera/compile`

```json
{
  "world_id": "uuid",
  "selected_ruleset_keys": ["d100-5-pillars", "npc-personalities"],
  "include_entities": true,
  "include_lore": true
}
```

**200 →** Compiled Story DTO

### Error Examples

```json
{"error": {"code": "ruleset_conflict", "message": "Exclusion group violated."}}
```

```json
{"error": {"code": "schema_invalid", "message": "Invalid entity JSON."}}
```

---

# 8. Runtime APIs

## 8.1 Start Session

`POST /play/start`

```json
{
  "story_id": "uuid",
  "player_entity_id": "uuid",
  "seed": 42
}
```

**200 →**

```json
{
  "session_id": "uuid",
  "turn_index": 0,
  "state": {"...": "..."},
  "messages": [ {"role": "system", "content": "Session created"} ]
}
```

## 8.2 Cast Action (Turn Loop)

`POST /play/cast`

```json
{
  "session_id": "uuid",
  "text": "Pick the rusty lock quietly."
}
```

**200 →**

```json
{
  "messages": [
    {"role": "user", "content": "Pick the rusty lock quietly."},
    {"role": "assistant", "content": "The lock gives a reluctant click..."}
  ],
  "state_delta": {
    "tier2_system.current_stamina": -2,
    "tier0_world.current_tick": 1
  },
  "rules_fired": ["resolve_skill_check", "advance_time"],
  "turn_index": 1,
  "updated_state": {"...": "..."}
}
```

### Runtime Error Examples

```json
{"error": {"code": "blocked_by_state", "message": "You are too exhausted to continue."}}
```

```json
{"error": {"code": "invalid_action", "message": "Unable to parse intent."}}
```

## 8.3 Get Session

`GET /play/sessions/{session_id}` → session summary

## 8.4 List Session States

`GET /play/sessions/{session_id}/states?limit=50&cursor=...`

```json
{
  "items": [
    {"turn_index": 0, "updated_at": "2025-12-06T00:01:00Z"},
    {"turn_index": 1, "updated_at": "2025-12-06T00:02:00Z"}
  ],
  "next_cursor": null
}
```

---

# 9. Embedding APIs (Lore RAG)

## 9.1 Trigger Embedding Job

`POST /embed/lore`

```json
{
  "world_id": "uuid"
}
```

**202 →**

```json
{"job_id": "uuid", "status": "queued"}
```

## 9.2 Check Job Status

`GET /embed/jobs/{job_id}`

```json
{
  "job_id": "uuid",
  "status": "succeeded",
  "embedded": 12
}
```

---

# 10. Pagination & Sorting

All list endpoints accept `limit` and `cursor`. Some accept `sort` keys where meaningful (e.g., `created_at desc`). The cursor is opaque to clients.

```json
{
  "items": [ {"id": "uuid"} ],
  "next_cursor": "opaque-string-or-null"
}
```

---

# 11. Error Model (Uniform Envelope)

All failures return **4xx/5xx** with a consistent JSON body:

```json
{
  "error": {
    "code": "string_enum",
    "message": "Human-readable message",
    "details": {"field": "optional structured info"}
  }
}
```

**Common Codes**

* `unauthorized` — missing/invalid token
* `forbidden` — RLS or ownership block
* `not_found` — resource does not exist or not visible
* `validation_error` — payload shape or bounds invalid
* `ruleset_conflict` — exclusion group violation
* `schema_invalid` — invalid domain JSON
* `rate_limit` — too many requests
* `server_error` — unhandled error

---

# 12. Webhooks (Optional, Future)

Reserved for later use (e.g., compile completion, embedding finished). Not required for MVP.

---

# 13. Versioning Policy

* Backward-compatible changes bump **minor** version.
* Breaking changes bump **major** and require migration notes.
* DTOs must retain fields; removals require deprecation window.

---

# 14. Security Notes

* All protected routes use JWT + RLS at the DB layer.
* Authoring write routes validate ownership by `author_id`.
* Compiled stories are immutable; only compiler service may write.
* Sessions and states scoped to the session owner.

---

# 15. Compliance & Logging

* Log request metadata (no player text content) for observability.
* Do not log MAS-2 narration content.
* Support data deletion on user request.

---

# 16. Summary

This API Contract is the canonical interface for StoneCaster MVP. Implementations **must**:

* honor DTO shapes
* enforce RLS
* align with Domain & Data Models
* avoid ad-hoc prompt injection

Any PR changing this contract must also update: Domain Model, Data Model, Test Plan, and Prompt Assembly specs.
