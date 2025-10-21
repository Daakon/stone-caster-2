# JSON Protocol (stub v1)

**Date**: 2025-01-21  
**Phase**: 0 - Config & Safety  
**Status**: Stub (will be finalized in Phase 3)

---

## Overview

The model **MUST** return a single JSON object matching `LlmResultV1` (defined in code).

### Constraints

- **Non-streaming**: Complete JSON payload returned at once (no token streaming)
- **No markdown fences**: Raw JSON only (no ` ```json ` wrappers)
- **No extra keys**: Only fields defined in schema are permitted
- **Strict validation**: All responses validated against Zod schema before processing

---

## Schema Definition

> **TODO**: Phase 3 will finalize schema and link to `src/model/jsonSchema.ts`

**Current reference**: `shared/src/types/api.ts:137-161` - `TurnResponseSchema`

### Expected Structure (preliminary)

```typescript
{
  narrative: string;           // Main story text (1-10000 chars)
  emotion: string;             // One of: neutral, happy, sad, angry, fearful, surprised, excited
  choices: Array<{             // AI-generated player choices (max 10)
    id: string;                // UUID
    label: string;             // Choice label (1-100 chars)
    description?: string;      // Optional description (max 500 chars)
  }>;
  npcResponses?: Array<{       // Optional NPC dialogue (max 20)
    npcId: string;             // NPC identifier
    response: string;          // NPC dialogue (max 1000 chars)
    emotion: string;           // NPC emotion
  }>;
  worldStateChanges?: Record<string, unknown>;  // Optional state mutations
  relationshipDeltas?: Record<string, number>;  // Optional NPC relationship changes (-100 to +100)
  factionDeltas?: Record<string, number>;       // Optional faction standing changes (-100 to +100)
  debug?: {                    // Optional debug information
    promptState?: Record<string, unknown>;
    promptText?: string;
    aiResponseRaw?: string;
    processingTime?: number;
    tokenCount?: number;
  };
}
```

---

## Validation Rules

### Phase 1 (Gemini Adapter)

1. Gemini API called with `response_format: { type: "json_object" }`
2. Response must be valid JSON (no parsing errors)
3. Response must contain all required fields
4. Field types must match schema

### Phase 3 (Strict Validation)

1. All Phase 1 rules
2. String length constraints enforced
3. Array length constraints enforced
4. Numeric range constraints enforced
5. Unknown keys rejected
6. Invalid enum values rejected

---

## Error Handling

### Invalid JSON

**Behavior**: 
1. Attempt auto-repair via `OpenAIService.repairJSONResponse` (once)
2. If repair fails, return 422 VALIDATION_FAILED with raw response in `details`

**Example error response**:
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid JSON response from model",
    "details": {
      "raw": "{ narrative: 'missing quotes'... }",
      "parseError": "Unexpected token 'n'..."
    }
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

### Schema Validation Failure

**Behavior**: Return 422 VALIDATION_FAILED with Zod error details

**Example error response**:
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Response failed schema validation",
    "details": {
      "issues": [
        {
          "path": ["narrative"],
          "message": "String must contain at least 1 character(s)"
        }
      ]
    }
  },
  "meta": {
    "traceId": "uuid"
  }
}
```

---

## Examples

### Valid Response

```json
{
  "narrative": "The ancient forest whispers secrets as you step into the Whispering Woods. Mist swirls around your feet, and distant crystal chimes echo through the trees. What do you do?",
  "emotion": "neutral",
  "choices": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "label": "Follow the sound of the chimes",
      "description": "The crystal chimes seem to be calling you deeper into the forest."
    },
    {
      "id": "b2c3d4e5-f6g7-8901-bcde-f12345678901",
      "label": "Examine the mist",
      "description": "The mist appears unnatural, swirling with faint magical energy."
    },
    {
      "id": "c3d4e5f6-g7h8-9012-cdef-123456789012",
      "label": "Call out to see if anyone is nearby",
      "description": "Perhaps someone else is in this forest who can help guide you."
    }
  ],
  "npcResponses": [
    {
      "npcId": "npc.kiera",
      "response": "Stay close. These woods are not what they seem.",
      "emotion": "cautious"
    }
  ],
  "relationshipDeltas": {
    "npc.kiera": 5
  }
}
```

### Invalid Response (will be rejected)

```json
{
  "narrative": "",  // ❌ Empty string (min 1 char)
  "emotion": "confused",  // ❌ Not in allowed enum
  "choices": [],  // ❌ No choices provided
  "extra_field": "value"  // ❌ Unknown key
}
```

---

## Implementation Plan

### Phase 0 (Current)

- Document JSON protocol requirements
- Link to existing schema (`TurnResponseSchema`)

### Phase 1

- Implement Gemini adapter with `response_format: json`
- Basic JSON parsing and validation

### Phase 2

- Wire adapter to `/api/games/:id/turns`
- Return structured errors on validation failure

### Phase 3

- Finalize schema in `src/model/jsonSchema.ts`
- Add strict Zod validation
- Implement auto-repair logic
- Add schema version negotiation (future-proofing)

### Phase 4

- Update UI to handle all response fields
- Display NPC responses
- Show relationship deltas (optional)

---

## References

- [CHAT_AUDIT.md](./CHAT_AUDIT.md) - Current JSON protocol analysis
- [CHAT_GAP_PLAN.md](./CHAT_GAP_PLAN.md) - Gap 1 (JSON validation)
- `shared/src/types/api.ts:137-161` - Current `TurnResponseSchema`
- [Gemini JSON Mode Docs](https://ai.google.dev/docs/json_mode) - Official documentation

---

## Version History

- **v1 (stub)**: Phase 0 - Initial protocol definition
- **v2**: Phase 3 - Finalized schema with strict validation

