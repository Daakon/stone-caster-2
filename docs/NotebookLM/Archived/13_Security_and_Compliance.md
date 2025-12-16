# 13 Security and Compliance

*(StoneCaster / Chimera Engine – MVP)*

This document defines the **security model**, **compliance requirements**, **data protection rules**, and **runtime safety layers** for StoneCaster.
It ensures that the system is safe for users, safe for authors, and safe for deployment across internal and external environments.

Security here refers to **infrastructure, access control, runtime validation, data handling, and model safety**.

---

# 1. Security Philosophy

StoneCaster follows a **multi-layer, zero-trust inspired** design:

1. **All data access is intentionally restricted by RLS (Row Level Security)** in PostgreSQL.
2. **Application code should not trust LLM output** beyond strict schema validation.
3. **Compiled stories are immutable**, eliminating mutation-based attacks or drift.
4. **Ruleset templates are read-only** for non-admin users.
5. **Player sessions are sandboxed** to their own story and state.

The system assumes:

* Any API input may be malicious.
* Any LLM output may break format unless validated.
* Any external file (lore, world content) may contain unsafe content.

---

# 2. Data Classification

```md
Public Data
  • Ruleset catalog (read-only)
  • Public lore (visibility = public)

Protected Data
  • Worlds (owned by author)
  • Entities (belong to an author’s world)
  • Compiled stories (playable but immutable)
  • Player sessions and states

Restricted / Internal
  • Admin ruleset authoring
  • Internal metrics, logs, embeddings
```

---

# 3. Authentication & Authorization Model

## 3.1 Authentication

Performed by Supabase Auth (JWT). All API calls include:

```md
Authorization: Bearer <token>
```

## 3.2 Authorization

RLS governs all access. The application cannot bypass RLS.

### Core Rules:

* **Worlds** → only owner can read/write.
* **Entities** → only owner of parent world.
* **Lore** → only owner unless visibility=public.
* **Compiled Stories** → read for all players, write for compiler only.
* **Sessions** → owner-only.
* **Game States** → owner-only.

---

# 4. RLS Policies (Summaries)

### Worlds

```sql
policy "world_owner_read" on chimera_worlds
  for select using (author_id = auth.uid());
policy "world_owner_write" on chimera_worlds
  for all using (author_id = auth.uid());
```

### Entities, Lore

Inherited from world ownership.

```sql
using (world_id in (select id from chimera_worlds where author_id = auth.uid()));
```

### Compiled Stories

* SELECT allowed to all authenticated users.
* INSERT only by server function.

### Sessions & Game States

```sql
using (player_entity_id in (select id from chimera_entities where world_id in (select id from chimera_worlds where author_id = auth.uid())));
```

---

# 5. Input Validation & Sanitization

### 5.1 All external-facing APIs must validate:

* world_id, entity_id, story_id are valid UUIDs
* payload JSON matches schema
* no extra fields allowed
* lengths bounded (title, summary, lore body, etc.)

### 5.2 LLM input sanitization

Before sending any text to MAS-1 or MAS-2:

* Trim whitespace
* Enforce max length (e.g., 800 chars)
* Escape unsafe characters when needed

---

# 6. LLM Output Validation (Strict)

Every MAS output must be validated before use.

## 6.1 MAS-1 Validation

Checks:

* JSON must parse
* Keys must match exactly
* `intent` must be known
* `skill_id` must be valid
* If `blocked_reason` non-null, ignore other fields

## 6.2 MAS-2 Validation

Checks:

* JSON must parse
* Must contain `narration`
* Narration must be text only, no HTML/script
* Sentence count ≤ 6
* No disallowed words (see Style Guide)
* Must not leak mechanics

If invalid → regenerate with stricter prompt.

---

# 7. Content Safety Filters (PG, PG-13, R-lite)

### 7.1 Global Filters

Stories can define:

* violence level
* profanity level
* suggestive content level

### 7.2 MAS-2 Enforcement

MAS-2 receives safety constraints like:

```json
{
  "forbidden_topics": ["explicit gore", "sexual content"],
  "allowed_intensity": "pg13"
}
```

Narration must comply.

### 7.3 Hard Restrictions

MAS-2 must not:

* generate graphic violence
* produce sexual content
* generate slurs or hate speech
* create vulnerable personal data (PII)

---

# 8. Compiler Security Responsibilities

Compiler must:

* Validate ruleset definitions
* Prevent state path collisions
* Ensure instruction bundles are safe
* Ensure no ruleset injects harmful content

Compiler-produced instructions must be:

* fully deterministic
* free from arbitrary user content
* validated against schemas

---

# 9. Engine Security Responsibilities

Engine must:

* Not accept invalid MAS-1 outputs
* Never call MAS-2 with unsafe or incomplete state
* Ensure stamina/hunger/etc. constraints are enforced

Engine is pure code and therefore inherently safer than LLM layers.

---

# 10. Database Security

### 10.1 Principles

* Never return JSONB that includes another user's data
* All writes checked by RLS
* Embeddings table not accessible to end users

### 10.2 Index Security

Ensure no leak through index inference.
Example: hide private lore titles (store hashed title for indexing if necessary).

---

# 11. API Security Hardening

* Rate limiting by IP and user
* Input-size throttling
* Circuit breakers for LLM calls
* Logging of anomalous action patterns

Example API rejection:

```json
{
  "error": {
    "code": "rate_limit",
    "message": "Too many requests. Please slow down."
  }
}
```

---

# 12. User Data Protection

### 12.1 Data Retention

* Worlds kept until deleted by user
* Sessions kept until archived or removed
* Embeddings deletable when parent lore is deleted

### 12.2 PII Policy

StoneCaster should store **no personally identifiable information** beyond an email used by Auth.

### 12.3 Backups & Encryption

* Automated backups daily
* Data encrypted in transit (TLS)
* Data encrypted at rest (Postgres native or platform encryption)

---

# 13. Logging & Monitoring

Log categories:

* API calls (excluding player text content)
* MAS-1/2 failures (no raw narration logged)
* Engine errors
* DB errors

PII and narrative content are excluded by design.

---

# 14. Threat Model Summary

### Primary Threats

* Unauthorized access to worlds/entities
* Injection of malicious content into LLM
* Prompt-injection attacks
* Schema poisoning through invalid JSON
* Story hijacking by manipulating MAS outputs

### Mitigations

* RLS and strict auth
* Schema validation on all LLM outputs
* Hard narrative guardrails
* Compiler-validated rulesets only
* Token limits in prompts

---

# 15. Compliance Considerations (MVP)

### Covers:

* GDPR-light (user data deletion)
* COPPA avoidance (do not target minors)
* Content safety (OpenAI guidelines)

### Not Required for MVP:

* HIPAA
* SOC2
* PCI

These may become relevant for enterprise versions.

---

# 16. Summary

StoneCaster security is based on:

* **Zero-trust RLS enforcement**
* **Strict schema validation** for all AI output
* **Immutable compiled stories**
* **Ruleset-level safety and tone binding**
* **Minimal PII storage and encrypted data flows**

This document represents the **official
