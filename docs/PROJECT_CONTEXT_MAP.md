# StoneCaster Project Context Map (Canonical)

**Status:** Active | **Architecture:** Chimera V3 (Greenfield) | **Legacy:** AWF (Kill)

## 1. The "Kill List" (Legacy Protocol)
**Directive:** The "Adventure World Forge" (AWF) and "Stone" systems are deprecated. Any file or table matching these patterns is flagged for deletion.

### Directories to Delete
* `backend/src/assemblers/awf-*`
* `backend/src/orchestrators/awf-*`
* `backend/src/routes/awf-*`
* `backend/src/model/awf-*`
* `backend/src/types/awf-*`
* `backend/src/mods/`
* `backend/src/marketplace/`
* `backend/src/services/stonePacks.service.ts`

### Tables to Drop
* `awf_*` (All analytics, rollups, dashboards)
* `stone_*` (Wallets, ledgers, packs)
* `mod_*` (Packs, registry, hooks)
* `world_templates`, `worlds` (Old schemas)
* `adventures`, `games`, `sessions`, `turns` (Legacy runtime)

---

## 2. The Data Architecture (Hybrid Schema)
**Directive:** We use a **Hybrid Pattern** intentionally.
* **SQL Columns:** Used for `name`, `slug`, `visibility`, `tags`, `owner_id`. These exist for **indexing and fast filtering**.
* **JSONB `definition`:** Used for the full canonical object (`WorldDefinition`, `RulesetDefinition`).
* **Migration Rule:** If a field is needed for a `WHERE` clause, it gets a column. If it is only needed for the Compiler/Client, it stays in JSONB.

### Core Tables
* `chimera_worlds`: Hybrid (SQL Index + JSONB Definition)
* `chimera_ruleset_templates`: Hybrid
* `chimera_entities`: Hybrid (SQL `kind`/`key` + JSONB `raw_data`)
* `chimera_lore`: **Vector Enabled**. (`embedding` column using `vector(1536)`).
* `compiled_stories`: Artifact storage.
* `chimera_game_states`: Runtime persistence.

---

## 3. System Architecture (Route → Service → Repo)
**Directive:** Business logic must live in Services, not Routes.

### Backend Structure (`backend/src/`)
* **`routes/`**: Zod validation of HTTP inputs. Calls Service. Returns DTO.
* **`services/`**: Pure Business Logic.
    * `compile/`: The 4-Step Compiler (New Implementation).
    * `runtime/`: The Game Loop (`mas1`, `engine`, `mas2`).
    * `authoring/`: CRUD logic for Worlds, Lore, etc.
    * `assets/`: R2/S3 integrations.
* **`db/repos/`**: Supabase/SQL interactions. No business logic.
* **`types/`**: Shared Zod schemas (Synced with `chimera-full-schemas.json`).

### Frontend Structure (`frontend/src/`)
* **`pages/casting-circle/`**: The 4-Stone Wizard (World, Forces, Elements, **Lore**).
* **`pages/play/`**: The Runtime Interface.
* **`services/`**: API Client wrappers.

---

## 4. The Compiler Strategy (Clean Slate)
**Directive:** Delete existing `services/compiler` and `services/compile`. Build fresh.
**The 4-Step Pipeline:**
1.  **Base Loader:** Load `BaseCharacter` + Merge `World` extensions.
2.  **Resolution:** Validate `Ruleset` dependencies and `Exclusion Groups`.
3.  **Schema Build:** Merge `actions`, `stats`, and `lore` into a Master Schema.
4.  **Artifact Gen:** Output `CompiledStory` (JSON) + `LoreIndex` (Vector).

---

## 5. The Lore Strategy (RAG)
**Directive:** Lore is a cross-cutting concern powered by `pgvector`.
* **Ingestion:** When World/Element/Force is saved, text fragments are chunked, embedded (OpenAI/local), and saved to `chimera_lore`.
* **Retrieval:** At runtime, MAS2 queries `chimera_lore` by vector similarity to the current context.