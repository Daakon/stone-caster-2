---
description: "The single source of truth for all database changes, from inspection to migration."
---
When a task involves SQL, schema changes, or database queries, you must follow this workflow strictly. You have read-only access to the database to verify its state.

### 1. Inspect and Verify (No Assumptions)
Before proposing any change, you MUST inspect the current state of the database. Do not assume table names, column types, or constraints.
   - **What to Inspect**: Use your tools to check the target table(s), related tables (via foreign keys), existing indexes, constraints, RLS policies, and any views or functions that might be affected.
   - **Cite Your Evidence**: After inspecting, you must summarize your findings. For example: "I have confirmed that the `profiles` table has a `user_id` column of type UUID." Do not claim to have "confirmed" something unless you have actually checked it. If you cannot inspect the database for any reason, state this clearly.

### 2. Propose the Change
Based on your inspection, propose the smallest viable change to accomplish the goal.
   - **Summarize Risks**: Briefly note any potential risks (e.g., table locking during migration, performance impact of a missing index, RLS implications).
   - **Follow Patterns**: Adhere to existing patterns in the database (naming conventions, migration style, etc.).
   - **Prefer Additive Changes**: It is safer to add new columns or tables than to modify or drop existing ones.

### 3. Provide Migration SQL
If the change requires a database migration, provide the complete, runnable SQL script.
   - **Idempotency is Required**: The script must be safe to re-run. Use `IF NOT EXISTS`, `IF EXISTS`, `CREATE OR REPLACE`, and `DO` blocks to prevent errors on repeated execution.
   - **Include Verification**: Add `SELECT` statements or other queries to your proposed script to verify that the change was applied correctly.
   - **Consider Rollbacks**: Where feasible, provide guidance or a script for rolling back the change.

### 4. Detail Application Layer Follow-ups
A database change is rarely isolated. You must also detail the required changes in the application code.
   - **Code Changes**: What repositories, services, or DTOs need to be updated?
   - **RLS Policy Adjustments**: Does the code change require a corresponding change to a Row Level Security policy?
   - **Data Backfill**: Does existing data need to be updated after the schema change? If so, outline the backfill strategy.