# Build Strategy - Type Safety Without Blocking

## Current Setup

### Build Commands

1. **`npm run build`** (Default - Fast, No Type Checking)
   - Runs: `vite build`
   - **Purpose**: Production builds that work immediately
   - **Type Checking**: None (Vite handles compilation)
   - **Use Case**: Deployments, local testing
   - **Status**: ✅ Works with current codebase

2. **`npm run build:type-check`** (Strict - For CI/Validation)
   - Runs: `tsc --project tsconfig.build.json --noEmit && vite build`
   - **Purpose**: Validate types before building
   - **Type Checking**: Strict (all errors must be fixed)
   - **Use Case**: CI pipelines, pre-commit validation
   - **Status**: Will fail until errors are fixed

3. **`npm run type-check`** (Validation Only)
   - Runs: `tsc --noEmit --project tsconfig.build.json`
   - **Purpose**: Check types without building
   - **Use Case**: Quick validation, IDE integration

4. **`npm run type-check:dev`** (Lenient Validation)
   - Runs: `tsc --noEmit --project tsconfig.app.json`
   - **Purpose**: Check types with lenient settings
   - **Use Case**: Development validation

## Why This Approach?

### Problem
- 577 TypeScript errors blocking builds
- Dev environment works fine
- Need to deploy without fixing all errors immediately

### Solution
- **Default build** skips type checking (Vite still compiles)
- **Strict build** available for CI/validation
- **Incremental fixes** can happen over time
- **No breaking changes** to dev workflow

## Workflow

### Development
```bash
npm run dev  # Works as before, shows type errors but doesn't block
```

### Local Build Testing
```bash
npm run build  # Fast build, no type checking
```

### CI/Pre-commit (When Ready)
```bash
npm run build:type-check  # Strict type checking + build
```

### Type Validation
```bash
npm run type-check  # Check types without building
```

## Migration Path

### Phase 1: Current (Now)
- ✅ Build works without type checking
- ✅ Dev environment unchanged
- ✅ Can deploy immediately

### Phase 2: Incremental Fixes (Next 2-4 Weeks)
- Fix unused variables/imports
- Add type annotations incrementally
- Use type utilities for API/Supabase

### Phase 3: Enable Strict Build (When Ready)
- Switch CI to use `build:type-check`
- Gradually fix remaining errors
- Eventually make strict build the default

## Benefits

1. **No Blocking**: Can deploy immediately
2. **Type Safety Available**: Strict checking when needed
3. **Incremental**: Fix errors gradually
4. **CI Ready**: Can enable strict checking in CI when ready
5. **Dev Unchanged**: Development workflow unaffected

## Notes

- Vite still compiles TypeScript (just doesn't fail on errors)
- Type errors are still shown in IDE
- Runtime behavior unchanged
- Can enable strict checking in CI when ready
