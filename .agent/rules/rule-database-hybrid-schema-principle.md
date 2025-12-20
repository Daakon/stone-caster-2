Per `docs/CHIMERA_ARCHITECTURE_SPEC.md`, the database follows a **Hybrid Schema Principle**.

- **SQL Columns**: Use for fields that require indexing for fast filtering and querying (e.g., `name`, `slug`, `visibility`, `owner_user_id`, `status`).
- **JSONB `definition` field**: Use for the complete, canonical object definition that does not require indexing for `WHERE` clauses.

**Rule**: When modifying a database table, if a new field needs to be used in a `WHERE` clause, `ORDER BY`, or `JOIN`, you MUST add it as a new SQL column and create a migration. Do not add it to the JSONB `definition` and attempt to query it directly.