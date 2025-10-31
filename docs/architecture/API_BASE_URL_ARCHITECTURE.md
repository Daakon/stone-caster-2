# API Base URL Architecture

## Overview

All API calls in the Stone Caster application must go through **one of two URLs**:

- **Development**: `http://localhost:3000`
- **Production**: `https://api.stonecaster.ai`

## Single Source of Truth

### Primary Definition

📍 **`frontend/src/lib/apiBase.ts`** - Single source of truth for API base URL

```typescript
export const API_BASE = (
  import.meta.env.VITE_API_BASE ?? 
  (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://api.stonecaster.ai')
).replace(/\/+$/, "");
```

### Environment Variable

Set `VITE_API_BASE` in `.env` to override:
```bash
# Development
VITE_API_BASE=http://localhost:3000

# Production
VITE_API_BASE=https://api.stonecaster.ai
```

---

## API Call Flow

### 1. Standard API Calls ✅

**All catalog, characters, sessions, games, etc.**

```
Frontend → API_BASE → Backend API → Supabase (server-side)
```

- ✅ `GET /api/catalog/worlds` → `http://localhost:3000/api/catalog/worlds`
- ✅ `GET /api/characters` → `http://localhost:3000/api/characters`
- ✅ `POST /api/sessions` → `http://localhost:3000/api/sessions`
- ✅ `POST /api/games/:id/turn` → `http://localhost:3000/api/games/:id/turn`

**Files using API_BASE**:
- `lib/api.ts` - All apiFetch, apiGet, apiPost, etc.
- `lib/http.ts` - Catalog-specific HTTP methods
- `services/adminService.ts` - Admin panel API calls
- `services/awfAdminService.ts` - AWF marketplace API calls
- `pages/AuthSuccessPage.tsx` - Guest account linking
- `utils/testAdminApi.ts` - API connectivity tests

---

### 2. Supabase Auth (OAuth Flows Only) ⚠️

**OAuth redirects to Supabase auth servers**

```
Frontend → Supabase Auth → OAuth Provider (Google/GitHub/Discord) → Supabase → Frontend
```

The Supabase client (`lib/supabase.ts`) is **only used for**:
- OAuth flows (Google, GitHub, Discord sign-in)
- `getSession()` - **Local-only**, reads from localStorage, no network call

**Not used for**:
- ❌ Direct database queries (use API endpoints)
- ❌ User data fetching (use API endpoints)
- ❌ Session creation (OAuth handles this)

**Why Supabase URL is still present**:
OAuth flows require redirecting to Supabase's authorization servers. After auth, the session token is stored in localStorage and attached to all API requests via `Authorization: Bearer <token>`.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  lib/apiBase.ts (Single Source of Truth)             │  │
│  │  API_BASE = localhost:3000 | api.stonecaster.ai     │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ▲                                  │
│                           │                                  │
│  ┌────────────────────────┴──────────────────────────────┐ │
│  │  All API Calls Use API_BASE                           │ │
│  │  • lib/api.ts (apiFetch, apiGet, apiPost...)         │ │
│  │  • lib/http.ts (catalog HTTP methods)                 │ │
│  │  • services/adminService.ts                           │ │
│  │  • services/awfAdminService.ts                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  lib/supabase.ts (OAuth Only)                         │ │
│  │  • OAuth flows: Google, GitHub, Discord               │ │
│  │  • getSession(): Local read from localStorage         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ All API Requests
                          ▼
        ┌─────────────────────────────────────┐
        │  Backend API                        │
        │  localhost:3000 | api.stonecaster.ai│
        │  ┌────────────────────────────────┐ │
        │  │  Routes:                       │ │
        │  │  • /api/catalog/*              │ │
        │  │  • /api/characters             │ │
        │  │  • /api/sessions               │ │
        │  │  • /api/games                  │ │
        │  │  • /api/auth/* (proxies)       │ │
        │  │  • /api/admin/*                │ │
        │  └────────────────────────────────┘ │
        └─────────────────────────────────────┘
                          │
                          │ Database Queries
                          ▼
              ┌──────────────────────┐
              │  Supabase Database   │
              │  (Server-side only)  │
              └──────────────────────┘
```

---

## Migration Guide

### Before (Multiple Definitions ❌)

```typescript
// lib/api.ts
const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// lib/supabase.ts
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

// services/adminService.ts
const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
```

### After (Single Source ✅)

```typescript
// lib/apiBase.ts (SINGLE SOURCE OF TRUTH)
export const API_BASE = (
  import.meta.env.VITE_API_BASE ?? 
  (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://api.stonecaster.ai')
).replace(/\/+$/, "");

// All other files import from apiBase.ts
import { API_BASE } from './lib/apiBase';
```

---

## Key Benefits

✅ **Single Source of Truth** - Only one place to define API base URL

✅ **No Direct Supabase Calls** - All data flows through our API

✅ **Environment-aware** - Automatically uses localhost in dev, api.stonecaster.ai in prod

✅ **OAuth Support** - Supabase client still available for OAuth flows

✅ **Easy Testing** - Override via `VITE_API_BASE` environment variable

---

## Troubleshooting

### Issue: API calls hitting wrong URL

**Check**:
1. Verify `VITE_API_BASE` in `.env`
2. Restart Vite dev server after changing `.env`
3. Check browser console for actual URL being called

### Issue: Auth not working

**Check**:
1. Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
2. OAuth flows require Supabase URL for redirects
3. Session token should be in localStorage after OAuth

### Issue: 404 on API endpoints

**Check**:
1. Backend is running on correct port (3000 in dev)
2. API endpoint exists in backend routes
3. No typos in endpoint paths (e.g., `/api/characters` not `/me/characters`)

---

## Files Modified

### Core Architecture
- ✅ `frontend/src/lib/apiBase.ts` - Single source of truth (exported API_BASE)
- ✅ `frontend/src/lib/api.ts` - Imports API_BASE
- ✅ `frontend/src/lib/supabase.ts` - Imports API_BASE, documented OAuth-only usage

### Services
- ✅ `frontend/src/services/adminService.ts` - Uses API_BASE
- ✅ `frontend/src/services/awfAdminService.ts` - Uses API_BASE
- ✅ `frontend/src/services/cloudSyncClient.ts` - Uses API_BASE pattern

### Pages
- ✅ `frontend/src/pages/AuthSuccessPage.tsx` - Uses API_BASE for guest linking

### Utils
- ✅ `frontend/src/utils/testAdminApi.ts` - Uses API_BASE for tests

---

## Testing Checklist

Before deploying changes:

- [ ] Dev environment: Verify API calls go to `http://localhost:3000`
- [ ] Prod environment: Verify API calls go to `https://api.stonecaster.ai`
- [ ] OAuth flows: Verify Google/GitHub/Discord sign-in works
- [ ] Session persistence: Verify session token in localStorage
- [ ] Guest flows: Verify guest cookie and linking works
- [ ] Admin panel: Verify admin API calls work
- [ ] Catalog: Verify worlds, stories, NPCs load correctly
- [ ] Characters: Verify character creation and listing works
- [ ] Sessions: Verify session creation and game turns work

---

**Last Updated**: January 31, 2025
**Status**: ✅ Active - All files consolidated

