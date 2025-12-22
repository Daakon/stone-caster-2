---
description: Refactor Route to Service
---

## Step 1: Repo vs Service Check
- **Repository**: Code that answers \"How do I query Supabase?\" (SQL, .from, .select).
- **Service**: Code that answers \"What does the app do?\" (Validation, Orchestration, Transforms).

## Step 2: Slice Isolation
Identify ONE logical block to move (e.g. \"Retry Logic\").
1. Create/Open \ackend/src/services/[Domain].service.ts\.
2. Move the logic into a typed method: \sync method(ctx, input): Promise<Output>\.
3. Replace the block in the route with \wait Service.method()\.

## Step 3: Characterization Test (Safe Refactor)
Before saving:
1. Trigger the endpoint with a sample payload.
2. Save the **exact JSON response**.
3. Apply changes.
4. Trigger again.
5. Diff the JSON. **Must be identical.**

## Step 4: Final Cleanup
- Remove unused imports (\supabaseAdmin\, utils) from the route file.
- Verify linting passes.
