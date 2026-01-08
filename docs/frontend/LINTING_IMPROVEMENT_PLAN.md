# Linting & Type Safety Improvement Plan

## Goal
Improve code quality and type safety incrementally without breaking the dev environment.

## Current State
- **Build errors**: ~575 TypeScript errors
- **Dev environment**: Working (Vite dev server runs)
- **Build**: Failing due to strict type checking

## Strategy: Incremental, Non-Breaking Approach

### Phase 1: Non-Breaking Fixes (Week 1)
**Goal**: Fix issues that don't affect runtime behavior

#### 1.1 Unused Variables/Imports (TS6133)
- **Impact**: None (warnings only)
- **Approach**: 
  - Configure ESLint to auto-fix on save
  - Add script to bulk-fix: `npm run lint -- --fix`
  - Prefix intentionally unused vars with `_` (e.g., `_unusedParam`)

#### 1.2 Type-Only Imports (TS1484)
- **Impact**: None (build-time only)
- **Status**: ✅ Already fixed for common cases
- **Action**: Continue fixing remaining files incrementally

#### 1.3 React Query `onSuccess` Deprecation
- **Impact**: None (React Query v5 handles this)
- **Status**: ✅ Already fixed
- **Action**: Monitor for any remaining instances

### Phase 2: Type Safety Improvements (Week 2-3)
**Goal**: Add type safety without breaking functionality

#### 2.1 Add Type Assertions for Supabase (Temporary)
```typescript
// Before (causes TS2769 error)
const { data } = await supabase.from('table').select('*');

// After (safe type assertion)
const { data } = await supabase.from('table').select('*') as { data: MyType[] | null };
```

**Action**: Create utility type helpers:
```typescript
// frontend/src/lib/supabase-types.ts
export function assertSupabaseData<T>(result: { data: T | null }): T {
  if (!result.data) throw new Error('No data returned');
  return result.data;
}
```

#### 2.2 Add Missing Type Annotations
- **Impact**: Better IDE support, catch bugs earlier
- **Approach**: 
  - Start with function parameters (TS7006)
  - Use `any` temporarily where types are complex
  - Gradually replace `any` with proper types

#### 2.3 Fix API Response Type Guards
- **Status**: ✅ Partially fixed
- **Action**: Create reusable type guard utilities:
```typescript
// frontend/src/lib/api-types.ts
export function isApiSuccess<T>(response: ApiResponse<T>): response is { ok: true; data: T } {
  return 'ok' in response && response.ok === true;
}
```

### Phase 3: Configuration Adjustments (Week 4)
**Goal**: Make TypeScript more lenient for dev, strict for build

#### 3.1 Separate Dev/Build Configs
```json
// tsconfig.dev.json (for dev server)
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitAny": false
  }
}

// tsconfig.build.json (for production build)
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitAny": true
  }
}
```

#### 3.2 Update Vite Config
```typescript
// vite.config.ts
export default defineConfig({
  // Use lenient config for dev
  esbuild: {
    // Don't fail on type errors in dev
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
});
```

#### 3.3 Update Package Scripts
```json
{
  "scripts": {
    "dev": "vite --mode development",
    "build": "tsc -p tsconfig.build.json && vite build",
    "type-check": "tsc --noEmit -p tsconfig.build.json",
    "type-check:dev": "tsc --noEmit -p tsconfig.dev.json"
  }
}
```

### Phase 4: Long-Term Improvements (Ongoing)
**Goal**: Gradually improve type safety

#### 4.1 Supabase Type Generation
```bash
# Generate types from database
npx supabase gen types typescript --project-id <project-id> > frontend/src/types/supabase.ts
```

#### 4.2 Add Cloudflare Workers Types
```bash
npm install --save-dev @cloudflare/workers-types
```

#### 4.3 Incremental Strict Mode
Enable one strict option at a time:
1. `strictNullChecks` (safest)
2. `strictFunctionTypes`
3. `strictPropertyInitialization`
4. `noImplicitAny` (last)

## Implementation Priority

### Immediate (This Week)
1. ✅ Fix type-only imports
2. ✅ Fix React Query deprecations
3. ✅ Fix API response type guards
4. ⏳ Configure ESLint auto-fix
5. ⏳ Add type assertion utilities

### Short-Term (Next 2 Weeks)
1. Add missing type annotations incrementally
2. Create Supabase type helpers
3. Fix Badge/component prop issues
4. Add Cloudflare Workers types

### Medium-Term (Next Month)
1. Generate Supabase types
2. Separate dev/build TypeScript configs
3. Enable incremental strict mode options
4. Fix admin component type mismatches

### Long-Term (Ongoing)
1. Replace all `any` types
2. Enable full strict mode
3. Add comprehensive type tests
4. Document type patterns

## Risk Mitigation

### For Dev Environment
- **Never break**: Keep `tsconfig.app.json` lenient for dev
- **Warn, don't fail**: Use ESLint warnings instead of errors
- **Incremental**: Fix files as you touch them

### For Build
- **Separate config**: Use strict config only for builds
- **Type assertions**: Use safe assertions where types are complex
- **Gradual**: Enable strict options one at a time

## Tools & Scripts

### Auto-Fix Scripts
```json
{
  "scripts": {
    "lint:fix": "eslint . --fix",
    "type-check:fix": "tsc --noEmit --incremental false",
    "clean:types": "rm -rf frontend/.tsbuildinfo"
  }
}
```

### Pre-Commit Hooks
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

## Success Metrics
- [ ] Dev server starts without type errors
- [ ] Build succeeds with < 100 errors (down from 575)
- [ ] Zero runtime errors from type issues
- [ ] Improved IDE autocomplete and error detection
- [ ] Team can work without type-checking blocking them

## Notes
- **Never sacrifice dev experience** for type safety
- **Incremental is better than perfect**
- **Type assertions are OK** as temporary solutions
- **Focus on new code** being type-safe, legacy can wait
