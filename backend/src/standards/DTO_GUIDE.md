# Backend Standard: DTOs & Anti-Corruption Layers

## The "Law" of Phase 13
As we move into the Game Engine phase, strict typing is non-negotiable.

### Rule #1: No Raw DB Rows in Services
Services must NEVER accept raw database rows (Supabase types) directly in their public methods.
*   **BAD:** `processRuleset(row: any)`
*   **GOOD:** `processRuleset(ruleset: RulesetDTO)`

### Rule #2: Zod is the Anti-Corruption Layer (ACL)
Data entering the system from the Database (Supabase) acts as "external input" just like a user API request. It must be sanitized.
*   Supabase often returns `JSONB` columns as **strings** (depending on client config).
*   Your Code expects **objects**.

**The Pattern:**
Use Zod schemas with `z.preprocess()` to automatically parse JSON strings into objects at the boundary.

#### Example: `standards.schemas.ts`

```typescript
import { z } from 'zod';

// Helper for Robust JSON Parsing
const jsonHelper = (schema: z.ZodTypeAny) =>
  z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        // Handle double-encoded strings
        return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
      } catch {
        return val;
      }
    }
    return val;
  }, schema);

// Standard Entity Schema
export const EntitySchema = z.object({
  id: z.string().uuid(),
  // "raw_data" is JSONB in DB. We force it to be an object here.
  raw_data: jsonHelper(z.record(z.unknown())).default({}),
  world_id: z.string().uuid()
});

export type EntityDTO = z.infer<typeof EntitySchema>;
```

### Rule #3: Fail Fast, Fail Loud
If a DB row violates the schema (e.g., missing required fields for the Engine), throw a strict `ServiceError` immediately. Do not propagate `undefined` deeply into the engine logic.
