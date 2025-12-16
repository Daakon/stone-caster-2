# 14 Roadmap and Cutlines

*(StoneCaster / Chimera Engine – MVP)*

This document defines the **official product roadmap**, **scope boundaries**, and **cutline rules** that determine what is included in the MVP, what is deferred, and what should *never* be added without major revision.
It ensures alignment across engineering, design, LLM prompt architecture, authoring workflow, and gameplay experience.

---

# 1. Roadmap Philosophy

The roadmap for StoneCaster balances:

* **Speed** — ship a working MVP quickly.
* **Stability** — avoid overextending the system with advanced features.
* **Determinism** — maintain predictable narrative structure.
* **Scalability** — build primitives that support expansion packs.

The principle:

> Build the *framework*, not the universe.

---

# 2. Roadmap Overview

```md
Phase 0 – Foundation     → Architecture, schemas, rulesets
Phase 1 – MVP            → Compiler + Runtime + MAS pipelines
Phase 2 – Feature Pack 1 → Inventory, factions, quests
Phase 3 – Ecosystem      → Marketplace, multi-genre expansions
Phase 4 – Enterprise     → B2B SaaS platform (separate product)
```

---

# 3. Phase 0 — Foundation (Complete or In Progress)

**Goals:**

* Establish Domain Model (Tier0/Tier1/Tier2)
* Create initial ruleset catalog
* Define MAS-1 and MAS-2 schemas & templates
* Establish prompt-governance system (Chimera)
* Create DB schema + RLS rules
* Define UX flows
* Write core documentation

**Artifacts:**

* Domain Model
* Rulesets Index
* API Contract
* Test Plan
* UX Wireframes
* Style & Tone Guide
* Prompt Assembly Spec

Status: **Complete** (with ongoing refinement)

---

# 4. Phase 1 — MVP (Current Phase)

This is the **playable story** milestone.

### MVP Must Include:

1. **Authoring Tools**

   * Create/edit worlds
   * Create/edit entities
   * Create/edit lore
   * Select rulesets
   * Compile story

2. **Compiler**

   * Deterministic merging of state contributions
   * MAS instruction bundles
   * Lore index embedding

3. **Runtime Engine**

   * MAS-1 interpretive layer
   * Deterministic engine (stamina, hunger, contests)
   * MAS-2 narrative generator
   * Turn-based loop

4. **Player Experience**

   * Start session
   * Story view (narration + state panel)
   * Enter actions
   * Receive narrative response

5. **Infrastructure**

   * Auth & RLS
   * Logging & monitoring
   * Basic error handling

6. **Content**

   * At least 2 example worlds
   * Minimal lore set

### MVP Deliverables

```md
• Player can complete a 30–60 minute story session  
• Author can build a story from scratch  
• LLM outputs stable JSON 99% of the time  
• Compiler generates deterministic outputs  
• State updates remain consistent across turns  
```

---

# 5. Phase 1 Cutlines (What Will Not Be Included)

Anything here is explicitly **excluded** from MVP.

## 5.1 Gameplay Features (Cut from MVP)

* Inventory system
* Item crafting
* Detailed combat engine (distance, targeting, HP)
* Quest chains / objectives system
* Factions system
* Money/economy simulation
* Reputation scores
* Alignment/morality system
* Detailed dialogue trees
* Party-based gameplay
* Non-linear scene branching

These rely on more complex state transitions and require expanded rulesets.

## 5.2 AI Features

* Memory persistence across sessions
* Reinforcement learning loops
* AI-generated rulesets
* Full story auto-generation
* Player emotion detection

## 5.3 Platform Features

* Marketplace
* Modding toolkit
* Developer API for external games
* Multi-device sync with offline mode

## 5.4 Admin Tools

* Version history for worlds/entities/lore
* Automated migration engine for stories
* Ruleset creation UI (admin-only in MVP)

---

# 6. Phase 2 — Feature Pack 1 (Post-MVP)

Focuses on **mechanical depth**.

## 6.1 Major Features

* Inventory (lightweight)
* Items + equipment
* Money + trade tiers
* Factions system
* Simple quest flags
* Emotional memory queues
* NPC long-term objectives

## 6.2 Required Additions

* New rulesets
* New engine procedures
* Expanded entity definitions
* Cross Story NPC Persistance (companions)

---

# 7. Phase 3 — Ecosystem Expansion

Turns StoneCaster into a platform.

## 7.1 Marketplace

* Buy/sell worlds, rulesets, art packs
* Creator revenue sharing

## 7.2 Player Accounts & Cloud Saves

* Cross-device syncing

## 7.3 Multi-Genre Expansion

* Noir pack
* Sci-fi pack
* Cozy pack
* Horror pack
* Superhero pack

Each includes:

* Genre-specific rulesets
* Tone injectors
* MAS-2 behavior extensions

---

# 8. Phase 4 — Enterprise (Separate Product)

This phase is **not** part of StoneCaster D2C.
It becomes an enterprise SaaS product with:

* SSO
* Admin dashboards
* Compliance frameworks (SOC2, HIPAA where relevant)
* API-based story engines for other companies

This is a **separate product line**, not a continuation of MVP.

---

# 9. Scope Boundaries (Deciding What Stays Out of MVP)

A feature is considered **Out of Bounds** for MVP if:

1. **It requires new ruleset categories** (e.g., factions, economy).
2. **It introduces new MAS instruction types** (e.g., dialogue tree data).
3. **It expands state beyond Tier0/Tier1/Tier2 primitives**.
4. **It reduces stability of deterministic narrative**.
5. **It adds more than one week of development overhead**.

If a feature touches more than **two architectures** (Compiler, Engine, MAS) simultaneously, it is automatically deferred to Phase 2 unless approved.
---

# 10. Risk Map

### High Risk (Do Not Add to MVP)

* Factions system
* Inventory system
* Dialogue tree branching

### Medium Risk (Maybe Later in MVP+)

* Quest flags
* Money system
* Expanded combat

### Low Risk (Safe for MVP if needed)

* More rulesets (tone, social behaviors)
* More worlds
* More lore

---

# 11. Success Criteria for MVP

The MVP is successful when:

```md
✓ A player completes a story with minimal errors  
✓ MAS-1 correctly parses 95% of actions  
✓ MAS-2 produces stable narrative with no contradictions  
✓ State evolution remains consistent and debuggable  
✓ Authors can create/compile worlds without engineering support  
✓ No critical security or RLS failures  
```

These criteria ensure foundational viability before expanding the system.

---

# 12. Summary

This Roadmap & Cutlines document defines the **strategic boundaries** of the StoneCaster MVP.
It ensures:

* Focus
* Predictability
* Feasibility
* Room for future expansion without rewriting the core

Use this as the **guiding document** to prevent feature creep and maintain clear development priorities.
