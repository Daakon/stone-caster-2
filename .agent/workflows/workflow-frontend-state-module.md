---
description: Extract Frontend State Module
---

## Goal
Extract complex state/effect logic from a UI Component (like \WorldEditorModal.tsx\) into a testable Hook/Model.

## Step 1: Interface Definition
Define what the UI needs:
\\\	ypescript
interface WorldEditorModel {
  formData: WorldFormData;
  setField: (k, v) => void;
  save: () => Promise<void>;
  isLoading: boolean;
}
\\\

## Step 2: Move Logic
Create \eatures/[feature]/hooks/useWorldEditorModel.ts\.
- Copy \useState\, \useEffect\, and handlers.
- Fix imports.

## Step 3: Implement Hook
Return the interface from Step 1.

## Step 4: Component Integration
Replace logic in the Component:
\\\	ypescript
export function WorldEditorModal() {
  const model = useWorldEditorModel();
  
  return <Layout ... onSave={model.save} />;
}
\\\

## Step 5: Verify
- Check that form inputs still update.
- Check that submission still triggers API.
