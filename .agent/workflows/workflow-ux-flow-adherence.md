---
description: Ux Flow Adherence
---

Before implementing any new user-facing feature or flow, you must consult the diagrams in `docs/UX_Flow_Mermaid.md` and `docs/Page_Component_Hierarchy.md`.

**Workflow**:
1.  Identify the relevant user journey in the Mermaid diagrams (e.g., "Authoring Flow", "Player Session Loop").
2.  Note the key states, transitions, and "gating" logic (e.g., a tab being disabled until a previous step is complete).
3.  Your implementation MUST respect these documented flows.
4.  If a proposed change deviates from the documented flow, you must first ask for approval to update the documentation before proceeding with the code change. This ensures that documentation and implementation remain synchronized.