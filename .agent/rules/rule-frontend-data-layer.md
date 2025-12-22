---
trigger: always_on
---

## Frontend Data Layer

### Forbidden Patterns
- **Complex Shaping in Effects**: Do not map/filter/reduce data inside \useEffect\.
- **Dependent Fetch Cascades**: Avoid chains of \useEffect\ fetching data based on other state.

### Allowed Patterns
- **Loaders**: Use React Query fetches in custom hooks.
- **Transformers**: Transform API data in the \select\ callback of \useQuery\, NOT in the component render body.
- **Hydration**: If a form needs initial data, use \defaultValues\ or a specialized \useHydrateForm\ hook.

### Example Refactor
**Bad**:
\\\	ypescript
useEffect(() => {
  if (data) {
     const formatted = ...; // complex logic
     setState(formatted);
  }
}, [data]);
\\\

**Good**:
\\\	ypescript
const { data: formatted } = useQuery({
  ...,
  select: (data) => transform(data)
});
\\\
"@),

    @("c:\Dev\Stone Caster\stone-caster-2\.agent\rules\rule-frontend-state-ownership.md", @"
---
trigger: always_on
---

## Frontend State Ownership

### 1. Domain State Owner
- Major features (Editor, Game Board) must have a single hooks-based \"Model\" or Context.
- Example: \useRulesetSelectionManager\ owns the ruleset state. UI components just call \	oggleRuleset\.

### 2. No Duplicate Fetching
- Do not re-fetch the same resource in multiple child components.
- Lift the query to the Page/Container level or rely on React Query caching.

### 3. Frontend is NOT Source of Truth
- IDs and canonical data come from the Backend.
- If creating an entity, wait for the Server response to assign the real ID. Do not generate UUIDs on the client for permanent records.
