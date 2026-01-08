# Quick Fix Guide for Common TypeScript Errors

## Unused Variables/Imports (TS6133)

### Fix: Prefix with underscore
```typescript
// Before
const unused = getValue();

// After
const _unused = getValue();
```

### Or remove if truly unused
```typescript
// Remove the import/variable entirely
```

## Type-Only Imports (TS1484)

### Fix: Use `import type`
```typescript
// Before
import { ReactNode } from 'react';

// After
import type { ReactNode } from 'react';
```

## API Response Type Errors (TS2339)

### Fix: Use type guards
```typescript
// Before
const data = response.data;

// After
import { isApiSuccess, getApiData } from '@/lib/api-types';
const data = getApiData(response);
// or
if (isApiSuccess(response)) {
  const data = response.data; // TypeScript knows this is safe
}
```

## Supabase Type Errors (TS2769, TS2339)

### Fix: Use type assertions
```typescript
// Before
const { data } = await supabase.from('table').select('*');
// Error: Type 'never'

// After
import { assertSupabaseArray } from '@/lib/supabase-types';
const { data, error } = await supabase.from('table').select('*');
const items = assertSupabaseArray<MyType>({ data, error });
```

## Missing Type Annotations (TS7006)

### Fix: Add explicit types
```typescript
// Before
items.map(item => item.name);

// After
items.map((item: MyType) => item.name);
```

## Badge Size Prop (TS2322)

### Fix: Remove invalid prop
```typescript
// Before
<Badge size="sm">Label</Badge>

// After
<Badge>Label</Badge>
```

## React Query onSuccess (Deprecated)

### Fix: Use useEffect
```typescript
// Before
useMutation({
  mutationFn: doSomething,
  onSuccess: (data) => {
    // handle success
  }
});

// After
const mutation = useMutation({
  mutationFn: doSomething
});

useEffect(() => {
  if (mutation.isSuccess) {
    // handle success
  }
}, [mutation.isSuccess]);
```

## Quick Commands

```bash
# Auto-fix linting issues
npm run lint:fix

# Type check (won't block dev)
npm run type-check

# Build with strict types (for CI)
npm run build

# Build with lenient types (for local testing)
npm run build:dev
```
