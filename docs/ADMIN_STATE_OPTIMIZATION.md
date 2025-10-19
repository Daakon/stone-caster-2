# Admin State Optimization

## Problem

The Core Contracts admin page was making redundant API calls:
- **7 calls to `user_profiles`** - AdminLayout was fetching user role on every mount, and AwfAdminService was fetching it on every API request
- **2 calls to `core-contracts`** - The page was making duplicate API calls due to React re-renders

## Solution

Created a centralized admin state store using Zustand to manage:
1. **User role caching** - Fetch once, use everywhere
2. **Core contracts caching** - Cache with 5-minute TTL
3. **Loading states** - Centralized loading and error states
4. **Cache invalidation** - Clear cache when needed

## Changes Made

### 1. Created Admin Store (`frontend/src/stores/adminStore.ts`)

```typescript
interface AdminState {
  // User role state
  userRole: string | null;
  roleLoading: boolean;
  roleError: string | null;
  
  // Core contracts state
  coreContracts: any[];
  contractsLoading: boolean;
  contractsError: string | null;
  contractsLastFetched: number | null;
  
  // Actions
  fetchUserRole: (userId: string) => Promise<void>;
  getCachedUserRole: () => string | null;
  fetchCoreContracts: () => Promise<void>;
  getCachedCoreContracts: () => any[];
  clearCache: () => void;
}
```

**Key Features:**
- **Role caching**: Only fetch user role once per session
- **Contract caching**: 5-minute cache duration for core contracts
- **Error handling**: Centralized error states
- **Cache management**: Clear cache functionality

### 2. Updated AdminLayout (`frontend/src/components/layout/AdminLayout.tsx`)

**Before:**
```typescript
// Made direct API call on every mount
const { data, error } = await supabase
  .from('user_profiles')
  .select('role')
  .eq('auth_user_id', user.id)
  .single();
```

**After:**
```typescript
// Check cache first, only fetch if needed
const cachedRole = getCachedUserRole();
if (cachedRole) {
  // Use cached role
  return;
}
await fetchUserRole(user.id);
```

### 3. Updated AwfAdminService (`frontend/src/services/awfAdminService.ts`)

**Before:**
```typescript
// Made API call on every request
const { data, error } = await supabase
  .from('user_profiles')
  .select('role')
  .eq('auth_user_id', session.user.id)
  .single();
```

**After:**
```typescript
// Use cached role from store
const { getCachedUserRole } = useAdminStore.getState();
const role = getCachedUserRole();
```

### 4. Updated Core Contracts Page (`frontend/src/pages/admin/AwfCoreContractsAdmin.tsx`)

**Before:**
```typescript
// Local state management
const [contracts, setContracts] = useState<AwfCoreContract[]>([]);
const [loading, setLoading] = useState(true);

// Direct API call
const response = await awfAdminService.getCoreContracts();
```

**After:**
```typescript
// Use centralized store
const { 
  fetchCoreContracts, 
  getCachedCoreContracts, 
  coreContracts, 
  contractsLoading, 
  contractsError 
} = useAdminStore();

// Check cache first
const cachedContracts = getCachedCoreContracts();
if (cachedContracts.length > 0) {
  return; // Use cached data
}
await fetchCoreContracts();
```

## Performance Improvements

### Before Optimization
- **7 API calls** to `user_profiles` on page load
- **2 API calls** to `core-contracts` on page load
- **Total: 9 redundant API calls**

### After Optimization
- **1 API call** to `user_profiles` (cached for session)
- **1 API call** to `core-contracts` (cached for 5 minutes)
- **Total: 2 API calls** (78% reduction)

## Benefits

1. **Reduced API calls**: 78% reduction in redundant requests
2. **Better UX**: Faster page loads, less loading states
3. **Centralized state**: Single source of truth for admin data
4. **Cache management**: Intelligent caching with TTL
5. **Error handling**: Consistent error states across components
6. **Type safety**: Full TypeScript support

## Testing

Added comprehensive tests in `frontend/src/stores/__tests__/adminStore.test.ts`:
- State initialization
- Role caching
- Error handling
- Cache clearing

## Usage

```typescript
// In any component
const { 
  fetchUserRole, 
  getCachedUserRole, 
  coreContracts, 
  contractsLoading 
} = useAdminStore();

// Check cached role
const role = getCachedUserRole();

// Fetch fresh data if needed
await fetchCoreContracts();
```

## Future Enhancements

1. **Persistent cache**: Store cache in localStorage
2. **Background refresh**: Refresh cache in background
3. **Optimistic updates**: Update UI before API calls complete
4. **Real-time updates**: WebSocket integration for live updates
