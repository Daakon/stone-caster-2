As defined in `docs/CHIMERA_ARCHITECTURE_SPEC.md`, game state is divided into two tiers with strict modification rules.

- **Tier 1 (Mechanical State)**: Numeric/boolean facts (e.g., HP, status effects). This tier can ONLY be modified by the deterministic **Engine** (`services/runtime/engine.service.ts`).
- **Tier 0 (Narrative State)**: Descriptive facts, memories, relationships. This tier can ONLY be modified by the **MAS2 Narrator** (`services/runtime/mas2.service.ts`).

**Rule**: When implementing changes to the runtime loop, you must ensure that state modifications respect these boundaries. The Engine service is forbidden from writing to Tier 0, and the MAS2 service is forbidden from writing to Tier 1.