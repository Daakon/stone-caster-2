# StoneCaster: The AI-Driven Narrative RPG Platform Built on Structured Systems

**StoneCaster** is a next-generation AI-powered storytelling engine that delivers rich, immersive RPG experiences without requiring human Dungeon Masters or fixed branching storylines. Players step into handcrafted worlds that react to every choice through a hybrid system of strict rules, persistent simulation, and controlled AI creativity.

Unlike AI-only RPGs that rely on a single language model and often break lore or mechanics, StoneCaster uses a multi-stage, multi-agent architecture that enforces world rules while still delivering cinematic narrative.

---

## What Makes StoneCaster Unique

### Content Creation With Selectable Rulesets
Users and designers can build custom worlds and stories by **selecting which internal Rulesets** they want to activate. Rulesets cannot be edited, but they can be mixed, matched, and layered to create unique narrative and mechanical experiences.

StoneCaster provides:
- **Foundational Rulesets** for core mechanics such as social interactions, exploration, or progression.
- **Expansion Rulesets** that extend a foundation with additional behaviors, constraints, or narrative hooks.
- **Variant Rulesets** planned for future expansion to offer alternate playstyles within the same system family.

The creator chooses from these options when building a story. The selected Rulesets determine what additional data the creator must supply. For example:
- Enabling a **character skill system** requires the story creator to define skills for NPCs.
- Enabling **advanced emotional tracking** requires specifying NPC emotional baselines.
- Enabling **faction mechanics** requires defining allegiances and reputations.

Players also participate in this setup by configuring their character based on the chosen Rulesets.

This approach lets StoneCaster evolve through a growing library of Rulesets while maintaining a stable mechanical core.

### 1. A Rules-First Platform — Not a Freeform AI Sandbox
StoneCaster’s foundation is a suite of **internally-built Rulesets** that define each major system:
- Social interactions
- Combat dynamics
- Exploration
- NPC behavior
- Time advancement
- Emotional states
- Relationship changes
- Environmental forces (such as Essence systems)

These Rulesets are created and maintained by the StoneCaster team only because they tie directly into:
- the Chimera Smart Compiler
- the Play Engine
- state schemas
- deterministic mechanics
- real server-side logic

Creators cannot modify the underlying mechanics. They build content **within** these rules — preserving stability, consistency, and quality.

---

### 2. AI Used Intelligently, Not Recklessly
StoneCaster uses AI only where it enhances user experience, never where it would break mechanics.

#### MAS 1 (Action Parser)
- Interprets unstructured player text
- Resolves pronouns and vague references
- Analyzes sentiment
- Produces a structured Action DTO valid within the rules

#### MAS 2 (Narrative Generator)
- Produces the descriptive story output
- Does not control mechanics, stats, outcomes, or world logic

AI is the narrator, not the game engine.

---

### 3. The Smart Compiler: The Brain Behind Every World
The Chimera Smart Compiler pre-processes all designer-created data **and all selected Rulesets**:
- Worlds
- Lore
- Items
- NPCs
- Scenarios (Stories)
- Starting conditions

Then merges them with the selected Rulesets to produce:
- a validated schema
- guardrails for AI
- a RAG index for lore-consistent output

The Compiler is essential because optional Rulesets create combinatorial complexity. It:
- builds an optimized data structure and state schema tailored to the active Rulesets
- enforces constraints across all user-supplied content
- generates the narrative guardrails MAS 2 must follow
- optimizes the RAG index so the narrative AI only pulls relevant, Ruleset-specific lore

This guarantees that AI-generated narrative remains coherent, mechanically aligned, and lore-accurate across any combination of Rulesets.

---

### 4. Modular Content, Not Modular Rules
Users and designers can create:
- worlds
- locations
- items
- NPCs
- storylines
- factions
- companions

But cannot change:
- mechanics
- relationship logic
- combat rules
- time systems
- NPC behavior models
- state schemas

This ensures StoneCaster expands through content, not rules, maintaining system-wide integrity.

---

### 5. NPCs With Real Agency
NPCs use a combination of:
- personality models
- relationship tracking
- emotional states
- goals and aversions
- memory
- world rules

AI generates their narrative responses only after the deterministic rule engine decides their intentions.

This produces rich, evolving characters that feel alive without AI inventing new mechanics.

---

### 6. Modern, Distributed Architecture
StoneCaster is built for global scale and low-latency performance:
- Cloudflare Workers for front end
- Supabase for auth and Postgres storage
- Fly.io for distributed Node/Chimera servers
- Vector indexes for RAG
- Rules-driven Play Engine
- Token-budgeting system for LLM cost control

This architecture supports high concurrency with minimal ops overhead.

---

### Story Scale: From Epic Adventures to Cozy Scenes
Stories can range from large, rule-heavy adventures with deep narrative arcs to simple, relaxing experiences such as spending time in a cozy tavern where NPCs come and go, relationships evolve, and atmosphere is the core of the experience.

The chosen Rulesets determine the complexity, from full combat and exploration systems to lightweight social-only simulations.

### Characters, Worlds, and Long-Term Continuity
- Players may create **one or many characters**.
- Each character is tied to a **specific world**, preserving lore and mechanical consistency.
- Stories are also world-specific.

A planned feature enables **long-term NPC companions** who can travel with the player across multiple stories within the same world. These NPCs retain:
- memories
- relationships
- emotional states
- growth and development

This supports long-term campaigns and multi-story sagas.

## The Business Value

### A Scalable Narrative Platform
One handcrafted world can support:
- thousands of players
- infinite replayability
- continuous expansions
- cross-genre ecosystem growth

### Personalized, High-Retention Experiences
Every session feels authored but never repetitive.

### Future Revenue Streams
- subscription access
- world expansions
- premium stories
- companions and cosmetics
- licensed IP worlds
- creator marketplace for content (worlds, stories, NPCs)

---

## TLDR for Investors
**StoneCaster is a hybrid AI-and-rules RPG platform that delivers handcrafted, deeply immersive stories at scale.**

AI handles interpretation and narrative.
Internal rule systems handle mechanics and world logic.
Creators build content, not code.

This gives players an experience that feels authored, but is infinitely replayable and globally scalable.

