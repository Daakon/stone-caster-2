---
description: Database Change Flow
---

When the task involves SQL, schema, or database behavior:

1. Inspect (via MCP read-only) the relevant objects:
   - target table(s)
   - related tables (FKs)
   - existing indexes
   - constraints
   - RLS policies
   - triggers/functions/views referencing them (if relevant)

2. Summarize findings briefly:
   - current schema shape
   - any risks (locking, missing index, RLS implications)
   - existing patterns used in the repo (naming, versioning, migration style)

3. Propose the smallest viable change.
   - Prefer additive migrations
   - Prefer per-world/per-tenant constraints where appropriate

4. Provide migration SQL.
   - Must be idempotent
   - Include verification queries (SELECT checks)
   - Include rollback guidance when feasible

5. Provide app-layer follow-ups.
   - any code changes needed
   - any backfill steps
   - any RLS policy adjustments needed
