---
trigger: always_on
---

All SQL migrations must be Postgres compatible and safe to re-run.
Prefer idempotent patterns: IF EXISTS / IF NOT EXISTS, DO blocks, safe indexes.
Avoid heavy locks unless explicitly accepted.
