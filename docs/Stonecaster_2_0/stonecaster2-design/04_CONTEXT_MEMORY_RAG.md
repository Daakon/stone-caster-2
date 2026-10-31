# 04 — Context Intelligence, Memory and RAG

## Guiding premise

RAG is **not** the main source of truth. StoneCaster's context engine joins reliable structured state with selective retrieval of world documents, scenario lore, character memories and rule instructions. Retrieval must respect what the scene needs **and what each character is allowed to know**.

## Context sources and treatment

| Source | How selected | Authority |
|---|---|---|
| Player/timeline/run/current cast/party | Exact SQL/typed domain query | Mandatory, authoritative |
| Current character goals/relationships/known facts | Exact typed state lookup | Mandatory for present actors |
| World canon and scene location | Versioned published lookup + indexed search | Canonical content |
| Scenario documents/clues | Scope-filtered exact/hybrid retrieval | Scenario evidence; some author-only |
| Events and past scenes | Event log, summaries, hybrid recall | Authoritative events + historical impressions |
| NPC memory/private belief | Ownership/knowledge-filtered lookup and recall | Character-specific, potentially false beliefs |
| Rule packs | Explicit selection and contextual activation | Versioned behavioral instructions |
| Conversation recency | Last N committed turns | Immediate continuity |

## Retrieval pipeline

1. Build typed `ContextRequest`: `worldId`, `timelineId`, `runId`, `actorIds`, location, player input, task intent, active rule selections, and content visibility scope.
2. Load *mandatory* exact state. Never let semantic search decide whether active party members are present.
3. Resolve named entities/references from canonical IDs and aliases. Search exact names first; keyword + pgvector hybrid search for loosely related lore and memories.
4. Apply **authorization before candidates become model-visible**, including per-character knowledge boundaries and creator-only scenario secrets. A global top-k retrieval over unrestricted embeddings is not acceptable even if the display layer filters later.
5. Rerank/merge by source trust, topical relevance, event recency, causal importance, confidence, and token size. Preserve provenance and duplicate suppression.
6. Resolve contradictions: canon/latest committed events win over obsolete summaries; beliefs remain labeled as beliefs even when false. Do not automatically overwrite previously held beliefs with new truth.
7. Select relevant rule packs; include stable system/world segments; construct compact, labeled context within model budget.
8. Log retrieval decisions and chunk IDs in internal trace only, with sensitive content redacted. Support an authorized 'why did this NPC say that?' inspector for debugging.

## Knowledge security and epistemics

Represent separately:

- `world_fact`: published canon in the world revision.
- `timeline_fact`: authoritative event/fact true in this player's timeline.
- `character_known_fact`: fact this specific NPC has actually learned.
- `character_belief`: what this NPC thinks, possibly mistaken or outdated.
- `player_known_fact`: what the player character has learned; distinct from secrets the underlying system knows.
- `creator_secret`: hidden scenario information used for planning, **not** automatically available to NPC voices or exposed to players.

Some director-level information may be available for planning while character-level output is constrained by knowledge scopes. For especially sensitive secrets, use a two-step plan/voice separation or explicit redaction so hidden text cannot bleed into dialogue. Testing must verify no NPC reveals an inaccessible secret even when retrieval ranks it highly.

Creator-supplied lore and uploaded documents are **untrusted content**; do not promote embedded 'ignore instructions' text into platform/system instructions. The compiler should wrap these as quoted/reference data and allow only vetted rule-pack content to become active gameplay instructions. Even rule packs never supersede platform policy, ownership checks, or tool permissions.

## Memory write path

After each committed turn:

1. Derive mechanical/relationship/party changes from committed events (no model needed to invent them).
2. Identify story-significant narrative observations, promises, discoveries and subjective reactions. A small extraction model may propose memory candidates.
3. Validate candidate subject, knowledge grant, evidence, time, provenance and duplication against event records.
4. Write typed character memory/knowledge and append event links, with short human-readable text.
5. Queue embedding generation or update only for durable, retrieval-worthy chunks. Keep raw transcript/event history as audit source.
6. Compact older transcript for prompt efficiency; summaries may be rebuilt and must never override event truths.

Do **not** embed every line of dialogue automatically. Use recency windows, structured state and selected durable memories first.

## Storage implementation (MVP)

- PostgreSQL tables for event log, NPC instance state, party, relationships and knowledge grants.
- `knowledge_chunks` with `(id, world_id, timeline_id?, scenario_revision_id?, subject_id?, kind, visibility, source_id, source_revision, content, embedding_model, embedding, full_text_index, valid_from, superseded_by?)`.
- PostgreSQL full-text search and pgvector for hybrid search; use RRF or similar rank fusion after visibility filters.
- Optional `knowledge_edges`/entity reference tables for named things, without Neo4j/Graphiti initially.
- Every query is scoped by verified caller/world/timeline and, when forming an NPC voice, the NPC's authorized knowledge.
- RLS protects user/creator ownership; server-level fine-grained actor knowledge rules protect fictional secrets. Do not rely on RLS alone for in-story awareness.

## Token budget strategy

Use configuration per model profile; these are illustrative shares, **not fixed token limits**:

| Context category | Share of context budget |
|---|---:|
| Stable platform/world/canon/rules | 25% |
| Current state, cast, active scenario | 25% |
| Retrieved lore/memories/beliefs | 25% |
| Recent dialogue and active threads | 20% |
| Safety margin | 5% |

Mandatory context is not dropped to fit a budget. Instead compress safe content, trim optional retrieval, or choose a longer-context capable model. Larger context windows don't excuse irrelevant prompts. Measure quality against token usage.

## Retrieval instrumentation

Track `turn_id`, content revision refs, chosen chunk IDs, retrieval method, visibility-filter result counts, cache hit, prompt tokens by category, total model latency/cost and errors. Provide opt-out/redaction for sensitive unpublished text in third-party observability products.

## Tests required

- NPC with private secret does not reveal it to other NPCs/the player without a recorded disclosure.
- NPC can hold a mistaken belief while the world's actual truth differs.
- Companion recalls a promise made in scenario A during scenario B without ingesting all prior turns.
- Two timelines using same NPC definition retrieve different memories and relationships.
- Old lore revision does not override a newer published revision for *new* runs; pinned runs remain consistent.
- Hybrid retrieval returns relevant obscure lore and exact-match names without unrelated lore flooding context.
- Prompt injection in lore/uploaded documents cannot change system instructions or invoke unauthorized tools.

## Reference implementations to evaluate

Supabase official hybrid search/pgvector docs: https://supabase.com/docs/guides/ai/hybrid-search . Use existing Supabase infrastructure before considering dedicated vector or graph services. Hosted framework memory features may assist with conversation compaction but must not replace typed, scoped NPC and timeline memory.
