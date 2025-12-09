# StoneCaster UX Flow Reference (Mermaid)

This document captures the core UX journeys for the StoneCaster MVP using Mermaid diagrams so the team can keep flows synchronized with the ever-evolving architecture specifications in `docs/`. It mirrors the structure of the archived NotebookLM UX notes but focuses on visualizing state transitions.

---

## Document Goals

- Provide a quick visual map of how Author, Player, and Admin roles traverse the product.
- Emphasize deterministic transitions so the UX mirrors Chimera's rule-driven engine.
- Highlight key UI/system checkpoints that must exist for the MVP.

---

## Personas & Primary Success Criteria

### Author
- Compose or edit a world draft, stitch in Forces/Elements/Lore, and compile a playable story with confidence.
- Understand gating (e.g., presets lock/unlock later tabs) and see validation feedback before binding.

### Player
- Discover a compiled story, launch a session, and stay in flow while MAS pipelines resolve actions and update state.
- Receive clear guidance when inputs are invalid or the engine needs more information.

### Admin / Maintainer
- Seed templates, guardrails, and diagnostics that keep the Author and Player surfaces predictable.
- Resolve schema conflicts or deployment issues without leaving the ops surface.

---

## Experience Flyover (multi-persona)

The diagram below stitches the major persona journeys into a single loop so dependencies are explicit.

```mermaid
flowchart LR
    subgraph "Author Journey"
        A0[Dashboard\nWorld + Story hub]
        A1[Preset & Scope\nWorld tab]
        A2[Forces\nPhysics/Rulesets]
        A3[Elements\nCharacters, Items, Places]
        A4[Lore\nContext + Memories]
        A5[Bind & Compile\nStory build]
    end

    subgraph "Story Ops"
        S0[Story Library\nCompiled versions]
        S1[Session Templates\nSafety + ruleset locks]
    end

    subgraph "Player Journey"
        P0[Story Discovery\nChoose compiled story]
        P1[Session Setup\nSelect avatar, confirm safety]
        P2[Narration View]
        P3[Action Input]
        P4[MAS Pipelines\nMAS-1 parse, Engine update, MAS-2 narrate]
        P5[State Panel\nDeterministic updates]
    end

    subgraph "Admin Guardrails"
        G0[Template Depot]
        G1[Rule Conflict Monitor]
        G2[Telemetry & Error Console]
    end

    A0 --> A1 --> A2 --> A3 --> A4 --> A5 -->|Successful bind| S0
    S0 -->|Publish story| P0 --> P1 --> P2 --> P3 --> P4 --> P5
    P5 -.->|Continue turn| P2
    A5 -->|Validation errors| G1
    G0 -->|Preset updates| A1
    G1 -->|Conflict resolutions| A2
    G2 -->|Session health| P2
    P4 -->|Engine issues| G2
    S1 -->|Session defaults| P1
    A3 -->|Needs template| G0
```

---

## Authoring Flow – Interaction & System States

The authoring experience remains tabbed ("Casting Circle") with deterministic gating. The Mermaid flow highlights validation checkpoints that must pass before Bind.

```mermaid
flowchart TD
    D[Dashboard] --> W[World Preset Selected?]
    W -- No --> PromptWorld[Display preset cards\n+ gating notice]
    W -- Yes --> F[Forces Configured]
    F -- Incomplete --> ForceHints[Surface mutually exclusive rule hints]
    F -- Complete --> E[Elements >= Minimum Viable Set]
    E -- Missing --> ElementModal[Open Library/Forge modal]
    E -- Ready --> L[Lore Context Applied]
    L -- Optional gaps --> LoreSuggestions[Suggest linking contexts to entities]
    L -- Complete --> V[Validation Pass]
    V -- Fails --> ErrorDrawer[Conflict + fix instructions]
    V -- Passes --> B[Bind Story]
    B --> DraftState[Auto-save draft + version bump]
    DraftState --> PublishDecision{Compile now?}
    PublishDecision -- No --> ReturnDashboard[Return to Dashboard w/ Resume chip]
    PublishDecision -- Yes --> StoryRecord[Create compiled Story record]
```

**Key Notes**
- Tabs remain disabled until the prior milestone reports "Complete" to prevent partial binds.
- Draft states auto-save after every major milestone (`W`, `F`, `E`, `L`).
- Validation drawer aggregates schema and safety warnings so Authors can fix issues inline.

---

## Player Session Loop

Players see a single-page experience anchored by Narration, Action Input, and State Panel. The session loop diagram shows where MAS components interact with UI feedback.

```mermaid
sequenceDiagram
    participant Player
    participant UI as Player UI
    participant MAS1 as MAS-1 Parser
    participant Engine as Chimera Engine
    participant MAS2 as MAS-2 Narrator

    Player->>UI: Submit action text
    UI->>MAS1: Send intent request
    MAS1-->>UI: Validation result / guidance
    MAS1->>Engine: Structured intent payload
    Engine-->>MAS2: Updated game state
    MAS2-->>UI: Narrative block + state deltas
    UI-->>Player: Render narration + sidebar updates
    rect rgb(245,245,245)
        UI-->>Player: Offer retry / suggestions if MAS1 rejects
    end
```

**Session Guardrails**
- MAS-1 errors never clear the action field; the UI simply injects guidance inline.
- MAS-2 deliveries stream into the narration window, but state deltas also render inside the sidebar (and optionally in compact turn cards).
- Auto-save checkpoints fire after every successful Engine update so rejoining a session restores the last turn.

---

## Admin & Support Touchpoints

While Admin users rarely appear in front of players, their tooling keeps flows reliable. The smaller flow below shows how ops tasks influence authoring and play.

```mermaid
flowchart LR
    T[Template Depot] -->|Version update| CastingCircle[Author Casting Circle]
    CastingCircle -->|Uses preset| Validator
    Validator[Ruleset Validator] -->|Conflicts| Monitor[Rule Conflict Monitor]
    Monitor -->|Resolution| CastingCircle
    Telemetry[Session Telemetry] --> DashboardOps[Ops Console]
    DashboardOps -->|Alerts| SupportTeam[Support]
    SupportTeam -->|Notify| PlayersAuthor[Player & Author comms]
```

**Operational Expectations**
- Template edits propagate version numbers so Authors immediately know when presets have drifted.
- Rule Conflict Monitor surfaces binding issues in real-time, reducing failed compiles.
- Telemetry drives proactive outreach when MAS latency or Engine faults rise.

---

## Next Use

- Designers can drop these Mermaid blocks directly into Notion / Markdown workspaces to keep diagrams reproducible.
- Engineers can align validation hooks and telemetry events with the checkpoints shown here.
- Product can expand each node into acceptance criteria, ensuring UX fidelity remains in lockstep with the Chimera architecture spec.
