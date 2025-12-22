import { z } from 'zod';

// Robust JSON Transform: Tries to parse strings, handles double-encoding, defaults to empty object on failure or original value
const JsonOrObject = z.custom<any>((val) => true).transform((val) => {
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            // Handle double-stringification (common in Supabase JSONB)
            return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
        } catch { return {}; }
    }
    return val;
});

export const RulesetSchema = z.object({
    id: z.string(),
    key: z.string().optional(),  // The DB Column 'key' (often used for lookups)
    name: z.string().optional(), // The DB Column 'name' (often the user-facing name)
    definition: JsonOrObject.pipe(z.object({
        name: z.string().optional(), // The Internal Name within definition
        actions: z.record(z.any()).optional(),
        state_contributions: z.record(z.any()).optional(),
        ai_instructions: z.record(z.any()).optional() // Use record(any) to be permissive so we don't drop data
    }))
});

export type RulesetDTO = z.infer<typeof RulesetSchema>;
