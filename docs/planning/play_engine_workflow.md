# The Play Engine Workflow

The Play Engine orchestrates a multi-stage loop that separates **AI creativity** (Narrative) from **code-driven rules** (Mechanics) to ensure security, consistency, and token efficiency.

---

## 1. Play Engine Workflow (The Loop)
All gameplay executes inside:
**POST /api/v2/play/:gameStateId/cast-stone**
This endpoint acts as the **Orchestrator**.

### Stage 1. Pre-Narrative Processing (MAS 1)
**Goal:** Convert free player text into a structured, executable command.

**Input:** Player free text and full GameStateTiers.

**Service:** **ActionParser**

**Process:**
- **Coreference Resolution**: Replaces pronouns and vague references with exact entities.
- **Intent Parsing**: Produces structured **ActionDto**.
- **Sentiment Analysis**: Detects tone and intensity.

**Output:** **Mas1ResponseDto**
- ActionDto
- ResolvedQuery
- DetectedSentiment

---

### Stage 2. Mechanical Resolution (Game Engine)
**Goal:** Determine deterministic mechanical outcome.

**Input:** ActionDto and action_context_json (compiled rules + mechanical state).

**Service:** **ActionResolver**

**Process:**
- Runs deterministic checks using action_rules
- Uses combat/math/stat rules
- Produces mechanical result and required T1/T2 mutations

**Output:** **OutcomeDto** and Engine-created **T1/T2 MutationDtos**

---

### Stage 3. Narrative Processing (MAS 2)
**Goal:** Generate the creative narrative based on the mechanical result.

**Input:** OutcomeDto, GameStateTiers, and ResolvedQuery.

**Service:** **MasContextProvider**

**Process:**
- **RAG Retrieval:** Vector search into narrative_context_json.rag_index using resolved query.
- **Prompt Assembly:** Builds secure MAS2 prompt using rules, mechanical state, outcome, and lore.

**Output:** **Mas2ResponseDto**
- ripple_narrative
- T0 mutations
- engine_requests

---

### Stage 4. Security & Persistence
**Goal:** Validate all mutations, apply them, and save new state.

**Services:**
- **MutationValidator:**
  - Permits **Tier 0** writes from AI
  - Rejects T1/T2 AI-written changes
- **EngineRequestProcessor:**
  - Validates and converts requested mechanical actions into safe mutations

**Final Action:**
- Combine validated T0/T1/T2 mutations
- Apply to GameStateTiers
- Save state
- Return ripple_narrative to client

---

## 2. State Engine Breakdown & Data Segregation

### 2.1 Tiered State Structure
Located in **chimera_game_states.current_game_state**.

#### **Tier 0: Narrative State**
- Relationship levels
- NPC psyches
- Player knowledge
- **AI Read/Write**

MutationValidator allows only Tier 0 to be modified by MAS2.

#### **Tier 1 & Tier 2: Mechanical State**
- Health, time, inventory
- Skills, combat stats
- Deterministic systems
- **Engine Read/Write** only

AI may read these but cannot change them.

---

## 2.2 Data Segregation (Lore vs Entities)
Efficient prompts and safe logic rely on separating these at compile time.

### Lore Entries
- Pure descriptive text
- Vectorized into narrative_context_json
- Never influences mechanics

### Entities (PC/NPC)
Contain a mix of:
- **Mechanical data** (health, stats) → goes to **action_context_json**
- **Narrative data** (backstory, personality) → vectorized into **narrative_context_json**

### Rulesets (Forces)
- Pure logic
- Provide:
  - action_rules
  - prompt_rules
  - state schemas
  - mechanical formulas

They feed all four generated contexts.

---

This completes the structured, secure, token-efficient Play Engine architecture.

