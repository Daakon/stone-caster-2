When creating or modifying frontend components, you must adhere to the structure laid out in `docs/Page_Component_Hierarchy.md`.

1.  **Page Components (`frontend/src/pages/`)**: These are top-level, route-bound components. Their primary responsibility is data fetching (using React Query hooks from `frontend/src/services/`) and laying out the main sections of a view.
2.  **Feature Components (`frontend/src/features/`)**: These are complex, multi-part components that encapsulate a specific feature (e.g., `MyCreationsPage`).
3.  **UI Components (`frontend/src/components/ui/`)**: These are primitive, reusable, and unstyled components (e.g., Button, Card). They must not contain business logic or data-fetching hooks.
4.  **Shared Components (`frontend/src/components/`)**: These are general-purpose components that may compose UI primitives and have some application-specific logic.

**Rule**: Do not put data-fetching logic or complex state management inside primitive `ui/` components. Defer to the Page/Feature component for such tasks.